if (!window.Maximize.loadedScript.includes('product-bundle.js')) {
  window.Maximize.loadedScript.push('product-bundle.js');

  requestAnimationFrame(() => {
    const defineProductBundle = () => {
      Alpine.data('xBundleSection', (sectionId, firstBlockId) => ({
        activeBlock: firstBlockId,
        initBundle() {
          if (Shopify.designMode) {
            document.addEventListener('shopify:block:select', (event) => {
              if (event.detail && event.detail.sectionId === sectionId) {
                this.activeBlock = event.detail.blockId;
              }
            });
          }
        }
      }));

      Alpine.data('xBundleBlock', (
        minimumItems,
        moneyFormat,
        productOnlyAddedOnce,
        discountType,
        discountValue,
        applyDiscountOncePerOrder,
        atbButtonText
      ) => ({
        productsBundle: [],
        _qtyErrorTimers: {}, // variantId → auto-hide timer for quantity-rule errors
        loading: false,
        addToCartButton: "",
        bundleSummary: "",
        totalPrice: 0,
        errorMessage: false,
        showBundleContent: false,
        discountPrice: 0,
        viewBundle: false,
        isDesktop: false,
        loadedChooseOptions: {},
        productOnlyAddedOnce: productOnlyAddedOnce,
        atbButtonText: atbButtonText,
        init() {
          this.addToCartButton = this.$el.querySelector(".button-atc");
          this.bundleSummary = this.$el.getElementsByClassName("bundle-summary__details")[0] || this.$el.closest(".bundle-summary__details ");
          this.totalPrice = formatMoney(0, moneyFormat);
          installMediaQueryWatcher("(min-width: 1024px)", (matches) => {
            this.isDesktop = matches;
          });
        },
        async loadChooseOptions(url, el, index) {
          const productCardWrapper = el.closest(".product-card-bundle")
          if (!productCardWrapper) return;
          const effectiveUrl = productCardWrapper.dataset.effectiveUrl || url;
          let listOptionValuesIdSelected = productCardWrapper.dataset.listOptionValuesIdSelected ? productCardWrapper.dataset.listOptionValuesIdSelected.split(",") : "";
          let urlProduct = `${effectiveUrl}?option_values=${listOptionValuesIdSelected}&section_id=choose-option-product-bundle&page=${index}`;

          let destinationElm = productCardWrapper.querySelector(".choose-option");
          let loadingEl = productCardWrapper.querySelector(".icon-loading");
          if (this.loadedChooseOptions[urlProduct]) {
            destinationElm.innerHTML = this.loadedChooseOptions[urlProduct];
            this.handleChooseOptionElements(destinationElm);
            this.handleB2BPriceLabel(destinationElm)
            setTimeout(() => {
              this.focusChooseOption(destinationElm);
            }, 500);
            return true;
          }

          try {
            if (loadingEl) {
              loadingEl.classList.remove("hidden");
            }
            const response = await fetch(urlProduct);
            const content = await response.text();

            const parser = new DOMParser();
            const parsedContent = parser.parseFromString(content, "text/html").getElementsByClassName("choose-option-content")[0].innerHTML;
             if (parsedContent) {
              if (destinationElm) {
                destinationElm.innerHTML = parsedContent;
              }
              if (!Shopify.designMode) {
                this.loadedChooseOptions[urlProduct] = parsedContent;
              }
              this.handleChooseOptionElements(destinationElm);
              this.handleB2BPriceLabel(destinationElm);
            }
            if (loadingEl) {
              loadingEl.classList.add("hidden");
            }
          } catch (error) {
            console.error(error);
          }
          this.focusChooseOption(destinationElm);
        },
        focusChooseOption(el) {
          const closeButton = el.querySelector(".btn-close-choose-option");
          if (closeButton) {
            closeButton.focus({ preventScroll: true });
          }
        },
        checkDisabledButton(el) {
          if (!this.productOnlyAddedOnce) return !this.isAvailableButton;
          const originalProductId = el?.closest?.(".product-card-bundle")?.dataset?.originalProductId;
          if (!originalProductId) return !this.isAvailableButton;
          return this.productsBundle.some((item) => item.product_original_id === originalProductId) || !this.isAvailableButton;
        },
        handleAddToBundle(el, showChooseOption = false) {
          let newProduct = this.getCurrentProduct(el, showChooseOption);
          newProduct.product_original_id = el?.closest(".product-card-bundle")?.dataset?.originalProductId ?? null;
          if (this.productOnlyAddedOnce && newProduct.product_original_id) {
            if (this.productsBundle.some(item => item.product_original_id === newProduct.product_original_id)) return;
          }

          let existingProduct = this.productsBundle.find(item => item.id == newProduct.id);
          if (existingProduct) {
            // Adding again steps up by one increment (rule-aware), clamped to max.
            existingProduct.quantity = quantityRuleUtils.step(existingProduct.quantity, this._ruleFor(existingProduct), 1);
          } else {
            // Seed the initial quantity to the rule minimum (defaults to 1 for non-B2B).
            newProduct.quantity = this._ruleFor(newProduct).min;
            this.productsBundle = [...this.productsBundle, newProduct];
          }
          this.errorMessage = false;
          this.updateBundleContent(this.productsBundle);
        },
        getCurrentProduct(el, showChooseOption) {
          return showChooseOption ?
            JSON.parse(el.closest(".choose-options-content")?.querySelector('[type="application/json"][data-type="current-bundle-item"]')?.textContent) :
            JSON.parse(el.closest('.product-info__form-wrapper')?.querySelector('[type="application/json"][data-type="current-bundle-item"]')?.textContent);
        },
        handleAddToCart(el) {
          this.errorMessage = false;
          let items = maximizeParseJSON(JSON.stringify(this.productsBundle));
          items = items.reduce((data, product) => {
            if (data[product.id]) {
              // Merge duplicate variants, keeping the total a valid multiple of increment (≤ max).
              data[product.id].quantity = quantityRuleUtils.normalizeQuantity(data[product.id].quantity + product.quantity, this._ruleFor(product));
            } else {
              data[product.id] = product;
            }
            return data;
          }, {});

          this.loading = true;

          let cartSectionElement = document.querySelector("#CartDrawer");
          let cartSectionElementId = cartSectionElement && cartSectionElement.dataset.sectionId ? cartSectionElement.dataset.sectionId : false;
          if (window.Maximize.isCartPage) {
            cartSectionElement = document.querySelector("#MainCart__Items");
            cartSectionElementId = cartSectionElement && cartSectionElement.dataset.sectionId
          }
          const sectionsToRender = window.xCartHelper.getSectionsToRender(cartSectionElementId);

          const _slUpdate = window.MaximizeStorefrontEvents?.createCartLinesUpdate({
            action: 'add',
            context: 'dialog',
            lines: items,
            element: document,
          });

          fetch(window.Shopify.routes.root + 'cart/add.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body:  JSON.stringify({ "items": items, "sections": sectionsToRender.map((section) => section.id) })
          }).then((response) => {
            return response.json();
          }).then((response) => {
            if (response.status == '422') {
              const _422msg = response.description || response.message || '';
              _slUpdate?.resolve(null, [{ code: 'MAXIMUM_EXCEEDED', message: _422msg }]);
              window.MaximizeStorefrontEvents?.dispatchCartError(
                _422msg || 'Unable to add bundle to cart', 'INVALID', document
              );
              const error_message = el.closest('.bundle-summary__wrapper')?.querySelector('.cart-warning');
              this.errorMessage = true;
              if (error_message) {
                error_message.textContent = response.description;
                setTimeout(() => this.errorMessage = false, 5000);
              }

            } else {
              _slUpdate?.resolve(response);
              this.handleUpdateContentButton(el,true);
              sectionsToRender.forEach((section => {
                const sectionElement = document.querySelector(section.selector);
                if (sectionElement) {
                  if (response.sections[section.id])
                    sectionElement.innerHTML = getSectionInnerHTML(response.sections[section.id], section.selector);
                }
              }));
              if (window.Maximize?.isEnableCartDrawer)  document.getElementById('CartDrawer').isOpen = true;
              window.xCartHelper.updateCurrentCountItem();
              document.dispatchEvent(new CustomEvent(`${CART_EVENT.cartUpdate}`, {
                bubbles: true,
                detail: {
                  isItemCountChanged: true,
                }
              }));
            }
          })
          .catch((error) => {
            _slUpdate?.reject(error);
            window.MaximizeStorefrontEvents?.dispatchCartError(
              error?.message || 'Cart add failed', 'SERVICE_UNAVAILABLE', document
            );
            console.error('Error:', error);
          }).finally(() => {
            this.loading = false;
            this.productsBundle = [];
            this.totalPrice = formatMoney(0, moneyFormat);
            this.discountPrice = formatMoney(0, moneyFormat);
            this.addToCartButton.setAttribute('disabled', 'disabled');
            this.updateBundleContent(this.productsBundle);
          })
        },
        handleUpdateContentButton(el,isSuccess = false) {
          const textEl = el.querySelector('.add_to_cart_text');
          if (!textEl) return;

          const checkIconSpan = el?.querySelector('[data-check-icon]');

          if (textEl._atcTimeout) {
            clearTimeout(textEl._atcTimeout);
            delete textEl._atcTimeout;
          }

          if (isSuccess && checkIconSpan) {
            textEl.style.visibility = 'hidden';
            textEl.style.opacity = '0';
            textEl.setAttribute('aria-hidden', 'true');

            checkIconSpan.classList.remove('hidden');

            textEl._atcTimeout = setTimeout(() => {
              checkIconSpan.classList.add('hidden');

              textEl.style.removeProperty('visibility');
              textEl.style.removeProperty('opacity');
              textEl.removeAttribute('aria-hidden');

              delete textEl._atcTimeout;
            }, DURATION.SHOW_ICON_ATC_SUCCESS);
          } else {
            if (checkIconSpan) checkIconSpan.classList.add('hidden');
            textEl.style.removeProperty('visibility');
            textEl.style.removeProperty('opacity');
            textEl.removeAttribute('aria-hidden');
          }
        },
        updateBundleContent(productsBundle) {
          let {total, totalQuantity} = productsBundle.reduce((accumulator, item) => {
            accumulator.total += this.unitPrice(item) * item.quantity;
            accumulator.totalQuantity += item.quantity;
            return accumulator;
          }, {total: 0, totalQuantity: 0});

          if (totalQuantity >= minimumItems) {
            this.addToCartButton?.removeAttribute('disabled');
            let discount = 0;
            let discountPrice = 0;
            if (!Number.isNaN(discountValue)) {
              discount = Number(discountValue);

              if (discountType == 'percentage' && Number.isInteger(discount) && discount >= 0 && discount <= 100) {
                discountPrice = Math.ceil(total - total * discount / 100);
              }

              if (discountType == 'amount' && discount >= 0) {
                discount = (Number.parseFloat(discountValue)).toFixed(2);
                if (applyDiscountOncePerOrder) {
                  discountPrice = total - discount * Shopify.currency.rate * 100;
                } else {
                  discountPrice = total - totalQuantity * discount * Shopify.currency.rate * 100;
                }
              }

              if (discountPrice > 0) {
                this.discountPrice = formatMoney(discountPrice, moneyFormat);
              }
            } else {
              this.discountPrice = 0;
            }
          } else {
            this.discountPrice = 0;
            this.addToCartButton?.setAttribute('disabled', 'disabled');
          }
          this.totalPrice = formatMoney(total, moneyFormat);
          this.updateProgressBar(totalQuantity);
        },
        removeBundle(indexItem) {
          let newProductsBundle = this.productsBundle.filter((item, index) => index != indexItem)
          this.productsBundle = newProductsBundle;
          this.updateBundleContent(this.productsBundle);
        },
        updateProgressBar(bundleLength) {
          let activeWidth = 0;
          if (this.bundleSummary) {
            activeWidth = bundleLength / minimumItems * 100;
            if(activeWidth > 100) activeWidth = 100;
          }
          this.bundleSummary.style.setProperty("--progress-bar-active-width", `${activeWidth}%`)
        },
        // Shopify quantity rule for a bundle item — defaults to {1, null, 1} when absent
        // (e.g. non-B2B, where the rule is not serialized), so behavior is unchanged there.
        _ruleFor(item) {
          return quantityRuleUtils.normalizeRule(
            item && item.quantity_rule && item.quantity_rule.min,
            item && item.quantity_rule && item.quantity_rule.max,
            item && item.quantity_rule && item.quantity_rule.increment
          );
        },
        // Normalized minimum for a bundle item (used by the stepper's minus guard/disable).
        _ruleMin(item) {
          return this._ruleFor(item).min;
        },
        // Unit price for the item's CURRENT quantity, so a bundle row and the bundle total follow
        // volume pricing instead of always billing the variant's base price — which is what made
        // the bundle total disagree with the cart. Falls back to item.price when the item carries
        // no price breaks (every non-B2B item), so nothing changes there.
        unitPrice(item) {
          return quantityRuleUtils.priceForQuantity(item && item.price, item && item.priceBreaks, item && item.quantity);
        },
        // Clear the per-item quantity-rule error (empties the row's error tooltip),
        // re-finding by variant id so the auto-hide survives array reordering/removal.
        _clearQtyError(variantId) {
          clearTimeout(this._qtyErrorTimers[variantId]);
          const i = this.productsBundle.findIndex(p => p.id === variantId);
          if (i !== -1 && this.productsBundle[i].qtyError) {
            this.productsBundle[i] = { ...this.productsBundle[i], qtyError: '' };
          }
        },
        updateQty(bundleItemIndex, action = 'input') {
          const item = this.productsBundle[bundleItemIndex];
          if (!item) return;

          const rule = this._ruleFor(item);
          let newQty = item.quantity;
          let error = '';

          switch (action) {
            case 'plus':
              newQty = quantityRuleUtils.step(item.quantity, rule, 1);
              break;

            case 'minus':
              newQty = quantityRuleUtils.step(item.quantity, rule, -1);
              break;

            case 'input': {
              const typed = parseInt(this.$el.value);
              if (quantityRuleUtils.isValid(typed, rule)) {
                newQty = typed;
              } else {
                // Snap to the nearest valid quantity and surface the reason briefly.
                newQty = quantityRuleUtils.normalizeQuantity(typed, rule);
                error = quantityRuleUtils.buildError(this.$el.value, rule);
              }
              break;
            }
          }

          this.productsBundle[bundleItemIndex] = { ...item, quantity: newQty, qtyError: error };

          clearTimeout(this._qtyErrorTimers[item.id]);
          if (error) this._qtyErrorTimers[item.id] = setTimeout(() => this._clearQtyError(item.id), 3000);

          this.updateBundleContent(this.productsBundle);
        },
        handleChooseOptionElements(destinationElm) {
          // Capture the xBundleBlock Alpine instance so the reRenderChooseOption closure
          // can call back into it for the Combine Listing fetch-and-replace path.
          const self = this;
          const chooseOptionElement = destinationElm.querySelector("choose-option");

          chooseOptionElement.reRenderChooseOption = async function() {
            const variantPickerEle = chooseOptionElement.closest('.variant-picker__wrapper');
            const indexParam = variantPickerEle?.dataset?.indexParam;
            const chooseOptionWrapper = chooseOptionElement.closest(".choose-option");
            const buyButton = chooseOptionWrapper.querySelector(".product-form__btn-add-to-cart");
            if (buyButton) {
              buyButton.disabled = true;
            }
            if (chooseOptionElement._pendingCombinedListingUrl) {
              const childUrl = chooseOptionElement._pendingCombinedListingUrl;
              chooseOptionElement._pendingCombinedListingUrl = null;
              await self.__fetchAndReplaceChooseOptionBundle(childUrl, indexParam, destinationElm);
              self.handleB2BPriceLabel(destinationElm);
              return;
            }
            const url = `${chooseOptionElement.productUrl}?option_values=${chooseOptionElement.optionsSelectedValues.join(",")}&section_id=choose-option-product-bundle&page=${indexParam}`;
            let dataHTML = chooseOptionElement.constructor.cacheData[url];
            if (!dataHTML) {
              try {
                const response = await fetch(url);
                const text = await response.text();
                dataHTML = new DOMParser().parseFromString(text, "text/html");
                chooseOptionElement.constructor.cacheData[url] = dataHTML;
              } catch (error) {
                console.error(error);
                if (buyButton && !buyButton.ariaDisabled) buyButton.disabled = false;
                return;
              }
            }

            chooseOptionElement.updateElements(chooseOptionWrapper, dataHTML, ".choose-option__price-wrapper");
            chooseOptionElement.updateElements(chooseOptionWrapper, dataHTML, ".choose-options-content .choose-option__properties-group");
            self.handleB2BPriceLabel(destinationElm);

            let newCurrentVariantInfoEle = dataHTML.querySelector('[type="application/json"][data-type="current-variant-info"]');
            if (newCurrentVariantInfoEle) {
              chooseOptionElement.currentVariant = JSON.parse(newCurrentVariantInfoEle?.textContent);
              chooseOptionElement.currentVariantInfoEle.textContent = newCurrentVariantInfoEle?.textContent;
            }

            let newCurrentVariantAdditionalInfoEle = dataHTML.querySelector('[type="application/json"][data-type="current-variant-additional-info"]');
            if (chooseOptionElement.currentVariantAdditionalInfoEle && newCurrentVariantAdditionalInfoEle) {
              chooseOptionElement.currentVariantAdditionalInfoEle.textContent = newCurrentVariantAdditionalInfoEle.textContent;
            }

            let newCurrentBundleItemEle = dataHTML.querySelector('[type="application/json"][data-type="current-bundle-item"]');
            let currentBundleItemEle = chooseOptionElement.querySelector('[type="application/json"][data-type="current-bundle-item"]');
            if (currentBundleItemEle && newCurrentBundleItemEle) {
              currentBundleItemEle.textContent = newCurrentBundleItemEle.textContent;
            }
            const productCardWrapper = destinationElm.closest(".product-card-bundle");
            if (productCardWrapper) {
              productCardWrapper.dataset.productOriginalUrl = chooseOptionElement.dataset.productOriginalId;
            }

            syncSwatchOptionStyles(dataHTML, chooseOptionWrapper);
            // Suppress Safari's ::before recreation transition BEFORE re-enabling or dispatching event.
            // Covers both cases:
            // (a) available → available: button.disabled toggled below (non-aria-disabled)
            // (b) unavailable → available: aria-disabled="true" removed by Alpine microtask
            //     triggered inside dispatchChangeVariantEvent — class must be present at that moment.
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
            chooseOptionElement.dispatchChangeVariantEvent();
          }
        },

        async __fetchAndReplaceChooseOptionBundle(childProductUrl, indexParam, destinationElm) {
          const productCardWrapper = destinationElm.closest(".product-card-bundle");
          const chooseOption = destinationElm.querySelector("choose-option");
          const currentOptionValues = chooseOption?.optionsSelectedValues ?? [];
          const buyButton = destinationElm.querySelector(".product-form__btn-add-to-cart");

          const url = `${childProductUrl}?option_values=${currentOptionValues.filter(Boolean).join(",")}&section_id=choose-option-product-bundle&page=${indexParam}`;

          try {
            let parsedContent;
            if (this.loadedChooseOptions[url]) {
              parsedContent = this.loadedChooseOptions[url];
            } else {
              const response = await fetch(url);
              const text = await response.text();
              const doc = new DOMParser().parseFromString(text, "text/html");
              parsedContent = doc.getElementsByClassName("choose-option-content")[0]?.innerHTML;

              if (!parsedContent) {
                console.error("[Bundle CL] choose-option-content not found in response");
                if (buyButton && !buyButton.ariaDisabled) buyButton.disabled = false;
                return;
              }

              if (!Shopify.designMode) {
                this.loadedChooseOptions[url] = parsedContent;
              }
            }
            destinationElm.innerHTML = parsedContent;
            if (productCardWrapper) {
              productCardWrapper.dataset.effectiveUrl = childProductUrl;

              productCardWrapper.dataset.listOptionValuesIdSelected = currentOptionValues.filter(Boolean).join(",");
              const newChooseOptionElement = destinationElm.querySelector(`choose-option`);
              if (newChooseOptionElement) {
                productCardWrapper.dataset.originalProductId = newChooseOptionElement.dataset.originalProductId;
              }
            }

            // Re-install bundle-specific reRenderChooseOption override on fresh element.
            this.handleChooseOptionElements(destinationElm);

            this.focusChooseOption(destinationElm);
          } catch (error) {
            console.error("[Bundle CL] fetch error:", error);
            if (buyButton && !buyButton.ariaDisabled) buyButton.disabled = false;
          }
        },

        handleB2BPriceLabel (chooseOptionElement){
          const productCardWrapper = chooseOptionElement.closest(".product-card-bundle")
          const showB2BPriceLabel = productCardWrapper?.dataset?.showB2bPriceLabel;
          if (showB2BPriceLabel === 'false') {
            const b2bPriceLabels = productCardWrapper.querySelectorAll('.price-b2b-label');
            if (b2bPriceLabels) {
              b2bPriceLabels.forEach(label => {
                  label.classList.add('hidden');
              });
            }
          }
        }
      }));
    };
    if (window.Alpine) {
      defineProductBundle();
    } else {
      document.addEventListener("alpine:init", defineProductBundle);
    }
  });
}
