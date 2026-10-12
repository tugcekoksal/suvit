if (!window.Maximize.loadedScript.includes('product-form.js')) {
  window.Maximize.loadedScript.push("product-form.js");

  document.addEventListener("alpine:init", () => {
    Alpine.data("xProductForm", (formId, variantId, available, btnText, atcButtonLabel, sectionId, optionId, preorderTypeShow, preorderLabel, isApplyPreorder, initIsShowPreorder = false, initIsContinueSelling = false) => ({
      isFirstLoading: true,
      variantId: variantId,
      currentVariant: false,
      isOptionAvailable: available,
      isOptionExist: true,
      isAvailableButton: available,
      btnText: btnText,
      atcButtonLabel: atcButtonLabel,
      visible: false,
      isLoading: false,
      errorMessage: false,
      quantityErrorMessage: "",
      isShowPreorder: initIsShowPreorder,
      isContinueSelling: initIsContinueSelling,
      giftCardWrapperEle: document.querySelector(`#GiftCardRecipient__${sectionId}`),
      _formInitialized: false,
      _formController: null,
      destroy() {
        // Clean up all document-level listeners added in handleInitProductForm.
        // Alpine calls destroy() when the component element is removed from the DOM
        // (e.g. during a sibling-product block replacement), preventing listener leaks.
        this._formController?.abort();
        this._formController = null;
        this._formInitialized = false;
      },
      handleInitProductForm() {
        if (this._formInitialized) return;
        this._formInitialized = true;

        this._formController = new AbortController();
        const signal = this._formController.signal;

        const currentVariantInfoElement = this.$el.querySelector(`[type="application/json"][data-type="init-current-variant"]`);
        if (currentVariantInfoElement) {
          this.currentVariant = JSON.parse(currentVariantInfoElement.textContent);
        }

        const additionalVariantInfoElement = document.querySelector(`#AdditionalVariantInfo__${sectionId}`);
        if (additionalVariantInfoElement) {
          const jsonText = additionalVariantInfoElement?.textContent?.trim();

          if (jsonText) {
            try {
              this.currentVariantAdditionalInfo = JSON.parse(jsonText);
            } catch (error) {
              console.error("Invalid JSON in additionalVariantInfoElement:", error);
              this.currentVariantAdditionalInfo = {};
            }
          } else {
            this.currentVariantAdditionalInfo = {};
          }
        }

        this.visible = true;

        document.addEventListener(`${PRODUCT_EVENT.updatedVariant}${sectionId}`, (event) => {
          const { currentVariant } = event.detail;
          this.currentVariant = currentVariant;
        }, { signal });
        document.addEventListener(`${PRODUCT_EVENT.swatchChange}${sectionId}`, (event) => {
          const { currentVariant } = event.detail;
          this.currentVariant = currentVariant;
        }, { signal });
        if (this.giftCardWrapperEle) {
          document.addEventListener(`${PRODUCT_EVENT.giftCardRecipientChange}${sectionId}`, (event) => {
            const { isValidated } = event.detail;
            const isValidatedGiftCard = isValidated;
            this.__updateStatus(PRODUCT_FORM_SOURCE_CHANGE.giftCardRecipient, isValidatedGiftCard);
          }, { signal });
        }
        this.__updateAddToCartText(this.btnText);

        if (optionId) {
          let additionalVariantsInfoElement = this.$el.closest(".product-card__wrapper")?.querySelector(`.variant-inventory`);
          if (additionalVariantsInfoElement) {
            this.currentVariantAdditionalInfo = JSON.parse(additionalVariantsInfoElement.textContent);
          }
          document.addEventListener(`${PRODUCT_EVENT.swatchChange}${optionId}`, (event) => {
            const { currentVariant } = event.detail;
            this.currentVariant = currentVariant;
          }, { signal });
        }

        if (this.$el.classList.contains("product-card__form-wrapper")) {
          let additionalVariantsInfoElement = this.$el.closest(".product-card__wrapper")?.querySelector(`.product-card-variant-inventory`);
          if (additionalVariantsInfoElement) {
            this.currentVariantAdditionalInfo = JSON.parse(additionalVariantsInfoElement.textContent);
          }
        }

        this.$watch("currentVariant", () => {
          this.__updateStatus(PRODUCT_FORM_SOURCE_CHANGE.variantPicker);
        });

        if (this.$refs.error_message) {
          this.$watch("errorMessage", (newValueError) => {
            if (newValueError) {
              this.$refs.error_message.parentElement.classList.remove("hidden");
              this.$refs.error_message.parentElement.classList.add("flex");
            } else {
              this.$refs.error_message.parentElement.classList.add("hidden");
              this.$refs.error_message.parentElement.classList.remove("flex");
            }
          });
        }

        // Surface quantity-rule errors (from the separate xQuantitySelector /
        // xQuantitySelectorAtc component) in this form's shared error_message element.
        // Scope by the card id (optionId) when present so each product card shows only
        // its own error; fall back to sectionId for the main product page.
        // Toggle the DOM directly (not the `errorMessage` state) so the message is NOT
        // dismissed by @click.away and stays visible until the quantity becomes valid.
        // B2B-only: non-B2B never emits quantity-rule errors, so skip registering.
        const quantityErrorScope = optionId ? optionId : sectionId;
        if (window.Maximize.isB2BCustomer)
          document.addEventListener(`quantity-rule-error:${quantityErrorScope}`, (event) => {
            const message = (event.detail && event.detail.message) || "";
            // Prefer a dedicated quantity-error element (product cards) bound to
            // `quantityErrorMessage`; otherwise fall back to the shared form
            // error_message (product page). Either way the message persists until the
            // quantity becomes valid (an empty message clears it).
            if (this.$refs.quantity_error) {
              this.quantityErrorMessage = message;
              return;
            }
            // Card forms without a dedicated quantity-error element (e.g. the icon-only
            // ATC in product-card.liquid) must NOT surface quantity errors in their shared
            // error_message. Only the product page form (no card optionId) falls back.
            if (optionId) return;
            if (!this.$refs.error_message) return;
            const wrapper = this.$refs.error_message.parentElement;
            if (message) {
              this.$refs.error_message.textContent = message;
              wrapper.classList.remove("hidden");
              wrapper.classList.add("flex");
            } else {
              this.$refs.error_message.textContent = "";
              wrapper.classList.add("hidden");
              wrapper.classList.remove("flex");
            }
          }, { signal });

        this.isFirstLoading = false;
      },
      formDataToObject(formData) {
        const object = {};
        formData.forEach((value, key) => {
          if (key.includes("[")) {
            const [mainKey, subKey] = key.split("[");
            const cleanSubKey = subKey.replace("]", "");

            if (!object[mainKey]) {
              object[mainKey] = {};
            }
            object[mainKey][cleanSubKey] = value;
          } else {
            object[key] = value;
          }
        });

        return object;
      },
      async handleAddAdditionalFeeItems(additionalFeePropertyValue, additionalFeeData, sectionsToRender, isAddError) {
        if (additionalFeePropertyValue != "") {
          if (isAddError) {
            await fetch(Shopify.routes.root + "cart.js", {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            })
              .then((responseCart) => responseCart.json())
              .then(async (responseCart) => {
                if (responseCart.item_count != window.xCartHelper.currentItemCount) {
                  let newQty = responseCart.item_count - window.xCartHelper.currentItemCount;

                  additionalFeeData.items.map((item) => {
                    item.quantity = newQty;
                  });

                  await window
                    .fetch("/cart/add.js", {
                      method: "POST",
                      headers: {
                        Accept: "application/javascript",
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify(additionalFeeData),
                    })
                    .then((responseAdditionalFee) => responseAdditionalFee.json())
                    .then((responseAdditionalFee) => {
                      sectionsToRender.forEach((section) => {
                        const sectionElement = document.querySelector(section.selector);
                        if (sectionElement) {
                          if (responseAdditionalFee.sections[section.id]) sectionElement.innerHTML = getSectionInnerHTML(responseAdditionalFee.sections[section.id], section.selector);
                        }
                      });
                    })
                    .finally(() => window.xCartHelper.updateCurrentCountItem());
                }
              });
          } else {
            return await window
              .fetch("/cart/add.js", {
                method: "POST",
                headers: {
                  Accept: "application/javascript",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(additionalFeeData),
              })
              .then((responseAdditionalFee) => responseAdditionalFee.json());
          }
        }
      },
      // The quantity selector no longer reports on blur (re-focusing there swallowed clicks
      // aimed at other buttons), so pressing Add to cart is one of the two commit points —
      // Enter is the other. Reads the rule off the input's own min/max/step, which Alpine keeps
      // in step with the selected variant, so this needs no handle on the selector component.
      // Returns false when the add should be blocked.
      __validateQuantityBeforeAdd() {
        if (!window.Maximize.isB2BCustomer) return true;
        const form = this.$refs.product_form;
        if (!form) return true;

        // A `form=` association can produce a RadioNodeList when several inputs share the name.
        const named = form.elements.quantity;
        const input = named instanceof RadioNodeList ? Array.from(named).find((el) => el.type === "number") : named;
        if (!input || input.type !== "number") return true;

        const rule = quantityRuleUtils.normalizeRule(input.min, input.max, input.step);
        if (quantityRuleUtils.isValid(input.value, rule)) return true;

        const scope = optionId ? optionId : sectionId;
        document.dispatchEvent(
          new CustomEvent(`quantity-rule-error:${scope}`, {
            detail: { message: quantityRuleUtils.buildError(input.value, rule) },
          })
        );
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        return false;
      },
      handleAddToCart: async function (e, isCheckRequired = false) {
        if (isCheckRequired) {
          let productInfo = this.$el.closest(".product-template__wrapper");
          if (productInfo) {
            let propertiesInput = productInfo.querySelectorAll(`.customizable-option`);
            this.stopAction = false;
            let isScroll = false;
            propertiesInput.length &&
              propertiesInput.forEach((input) => {
                if ((input.required && input.value === "") || input.classList.contains("validate-checkbox")) {
                  if (!isScroll) {
                    const inputWrapper = input.closest(`.customizable-option__wrapper`);
                    if (inputWrapper) inputWrapper.scrollIntoView({ behavior: "smooth", block: "center" });
                    isScroll = true;
                  }
                  input.classList.add("required-picker");
                  this.stopAction = true;
                }
              });
          }
          if (this.stopAction) {
            return true;
          }
        }

        if (!this.__validateQuantityBeforeAdd()) return true;

        this.isLoading = true;

        const addGiftWrapping = await this.__addGiftWrapping();
        if (!addGiftWrapping) return;

        let cartSectionElement = document.querySelector("#CartDrawer");
        let cartSectionElementId = cartSectionElement && cartSectionElement.dataset.sectionId ? cartSectionElement.dataset.sectionId : false;
        if (window.Maximize.isCartPage) {
          cartSectionElement = document.querySelector("#MainCart__Items");
          cartSectionElementId = cartSectionElement && cartSectionElement.dataset.sectionId;
        }
        const sectionsToRender = window.xCartHelper.getSectionsToRender(cartSectionElementId);

        const formData = new FormData(this.$refs.product_form);

        // Card / ATC without a quantity selector: default the added quantity to the
        // variant's quantity-rule minimum instead of Shopify's implicit 1. Normalize
        // so the minimum is a valid multiple of the increment (e.g. min 1 / inc 2 → 2).
        //
        // Ask the FormData, not the DOM: a quantity input joins the form through its
        // `form="…"` attribute and usually sits OUTSIDE the <form> subtree (the standalone
        // Quantity block renders elsewhere in the product column). querySelector missed
        // those, so this branch ran anyway and overwrote the shopper's quantity with the
        // rule minimum.
        if (!formData.has("quantity")) {
          const qr = (this.currentVariant && this.currentVariant.quantity_rule) || {};
          const minQty = quantityRuleUtils.normalizeRule(qr.min, qr.max, qr.increment).min;
          if (minQty > 1) formData.set("quantity", minQty);
        }

        formData.append(
          "sections",
          sectionsToRender.map((section) => section.id)
        );
        formData.append("sections_url", window.location.pathname);

        // Preprocess data additional fee
        let formDataObject = this.formDataToObject(formData);
        const additionalFeeData = {
          items: [],
          sections: formDataObject.sections,
          sections_url: window.location.pathname,
          "section-id": formDataObject["section-id"],
        };
        const productContent = this.$el.closest(".product-template__content__container");
        let additionalFeePropertyValue = "";
        if (productContent) {
          const arrayAdditionalFeeEl = Array.from(productContent.querySelectorAll(".additional-fee__card.checked"));
          if (arrayAdditionalFeeEl.length > 0) {
            const listIdVariants = [];
            let quantity = parseInt(formDataObject.quantity || 1);
            additionalFeePropertyValue = formDataObject.id;

            arrayAdditionalFeeEl.forEach((item) => {
              additionalFeePropertyValue += `_${item.querySelector(".additional-fee-selected").innerHTML}`;
              listIdVariants.push(item.querySelector(".additional-fee-selected").innerHTML);
            });

            listIdVariants.sort((a, b) => a.index - b.index);
            listIdVariants.forEach((item) => {
              const additionalFeeItem = {
                id: item,
                quantity: quantity,
                properties: { [window.Maximize.cartProperties.additionalFee]: additionalFeePropertyValue },
              };
              additionalFeeData.items.push(additionalFeeItem);
            });
            additionalFeeData.items = [...new Map(additionalFeeData.items.map((item) => [JSON.stringify(item), item])).values()];

            formData.append(`properties[${window.Maximize.cartProperties.additionalFee}]`, additionalFeePropertyValue);
          }
        }

        const _atcContext = this.$el.closest("cart-drawer") ? "dialog" : "product";
        const _atcLines = this.variantId ? [{ id: this.variantId, quantity: Number(formData.get("quantity")) || 1 }] : [];
        const _slUpdate = window.MaximizeStorefrontEvents?.createCartLinesUpdate({
          action: "add",
          context: _atcContext,
          lines: _atcLines,
          element: this.$el,
        });

        await window
          .fetch(`${window.Maximize.routes.addToCart}`, {
            method: "POST",
            credentials: "same-origin",
            headers: { Accept: "application/javascript", "X-Requested-With": "XMLHttpRequest" },
            body: formData,
          })
          .then((response) => {
            return response.json();
          })
          .then(async (response) => {
            if (response.status === 422) {
              const _422msg = response.description || response.message || "";
              // 422 Declined → resolve with userErrors; do NOT also dispatch cart:error (mutually exclusive)
              _slUpdate?.resolve(null, [{ code: "MAXIMUM_EXCEEDED", message: _422msg }]);
              const _recipientErrorEl = document.querySelector(".recipient-error-message");
              if (typeof response.errors == "object" && _recipientErrorEl) {
                this.errorMessage = false;
                _recipientErrorEl.classList.remove("hidden");
              } else {
                const _errorText = response.description || response.message || (typeof response.errors === "string" ? response.errors : "");
                this.errorMessage = true;
                const errorMessageEl = this.$refs.error_message;
                if (errorMessageEl) {
                  if (_errorText) errorMessageEl.textContent = _errorText;
                  if (errorMessageEl.dataset?.autoHideMessage) {
                    setTimeout(() => (this.errorMessage = false), 5000);
                  }
                } else {
                  setTimeout(() => (this.errorMessage = false), 5000);
                }
              }

              await this.handleAddAdditionalFeeItems(additionalFeePropertyValue, additionalFeeData, sectionsToRender, true);

              if (additionalFeePropertyValue === "")
                try {
                  const cartState = await fetch(`${Shopify.routes.root}cart.js`, {
                    headers: { Accept: "application/json" },
                  }).then((res) => res.json());

                  if (cartState && cartState.item_count > window.xCartHelper.currentItemCount) {
                    const sectionsData = await fetch(`${window.location.pathname}?sections=${sectionsToRender.map((section) => section.id).join(",")}`).then((res) => res.json());

                    sectionsToRender.forEach((section) => {
                      const sectionElement = document.querySelector(section.selector);
                      if (sectionElement && sectionsData[section.id]) {
                        sectionElement.innerHTML = getSectionInnerHTML(sectionsData[section.id], section.selector);
                      }
                    });

                    window.xCartHelper.updateCurrentCountItem();
                    document.dispatchEvent(
                      new CustomEvent(`${CART_EVENT.cartUpdate}`, {
                        bubbles: true,
                        detail: {
                          isItemCountChanged: true,
                        },
                      })
                    );
                  }
                } catch (error) {
                  console.error(error);
                }
            } else {
              _slUpdate?.resolve(response);
              this.__updateAddToCartText(this.btnText, true);
              const finalResponse = (await this.handleAddAdditionalFeeItems(additionalFeePropertyValue, additionalFeeData, sectionsToRender, false)) || response;

              document.querySelector(".recipient-error-message") ? document.querySelector(".recipient-error-message").classList.add("hidden") : "";

              sectionsToRender.forEach((section) => {
                const sectionElement = document.querySelector(section.selector);
                if (sectionElement) {
                  if (finalResponse.sections[section.id]) {
                    sectionElement.innerHTML = getSectionInnerHTML(finalResponse.sections[section.id], section.selector);
                    // sectionElement.innerHTML = '';
                  }
                }
              });

              if (Alpine.store("xQuickView") && Alpine.store("xQuickView").show) {
                Alpine.store("xQuickView").close();
              }

              const cartDrawerEl = document.getElementById("CartDrawer");
              if (cartDrawerEl) {
                cartDrawerEl.isOpen = true;
                document.getElementById("CartDrawer__Wrapper")?.classList.add("is-visible");
                if (cartDrawerEl._isOpenUpsell) {
                  const upsellEl = cartDrawerEl.querySelector("cart-drawer-upsell");
                  if (upsellEl) {
                    cartDrawerEl.removeAttribute("upsell-open");
                  }
                }
              }

              window.xCartHelper.updateCurrentCountItem();
              document.dispatchEvent(
                new CustomEvent(`${CART_EVENT.cartUpdate}`, {
                  bubbles: true,
                  detail: {
                    isItemCountChanged: true,
                  },
                })
              );
            }
          })
          .catch((error) => {
            _slUpdate?.reject(error);
            window.MaximizeStorefrontEvents?.dispatchCartError(error?.message || "Add to cart failed", "SERVICE_UNAVAILABLE", this.$el);
            console.error("Error:", error);
          })
          .finally(() => {
            this.isLoading = false;
            if (this.$refs.gift_wrapping_checkbox) this.$refs.gift_wrapping_checkbox.checked = false;
          });
      },
      updatePickUpAvailability(isFirstLoading = true) {
        const pickupAvailabilityEle = document.querySelector(`#PickupAvailability__${sectionId}`);
        if (!pickupAvailabilityEle) return;
        const isHidePickupWhenPreorder = !!(pickupAvailabilityEle.dataset.hideWhenPreorder && pickupAvailabilityEle.dataset.hideWhenPreorder === "true");

        if (this.isShowPreorder && isHidePickupWhenPreorder) {
          pickupAvailabilityEle.innerHTML = "";
          return;
        }

        if (isFirstLoading) this.__initCurrentVariant();
        if (this.currentVariant && this.currentVariant.available) {
          fetch(`${window.Shopify.routes.root}variants/${this.currentVariant.id}/?section_id=pickup-availability`)
            .then((response) => response.text())
            .then((text) => {
              const pickupAvailabilityHTML = new DOMParser().parseFromString(text, "text/html").querySelector(".shopify-section");
              if (pickupAvailabilityHTML) {
                pickupAvailabilityEle.innerHTML = pickupAvailabilityHTML.innerHTML;
              }
            })
            .catch((e) => {
              console.error(e);
            });
        } else {
          pickupAvailabilityEle.innerHTML = "";
        }
      },
      __updateStatus: async function (updateSource, isValidatedGiftCard) {
        if (this.currentVariant) {
          this.variantId = this.currentVariant.id;
          this.isOptionAvailable = this.currentVariant.available;
          this.isOptionExist = true;
          const additionalVariantInfoElement = document.querySelector(`#AdditionalVariantInfo__${sectionId}`);
          if (additionalVariantInfoElement) {
            this.currentVariantAdditionalInfo = JSON.parse(additionalVariantInfoElement.textContent);
          }

          if (optionId) {
            let additionalVariantsInfoElement = this.$el.closest(".product-card__wrapper")?.querySelector(`.variant-inventory`);
            if (additionalVariantsInfoElement) {
              this.currentVariantAdditionalInfo = JSON.parse(additionalVariantsInfoElement.textContent);
            }
          }

          if (this.$el.classList.contains("product-card__form-wrapper")) {
            let additionalVariantsInfoElement = this.$el.closest(".product-card__wrapper")?.querySelector(`.product-card-variant-inventory`);
            if (additionalVariantsInfoElement) {
              this.currentVariantAdditionalInfo = JSON.parse(additionalVariantsInfoElement.textContent);
            }
          }

          this.isAvailableButton = !!(this.currentVariant.available && this.currentVariant.available && this.__validateGiftCard(updateSource, isValidatedGiftCard));

          if (this.currentVariant.available) {
            if (this.atcButtonLabel) {
              this.__updateAddToCartText(this.atcButtonLabel);
            } else {
              this.__updateAddToCartText(window.Maximize.variantStrings.addToCart);
            }
          } else {
            this.__updateAddToCartText(window.Maximize.variantStrings.soldOut);
          }
          let isShowPreorder = false;
          if (isApplyPreorder) {
            if (preorderTypeShow === PREORDER_TYPE_SHOW.yes) {
              if (this.currentVariantAdditionalInfo?.inventory_quantity < 1) {
                if (this.currentVariantAdditionalInfo.inventory_policy === "continue" || this.currentVariantAdditionalInfo.inventory_management === "") {
                  isShowPreorder = true;
                }
              } else {
                isShowPreorder = true;
              }
            } else if (preorderTypeShow === PREORDER_TYPE_SHOW.onBackOrder) {
              if (this.currentVariantAdditionalInfo.inventory_policy === "continue" && this.currentVariantAdditionalInfo.inventory_quantity < 1 && this.currentVariantAdditionalInfo.inventory_management !== "") {
                isShowPreorder = true;
              }
            }
          }
          this.isShowPreorder = isShowPreorder;
          this.isContinueSelling = !isShowPreorder && this.currentVariantAdditionalInfo?.inventory_management !== "" && this.currentVariantAdditionalInfo?.inventory_policy === "continue" && this.currentVariantAdditionalInfo?.inventory_quantity < 1;
          if (isShowPreorder) {
            if (this.__validateGiftCard(updateSource, isValidatedGiftCard)) {
              this.isAvailableButton = true;
            }
            this.__updateAddToCartText(preorderLabel);
            this.isShowPreorder = true;
          }
        } else {
          this.variantId = false;
          this.isOptionExist = false;
          this.isAvailableButton = false;
          this.__updateAddToCartText(window.Maximize.variantStrings.unavailable);
        }

        this.updatePickUpAvailability(false);
      },
      __addGiftWrapping: async function () {
        let isSuccessAddGiftWrapping = true;
        const giftWrappingInput = document.querySelector(`#GiftWrappingInput__${formId}`);

        if (giftWrappingInput && giftWrappingInput.checked && window.Maximize.giftWrappingVariantId && this.currentVariant && this.currentVariant.available) {
          const giftData = {
            items: [
              {
                id: window.Maximize.giftWrappingVariantId,
                quantity: 1,
              },
            ],
          };

          const giftRequest = await window.fetch("/cart/add.js", {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              "X-Requested-With": "XMLHttpRequest",
            },
            body: JSON.stringify(giftData),
          });

          const giftResponse = await giftRequest.json();
          if (!giftRequest.ok) {
            if (giftRequest.status === 422) {
              const giftWrappingError = document.querySelector(`#GiftWrappingError__${formId}`);
              if (giftWrappingError) {
                giftWrappingError.textContent = giftResponse.description;
                this.isLoading = false;
                setTimeout(() => {
                  giftWrappingError.textContent = "";
                }, 5000);
              }
            }
            isSuccessAddGiftWrapping = false;
          }
        }
        return isSuccessAddGiftWrapping;
      },
      __validateGiftCard: function (updateSource, isValidatedGiftCard) {
        let isValidated = true;

        if (updateSource === PRODUCT_FORM_SOURCE_CHANGE.giftCardRecipient) {
          isValidated = isValidatedGiftCard;
        } else if (updateSource === PRODUCT_FORM_SOURCE_CHANGE.variantPicker) {
          this.giftCardWrapperEle = document.querySelector(`#GiftCardRecipient__${sectionId}`);
          if (!this.giftCardWrapperEle) return isValidated;

          isValidated = this.giftCardWrapperEle.dataset.validated === "true";
        }

        return isValidated;
      },
      __initCurrentVariant: function () {
        if (!this.currentVariant) {
          let currentVariantInfoElement = document.querySelector(`#CurrentVariantInfo__${sectionId}`);
          if (currentVariantInfoElement) {
            this.currentVariant = JSON.parse(currentVariantInfoElement.textContent);
          }
        }
      },
      __updateAddToCartText(atcButtonLabel, isSuccess = false) {
        this.btnText = atcButtonLabel;
        if (formId.includes("CartDrawerUpsell")) return;

        const textEl = document.getElementById(`AddToCartText-${formId}`);
        if (!textEl) return;

        const buttonEl = textEl.closest("button");
        const checkIconSpan = buttonEl?.querySelector("[data-check-icon]");

        if (textEl._atcTimeout) {
          clearTimeout(textEl._atcTimeout);
          delete textEl._atcTimeout;
        }

        const mode = textEl.dataset.type || "text";
        const isIconMode = mode === "icon";

        if (atcButtonLabel && !isIconMode) {
          textEl.textContent = atcButtonLabel;
        }

        if (isSuccess && checkIconSpan) {
          textEl.style.visibility = "hidden";
          textEl.style.opacity = "0";
          textEl.setAttribute("aria-hidden", "true");

          checkIconSpan.classList.remove("hidden");

          textEl._atcTimeout = setTimeout(() => {
            checkIconSpan.classList.add("hidden");

            textEl.style.removeProperty("visibility");
            textEl.style.removeProperty("opacity");
            textEl.removeAttribute("aria-hidden");

            delete textEl._atcTimeout;
          }, DURATION.SHOW_ICON_ATC_SUCCESS);
        } else {
          if (checkIconSpan) checkIconSpan.classList.add("hidden");
          textEl.style.removeProperty("visibility");
          textEl.style.removeProperty("opacity");
          textEl.removeAttribute("aria-hidden");
        }
      },
      handleClickButtonCartUpSell: async function (event, hasOnlyDefaultVariant, currentVariantId, productId, productUrl) {
        if (hasOnlyDefaultVariant || !Alpine.store("xQuickView")) {
          const loadingEl = document.querySelector(`#CartUpSellItem_Loading_${productId}`);
          if (loadingEl) {
            loadingEl.classList.remove("hidden");
          }
          await this.handleAddToCart(event, false, currentVariantId);
          if (loadingEl) {
            loadingEl.classList.add("hidden");
          }
        } else {
          if (Alpine.store("xQuickView")) {
            Alpine.store("xQuickView").load(productId, productUrl, this.$el);
            Alpine.store("xQuickView").open("cart_drawer_upsell");
          }
        }
      },
      handleClickButtonAtcInCompareSection: async function (event, isChooseOption, productId, productUrl) {
        if (!isChooseOption || !Alpine.store("xQuickView")) {
          await this.handleAddToCart(event, false);
        } else {
          if (Alpine.store("xQuickView")) {
            Alpine.store("xQuickView").load(productId, productUrl, this.$el);
            Alpine.store("xQuickView").open();
          }
        }
      },
    }));
  });
}
