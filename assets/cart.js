requestAnimationFrame(() => {
  document.addEventListener("alpine:init", () => {
    Alpine.store("xCartHelper", {
      currentItemCount: 0,
      cartShareUrl: "",
      validated: true,
      openField: "",
      isOpenDiscountCodeMainCart: false,
      isCopiedCart: false,
      items: [],
      addItems: function (items) {
        const cartDrawerElement = document.querySelector(`#CartDrawer`);
        let sectionIdCartDrawer;
        if (cartDrawerElement) sectionIdCartDrawer = cartDrawerElement.dataset.sectionId;

        const sectionsToRender = this.getSectionsToRender(sectionIdCartDrawer);

        const sections = sectionsToRender.map((s) => s.id);

        const formData = {
          'items': items,
          'sections': sections
        }

        const _slUpdate = window.MaximizeStorefrontEvents?.createCartLinesUpdate({
          action: 'add',
          context: 'dialog',
          lines: items,
          element: cartDrawerElement || document,
        });

        fetch(Shopify.routes.root + "cart/add.js", {
          method: "POST",
          headers: {"Content-Type": "application/json", Accept: "application/json"},
          body: JSON.stringify(formData)
        }).then(response => response.json())
          .then(response => {
            _slUpdate?.resolve(response);
            sectionsToRender.forEach((section => {
              const sectionElement = document.querySelector(section.selector);
              if (sectionElement) {
                if (response.sections[section.id])
                  sectionElement.innerHTML = getSectionInnerHTML(response.sections[section.id], section.selector);
              }
            }));

            document.getElementById('CartDrawer').isOpen = true;
          })
          .catch(error => {
            _slUpdate?.reject(error);
            window.MaximizeStorefrontEvents?.dispatchCartError(
              error?.message || 'Cart add failed', 'SERVICE_UNAVAILABLE', cartDrawerElement || document
            );
            console.error(error);
          });
      },
      updateCart: function (data, needValidate = false) {
        const formData = JSON.stringify(data);
        fetch(Shopify.routes.root + "cart/update.js", {
          method: "POST",
          headers: {"Content-Type": "application/json", Accept: "application/json"},
          body: formData,
        }).then(() => {
          if (needValidate) this.validateCart();
        });
      },
      changeCart: function (data) {
        fetch(`${Shopify.routes.root}cart/change.js`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }).then((response) => response.text());
      },
      validateCart: function () {
        this.validated = true;
        const cartTerm = document.querySelector(`#MainCart__Agree`);
        if (cartTerm) this.validated = cartTerm.checked;
        document.dispatchEvent(new CustomEvent(`${CART_EVENT.validate}`));
      },
      goToCheckout(e) {
        this.validateCart();

        if (this.validated) {
          let formData = {
            attributes: {
              "collection-pagination": null,
              "blog-pagination": null,
              "choose_option_id": null,
              "datetime-updated": null,
              "datetime-created": null,
              [CART_ATTRIBUTES.product_comparison_options]: null,
              [CART_ATTRIBUTES.product_comparison_metafields]: null
            },
          };

          fetch(Shopify.routes.root + "cart/update", {
            method: "POST",
            headers: {"Content-Type": "application/json", Accept: "application/json"},
            body: JSON.stringify(formData),
          });
        } else {
          e.preventDefault();
        }
      },
      getSectionsToRender(sectionId) {
        let sectionsToRender = [
          {
            id: "cart-icon-bubble",
            selector: '#cart-icon-bubble'
          },
          {
            id: `${sectionId}`,
            selector: '.cart__shipping-and-delivery-wrapper'
          }
        ];

        if (window.Maximize.isCartPage) {
          sectionsToRender.push(
            {
              id: `${sectionId}`,
              selector: '#MainCart__Items'
            }
          )

          const sectionEle = document.querySelector(`.section-${sectionId}`);
          if (sectionEle) {
            const templateId = sectionEle.closest('.shopify-section').id
              .replace('cart-items', '')
              .replace('shopify-section-', '');
          }
        } else {
          if (sectionId) {
            sectionsToRender.push(
              {
                id: `${sectionId}`,
                selector: '#CartDrawer'
              }
            )
          }
        }

        return sectionsToRender;
      },
      generateUrl() {
        fetch(Shopify.routes.root + "cart.js", {
          method: "GET",
          headers: {
            "Content-Type": "application/json"
          }
        })
          .then(response => response.json())
          .then(response => {
            this.items = response.items;

            const serialize = (obj) => {
              return Object.entries(obj).reduce((str, [key, value]) => str.concat(`${encodeURIComponent(key)}:${encodeURIComponent(value.toString())},`), "").slice(0, -1);
            };

            let filteredCart = this.items.map((item) => {
              return {
                id: item.variant_id,
                quantity: item.quantity
              };
            });

            filteredCart.push({share_cart: true});

            const queryString = filteredCart.map(serialize).join("&");

            this.cartShareUrl = `${window.location.origin}?&${queryString}`;
          });
      },
      copyURL(cartShareButton) {
        const cartShareInput = document.querySelector(`#cart-share`);
        if (cartShareInput) {
          cartShareInput.select();
          document.execCommand("copy");
          this.isCopiedCart = true;
        }
      },
      handleSharedCart() {
        if (location.search.includes("share_cart")) {
          const queryString = window.location.search.substring(1);
          let items = [];

          if (queryString.includes(`share_cart:true`)) {
            const idsAndQuantities = queryString.match(/id:\d+,quantity:\d+/g);

            if (idsAndQuantities) {
              idsAndQuantities.forEach(pair => {
                const [idPart, quantityPart] = pair.split(",");
                const id = idPart.split(":")[1];
                const quantity = quantityPart.split(":")[1];

                items.push({
                  id: Number(id),
                  quantity: Number(quantity)
                });
              });
            }
          }

          if (items.length) {
            this.addItems(items);
          }
        }
      },
      updateCurrentCountItem() {
        const cartBubbleContainer = document.querySelector("#cart-icon-bubble .cart-bubble__container");
        this.currentItemCount = parseInt(cartBubbleContainer && cartBubbleContainer.dataset.countItem ? cartBubbleContainer.dataset.countItem : 0);
      },
      closeField(isCloseMiniCart = false) {
        this.isCopiedCart = false;
        if (isCloseMiniCart) {
          const drawerTransitionDuration = DURATION.DRAWER_TRANSITION;
          setTimeout(() => {
            this.openField = "";
          }, drawerTransitionDuration)
        } else {
          this.openField = "";
        }
        Alpine.store('xFocusElement').removeTrapFocus();
      }
    });

    Alpine.data("xCart", (sectionId) => ({
      t: "",
      isLoading: false,
      _errorTimers: {}, // line → auto-hide timer for blur-corrected quantity errors
      // Read the Shopify quantity rule (min/max/increment) from the input's data attrs.
      __getQuantityRule(inputEl) {
        return quantityRuleUtils.normalizeRule(
          inputEl && inputEl.dataset.qtyMin,
          inputEl && inputEl.dataset.qtyMax,
          inputEl && inputEl.dataset.qtyIncrement
        );
      },
      // On blur, an out-of-range value (below min / above max) is auto-corrected to
      // min/max, committed, and the reason shown for 5s. Any other invalid value (off
      // the increment grid) shows a persistent error without committing.
      // qty <= 0 means "remove" and is treated as valid. Returns whether it was valid.
      validateItemQty(inputEl, line, event, additionalFeePropertyValue) {
        if (!inputEl) return false;
        const qty = parseInt(inputEl.value);
        const rule = this.__getQuantityRule(inputEl);
        // A blank / non-numeric entry is not "remove" — only an explicit 0 is. It used to
        // fall through the `!(qty > 0)` shortcut below and be accepted as valid, which left
        // the box empty with no correction and no message.
        if (!Number.isInteger(qty) && inputEl.value.trim() !== "0") {
          const message = quantityRuleUtils.buildError(inputEl.value, rule); // from the typed value
          inputEl.value = rule.min;
          this._addQtyError(line, message, 3000);
          this.__postUpdateItem(line, rule.min, additionalFeePropertyValue || "");
          return true;
        }
        if (!(qty > 0) || quantityRuleUtils.isValid(qty, rule)) {
          this._clearQtyError(line);
          return true;
        }
        const belowMin = qty < rule.min;
        const aboveMax = rule.max !== null && qty > rule.max;
        if (event && event.type === "blur" && (belowMin || aboveMax)) {
          const message = quantityRuleUtils.buildError(inputEl.value, rule); // from the typed value
          const corrected = belowMin ? rule.min : rule.max;
          inputEl.value = corrected;
          this._addQtyError(line, message, 3000);
          this.__postUpdateItem(line, corrected, additionalFeePropertyValue || "");
          return true;
        }
        // Off-grid (in range): persistent error, do NOT commit. Never re-focus the
        // input — that stole clicks aimed at the +/- buttons and other cart lines.
        this._addQtyError(line, quantityRuleUtils.buildError(inputEl.value, rule));
        return false;
      },
      // Quantity-rule error → tooltip next to the qty input (content drives it open via
      // MutationObserver). autoHideMs auto-clears after a delay; a newer message/clear
      // cancels the pending hide.
      _addQtyError(line, message, autoHideMs) {
        const el = document.getElementById(`QtyRuleError-${line}`);
        if (!el) return;
        clearTimeout(this._errorTimers[line]);
        const textEl = el.getElementsByClassName("cart-item__qty-error-text")[0];
        if (textEl) textEl.innerHTML = message;
        if (message && autoHideMs) {
          this._errorTimers[line] = setTimeout(() => this._clearQtyError(line), autoHideMs);
        }
      },
      _clearQtyError(line) {
        const el = document.getElementById(`QtyRuleError-${line}`);
        if (!el) return;
        clearTimeout(this._errorTimers[line]);
        const textEl = el.getElementsByClassName("cart-item__qty-error-text")[0];
        if (textEl) textEl.innerHTML = ""; // empty content closes the tooltip (MutationObserver)
      },
      updateItemQty(line, additionalFeePropertyValue) {
        const inputEl = document.getElementById(`CartItemQuantity--${line}`);
        let qty = parseInt(inputEl.value);
        if (!this.__validateQty(qty)) return;
        // 500ms-input path: silently skip posting an invalid (off-rule) quantity so
        // mid-typing values don't flash an error. The B2B 2s-debounce validation
        // (validateItemQty) surfaces the error after the pause.
        if (qty > 0 && !quantityRuleUtils.isValid(qty, this.__getQuantityRule(inputEl))) return;
        this._clearQtyError(line);
        this.__postUpdateItem(line, qty, additionalFeePropertyValue);
      },
      // step() snaps an off-grid value to the nearest valid one IN the pressed direction.
      // normalizeQuantity rounds to the *nearest*, so pressing "-" on an off-grid quantity
      // could jump the value up — and land on a different increment band than the one named
      // in the error message.
      minusItemQty(line, additionalFeePropertyValue) {
        const inputEl = document.getElementById(`CartItemQuantity--${line}`);
        let qty = parseInt(inputEl.value);
        if (this.__validateQty(qty)) {
          if (qty > 0) {
            const rule = this.__getQuantityRule(inputEl);
            const next = quantityRuleUtils.step(qty, rule, -1);
            // step() clamps at the minimum, so it failing to lower the value means we were already
            // at the floor — and nothing between 0 and the minimum is orderable, so remove the line.
            qty = next >= qty ? 0 : next;
            inputEl.value = qty;
          }
          this._clearQtyError(line);
          this.__postUpdateItem(line, qty, additionalFeePropertyValue);
        }
      },
      plusItemQty(line, additionalFeePropertyValue) {
        const inputEl = document.getElementById(`CartItemQuantity--${line}`);
        let qty = parseInt(inputEl.value);
        if (this.__validateQty(qty)) {
          const rule = this.__getQuantityRule(inputEl);
          qty = qty <= 0 ? rule.min : quantityRuleUtils.step(qty, rule, 1);
          inputEl.value = qty;
          this._clearQtyError(line);
          this.__postUpdateItem(line, qty, additionalFeePropertyValue);
        }
      },
      removeItem(line, additionalFeePropertyValue) {
        this.__postUpdateItem(line, 0, additionalFeePropertyValue, 0);
      },
      handleKeydown(evt, el, line, additionalFeePropertyValue) {
        if (evt.key !== "Enter") return;
        evt.preventDefault();
        // Enter = explicit commit: validate now instead of waiting for the 2s debounce
        // (B2B-only; the old flow relied on the now-removed @blur handler).
        if (window.Maximize?.isB2BCustomer && line != null) {
          this.validateItemQty(el, line, { type: "blur" }, additionalFeePropertyValue || "");
        }
      },
      updateCartItem(line, errorMessage) {
        fetch(`${window.Shopify.routes.root}?section_id=${sectionId}`, {
          method: "GET",
          headers: {
            Accept: "application/javascript",
            "Content-Type": "application/json",
          },
        })
          .then((response) => response.text())
          .then((text) => {
            const newCartSectionHTML = new DOMParser().parseFromString(text, "text/html").querySelector(".shopify-section");

            const newCartWrapperHTML = newCartSectionHTML.querySelector(`.cart-wrapper-${sectionId}`);
            if (newCartWrapperHTML) {
              const oldCartItemEle = document.querySelector(`.cart-wrapper-${sectionId} .cart-item__wrapper[data-cart-item-line="${line}"]`);
              const newCartItemEle = newCartWrapperHTML.querySelector(`.cart-item__wrapper[data-cart-item-line="${line}"]`);

              if (oldCartItemEle && newCartItemEle) {
                oldCartItemEle.outerHTML = newCartItemEle.outerHTML;
              }

              this._addErrorMessage(line, errorMessage);
            }
          });
      },
      updateEstimateShippingCart(el, estimateShippingKey) {
        const attributeEstimateShipping = {};
        const estimateContentEle = el.querySelector('.estimate-content');
        if (estimateContentEle) {
          const clone = estimateContentEle.cloneNode(true);

          clone.querySelector('.tooltip-icon-estimate')?.remove();

          const text = clone.textContent.replace(/\s+/g, ' ').trim();

          attributeEstimateShipping[estimateShippingKey] = text;

          Alpine.store('xCartHelper').updateCart({
            attributes: attributeEstimateShipping
          });
        }
      },
      updateEstimateShippingCartItem(el, line) {
        const quantityEle = document.querySelector(`#CartItemQuantity--${line}`);
        const qty = quantityEle ? parseInt(quantityEle.value) : 1;
        const properties = xParseJSON(el.dataset.properties);

        let updateData = {
          line: `${line}`,
          quantity: `${qty}`,
          properties: properties,
        };

        Alpine.store('xCartHelper').changeCart(updateData);
      },
      updateDate(date) {
        let formData = {
          attributes: {
            "datetime-updated": `${date}`,
          },
        };
        fetch(Shopify.routes.root + "cart/update", {
          method: "POST",
          headers: {"Content-Type": "application/json", Accept: "application/json"},
          body: JSON.stringify(formData),
        })
          .then((response) => response.json())
          .catch((error) => console.error(error));
      },
      // Server/API error → inline flash message at the top of the cart item (a separate
      // element from the quantity-rule tooltip). Cleared by the section re-render on a
      // successful update, or replaced by a newer server error.
      _addErrorMessage(line, message) {
        const lineItemError = document.getElementById(`LineItemError-${line}`);
        if (!lineItemError) return;
        lineItemError.classList.remove("hidden");
        lineItemError.getElementsByClassName("cart-item__error-text")[0].innerHTML = message;
      },
      _clearErrorMessage(line) {
        const lineItemError = document.getElementById(`LineItemError-${line}`);
        if (!lineItemError) return;
        lineItemError.classList.add("hidden");
        const textEl = lineItemError.getElementsByClassName("cart-item__error-text")[0];
        if (textEl) textEl.innerHTML = "";
      },
      async handleUpdateAdditionalFeeData(additionalFeePropertyValue, additionalFeeItemsUpdate, additionalFeeItemsData, sectionsToRender, mainItemKey, qty, isUpdateError) {
        if (additionalFeePropertyValue != '') {
          if (isUpdateError) {
            await fetch(Shopify.routes.root + "cart.js", {
              method: "GET",
              headers: {
                "Content-Type": "application/json"
              }
            })
              .then(responseCart => responseCart.json())
              .then( async (responseCart) => {
                const items = responseCart.items;
                let newQty = qty;
                for(let i=0; i<items.length; i++) {
                  if (items[i].key == mainItemKey) {
                    newQty = items[i].quantity;
                    break;
                  }
                }
                additionalFeeItemsUpdate.map(item => {
                  additionalFeeItemsData.updates[item.itemKey] = newQty
                })
                
                await fetch(window.Maximize.routes.cartUpdate, {
                  method: "POST",
                  headers: {
                    Accept: "application/javascript",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(additionalFeeItemsData),
                })
                  .then(responseAdditionalFee => responseAdditionalFee.json())
                  .then((responseAdditionalFee) => {
                    sectionsToRender.forEach((section) => {
                      const sectionElement = document.querySelector(section.selector);
                      if (sectionElement) {
                        if (responseAdditionalFee.sections[section.id]) sectionElement.innerHTML = getSectionInnerHTML(responseAdditionalFee.sections[section.id], section.selector);
                      }
                    });
                  })
              });
            return;
          } else {
            additionalFeeItemsUpdate.map(item => {
              additionalFeeItemsData.updates[item.itemKey] = qty
            })
            
            return await fetch(window.Maximize.routes.cartUpdate, {
              method: "POST",
              headers: {
                Accept: "application/javascript",
                "Content-Type": "application/json",
              },
              body: JSON.stringify(additionalFeeItemsData),
            })
              .then(responseAdditionalFee => responseAdditionalFee.json())
          }
        }
        return;
      },
      __postUpdateItem(line, qty, additionalFeePropertyValue, wait = 500) {
        clearTimeout(this.t);

        const func = () => {
          this.isLoading = true;

          const sectionsToRender = Alpine.store("xCartHelper").getSectionsToRender(sectionId);
          const sections = sectionsToRender.map((s) => s.id);

          let updateData = {
            line: `${line}`,
            quantity: `${qty}`,
            sections: sections
          };

          const loadingEle = document.getElementById(`CartItem__Loading__${line}`);
          if (loadingEle) {
            loadingEle.classList.remove('hidden');
          }
          let removeEl = document.getElementById(`CartItemRemove-${line}`);
          if (removeEl) {
            removeEl.style.display = "none";
          }

          const additionalFeeItemsData = {
            updates: {},
            sections: sections
          }
          const additionalFeeItemsUpdate = []
          let mainItemKey = ''

          // Preprocess data additional fee
          if (additionalFeePropertyValue != '') {
            Array.from(document.querySelectorAll(`.cart-item__wrapper[data-additional-fee-property="${additionalFeePropertyValue}"]`)).map(item => {
              if (additionalFeePropertyValue.split('_')[0] != item.dataset.variantId) {
                additionalFeeItemsUpdate.push({
                  itemKey: item.dataset.cartItemKey,
                  itemLine: item.dataset.cartItemLine
                })
              }
              else {
                mainItemKey = item.dataset.cartItemKey
              }
            })
          }

          const _slAction = qty <= 0 ? 'remove' : 'update';
          const _slUpdate = window.MaximizeStorefrontEvents?.createCartLinesUpdate({
            action: _slAction,
            context: 'cart',
            lines: [{ line: `${line}`, quantity: qty }],
            element: document,
          });

          // call api update cart
          fetch(window.Maximize.routes.cartChange, {
            method: "POST",
            headers: {
              Accept: "application/javascript",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updateData),
          })
            .then((response) => {
              if (!response.ok && response.errors) {
                this._addErrorMessage(line, response.message);
                this.updateCart(line);
              }

              return response.json();
            })
            .then(async (response) => {
              if (response.status === 422) {
                // Declined change (422) → resolve with userErrors, do NOT reject or dispatch cart:error.
                _slUpdate?.resolve(null, [{ code: 'MAXIMUM_EXCEEDED', message: response.message || '' }]);
                await this.handleUpdateAdditionalFeeData(additionalFeePropertyValue, additionalFeeItemsUpdate, additionalFeeItemsData, sectionsToRender, mainItemKey, qty, true)

                this.updateCartItem(line, response.message);
              } else {
                if (response.errors) {
                  // Cart declined change → resolve with userErrors.
                  let _errMsg = typeof response.errors === 'string' ? response.errors : 'Cart update error';
                  _slUpdate?.resolve(null, [{ code: 'INVALID', message: _errMsg }]);
                  this._addErrorMessage(line, response.errors);
                } else {
                  const finalResponse = await this.handleUpdateAdditionalFeeData(additionalFeePropertyValue, additionalFeeItemsUpdate, additionalFeeItemsData, sectionsToRender, mainItemKey, qty, false) || response

                  _slUpdate?.resolve(finalResponse);
                  sectionsToRender.forEach((section) => {
                    const sectionElement = document.querySelector(section.selector);
                    if (sectionElement) {
                      if (section.selector === "#MainCart__Items") {
                        const mainCartElement = sectionElement;
                        mainCartElement.classList.add("disable-fade-element")
                      }
                      if (finalResponse.sections[section.id]) sectionElement.innerHTML = getSectionInnerHTML(finalResponse.sections[section.id], section.selector);
                    }
                  });

                  if (!window.Maximize.isCartPage) {
                    if (Alpine.store("xProductRecommendations")) {
                      Alpine.store("xProductRecommendations").updateCartDrawerUpsellStatus();
                    }
                  }

                  const currentItemCount = Alpine.store("xCartHelper").currentItemCount;
                  if (currentItemCount !== finalResponse.item_count) {
                    Alpine.store("xCartHelper").currentItemCount = finalResponse.item_count;
                    document.dispatchEvent(new CustomEvent(`${CART_EVENT.cartUpdate}`, {
                      bubbles: true,
                      detail: {
                        isItemCountChanged: true,
                      }
                    }));
                  }
                }
              }
            })
            .catch(e => {
              _slUpdate?.reject(e);
              window.MaximizeStorefrontEvents?.dispatchCartError(
                e?.message || 'Cart update failed', 'SERVICE_UNAVAILABLE', document
              );
              console.error("Error updating cart item:", e);
            })
            .finally(() => {
              this.isLoading = false;
              if (loadingEle) {
                loadingEle.classList.add('hidden');
              }
            });
        };

        this.t = setTimeout(() => {
          func();
        }, wait);
      },
      __validateQty: function (number) {
        return !(parseFloat(number) !== parseInt(number) && isNaN(number));
      },
    }));


    Alpine.store('xCartAnalytics', {
      viewCart() {
        fetch(
          '/cart.js'
        ).then(response => {
          return response.text();
        }).then(cart => {
          cart = JSON.parse(cart);
          if (cart.items.length > 0) {
            Shopify.analytics.publish('view_cart', {'cart': cart});
          }
          window.MaximizeStorefrontEvents?.dispatchCartView('page', cart, document);
        });
      }
    });
  })
})
