if (!window.Maximize.loadedScript.includes("variant-picker.js")) {
  window.Maximize.loadedScript.push("variant-picker.js");

  class VariantPicker extends HTMLElement {
    static cacheData = {};
    constructor() {
      super();
      this.pickerType = this.dataset.pickerType || "swatch";
      this.productId = this.dataset.productId;
      this.sectionId = this.dataset.sectionId;
      this.originalProductUrl = this.dataset.url;
      this.isMainProduct = false;
      let sectionWrapper = this.closest(`.section--${this.sectionId}`);
      if (sectionWrapper) {
        this.isMainProduct = sectionWrapper.dataset.mainProduct === "true";
      }
      this.optionsSelectedValues = [];
      // Build quick-lookup refs (optionElements, optionLabelElements, _optionsByPosition).
      // Done once here; called again by __reInitVariantPickerAfterSiblingSwitch after innerHTML replace.
      this.__rebuildOptionRefs();
      // Bind the click handler once so every option element shares the same function object
      // instead of N separate .bind(this) allocations in connectedCallback / reinit.
      this._boundHandleChangedOption = this.handleChangedOption.bind(this);
      this.isEnableStickyATC = this.dataset.enableStickyAtc === "true";
      this.currentVariantInfoElement = document.querySelector(`#CurrentVariantInfo__${this.sectionId}`);
      this.additionalCurrentVariantInfoElement = document.querySelector(`#AdditionalVariantInfo__${this.sectionId}`);
      this.currentVariant = JSON.parse(this.currentVariantInfoElement.textContent);
      this.sectionWrapper = document.getElementById(`shopify-section-${this.sectionId}`);
      this.productDetailsElement = document.querySelector("product-details");
      if (this.productDetailsElement && this.isMainProduct) {
        this.productDetailSectionId = this.productDetailsElement.dataset.sectionId;
      }
      // Spec & tab sections self-update by listening to PRODUCT_EVENT.updatedProductSections
      // (see product-specifications.js / product-tabs.js); they are intentionally not fetched here.

      if (this.currentVariant) {
        this.isOptionExist = true;
        this.isOptionAvailable = this.currentVariant.available;
      } else {
        this.isOptionExist = false;
      }
      this.variantPickerAbortController = null;
    }

    connectedCallback() {
      this.optionElements.forEach((el) => {
        el.addEventListener("click", this._boundHandleChangedOption);
      });

      this.optionLabelElements.forEach((labelEl) => {
        labelEl.addEventListener("keyup", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            // The hidden input sits immediately before each label in the DOM.
            labelEl.previousElementSibling?.click();
          }
        });
      });

      if (Shopify.designMode) {
        window.addEventListener("shopify:section:load", (event) => {
          if (event.detail.sectionId == this.sectionId) {
            VariantPicker.cacheData = {};
          }
        });
      }

      this.updateOptionSelectedValues();

      if (this.isEnableStickyATC) {
        this.__initEventSticky();
      }
    }

    handleChangedOption(event) {
      const targetOption = event.currentTarget;
      const position = targetOption.dataset.optionPosition;

      // O(1) lookup via pre-grouped Map — avoids querySelectorAll on every click.
      const listOptionSamePosition = this._optionsByPosition.get(position) ?? [];
      listOptionSamePosition.forEach((optionEle) => {
        const isTarget = optionEle === targetOption;
        optionEle.classList.toggle("selected", isTarget);
        optionEle.setAttribute("aria-selected", String(isTarget));
      });

      const selectedOptionEle = this.querySelector(`.variant-option__selected-value[data-position='${position}']`);
      if (selectedOptionEle) {
        selectedOptionEle.innerHTML = targetOption.dataset.value;
      }

      this.optionsSelectedValues[Number(position) - 1] = targetOption.dataset.optionValueId;

      const targetOptionProductUrl = targetOption.dataset.productUrl;
      const isCombinedListingSwitch = !!targetOptionProductUrl && targetOptionProductUrl !== this.originalProductUrl.split("?")[0];

      if (this.isMainProduct) {
        if (isCombinedListingSwitch) {
          this._pendingProductUrl = targetOptionProductUrl;
          this._pendingSiblingProductUrl = null;
        } else {
          this._pendingProductUrl = null;
          this._pendingSiblingProductUrl = null;
        }
      } else {
        this._pendingProductUrl = null;
        this._pendingSiblingProductUrl = isCombinedListingSwitch ? targetOptionProductUrl : null;
      }

      this.__renderProductInfo();
    }

    updateOptionSelectedValues() {
      this.optionElements.forEach((optionEle) => {
        const optionPosition = optionEle.dataset.optionPosition;
        const idx = Number(optionPosition) - 1;
        if (optionEle.classList.contains("selected")) {
          this.optionsSelectedValues[idx] = optionEle.dataset.optionValueId;
        }
      });
    }

    // Build (or rebuild) the live element collections and the position→elements Map.
    // Called once from the constructor; called again after __reInitVariantPickerAfterSiblingSwitch
    // replaces this.innerHTML so refs point to the fresh nodes.
    __rebuildOptionRefs() {
      this.optionElements = this.querySelectorAll(".variant-option");
      this.optionLabelElements = Array.from(this.querySelectorAll(".variant-option__label"));
      // Pre-group by position so handleChangedOption can deselect siblings in O(1)
      // instead of running querySelectorAll on every click.
      this._optionsByPosition = new Map();
      this.optionElements.forEach((el) => {
        const pos = el.dataset.optionPosition;
        if (!this._optionsByPosition.has(pos)) this._optionsByPosition.set(pos, []);
        this._optionsByPosition.get(pos).push(el);
      });
    }

    async __renderProductInfo() {
      // ─── PATH A: Combine Listing on PDP ──────────────────────────────────────
      // User picked a different product → replace <main> wholesale.
      // `this` is detached by replaceWith; the fresh picker boots its own lifecycle.
      if (this._pendingProductUrl) {
        const url = this._pendingProductUrl;
        this._pendingProductUrl = null;
        await this.__fetchAndReplaceMain(url);
        return;
      }

      // ─── PATH B: Sibling switch OR regular variant change ─────────────────────
      const siblingProductUrl = this._pendingSiblingProductUrl || null;
      this._pendingSiblingProductUrl = null;

      const buyButtonList = this.__disableBuyButtons();

      const productResponseHTML = await this.__fetchSectionData(siblingProductUrl || this.originalProductUrl);
      if (!productResponseHTML) {
        this.__reEnableBuyButtons(buyButtonList);
        return;
      }

      const productInfoHTML = productResponseHTML[this.sectionId];
      const productDetailInfoHTML = productResponseHTML[this.productDetailSectionId];

      if (productDetailInfoHTML) {
        this.__updateProductDetailSpecifications(productDetailInfoHTML);
      }
      if (siblingProductUrl) {
        this.__syncSiblingProductMeta(siblingProductUrl, productInfoHTML);
      }
      if (this.isMainProduct) {
        document.dispatchEvent(new CustomEvent(`${PRODUCT_EVENT.updatedProductSections}${this.productId}`, { detail: { optionsSelectedValues: this.optionsSelectedValues, productUrl: this.originalProductUrl } }));
      }
      this.__updateBrowserState(productInfoHTML);
      this.__updateCurrentVariantInfo(productInfoHTML);

      if (this.currentVariant) {
        this.__patchAvailableContent(productInfoHTML);
      } else {
        this.__renderProductInfoWhenUnavailable();
      }

      if (siblingProductUrl) {
        [".product-template__wrapper", ".block-product-details", ".block-product-information"].forEach((sel) => this.__replaceElementForSiblingSwitch(productInfoHTML, sel));
        this.__reInitVariantPickerAfterSiblingSwitch(productInfoHTML);
        this.__updateMediaGalleryForSiblingSwitch(productInfoHTML);
        if (window.Alpine) {
          Alpine.initTree(this);
        }
      } else {
        this.__updateVariantPickerWhenChange(productInfoHTML);
      }

      this.__reEnableBuyButtons(buyButtonList);
      this.__dispatchChangeVariantEvent(productInfoHTML);
      if (this.isEnableStickyATC) this.__renderStickyATC(productInfoHTML);
    }
    __disableBuyButtons() {
      const buttons = this.sectionWrapper.querySelectorAll(".product-info__buy-buttons-wrapper button, .block-add-to-cart__button");
      buttons.forEach((btn) => {
        btn.disabled = true;
      });
      return buttons;
    }

    async __fetchSectionData(fetchUrl) {
      const sectionIds = [this.sectionId, this.productDetailSectionId].filter(Boolean).join(",");
      const url = `${fetchUrl}?option_values=${this.optionsSelectedValues.join(",")}&sections=${sectionIds}`;

      if (VariantPicker.cacheData[url]) return VariantPicker.cacheData[url];

      try {
        const response = await fetch(url);
        const contentType = response.headers.get("content-type");
        let result;

        if (contentType?.includes("application/json")) {
          // Shopify sections API response: { sectionId: htmlString, … }
          const data = await response.json();
          result = Object.fromEntries(Object.entries(data).map(([k, html]) => [k, new DOMParser().parseFromString(html, "text/html")]));
        } else {
          // Fallback: single-section plain HTML response.
          result = { [this.sectionId]: new DOMParser().parseFromString(await response.text(), "text/html") };
        }

        VariantPicker.cacheData[url] = result;
        return result;
      } catch (err) {
        console.error("[VariantPicker] fetch error:", err);
        return null;
      }
    }

    __syncSiblingProductMeta(siblingProductUrl, productInfoHTML) {
      const newPickerEl = productInfoHTML.querySelector(`.section--${this.sectionId} variant-picker.variant-picker__wrapper`);
      this.originalProductUrl = siblingProductUrl;
      this.dataset.url = this.dataset.productUrl = siblingProductUrl;
      if (newPickerEl?.dataset.productId) {
        this.productId = this.dataset.productId = newPickerEl.dataset.productId;
      }
      if (newPickerEl?.dataset.mediaId) {
        this.dataset.mediaId = newPickerEl.dataset.mediaId;
      } else {
        delete this.dataset.mediaId;
      }
    }

    __updateBrowserState(productInfoHTML) {
      const newPickerEl = productInfoHTML.querySelector(`.section--${this.sectionId} variant-picker.variant-picker__wrapper`);
      this.dataset.currentVariantId = newPickerEl?.dataset.currentVariantId || "";
      if (this.isMainProduct) {
        const variantId = this.dataset.currentVariantId;
        const newUrl = variantId ? `${this.originalProductUrl}?variant=${variantId}` : this.originalProductUrl;
        window.history.replaceState({}, "", newUrl);
      }
    }

    __patchAvailableContent(productInfoHTML) {
      [
        ".product-info__label-wrapper", // sale / new / custom labels
        ".product-template__properties", // product metafield properties
        ".product-info__volume-pricing",
        ".product-info__quantity-rule", // min / max / increment note
      ].forEach((sel) => this.__updateElements(productInfoHTML, sel));

      // Multi-element patch — multiple block instances matched by data-block-id.
      [
        ".product-info__estimate-delivery-wrapper",
        ".product-info__price-wrapper",
        ".product-info__identifier-wrapper", // SKU, barcode
        ".product-info__inventory-status-wrapper",
        ".product-info__back-in-stock-alert-wrapper",
        ".product-info__quantity-wrapper",
      ].forEach((sel) => this.__updateBlockElements(productInfoHTML, sel));

      this.__updateTableOfInformation(productInfoHTML);

      [".product-info__estimate-delivery-wrapper", ".product-info__rating", ".product-form__dynamic-checkout", `#PickupAvailability__${this.sectionId}`].forEach((sel) => {
        document.querySelector(`.section--${this.sectionId} ${sel}`)?.classList.remove("is-unavailable");
      });
    }

    __reEnableBuyButtons(buyButtonList) {
      buyButtonList.forEach((btn) => {
        btn.classList.add("is-variant-changing");
        if (!btn.ariaDisabled) btn.disabled = false;
      });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          buyButtonList.forEach((btn) => btn.classList.remove("is-variant-changing"));
        });
      });
    }

    async __fetchAndReplaceMain(productUrl) {
      this.variantPickerAbortController?.abort();
      this.variantPickerAbortController = new AbortController();

      const buyButtonList = this.__disableBuyButtons();

      try {
        const url = `${productUrl}?option_values=${this.optionsSelectedValues.join(",")}`;
        const response = await fetch(url, { signal: this.variantPickerAbortController.signal });
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const newMain = doc.querySelector("main#MainContent");
        const liveMain = document.querySelector("main#MainContent");
        if (!newMain || !liveMain) return;
        const newPickerEl = newMain.querySelector("variant-picker[data-current-variant-id]");
        const variantId = newPickerEl?.dataset.currentVariantId || "";

        const currentScriptSrcs = new Set(Array.from(document.querySelectorAll("script[src]")).map((s) => s.src));
        const scriptsToLoad = Array.from(doc.querySelectorAll("script[src]")).filter((s) => {
          const abs = new URL(s.getAttribute("src"), location.href).href;
          return !currentScriptSrcs.has(abs);
        });

        this.__cleanAlpineTeleports(liveMain);
        const freshMain = document.importNode(newMain, true);

        freshMain.querySelectorAll("script[src]").forEach((el) => el.remove());
        freshMain.setAttribute("x-ignore", "");
        liveMain.replaceWith(freshMain);

        for (const s of scriptsToLoad) {
          await new Promise((resolve) => {
            const el = document.createElement("script");
            el.src = new URL(s.getAttribute("src"), location.href).href;
            el.onload = resolve;
            el.onerror = resolve;
            document.head.appendChild(el);
          });
        }

        await new Promise((resolve) => requestAnimationFrame(resolve));

        if (window.Alpine) {
          freshMain.removeAttribute("x-ignore");
          delete freshMain._x_ignore;
          Alpine.initTree(freshMain);
        }
        if (this.isMainProduct) {
          const newHistoryUrl = variantId ? `${productUrl}?variant=${variantId}` : productUrl;
          window.history.replaceState({}, "", newHistoryUrl);
          this.__updateHeaderActiveLinks(productUrl);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("[VariantPicker] fetch error:", err);
          // Re-enable buttons on real errors so the user isn't stuck.
          buyButtonList.forEach((btn) => {
            btn.disabled = false;
          });
        }
      }
    }

    __cleanAlpineTeleports(liveMain) {
      Array.from(document.body.children).forEach((el) => {
        if (el._x_teleportBack && liveMain.contains(el._x_teleportBack)) {
          el.remove();
        }
      });
    }

    __updateHeaderActiveLinks(productUrl) {
      const headerSection = document.querySelector('[id^="shopify-section-"][id*="header"]');
      if (!headerSection) return;
      const newPath = new URL(productUrl, location.href).pathname;

      headerSection.querySelectorAll("a.active, p.menu-link.active").forEach((el) => {
        el.classList.remove("active");
      });

      headerSection.querySelectorAll("a[href]").forEach((a) => {
        try {
          if (new URL(a.href).pathname !== newPath) return;
          a.classList.add("active");
          // Walk up menu tree to activate parent items (child_active behaviour).
          let li = a.closest("li");
          while (li) {
            const parentLi = li.parentElement?.closest("li");
            if (!parentLi) break;
            const parentLink = parentLi.querySelector(":scope > a, :scope > div > a, :scope > div > p.menu-link");
            if (parentLink) parentLink.classList.add("active");
            li = parentLi;
          }
        } catch (_) {}
      });

      // Mobile menus use x-data components with a reactive `active` boolean.
      if (!window.Alpine) return;
      headerSection.querySelectorAll("[x-data]").forEach((el) => {
        const data = Alpine.$data(el);
        if (!data || typeof data.active !== "boolean") return;
        const link = el.querySelector("a[href]");
        if (!link) return;
        try {
          data.active = new URL(link.href).pathname === newPath;
        } catch (_) {}
      });
    }

    __updateElements(productInfoHTML, selector) {
      const oldElement = document.querySelector(`.section--${this.sectionId} ${selector}`);
      const newElement = productInfoHTML.querySelector(`.section--${this.sectionId} ${selector}`);
      if (oldElement && newElement) {
        oldElement.innerHTML = newElement.innerHTML;
        if (oldElement.classList.contains("is-unavailable")) {
          oldElement.classList.remove("is-unavailable");
        }
      }
    }

    __updateBlockElements(productInfoHTML, selector) {
      const oldElements = document.querySelectorAll(`.section--${this.sectionId} ${selector}`);
      oldElements.forEach((oldEl) => {
        const blockId = oldEl.dataset.blockId;
        const newEl = productInfoHTML.querySelector(`.section--${this.sectionId} ${selector}[data-block-id="${blockId}"]`);
        if (oldEl && newEl) {
          oldEl.innerHTML = newEl.innerHTML;
          oldEl.classList.remove("is-unavailable");
        }
      });
    }

    __updateTableOfInformation(productInfoHTML) {
      const selector = ".table-content__row__last";
      const oldElements = document.querySelectorAll(`.section--${this.sectionId} ${selector}`);
      const newElements = productInfoHTML.querySelectorAll(`.section--${this.sectionId} ${selector}`);
      oldElements.forEach((oldEle, index) => {
        if (newElements[index]) {
          oldEle.innerHTML = newElements[index].innerHTML;
        }
      });
    }

    __updateProductDetailSpecifications(productDetailInfoHTML) {
      const selector = ".product-details__specs-value";
      const oldElements = document.querySelectorAll(`.section--${this.productDetailSectionId} ${selector}`);
      const newElements = productDetailInfoHTML.querySelectorAll(`.section--${this.productDetailSectionId} ${selector}`);
      oldElements.forEach((oldEle, index) => {
        if (newElements[index]) {
          oldEle.innerHTML = newElements[index].innerHTML;
        }
      });
    }

    __reInitVariantPickerAfterSiblingSwitch(productInfoHTML) {
      const newPickerEl = productInfoHTML.querySelector(`.section--${this.sectionId} variant-picker.variant-picker__wrapper`);
      if (!newPickerEl) return;
      this.innerHTML = newPickerEl.innerHTML;
      this.__rebuildOptionRefs();

      this.optionElements.forEach((el) => {
        el.addEventListener("click", this._boundHandleChangedOption);
      });
      // Consistent keyup handling: capture labelEl so it doesn't rely on event.target.
      this.optionLabelElements.forEach((labelEl) => {
        labelEl.addEventListener("keyup", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            labelEl.previousElementSibling?.click();
          }
        });
      });
      if (window.Alpine) {
        Alpine.initTree(this);
      }
      this.updateOptionSelectedValues();
    }

    __updateMediaGalleryForSiblingSwitch(productInfoHTML) {
      const newMediaInfo = productInfoHTML.querySelector(`#ProductMediaInfo__${this.sectionId}`);
      const liveMediaInfo = document.querySelector(`#ProductMediaInfo__${this.sectionId}`);
      if (newMediaInfo && liveMediaInfo) {
        liveMediaInfo.textContent = newMediaInfo.textContent;
      }

      document.querySelector(`#MediaGalleryZoom__Enlarge__${this.sectionId}`)?.remove();
      const newGalleryEl = productInfoHTML.querySelector(`#MediaGallery__${this.sectionId}`);
      const liveGalleryEl = document.querySelector(`#MediaGallery__${this.sectionId}`);
      if (!newGalleryEl || !liveGalleryEl) return;

      const freshGalleryEl = document.importNode(newGalleryEl, true);
      liveGalleryEl.replaceWith(freshGalleryEl);

      if (window.Alpine) {
        Alpine.initTree(freshGalleryEl);
      }
    }

    __replaceElementForSiblingSwitch(productInfoHTML, selector) {
      const oldEl = document.querySelector(`.section--${this.sectionId} ${selector}`);
      const newEl = productInfoHTML.querySelector(`.section--${this.sectionId} ${selector}`);
      if (!oldEl || !newEl) return;

      const freshEl = document.importNode(newEl, true);
      oldEl.replaceWith(freshEl);
    }

    __updateVariantPickerWhenChange(productInfoHTML) {
      const newPicker = productInfoHTML.querySelector("variant-picker.variant-picker__wrapper");
      const newOptionMap = new Map(); // optionValueId  → .variant-option element
      const newLabelMap = new Map(); // optionValueId  → .variant-option__label element
      const newSelectMap = new Map(); // optionPosition → .select-button__label element
      const newSwatchMap = new Map(); // `for` attr     → .swatch-option__label element

      if (newPicker) {
        newPicker.querySelectorAll(".variant-option").forEach((el) => {
          newOptionMap.set(el.dataset.optionValueId, el);
        });
        newPicker.querySelectorAll(".variant-option__label").forEach((el) => {
          newLabelMap.set(el.dataset.optionValueId, el);
        });
        newPicker.querySelectorAll(".select-button__label.variant-option__select-button__label").forEach((el) => {
          newSelectMap.set(el.dataset.optionPosition, el);
        });
      }
      productInfoHTML.querySelectorAll(".swatch-option__label").forEach((el) => {
        newSwatchMap.set(el.getAttribute("for"), el);
      });

      this.optionElements.forEach((el) => {
        const newEl = newOptionMap.get(el.dataset.optionValueId);
        if (!newEl) return;
        el.classList.toggle("disabled", newEl.classList.contains("disabled"));
        el.classList.toggle("selected", newEl.classList.contains("selected"));
        el.checked = newEl.classList.contains("selected");
        el.innerHTML = newEl.innerHTML;
        el.dataset.selectValue = newEl.dataset.selectValue;
      });

      this.optionLabelElements.forEach((el) => {
        const newEl = newLabelMap.get(el.dataset.optionValueId);
        if (!newEl) return;
        el.classList.toggle("disabled", newEl.classList.contains("disabled"));
        el.classList.toggle("selected", newEl.classList.contains("selected"));
      });

      // Update dropdown select labels (picker type = dropdown)
      this.querySelectorAll(".select-button__label.variant-option__select-button__label").forEach((el) => {
        const newEl = newSelectMap.get(el.dataset.optionPosition);
        if (newEl) el.innerHTML = newEl.innerHTML.trim();
      });

      const oldSwatches = document.querySelectorAll(`.section--${this.sectionId} .swatch-option__label`);
      oldSwatches.forEach((swatch) => {
        const newSwatchLabel = newSwatchMap.get(swatch.getAttribute("for"));
        if (!newSwatchLabel) return;
        if (newSwatchLabel.dataset.swatchStyle === "image") {
          swatch.style.setProperty("--swatch-image-value", newSwatchLabel.dataset.swatchValue);
        } else if (newSwatchLabel.dataset.swatchStyle === "color") {
          swatch.style.setProperty("--swatch-color-value", newSwatchLabel.dataset.swatchValue);
        }
      });
    }

    __renderStickyATC(productInfoHTML) {
      const selectors = [`#StickyAddToCart__Image__${this.sectionId}`, `#StickyAddToCart__Variant__${this.sectionId}`, `#StickyAddToCart__Price__${this.sectionId}`, `.sticky-add-to-cart__form`];

      selectors.forEach((selector) => {
        this.__updateElements(productInfoHTML, selector);
      });
    }

    __initEventSticky() {
      document.addEventListener(`${STICKY_ATC_EVENT.optionChange}-${this.sectionId}`, (event) => {
        if (event.detail.optionsSelectedValues) {
          this.optionsSelectedValues = event.detail.optionsSelectedValues;

          const productUrl = event.detail.productUrl || null;
          const isCombinedListingSwitch = !!productUrl && productUrl !== this.originalProductUrl.split("?")[0];

          if (this.isMainProduct) {
            this._pendingProductUrl = isCombinedListingSwitch ? productUrl : null;
            this._pendingSiblingProductUrl = null;
          } else {
            this._pendingProductUrl = null;
            this._pendingSiblingProductUrl = isCombinedListingSwitch ? productUrl : null;
          }

          this.__renderProductInfo();
        }
      });
    }

    __updateCurrentVariantInfo(productInfoHTML) {
      const newCurrentVariantInfoElement = productInfoHTML.querySelector(`#CurrentVariantInfo__${this.sectionId}`);
      if (newCurrentVariantInfoElement) {
        this.currentVariantInfoElement.textContent = newCurrentVariantInfoElement.textContent;
        this.currentVariant = JSON.parse(newCurrentVariantInfoElement.textContent);
      }

      const newAdditionalCurrentVariantInfoElement = productInfoHTML.querySelector(`#AdditionalVariantInfo__${this.sectionId}`);
      if (newAdditionalCurrentVariantInfoElement) {
        this.additionalCurrentVariantInfoElement.textContent = newAdditionalCurrentVariantInfoElement.textContent;
      }

      if (this.currentVariant) {
        this.isOptionExist = true;
        this.isOptionAvailable = this.currentVariant.available;
      } else {
        this.isOptionExist = false;
      }
    }

    __renderProductInfoWhenUnavailable() {
      const selectors = [
        ".product-info__price-wrapper", // update price
        ".product-info__identifier-wrapper", // update sku, barcode
        ".product-info__estimate-delivery-wrapper", // update estimate delivery
        ".product-info__label-wrapper", // update labels
        ".product-info__inventory-status-wrapper", // update inventory status
        ".product-info__rating", // update rating
        `#PickupAvailability__${this.sectionId}`,
        ".product-info__volume-pricing",
        ".product-info__quantity-rule", // dim quantity-rule note consistently with its siblings
      ];

      selectors.forEach((selector) => {
        const element = document.querySelector(`.section--${this.sectionId} ${selector}`);
        if (element) {
          element.classList.add("is-unavailable");
        }
      });
    }

    __dispatchChangeVariantEvent(updatedHTML) {
      document.dispatchEvent(
        new CustomEvent(`${PRODUCT_EVENT.updatedVariant}${this.sectionId}`, {
          bubbles: true,
          detail: {
            productId: this.productId,
            currentVariant: this.currentVariant,
            sectionId: this.sectionId,
            isOptionAvailable: this.isOptionAvailable,
            isOptionExist: this.isOptionExist,
            previewMediaId: this.dataset.mediaId,
            optionsSelectedValues: this.optionsSelectedValues,
            updatedHTML: updatedHTML,
          },
        })
      );

      if (this.currentVariant && window.MaximizeStorefrontEvents) {
        const selectedOptions = [];

        this.querySelectorAll(".variant-option__wrapper").forEach((wrapper) => {
          const name = wrapper.dataset.optionName;
          const pos = parseInt(wrapper.dataset.optionPosition || "0");
          if (!name || !pos) return;
          const value = (this.currentVariant.options && this.currentVariant.options[pos - 1]) || wrapper.querySelector("[data-position]")?.textContent?.trim() || "";
          if (value) selectedOptions.push({ name, value });
        });

        // Fallback: read selected-value spans when wrappers don't have the attribute.
        if (!selectedOptions.length) {
          this.querySelectorAll(".variant-option.selected").forEach((el) => {
            const value = el.textContent.trim();
            if (value) selectedOptions.push({ name: "", value });
          });
        }

        const productInfo = {
          "id": this.dataset.productId ?? '',
          "title": this.dataset.productTitle ?? '',
          "handle": this.dataset.productHandle ?? ''
        }

        let variantPayload = null;
        if (this.currentVariant) {
          const cv = this.currentVariant;
          variantPayload = {
            id: cv.id ? `gid://shopify/ProductVariant/${cv.id}` : null,
            title: cv.title || '',
            availableForSale: cv.available ?? false,
            price: {
              amount: cv.price != null ? (cv.price / 100).toFixed(2) : '0.00',
              currencyCode: window.Shopify?.currency?.active || 'USD',
            },
            selectedOptions,
          };
        }

        window.MaximizeStorefrontEvents.dispatchProductSelect(productInfo, selectedOptions, this, variantPayload);
      }
    }
  }

  if (!customElements.get("variant-picker")) {
    customElements.define("variant-picker", VariantPicker);
  }
}
