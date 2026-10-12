if (!window.Maximize.loadedScript.includes("product-recommendations.js")) {
  window.Maximize.loadedScript.push("product-recommendations.js");

  const _registerProductRecommendations = () => {
    Alpine.store("xProductRecommendations", {
        loading: false,
        load(el, sectionId, productId, limit, intent, disableInitSwiffy) {
          this.updateCartDrawerUpsellStatus();
          this.loading = true;
          limit = limit || 10;
          fetch(`${window.Maximize.routes.productRecommendations}?section_id=${sectionId}&product_id=${productId}&limit=${limit}&intent=${intent}`)
            .then((response) => response.text())
            .then((text) => {
              const html = document.createElement("div");
              html.innerHTML = text;
              const recommendations = html.querySelector(".product-recommendations");

              if (recommendations && recommendations.innerHTML.trim().length) {
                if (recommendations.classList.contains("cart-upsell__product-recommendations")) {
                  const maxItemsToShow = parseInt(el.dataset.maxItems);
                  const container = el.querySelector(".slider-container");
                  const currentItems = el.querySelectorAll('.cart-upsell__item');
                  const itemsToAdd = Math.max(0, maxItemsToShow - currentItems.length);
                  let listRecommendationsItems = recommendations.querySelectorAll('.cart-upsell__item');

                  if (sectionId == 'cart-upsell-recommendations') {
                    const currentItemsProductIds = Array.from(currentItems)
                      .map(item => item.dataset?.productId)
                      .filter(id => id !== undefined);
                    listRecommendationsItems = Array.from(listRecommendationsItems).filter(
                      item => !currentItemsProductIds.includes(item.dataset?.productId)
                    );
                  }
                  if (itemsToAdd > 0) {
                    listRecommendationsItems.forEach((item, index) => {
                      if (index < itemsToAdd) {
                        const clone = item.cloneNode(true);
                        container.appendChild(clone);
                        // Re-init Alpine on the cloned node so x-intersect.once
                        // (used for shopify:product:view dispatch) activates correctly.
                        if (window.Alpine) Alpine.initTree(clone);
                      }
                    });
                    const currentSlideIndicator = el.querySelector(".swiffy-slide-indicator");
                    const newSlideIndicator = html.querySelector(".swiffy-slide-indicator");
                    if (currentSlideIndicator && newSlideIndicator) {
                      currentSlideIndicator.replaceWith(newSlideIndicator);
                    }
                  }

                  requestAnimationFrame(() => {
                    this.__updateCartUpsell(sectionId);
                  })
                } else {
                  requestAnimationFrame(() => {
                    el.innerHTML = recommendations.innerHTML;
                  });
                }

                if (recommendations.classList.contains("recommendation__main-product")) {
                  el.className += ` mb-[var(--spacing-between-heading-and-content)]`;
                }
              } else {
                this.__updateCartUpsell(sectionId);
              }

              // if (recommendations.classList.contains("cart-upsell__product-recommendations")) {
                if (!disableInitSwiffy) {
                  let observerEl;
                  let hasSlider = false;

                  const handleCheck = () => {
                    if (!el || el.innerHTML.trim() === '') {
                      return;
                    }
                    let slider = el.querySelector('.product-recommendations__slider') ||
                                 el.querySelector('.complementary__list-products') ||
                                 el;

                    const datasetString = slider.dataset.swiffyConfig;
                    const config = datasetString ? JSON.parse(datasetString.replace(/'/g, '"')) : {};

                    const observer = new IntersectionObserver((entries, observer) => {
                      entries.forEach(entry => {
                        if (entry.isIntersecting) {
                          if (!hasSlider) {
                            new SwiffySlider(slider, config);
                            hasSlider = true;
                          }
                          observer.unobserve(entry.target);
                        }
                      });
                    }, { threshold: 0.1 });

                    observer.observe(slider);
                    if (observerEl) observerEl.disconnect();
                  };
                  
                  handleCheck();

                  observerEl = new MutationObserver(handleCheck);
                  observerEl.observe(el, { childList: true, subtree: true });
                }
                // if (slider) {
                //   const datasetString = slider.dataset.swiffyConfig;
                //   const config = JSON.parse(datasetString.replace(/'/g, '"'));
                //   new SwiffySlider(slider, config);
                // } else {
                //   const datasetString = el.dataset.swiffyConfig;
                //   const config = JSON.parse(datasetString.replace(/'/g, '"'));
                //   new SwiffySlider(el, config);
                // }
              // }
            })
            .finally(() => {
              this.loading = false;
            })
            .catch((e) => {
              console.error(e);
            });
        },
        updateCartUpsellWhenCartChanged(sectionId) {
          document.addEventListener(`${CART_EVENT.cartUpdate}`, (event) => {
            const { isItemCountChanged } = event.detail;

            if (isItemCountChanged) {
              fetch(`${window.location.pathname}?section_id=${sectionId}`, {
                method: 'GET'
              }).then(response => response.text())
                .then(responseText => {
                const html = (new DOMParser()).parseFromString(responseText, 'text/html');
                const oldSectionEl = document.querySelector(`.section--${sectionId}`);
                const newSectionEl = html.querySelector(`.section--${sectionId}`);

                if (oldSectionEl && newSectionEl) {
                  oldSectionEl.innerHTML = newSectionEl.innerHTML;
                }
              })
            }
          })
        },
        __updateCartUpsell(sectionId) {
          if (window.Maximize.isCartPage) {
            const sectionEle = document.querySelector(`.section--${sectionId}`);

            if (sectionEle) {
              const mainCartUpsellHeading = sectionEle.querySelector(`.main-cart-upsell__heading`);
              const mainCartUpsellContainer = sectionEle.querySelector(`.main-cart-upsell__container`);
              const listUpsellItems = sectionEle.querySelectorAll('.cart-upsell__item');
              if (listUpsellItems.length) {
                mainCartUpsellHeading.classList.remove('hidden');
                mainCartUpsellContainer.classList.remove('hidden');
              } else {
                sectionEle.classList.add('hidden');
              }
            }
            document.dispatchEvent(new CustomEvent(`${PRODUCT_EVENT.productRecommendationsChange}`));
          } else {
            this.updateCartDrawerUpsellStatus();
          }
        },
        updateCartDrawerUpsellStatus: function () {
          const isOpen = !!document.querySelectorAll('.cart-drawer-upsell__item').length;
          const upsellEl = document.querySelector('cart-drawer-upsell');
          if (upsellEl) upsellEl.isOpen = isOpen;
        }
      });
  };

  // Script loads lazily — Alpine may already be initialized by this point,
  // so register the store immediately if Alpine is ready, otherwise wait for alpine:init.
  if (window.Alpine) {
    _registerProductRecommendations();
  } else {
    document.addEventListener("alpine:init", _registerProductRecommendations);
  }
}
