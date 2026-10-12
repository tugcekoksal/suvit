if (!window.Maximize.loadedScript.includes('coupon-code.js')) {
  window.Maximize.loadedScript.push('coupon-code.js');
  
  const _registerCouponCode = () => {
    // Alpine.data("xCouponCodeList", (sectionId) => ({
      //   loading: true,
      //   load() {
      //     this.loading = true;
      //     let url = `${window.location.pathname}?section_id=${sectionId}`;
      //     fetch(url, {
      //       method: 'GET'
      //     }).then(
      //       response => response.text()
      //     ).then(responseText => {
      //       const html = (new DOMParser()).parseFromString(responseText, 'text/html');
      //       const contentId = `x-promo-code-list-${sectionId}`;
      //       const newContent = html.getElementById(contentId);
      //       if (newContent && !document.getElementById(contentId)) {
      //         container.appendChild(newContent);
      //       }
      //       this.loading = false;
      //     })
      //   }
      // }));
      
      Alpine.data("xCouponCode", () => ({
        copySuccess: false,
        loading: false,
        disableCoupon: false,
        disableComing: false,
        discountCode: "",
        errorMessage: false,
        appliedDiscountCode: false,
        load(discountCode) {
          this.setAppliedButton(discountCode);
          document.addEventListener(`${CART_EVENT.discountCodeChange}`, (e) => {
            this.setAppliedButton(discountCode);
          });
        },
        copyCode() {
          if (this.copySuccess) return;

          const discountCode = this.$refs.code_value.textContent.trim();
          navigator.clipboard.writeText(discountCode).then(
            () => {
              this.copySuccess = true;

              setTimeout(() => {
                this.copySuccess = false;
              }, 5000);
            },
            () => {
              alert("Copy fail");
            }
          );
        },
        applyCouponCode(sectionId, discountCode) {
          Alpine.store("xCouponCodeDetail").discountFailed = false;
          Alpine.store("xCouponCodeDetail").discountApplied = false;
          Alpine.store("xCouponCodeDetail").discountCorrect = false;
          Alpine.store("xCouponCodeDetail").getDiscountCode();
          let appliedDiscountCodes = JSON.parse(JSON.stringify(Alpine.store("xCouponCodeDetail").appliedDiscountCodes));
          const appliedDiscount = document.querySelectorAll(".discount-title");
          let checkedDiscount = false;
          if (appliedDiscount.length > 0) {
            appliedDiscount.forEach((discount) => {
              if (discount.dataset.discountTitle.toLowerCase() == discountCode.toLowerCase()) checkedDiscount = true;
            });
          }
          if (checkedDiscount) {
            Alpine.store("xCouponCodeDetail").discountApplied = true;
            document.querySelector("#Cart__DiscountField") && (document.querySelector("#Cart__DiscountField").value = "");
            this.discountCode = "";
            setTimeout(() => {
              Alpine.store("xCouponCodeDetail").discountApplied = false;
            }, 3000);
            return true;
          }
          if (discountCode) {
            let listDiscountCodes = appliedDiscountCodes.length > 0 ? [...appliedDiscountCodes, discountCode].join(",") : discountCode;

            let sectionsToRender ;
            if (window.Maximize.isCartPage) {
              sectionsToRender = Alpine.store("xCartHelper").getSectionsToRender(sectionId);
            } else {
              let carDrawerElement = document.querySelector("#CartDrawer");
              const cartDrawerSectionId = carDrawerElement && carDrawerElement.dataset.sectionId ? carDrawerElement.dataset.sectionId : false;
              sectionsToRender = Alpine.store("xCartHelper").getSectionsToRender(cartDrawerSectionId);
            }
            const sections = sectionsToRender.map((section) => section.id);

            this.loading = true;
            let cartDrawer = false;
            let mainCartItems = false;

            const _newDiscountCodes = appliedDiscountCodes.length > 0
              ? [...appliedDiscountCodes, discountCode]
              : [discountCode];
            const _slDiscount = window.MaximizeStorefrontEvents?.createCartDiscountUpdate(
              _newDiscountCodes, document
            );

            fetch(`/checkout?skip_shop_pay=true&discount=${encodeURIComponent(listDiscountCodes)}`)
              .then((response) => {
                fetch("/cart/update.js", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sections: sections
                  })
                })
                  .then((response) => {
                    return response.json();
                  })
                  .then((response) => {
                    if (response.status !== 422) {
                      const discountApplySuccessArr = response.discount_codes || [];

                      const discountApplySuccess = discountApplySuccessArr
                        .filter(discount => discount.applicable === true) 
                        .map(discount => discount.code)
                        .join(',');  
                      document.cookie = `maximize_discount_code=${discountApplySuccess}; path=/`;
                      sectionsToRender.forEach((section) => {
                        const sectionElement = document.querySelector(section.selector);
                        if (sectionElement) {
                          if (response.sections[section.id]) {
                            const sectionInnerHTML = getSectionInnerHTML(response.sections[section.id], section.selector);
                            sectionElement.innerHTML = sectionInnerHTML;
                            if (section.selector === "#CartDrawer") {
                              cartDrawer = sectionInnerHTML;
                            }
                            if (section.selector === "#MainCart__Items") {
                              mainCartItems = sectionInnerHTML;
                            }
                          }
                        }
                      });
                      checkedDiscount = false;
                      const parser = new DOMParser();

                      if (mainCartItems) {
                        const mainCartHTML = parser.parseFromString(mainCartItems, "text/html");
                        const discountTitleCartPage = mainCartHTML.querySelectorAll(".discount-title");
                        if (discountTitleCartPage.length > 0) {
                          discountTitleCartPage.forEach((discount) => {
                            if (discount.dataset.discountTitle.toLowerCase() === discountCode.toLowerCase()) checkedDiscount = true;
                          });
                        }
                      }
                      if (cartDrawer) {
                        const cartDrawerHtml = parser.parseFromString(cartDrawer, "text/html");
                        const discountTitle = cartDrawerHtml.querySelectorAll(".discount-title");
                        if (discountTitle.length > 0) {
                          discountTitle.forEach((discount) => {
                            if (discount.dataset.discountTitle.toLowerCase() === discountCode.toLowerCase()) checkedDiscount = true;
                          });
                        }
                      }
                      
                      if (checkedDiscount) {
                        Alpine.store("xCouponCodeDetail").discountCorrect = true;
                        setTimeout(() => {
                          Alpine.store("xCartHelper").openField = false;
                          Alpine.store("xCartHelper").isOpenDiscountCodeMainCart = false;
                        }, 3000);
                      } else {
                        Alpine.store("xCouponCodeDetail").discountFailed = true;
                      }
                      _slDiscount?.resolve(response);
                      Alpine.store("xCouponCodeDetail").appliedDiscountCodes.push(discountCode);
                      Alpine.store("xCartHelper").updateCurrentCountItem();
                      document.dispatchEvent(new CustomEvent(`${CART_EVENT.discountCodeChange}`));
                      if (window.Maximize.isCartPage) {

                      } else {
                        document.getElementById('CartDrawer').isOpen = true;
                      }
                    }
                  })
                  .finally(() => {
                    this.loading = false;
                    setTimeout(() => {
                      Alpine.store("xCouponCodeDetail").discountFailed = false;
                    }, 5000);
                    setTimeout(() => {
                      Alpine.store("xCouponCodeDetail").discountCorrect = false;
                    }, 3000);
                  });
              })
              .catch((error) => {
                _slDiscount?.reject(error);
                console.error("Error:", error);
              });
          }
        },
        handleScheduleCoupon(el) {
          let settings = xParseJSON(el.getAttribute("x-countdown-data"));
          let timeSettings = Alpine.store("xHelper").handleTime(settings);
          if (timeSettings.distance < 0 && settings.set_end_date) {
            this.disableCoupon = true;
          } else if (timeSettings.startTime > timeSettings.now) {
            this.disableCoupon = true;
            this.disableComing = true;
          }
        },
        onChange() {
          this.discountCode = this.$el.value;
        },
        applyDiscountToCart(sectionId) {
          this.applyCouponCode(sectionId, this.discountCode);
        },
        setAppliedButton(discountCode) {
          let appliedDiscountCodes = JSON.parse(JSON.stringify(Alpine.store("xCouponCodeDetail").appliedDiscountCodes));
          this.appliedDiscountCode = discountCode && appliedDiscountCodes.indexOf(discountCode) !== -1;
        }
      }));
      Alpine.store('xCouponCodeDetail', {
        show: false,
        promoCodeDetail: {},
        sectionID: "",
        discountCodeApplied: "",
        appliedDiscountCodes: [],
        cachedResults: [],
        loading: false,
        cartEmpty: true,
        discountFailed: false,
        discountApplied: false,
        discountCorrect: false,
        handleCouponSelect(shopUrl) {
          let _this = this;
          const promoCodeDetail = JSON.parse(JSON.stringify(this.promoCodeDetail));
  
          document.addEventListener('shopify:section:select', function(event) {
            if (!event.target.classList.contains('section-promo-code')) {
              if (window.Alpine) {
                _this.close();
              } else {
                document.addEventListener('alpine:initialized', () => {
                  _this.close();
                });
              }
            }
          })

          if(promoCodeDetail && promoCodeDetail.blockID && promoCodeDetail.sectionID) {
            this.promoCodeDetail = xParseJSON(document.getElementById('x-data-promo_code-' + promoCodeDetail.blockID).getAttribute('x-data-promo_code'));
            let contentContainer = document.getElementById('PromoCodeContent-' + this.promoCodeDetail.sectionID);
            if (this.cachedResults[this.promoCodeDetail.blockID]) {
              contentContainer.innerHTML = this.cachedResults[this.promoCodeDetail.blockID];
              return true;
            }
            if (this.promoCodeDetail.page !== '') {
              let url = `${shopUrl}/pages/${this.promoCodeDetail.page}`;
              fetch(url, {
                method: 'GET'
              }).then(
                response => response.text()
              ).then(responseText => {
                const html = (new DOMParser()).parseFromString(responseText, 'text/html');
                contentContainer.innerHTML = html.querySelector(".page__container .page__body").innerHTML;
              })
            } else if (this.promoCodeDetail.details !== '') {
              contentContainer.innerHTML = this.promoCodeDetail.details;
              contentContainer.innerHTML = contentContainer.textContent;
            }
          }
        },
        load(el, blockID, shopUrl) {
          this.promoCodeDetail = xParseJSON(el.closest('#x-data-promo_code-' + blockID).getAttribute('x-data-promo_code'));
          let contentContainer = document.getElementById('PromoCodeContent-' + this.promoCodeDetail.sectionID);
          this.sectionID = this.promoCodeDetail.sectionID;
          if (this.cachedResults[blockID]) {
            contentContainer.innerHTML = this.cachedResults[blockID];
            return true;
          }
          if (this.promoCodeDetail.page !== '') {
            this.loading = true;
            let url = `${shopUrl}/pages/${this.promoCodeDetail.page}`;
            fetch(url, {
              method: 'GET'
            }).then(
              response => response.text()
            ).then(responseText => {
              const html = (new DOMParser()).parseFromString(responseText, 'text/html');
              const content = html.querySelector(".page__container .page__body").innerHTML;
              contentContainer.innerHTML = content;
              this.cachedResults[blockID] = content;
            }).finally(() => {
              this.loading = false;
            })
          } else if (this.promoCodeDetail.details !== '') {
            contentContainer.innerHTML = this.promoCodeDetail.details;
            contentContainer.innerHTML = contentContainer.textContent;
          }
        },
        showPromoCodeDetail() {
          this.show = true;
          Alpine.store('xMaximizePopup').handleOpen();
        },
        close() {
          this.show = false;
          Alpine.store('xMaximizePopup').handleClose();
        },
        getDiscountCode() {
          let cookieValue = document.cookie.match('(^|;)\\s*' + 'maximize_discount_code' + '\\s*=\\s*([^;]+)');
          let appliedDiscountCodes = cookieValue ? cookieValue.pop() : '';
          this.appliedDiscountCodes = appliedDiscountCodes.split(",");
        }
      });
  };

  if (window.Alpine) {
    _registerCouponCode();
  } else {
    document.addEventListener("alpine:init", _registerCouponCode);
  }

  class CouponCode extends HTMLElement {
    connectedCallback() {
      this._sectionId = this.dataset.sectionId;
      this._appliedDiscountCodes = [];

      this._inputEl = this.querySelector("[data-coupon-input]");
      this._buttonLabelEl = this.querySelector(".coupon-button-label");
      this._spinnerEl = this.querySelector(".coupon-spinner");
      this._failedEl = this.querySelector(".coupon-failed");
      this._appliedEl = this.querySelector(".coupon-applied");
      this._correctEl = this.querySelector(".coupon-correct");
      this._failedRemoveDiscountEl = this.querySelector(".discount-message-failure");

      this._loadAppliedCodes();

      this.addEventListener("click", this._onClick.bind(this));
      this._inputEl?.addEventListener("keyup", (e) => {
        if (e.key === "Enter") this._apply();
      });

      this._boundDiscountChange = this._loadAppliedCodes.bind(this);
      document.addEventListener(CART_EVENT.discountCodeChange, this._boundDiscountChange);
    }

    disconnectedCallback() {
      document.removeEventListener(CART_EVENT.discountCodeChange, this._boundDiscountChange);
    }

    _loadAppliedCodes() {
      const cookieValue = document.cookie.match("(^|;)\\s*maximize_discount_code\\s*=\\s*([^;]+)");
      const codes = cookieValue ? cookieValue.pop() : "";
      this._appliedDiscountCodes = codes ? codes.split(",") : [];
    }

    _onClick(e) {
      if (e.target.closest('[data-action="apply"]')) this._apply();
      if (e.target.closest('[data-action="remove"]')) this._remove(e.target.closest('[data-action="remove"]'));
    }

    set _isLoading(val) {
      this._buttonLabelEl?.classList.toggle("opacity-0", val);
      this._buttonLabelEl?.classList.toggle("is-focus-button", val);
      this._spinnerEl?.classList.toggle("hidden", !val);
    }

    _setStatus(type) {
      this._failedEl?.classList.toggle("hidden", type !== "failed");
      this._appliedEl?.classList.toggle("hidden", type !== "applied");
      this._correctEl?.classList.toggle("hidden", type !== "correct");
    }

    _setRemoveLoading(btn, isLoading) {
      const icon = btn.querySelector('.discount-icon-remove');
      const spinner = btn.querySelector('.discount-spinner');
      if (icon) icon.classList.toggle('invisible', isLoading);
      if (spinner) spinner.classList.toggle('invisible', !isLoading);
      btn.disabled = isLoading;
    }

    _setAllRemoveButtonsDisabled(isDisabled) {
      const buttons = this.querySelectorAll('[data-action="remove"]');
      buttons.forEach(btn => {
        btn.disabled = isDisabled;
        btn.classList.toggle('opacity-50', isDisabled);
        btn.classList.toggle('pointer-events-none', isDisabled);
      });
    }

    _setStatusRemoveCoupon(type) {
      if (!this._failedRemoveDiscountEl) return;
      if (type === 'failure') {
        this._failedRemoveDiscountEl.classList.remove('hidden');
        setTimeout(() => this._failedRemoveDiscountEl.classList.add('hidden'), DURATION.FLASH_MESSAGE);
      }
    }

    _apply() {
      const discountCode = this._inputEl?.value.trim();
      if (!discountCode) return;

      this._setStatus(null);
      this._loadAppliedCodes();

      // Check already applied in cart
      const discountTitles = document.querySelectorAll(".discount-title");
      for (const el of discountTitles) {
        if (el.dataset.discountTitle?.toLowerCase() === discountCode.toLowerCase()) {
          this._setStatus("applied");
          if (this._inputEl) this._inputEl.value = "";
          setTimeout(() => this._setStatus(null), 3000);
          return;
        }
      }

      const listCodes = this._appliedDiscountCodes.length > 0 ? [...this._appliedDiscountCodes, discountCode].join(",") : discountCode;

      let sectionsToRender;
      if (window.Maximize.isCartPage) {
        sectionsToRender = window.xCartHelper.getSectionsToRender(this._sectionId);
      } else {
        const cartDrawerEl = document.querySelector("#CartDrawer");
        const cartSectionId = cartDrawerEl?.dataset.sectionId;
        sectionsToRender = window.xCartHelper.getSectionsToRender(cartSectionId);
      }
      const sections = sectionsToRender.map((s) => s.id);

      this._isLoading = true;

      // discountCodes is the full intended set after applying this code.
      const _newCodes = this._appliedDiscountCodes.length > 0
        ? [...this._appliedDiscountCodes, discountCode]
        : [discountCode];
      const _slDiscount = window.MaximizeStorefrontEvents?.createCartDiscountUpdate(_newCodes, this);

      fetch(`/checkout?skip_shop_pay=true&discount=${encodeURIComponent(listCodes)}`)
        .then(() =>
          fetch("/cart/update.js", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sections }),
          })
        )
        .then((r) => r.json())
        .then((response) => {
          if (response.status === 422) {
            _slDiscount?.resolve(response);
            return;
          }
          const discountApplySuccessArr = response.discount_codes || [];

          const discountApplySuccess = discountApplySuccessArr
            .filter(discount => discount.applicable === true) 
            .map(discount => discount.code)
            .join(',');  
          document.cookie = `maximize_discount_code=${discountApplySuccess}; path=/`;
          let cartDrawerHtml = null;
          let mainCartHtml = null;

          sectionsToRender.forEach((section) => {
            const sectionEl = document.querySelector(section.selector);
            if (sectionEl && response.sections[section.id]) {
              const html = getSectionInnerHTML(response.sections[section.id], section.selector);
              if (section.selector === "#CartDrawer") {
                const wrapperVisible = sectionEl.querySelector("#CartDrawer__Wrapper")?.classList.contains("is-visible");
                const upsellEl = sectionEl.querySelector("#CartDrawer__Upsell");
                if (upsellEl) upsellEl.remove();
                sectionEl.innerHTML = html;
                if (wrapperVisible) sectionEl.querySelector("#CartDrawer__Wrapper")?.classList.add("is-visible");
                if (upsellEl) {
                  const newUpsellSlot = sectionEl.querySelector("#CartDrawer__Upsell");
                  if (newUpsellSlot) newUpsellSlot.replaceWith(upsellEl);
                }
                cartDrawerHtml = html;
              } else {
                sectionEl.innerHTML = html;
                if (section.selector === "#MainCart__Items") mainCartHtml = html;
              }
            }
          });

          // 'this' may have been detached by innerHTML replacement — resolve live element
          const liveCoupon = document.contains(this) ? this : document.querySelector("coupon-code");

          let checkedDiscount = false;
          const parser = new DOMParser();
          for (const html of [cartDrawerHtml, mainCartHtml]) {
            if (!html) continue;
            parser
              .parseFromString(html, "text/html")
              .querySelectorAll(".discount-title")
              .forEach((el) => {
                if (el.dataset.discountTitle?.toLowerCase() === discountCode.toLowerCase()) checkedDiscount = true;
              });
          }

          if (checkedDiscount) {
            liveCoupon?._setStatus("correct");
            this._appliedDiscountCodes.push(discountCode);
            setTimeout(() => {
              liveCoupon?._setStatus(null);
              window.xCartHelper.openField = false;
              window.xCartHelper.isOpenDiscountCodeMainCart = false;
            }, 3000);
          } else {
            liveCoupon?._setStatus("failed");
            setTimeout(() => liveCoupon?._setStatus(null), 5000);
          }

          _slDiscount?.resolve(response);
          window.xCartHelper.updateCurrentCountItem();
          document.dispatchEvent(new CustomEvent(CART_EVENT.discountCodeChange));

          if (!window.Maximize.isCartPage) {
            document.dispatchEvent(new CustomEvent(CART_EVENT.cartUpdate, { detail: { openMiniCart: true } }));
          }
        })
        .catch((e) => {
          _slDiscount?.reject(e);
          console.error("Error applying discount:", e);
        })
        .finally(() => {
          const liveCoupon = document.contains(this) ? this : document.querySelector("coupon-code");
          if (liveCoupon) liveCoupon._isLoading = false;
        });
    }

    _remove(removeBtn) {
      const discountCode = removeBtn.dataset.removeCode
      this._setRemoveLoading(removeBtn, true);
      this._setAllRemoveButtonsDisabled(true);

      this._loadAppliedCodes();
      const updatedCodes = this._appliedDiscountCodes.filter(code => 
        code.toLowerCase() !== discountCode.toLowerCase()
      );

      if (updatedCodes.length > 0) {
        document.cookie = `maximize_discount_code=${updatedCodes.join(',')}; path=/`;
      } else {
        document.cookie = `maximize_discount_code=; path=/; max-age=0`;
      }

      let sectionsToRender;
      if (window.Maximize.isCartPage) {
        sectionsToRender = window.xCartHelper.getSectionsToRender(this._sectionId);
      } else {
        const cartDrawerEl = document.querySelector("#CartDrawer");
        const cartSectionId = cartDrawerEl?.dataset.sectionId;
        sectionsToRender = window.xCartHelper.getSectionsToRender(cartSectionId);
      }
      const sections = sectionsToRender.map((s) => s.id);

      const discountParam = updatedCodes.length > 0
        ? encodeURIComponent(updatedCodes.join(','))
        : '';

      // discountCodes is the full intended set after removing this code.
      const _slDiscount = window.MaximizeStorefrontEvents?.createCartDiscountUpdate(updatedCodes, this);

      fetch(`/checkout?skip_shop_pay=true&discount=${discountParam}`)
        .then(() =>
          fetch("/cart/update.js", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sections }),
          })
        )
        .then((r) => r.json())
        .then((response) => {
          if (response.status === 422) {
            _slDiscount?.resolve(response);
            return;
          }

          let cartDrawerHtml = null;
          let mainCartHtml = null;
          sectionsToRender.forEach((section) => {
            const sectionEl = document.querySelector(section.selector);
            if (sectionEl && response.sections[section.id]) {
              const html = getSectionInnerHTML(response.sections[section.id], section.selector);
              
              if (section.selector === "#CartDrawer") {
                const wrapperVisible = sectionEl.querySelector("#CartDrawer__Wrapper")?.classList.contains("is-visible");
                const upsellEl = sectionEl.querySelector("#CartDrawer__Upsell");
                if (upsellEl) upsellEl.remove();
                sectionEl.innerHTML = html;
                if (wrapperVisible) sectionEl.querySelector("#CartDrawer__Wrapper")?.classList.add("is-visible");
                if (upsellEl) {
                  const newUpsellSlot = sectionEl.querySelector("#CartDrawer__Upsell");
                  if (newUpsellSlot) newUpsellSlot.replaceWith(upsellEl);
                }
                cartDrawerHtml = html;
              } else {
                sectionEl.innerHTML = html;
                if (section.selector === "#MainCart__Items") mainCartHtml = html;
              }
            }
          });

          let isRemoved = true; 
          const parser = new DOMParser();
          
          for (const html of [cartDrawerHtml, mainCartHtml]) {
            if (!html) continue;
            parser
              .parseFromString(html, "text/html")
              .querySelectorAll(".discount-title")
              .forEach((el) => {
                if (el.dataset.discountTitle?.toLowerCase() === discountCode.toLowerCase()) {
                   isRemoved = false; 
                }
              });
          }

          if (isRemoved) {
            this._appliedDiscountCodes = updatedCodes;
            _slDiscount?.resolve(response);
            document.dispatchEvent(new CustomEvent(CART_EVENT.discountCodeChange));
            window.xCartHelper?.updateCurrentCountItem?.();

            if (!window.Maximize.isCartPage) {
              document.dispatchEvent(new CustomEvent(CART_EVENT.cartUpdate, { detail: { openMiniCart: true } }));
            }
          } else {
            _slDiscount?.resolve(response);
            document.cookie = `maximize_discount_code=${this._appliedDiscountCodes.join(',')}; path=/`;
            document.cookie = oldCookieStr;
            this._setStatusRemoveCoupon("failure");
          }
        })
        .catch((e) => {
          _slDiscount?.reject(e);
          console.error("Error removing discount:", e);
          document.cookie = `maximize_discount_code=${this._appliedDiscountCodes.join(',')}; path=/`;
          this._setStatusRemoveCoupon("failure");
        })
        .finally(() => {
          const liveBtn = document.contains(removeBtn) ? removeBtn : document.querySelector(`[data-remove-code="${discountCode}"]`);
          if (liveBtn) this._setRemoveLoading(liveBtn, false);
          this._setAllRemoveButtonsDisabled(false);
        });
    }
  }

  if (!customElements.get("coupon-code")) customElements.define("coupon-code", CouponCode);
}
