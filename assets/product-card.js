if (!window.Maximize.loadedScript.includes("product-card.js")) {
  window.Maximize.loadedScript.push("product-card.js");

  /**
   * Shared helper — syncs swatch label styles and input state from a parsed
   * response document back into the live card wrapper.
   * @param {Document} dataHTML
   * @param {Element}  rootEl
   */
  function syncSwatchOptionStyles(dataHTML, rootEl) {
    rootEl.querySelectorAll(".swatch-option__label").forEach((label) => {
      const sourceLabel = dataHTML.querySelector(
        `.swatch-option__label[data-position="${label.dataset.position}"]`
      );
      if (!sourceLabel) return;

      if (sourceLabel.hasAttribute("style")) {
        label.setAttribute("style", sourceLabel.getAttribute("style"));
      }

      const input = label.previousElementSibling;
      const newInput = sourceLabel.previousElementSibling;
      if (input && newInput) {
        input.classList.toggle("disabled", newInput.classList.contains("disabled"));
        input.classList.toggle("selected", newInput.classList.contains("selected"));
        input.checked = newInput.classList.contains("selected");
      }
    });
  }

  /**
   * Reads a variant JSON blob, returning null when there is no variant to read — a missing
   * element, an empty body, or a literal `null` all mean "this option combination does not
   * exist". Callers must not keep the previously selected variant in that case: downstream
   * (the quantity selector's swatchChange listener) treats a variant as proof of a usable
   * quantity rule.
   * @param {Element|null} el
   * @returns {object|null}
   */
  function parseVariantInfo(el) {
    const raw = el && el.textContent ? el.textContent.trim() : "";
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // ProductCardSwatchOption
  // ---------------------------------------------------------------------------
  class ProductCardSwatchOption extends HTMLElement {
    static cacheData = {};

    constructor() {
      super();
      this.productCardWrapperEle = this.closest(".product-card__wrapper");
      this.productId = this.dataset.productId;
      this.sectionId = this.dataset.sectionId;
      this.optionId = this.dataset.optionId;
      this.productCardId = this.dataset.productCardId;
      this.productUrl = this.dataset.productUrl;
      this.effectImage = this.dataset.effectImage;
      this.isShowEDT = this.dataset.showEdt === "true";
      this.optionsSelectedValues = [];

      this.optionValueInputElements = Array.from(this.querySelectorAll(".variant-option__input"));
      this.optionLabelElements = Array.from(this.querySelectorAll(".swatch-option__label"));
      this.currentVariantEl = this.productCardWrapperEle.querySelector(".current-variant");
      this.currentVariant = parseVariantInfo(this.currentVariantEl);

      this.optionValueInputElements
        .filter((el) => el.classList.contains("selected"))
        .forEach((input) => {
          this.optionsSelectedValues[input.dataset.optionPosition - 1] = input.dataset.optionValueId;
        });
    }

    connectedCallback() {
      const handleClick = this.handleClickOptionLabel.bind(this);
      this.optionLabelElements.forEach((el) => {
        el.addEventListener("click", handleClick);
        el.addEventListener("keyup", (e) => {
          if (e.key === "Enter" || e.key === " ") handleClick(e);
        });
      });
    }

    handleClickOptionLabel(event) {
      event.preventDefault();
      const optionLabel = event.currentTarget;
      const option = optionLabel.previousElementSibling;
      const position = option.dataset.optionPosition;
      const idx = position - 1;

      this.optionValueInputElements
        .filter((el) => el.dataset.optionPosition === position)
        .forEach((el) => {
          const isTarget = el.dataset.optionValueId === option.dataset.optionValueId;
          el.checked = isTarget;
          el.classList.toggle("selected", isTarget);
          if (isTarget) this.optionsSelectedValues[idx] = el.dataset.optionValueId;
        });

      this.reRenderProductSwatches();
    }

    async reRenderProductSwatches() {
      const infoWrapper = this.closest(".product-card__info-wrapper");
      const buyButton = infoWrapper?.querySelector(".product-form__btn-add-to-cart");
      if (buyButton) buyButton.disabled = true;

      const selectedValues = this.optionsSelectedValues.filter(Boolean);
      this.productCardWrapperEle.dataset.listOptionValuesIdSelected = selectedValues.join(",");

      const url = `${this.productUrl}?option_values=${selectedValues.join(",")}&section_id=product-swatch`;
      let dataHTML = ProductCardSwatchOption.cacheData[url];

      if (!dataHTML) {
        try {
          const response = await fetch(url);
          const text = await response.text();
          dataHTML = new DOMParser().parseFromString(text, "text/html");
          ProductCardSwatchOption.cacheData[url] = dataHTML;
        } catch (error) {
          console.error(error);
          if (buyButton && !buyButton.ariaDisabled) buyButton.disabled = false;
          return;
        }
      }

      const root = this.productCardWrapperEle;

      // Update current variant info. An option combination that does not exist has no
      // variant to report, and a stale one here made the quantity selector keep the previous
      // variant's rule (see the swatchChange listener in theme.js) — so fall back to null
      // rather than leaving the old value in place.
      const newVariantInfoEl = dataHTML.querySelector(".current-variant");
      this.currentVariant = parseVariantInfo(newVariantInfoEl);
      if (newVariantInfoEl && this.currentVariantEl) {
        this.currentVariantEl.textContent = newVariantInfoEl.textContent;
      }
      // Update current variant pre-order info
      this.updateElements(root, dataHTML, '[type="application/json"][data-type="current-variant-additional-info"]');
      this.updateElements(root, dataHTML, '.product-card__properties-group');

      // Update current bundle item data
      this.updateElements(root, dataHTML, '[type="application/json"][data-type="current-bundle-item"]');

      // Same reason as the choose-option path below: the card's quantity box survives the swatch
      // change, so its quantity-rule tooltip has to be re-synced or it keeps describing the variant
      // rendered on first paint.
      this.updateElements(root, dataHTML, '.quantity-rule-tooltip-anchor');

      if (this.isShowEDT) {
        this.updateElements(root, dataHTML, ".estimate-delivery-card-msg");
      }
      this.updateLabelData(root, dataHTML);
      if (this.currentVariant) syncSwatchOptionStyles(dataHTML, root);
      this.updateImage(dataHTML);
      this.dispatchVariantChangeEvent();

      if (buyButton && !buyButton.ariaDisabled) buyButton.disabled = false;
    }

    dispatchVariantChangeEvent() {
      const productCardId = this.productCardWrapperEle.id?.replace("ProductCard_", "") ?? "";
      document.dispatchEvent(
        new CustomEvent(`${PRODUCT_EVENT.swatchChange}${productCardId}`, {
          bubbles: true,
          detail: { productId: this.productId, currentVariant: this.currentVariant },
        })
      );
    }

    updateLabelData(rootEl, dataHTML) {
      const metafieldDataset = dataHTML.querySelector("#product-swatch")?.dataset.metafieldLabel;
      if (!metafieldDataset) return;

      const linkVariantEle = rootEl.querySelector(".link-product-variant");
      if (!linkVariantEle) return;

      const linkLabelsData = linkVariantEle.getAttribute("x-labels-data");
      if (!linkLabelsData) return;

      const metafieldDataObj = xParseJSON(metafieldDataset);
      const currentLabelData = xParseJSON(linkLabelsData);
      currentLabelData.metafield_label = metafieldDataObj.metafield_label;

      linkVariantEle.setAttribute("x-labels-data", JSON.stringify(currentLabelData));
      Alpine.store("xLabelsAndBadges")?.load(linkVariantEle);
    }

    updateElements(rootEl, dataHTML, selector) {
      const oldElements = rootEl.querySelectorAll(selector);
      const newElements = dataHTML.querySelectorAll(selector);
      const single = newElements.length === 1;

      oldElements.forEach((oldEl, i) => {
        const newEl = single ? newElements[0] : newElements[i];
        if (oldEl && newEl) oldEl.innerHTML = newEl.innerHTML;
      });
    }

    updateImage(dataHTML) {
      const root = this.productCardWrapperEle;
      const activeSlide = root.querySelector(".slide-item.is-active");
      const newImg = dataHTML.querySelector(".product-card__image");
      const newMediaId = newImg?.dataset.mediaId ?? null;

      if (this.effectImage === "carousel") {
        const target = root.querySelector(`.slide-item[data-media-id="${newMediaId}"]`);
        if (activeSlide && target) {
          activeSlide.classList.remove("is-active");
          target.classList.add("is-active");
          return;
        }
      }

      const img = activeSlide?.querySelector(".product-card__image");
      if (img && newImg) {
        img.setAttribute("srcset", newImg.getAttribute("srcset"));
        img.setAttribute("src", newImg.getAttribute("src"));
        if (activeSlide && this.effectImage === "carousel") {
          activeSlide.dataset.mediaId = newMediaId;
        }
      }
    }
  }

  if (!customElements.get("product-card-swatch-option")) {
    customElements.define("product-card-swatch-option", ProductCardSwatchOption);
  }

  class ChooseOptionElement extends HTMLElement {
    static cacheData = {};

    constructor() {
      super();
      this.productCardWrapperEle = this.closest("[data-show-b2b-price-label]");
      this.optionInputElements = Array.from(this.querySelectorAll(".swatch-option__value"));
      this.optionLabelElements = Array.from(this.querySelectorAll(".swatch-option__label"));
      this.optionsSelectedValues = [];
      this.productId = this.dataset.productId;
      this.productUrl = this.dataset.productUrl;
      this.chooseOptionElementId = this.dataset.chooseOptionElementId;
      if(this.productCardWrapperEle ) {
        this.showB2BPriceLabel = this.productCardWrapperEle.dataset.showB2bPriceLabel;
      }
      this.optionInputElements
        .filter((el) => el.classList.contains("selected"))
        .forEach((input) => {
          this.optionsSelectedValues[input.dataset.optionPosition - 1] = input.dataset.optionValueId;
        });

      this.currentVariantInfoEle = this.querySelector(
        '[type="application/json"][data-type="current-variant-info"]'
      );
      this.currentVariantAdditionalInfoEle = this.querySelector(
        '[type="application/json"][data-type="current-variant-additional-info"]'
      );
      this.currentVariant = parseVariantInfo(this.currentVariantInfoEle);
    }

    connectedCallback() {
      const handleClick = this.handleClickOptionLabel.bind(this);
      this.optionLabelElements.forEach((el) => {
        el.addEventListener("click", handleClick);
        el.addEventListener("keyup", (e) => {
          if (e.key === "Enter" || e.key === " ") handleClick(e);
        });
      });
    }

    handleClickOptionLabel(event) {
      event.preventDefault();
      const optionLabel = event.currentTarget;
      const option = optionLabel.previousElementSibling;
      const position = option.dataset.optionPosition;
      const idx = position - 1;

      const selectedValue = this.querySelector(`.seclected-value-${position}`);
      if (selectedValue) selectedValue.textContent = option.dataset.value;

      this.optionInputElements.filter((el) => el.dataset.optionPosition === position)
        .forEach((el) => {
          const isTarget = el.dataset.optionValueId === option.dataset.optionValueId;
          el.checked = isTarget;
          el.classList.toggle("selected", isTarget);
          if (isTarget) this.optionsSelectedValues[idx] = el.dataset.optionValueId;
        });
      const targetProductUrl = option.dataset.productUrl;
      this._pendingCombinedListingUrl =
        targetProductUrl && targetProductUrl !== this.productUrl.split("?")[0]
          ? targetProductUrl
          : null;
      this.reRenderChooseOption();
    }

    async reRenderChooseOption() {
      const variantPickerEle = this.closest(".variant-picker__wrapper");
      const indexParam = variantPickerEle?.dataset?.indexParam;
      const chooseOptionWrapper = this.closest(".choose-option");
      const buyButton = chooseOptionWrapper?.querySelector(".product-form__btn-add-to-cart");
      if (buyButton) buyButton.disabled = true;
      if (this._pendingCombinedListingUrl) {
        const childUrl = this._pendingCombinedListingUrl;
        this._pendingCombinedListingUrl = null;
        await this.__fetchAndReplaceChooseOption(childUrl, indexParam, chooseOptionWrapper);
        this.handleB2BPriceLabel();
        return;
      }

      const url = `${this.productUrl}?option_values=${this.optionsSelectedValues.join(",")}&section_id=choose-option&page=${indexParam}`;
      let dataHTML = ChooseOptionElement.cacheData[url];

      if (!dataHTML) {
        try {
          const response = await fetch(url);
          const text = await response.text();
          dataHTML = new DOMParser().parseFromString(text, "text/html");
          ChooseOptionElement.cacheData[url] = dataHTML;
        } catch (error) {
          console.error(error);
          if (buyButton && !buyButton.ariaDisabled) buyButton.disabled = false;
          return;
        }
      }

      this.updateElements(chooseOptionWrapper, dataHTML, ".choose-option__price-wrapper");
      this.updateElements(chooseOptionWrapper, dataHTML, ".choose-options-content .choose-option__properties-group");
      this.updateElements(chooseOptionWrapper, dataHTML, ".choose-option__quantity_wrapper");
      // The quantity box itself is not re-rendered, so its quantity-rule tooltip would keep
      // describing the variant that happened to be selected on first paint. On a product where only
      // SOME variants carry volume pricing that means the tooltip never appears for the ones that
      // do. The anchor element is always present (empty when the variant has no rule), so syncing
      // its contents is enough — the injected <custom-tooltip> upgrades on insertion.
      this.updateElements(chooseOptionWrapper, dataHTML, ".quantity-rule-tooltip-anchor");
      this.handleB2BPriceLabel();

      // Same reasoning as the card above: an unavailable combination must clear the variant,
      // not keep the previous one, or the choose-option quantity box holds a stale rule.
      const newVariantInfoEl = dataHTML.querySelector(
        '[type="application/json"][data-type="current-variant-info"]'
      );
      this.currentVariant = parseVariantInfo(newVariantInfoEl);
      if (newVariantInfoEl && this.currentVariantInfoEle) {
        this.currentVariantInfoEle.textContent = newVariantInfoEl.textContent;
      }

      const newAdditionalInfoEl = dataHTML.querySelector(
        '[type="application/json"][data-type="current-variant-additional-info"]'
      );
      if (this.currentVariantAdditionalInfoEle && newAdditionalInfoEl) {
        this.currentVariantAdditionalInfoEle.textContent = newAdditionalInfoEl.textContent;
      }

      syncSwatchOptionStyles(dataHTML, chooseOptionWrapper);

      if (buyButton) {
        buyButton.classList.add('is-variant-changing');

        if (!buyButton.ariaDisabled) {
          buyButton.disabled = false;
        }

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            buyButton.classList.remove('is-variant-changing');
          });
        });
      }

      syncSwatchOptionStyles(dataHTML, chooseOptionWrapper);
      if (buyButton && !buyButton.ariaDisabled) buyButton.disabled = false;
      this.dispatchChangeVariantEvent();
    }
    async __fetchAndReplaceChooseOption(childProductUrl, indexParam, chooseOptionWrapper) {
      const url = `${childProductUrl}?option_values=${this.optionsSelectedValues.join(",")}&section_id=choose-option&page=${indexParam}`;
      try {
        const response = await fetch(url);
        const text = await response.text();
        let dataHTML = new DOMParser().parseFromString(text, "text/html");
        const newContent = dataHTML.querySelector("#ChooseOptionContent .choose-option__wrapper");
        const liveContent = this.closest(".choose-option__wrapper");
        if (!newContent || !liveContent) return;

        const freshContent = document.adoptNode(newContent);
        liveContent.replaceWith(freshContent);

        // if (window.Alpine) {
        //   Alpine.initTree(freshContent);
        // }
      } catch (error) {
        console.error("[ChooseOption] fetch error:", error);
        const buyButton = chooseOptionWrapper?.querySelector(".product-form__btn-add-to-cart");
        if (buyButton && !buyButton.ariaDisabled) buyButton.disabled = false;
        return;
      }
    }

    updateElements(rootEl, dataHTML, selector) {
      const oldEl = rootEl.querySelector(selector);
      const newEl = dataHTML.querySelector(selector);
      if (oldEl && newEl) oldEl.innerHTML = newEl.innerHTML;
    }

    dispatchChangeVariantEvent() {
      document.dispatchEvent(
        new CustomEvent(`${PRODUCT_EVENT.swatchChange}${this.chooseOptionElementId}`, {
          bubbles: true,
          detail: { productId: this.productId, currentVariant: this.currentVariant },
        })
      );
    }

    handleB2BPriceLabel = () => {
      if (this.showB2BPriceLabel === 'false') {
        const b2bPriceLabels = this.productCardWrapperEle.querySelectorAll('.price-b2b-label');
        if (b2bPriceLabels) {
          b2bPriceLabels.forEach(label => {
              label.classList.add('hidden');
            });
          }
        }
    };
  }

  if (!customElements.get("choose-option")) {
    customElements.define("choose-option", ChooseOptionElement);
  }
}
