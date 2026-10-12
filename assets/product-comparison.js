// =============================================================================
// xProductComparison Alpine Store
// Handles product comparison: add/remove products, drawer, popup, table rendering.
// Loaded conditionally on collection / search / product templates via theme.liquid.
// Dependencies: constants.js (MIN_DEVICE_WIDTH, CART_ATTRIBUTES, DURATION)
//               Alpine.store('xFocusElement') — accessed at runtime, defined in theme.js
// =============================================================================
requestAnimationFrame(() => {
  document.addEventListener("alpine:init", () => {
    Alpine.store("xProductComparison", {
      isShowWidget: false,
      isShowDrawer: false,
      isShowPopup: false,
      listComparisonProducts: [],
      listComparisonProductsPopUp: [],
      cacheResults: [],
      isClickAddToCompare: false,
      maximumProductCompare: 0,
      loadingOpenDrawer: false,
      loadingFetchDataPopup: false,
      array_variant_options: [],
      array_product_metafields: [],
      sectionId: '',
      arrow_prev: null,
      arrow_next: null,
      table_container: null,
      scrollPosition: 0,
      hasSection: false,
      init(sectionId) {
        const productComparisonStored = window.localStorage.getItem("maximize-product-comparison") || "[]";

        this.listComparisonProducts = JSON.parse(productComparisonStored);

        const productComparisonOverlayEle = document.querySelector(`#productComparisonOverlay`);
        this.sectionId = sectionId;
        if (productComparisonOverlayEle) {
          this.maximumProductCompare = parseInt(productComparisonOverlayEle.dataset.maximumProductCompare);
        }
      },
      updateArrowStatus() {
        if (this.arrow_prev && this.arrow_next) {
          let isStart = false;
          let isEnd = false;

          if (Math.abs(this.scrollPosition) <= 0) {
            isStart = true
          }

          if (Math.abs(Math.abs(this.scrollPosition) - (this.table_container.scrollWidth - this.table_container.clientWidth)) <= 2) {
            isEnd = true
          }

          if (isStart) {
            if (this.arrow_prev.classList.contains('product-compare__arrow-active')) {
              this.arrow_prev.classList.remove('product-compare__arrow-active')
              this.arrow_prev.classList.add('product-compare__arrow-disable')
            }
          } else {
            if (this.arrow_prev.classList.contains('product-compare__arrow-disable')) {
              this.arrow_prev.classList.remove('product-compare__arrow-disable')
              this.arrow_prev.classList.add('product-compare__arrow-active')
            }
          }

          if (isEnd) {
            if (this.arrow_next.classList.contains('product-compare__arrow-active')) {
              this.arrow_next.classList.remove('product-compare__arrow-active')
              this.arrow_next.classList.add('product-compare__arrow-disable')
            }
          } else {
            if (this.arrow_next.classList.contains('product-compare__arrow-disable')) {
              this.arrow_next.classList.remove('product-compare__arrow-disable')
              this.arrow_next.classList.add('product-compare__arrow-active')
            }
          }
        }
      },
      roundIndex(number, isRoudDown = true) {
        let rounded = Math.round(number);
        return Math.abs(number - rounded) <= 0.02 ? rounded : (isRoudDown ? Math.floor(number) : Math.ceil(number));
      },
      slide(next = true) {
        if (next && this.arrow_next.classList.contains('product-compare__arrow-active') || !next && this.arrow_prev.classList.contains('product-compare__arrow-active')) {
          const itemWidth = this.table_container.querySelector('.product-comparison-grid-item:not(.product-comparison-grid-title)').getBoundingClientRect().width;
          const currentItemIndex = this.roundIndex(Math.abs(this.scrollPosition / itemWidth), true);
          if (next) {
            this.scrollPosition = (currentItemIndex + 1) * itemWidth;
            if (Math.abs(Math.abs(this.scrollPosition) - (this.table_container.scrollWidth - this.table_container.clientWidth)) <= 2) {
              this.scrollPosition = this.table_container.scrollWidth - this.table_container.clientWidth;
            }
          } else {
            if (currentItemIndex == this.roundIndex(Math.abs(this.scrollPosition / itemWidth), false)) {
              this.scrollPosition = (currentItemIndex - 1) * itemWidth;
            } else {
              this.scrollPosition = (currentItemIndex) * itemWidth;
            }
            if (Math.abs(this.scrollPosition) < 0) {
              this.scrollPosition = 0;
            }
          }

          this.scrollPosition *= window.Maximize.rtl ? (-1) : 1

          this.table_container.scrollTo({
            left: this.scrollPosition,
            behavior: 'smooth'
          });
          this.updateArrowStatus()
        }
      },
      updateCSSVariables(sectionId) {
        if (sectionId && !this.sectionId) {
          this.sectionId = sectionId;
        }
        const table = document.querySelector(`.product-comparison-table--${this.sectionId}`);
        if (window.innerWidth >= MIN_DEVICE_WIDTH.desktop) {
          table?.style.setProperty('--product-comparison-item-in-table', this.listComparisonProducts.length + 1);
        } else {
          table?.style.setProperty('--product-comparison-item-in-table', this.listComparisonProducts.length);
        }
      },
      setData(list_variant_options, list_product_metafields) {
        this.hasSection = true;
        this.array_variant_options = list_variant_options.split('|||').filter(item => (item != null && item != ''));
        this.array_product_metafields = list_product_metafields.split('|||').filter(item => (item != null && item != ''));
        Array.from(new Set(this.array_variant_options));
        Array.from(new Set(this.array_product_metafields));
        let formData = {
          'attributes': {
            [CART_ATTRIBUTES.product_comparison_options]: this.array_variant_options.join('|||'),
            [CART_ATTRIBUTES.product_comparison_metafields]: this.array_product_metafields.join('|||'),
          }
        };
        fetch(Shopify.routes.root + 'cart/update', {
          method: 'POST',
          headers: {'Content-Type': 'application/json', Accept: 'application/json'},
          body: JSON.stringify(formData)
        })
      },
      addProductToCompare(productId, productHandle) {
        if ((this.listComparisonProducts.length >= this.maximumProductCompare && !this.isClickAddToCompare)
          || this.listComparisonProducts.some(item => item.productId === productId)) return;

        this.isClickAddToCompare = true
        if (this.listComparisonProducts.length >= this.maximumProductCompare || this.listComparisonProducts.some(item => item.productId === productId)) {
          return;
        }

        this.isShowWidget = true;

        this.listComparisonProducts.push({
          productId: productId,
          productHandle: productHandle
        });

        localStorage.setItem("maximize-product-comparison", JSON.stringify(this.listComparisonProducts));
        setTimeout(() => {
          this.isClickAddToCompare = false
          this.showDrawer()
        }, 200)
        this.updateCSSVariables()
      },
      removeProductFromCompare(productId, productHandle) {
        this.listComparisonProducts = this.listComparisonProducts.filter((item) => item.productId !== productId);

        localStorage.setItem("maximize-product-comparison", JSON.stringify(this.listComparisonProducts));

        if (this.isShowPopup) {
          const itemData = document.querySelectorAll(`.product-comparison-${productHandle}`)
          if (itemData && itemData.length > 0) {
            for (let i = 0; i < itemData.length; i++) {
              if (itemData[i]) {
                const item = itemData[i]
                item.classList.add('animation-fade-out');
                item.style.height = `${item.offsetHeight}px`
                item.addEventListener('transitionend', (e) => {
                  if (e.propertyName === 'width') {
                    item.classList.add('hidden');
                    this.updateCSSVariables();
                  }
                });
              }
            }
          }
          if (this.listComparisonProducts.length == 0) {
            setTimeout(() => {
              this.closePopup();
            }, 500);
          }
        } else {
          if (this.isShowDrawer) {
            const drawerItem = document.querySelector(`.product-comparison-overlay__item[data-product-id="${productId}"]`);
            if (drawerItem && drawerItem != null) {
              drawerItem.classList.add('animation-fade-out');

              drawerItem.addEventListener('transitionend', () => {
                drawerItem.remove();
              });
            }
          }
          if (this.listComparisonProducts.length == 0) {
            this.hideDrawer();
          }
          this.updateCSSVariables()
        }
      },
      clearAll() {
        const listItem = this.listComparisonProducts
        if (this.isShowDrawer) {
          listItem.map((item, index) => {
            const drawerItem = document.querySelector(`.product-comparison-overlay__item[data-product-id="${item.productId}"]`);
            if (drawerItem && drawerItem != null) {
              drawerItem.classList.add('animation-fade-out');

              drawerItem.addEventListener('transitionend', () => {
                drawerItem.remove();
              });
            }
          })
        }
        this.listComparisonProducts = [];
        localStorage.setItem("maximize-product-comparison", JSON.stringify(this.listComparisonProducts));
        this.hideDrawer();
      },
      handleDataDrawer(text) {
        const html = document.createElement('div');
        html.innerHTML = text;
        const drawerContainer = document.querySelector(`#ProductComparisonDrawer__Main`);
        const drawerContent = html.querySelector('.product-comparison__drawer-content');
        if (drawerContainer && drawerContent) {
          drawerContainer.innerHTML = drawerContent.innerHTML;
        }

        this.isShowDrawer = true;
        const overlayBodyEle = document.querySelector('.overlay-body');

        if (overlayBodyEle) {
          overlayBodyEle.classList.add('is-visible');
        }
        document.body.classList.add("overflow-hidden");
      },
      showDrawer() {
        if (this.isShowDrawer) return;
        this.fetchAndRenderDrawer();
      },
      // Re-fills #ProductComparisonDrawer__Main after the Theme Editor replaces the
      // section's DOM (isShowDrawer survives the reload, but the rendered content doesn't).
      reopenDrawer() {
        if (!this.isShowDrawer) return;
        const drawerContainer = document.querySelector(`#ProductComparisonDrawer__Main`);
        if (drawerContainer && drawerContainer.innerHTML.trim()) return;
        this.fetchAndRenderDrawer();
      },
      fetchAndRenderDrawer() {
        const productIdTerm = this.listComparisonProducts.map((item) => `id:${item.productId}`).join(' OR ');
        const urlProductComparisonOverlay = `${window.Maximize.routes.search_url}?section_id=product-comparison-overlay&type=product&q=${productIdTerm}`
        if (this.cacheResults[urlProductComparisonOverlay]) {
          this.handleDataDrawer(this.cacheResults[urlProductComparisonOverlay])
        } else {
          this.loadingOpenDrawer = true;
          fetch(urlProductComparisonOverlay)
            .then((response) => {
              if (!response.ok) {
                let error = new Error(response.status);
                this.hideDrawer();
                throw error;
              }

              return response.text();
            })
            .then((text) => {
              this.cacheResults[urlProductComparisonOverlay] = text;
              this.handleDataDrawer(text);
            })
            .finally(() => {
              this.loadingOpenDrawer = false;
            })
        }
      },
      hideDrawer() {
        if (!this.isShowDrawer) return;
        this.isShowDrawer = false;

        const overlayBodyEle = document.querySelector('.overlay-body');

        if (overlayBodyEle) {
          overlayBodyEle.classList.remove('is-visible');
        }
        document.body.classList.remove("overflow-hidden");
      },
      handleDataPopUp() {
        this.table_container = document.querySelector(`.product-comparison__table-container`);

        this.arrow_prev = document.querySelector(`.product-comparison__nav-prev`);
        this.arrow_next = document.querySelector(`.product-comparison__nav-next`);

        this.table_container.addEventListener('scroll', () => {
          this.scrollPosition = this.table_container.scrollLeft;
          this.updateArrowStatus();
        });

        if (this.arrow_prev && this.arrow_next) {
          setTimeout(() => {
            this.updateArrowStatus();
          }, 500)
          this.arrow_prev.addEventListener('click', () => this.slide(false));
          this.arrow_next.addEventListener('click', () => this.slide(true));
          this.arrow_prev.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
              this.slide(false);
            }
          })
          this.arrow_next.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
              this.slide(true);
            }
          })
        }

        const listProductData = []

        const fetchPromises = this.listComparisonProducts.map(async (item, index) => {
          const url_product = `/products/${item.productHandle}?section_id=product-comparison-grid-item`;
          if (this.cacheResults[url_product]) {
            return Promise.resolve({index, data: this.cacheResults[url_product]});
          } else {
            if (!this.loadingFetchDataPopup) {
              this.loadingFetchDataPopup = true;
            }
            return fetch(url_product)
              .then(response => {
                return response.text();
              })
              .then((response) => {
                this.cacheResults[url_product] = response
                return {index, data: response};
              })
          }
        })

        Promise.all(fetchPromises).then((results) => {
          results.sort((a, b) => a.index - b.index);
          results.forEach((result) => {
            listProductData.push(result.data);
          });

          const table = document.querySelector('.product-comparison-table-popup')
          listProductData.map((item, index) => {
            const parser = new DOMParser();
            const itemHtml = parser.parseFromString(item, 'text/html')

            const listClassAttributes = [
              {
                gridItem: 'table-header',
                table: `table-header-${this.listComparisonProducts[index].productHandle}-${index}`
              },
              {
                gridItem: 'rating',
                table: `rating-${this.listComparisonProducts[index].productHandle}-${index}`
              },
              {
                gridItem: 'sku',
                table: `sku-${this.listComparisonProducts[index].productHandle}-${index}`
              },
              {
                gridItem: 'description',
                table: `description-${this.listComparisonProducts[index].productHandle}-${index}`
              },
              {
                gridItem: 'vendor',
                table: `vendor-${this.listComparisonProducts[index].productHandle}-${index}`
              },
              {
                gridItem: 'vendor-new-tab',
                table: `vendor-new-tab-${this.listComparisonProducts[index].productHandle}-${index}`
              }
            ]

            listClassAttributes.map((attribute) => {
              const itemContent = itemHtml.querySelector(`.product-comparison-${attribute.gridItem}`)
              const tableContent = table?.querySelector(`.product-comparison-${attribute.table}`)
              if (itemContent && tableContent && itemContent?.innerHTML?.trim()) {
                tableContent.innerHTML = itemContent.innerHTML
              }
            })

            this.array_variant_options.map((option, i) => {
              const itemOptions = itemHtml.querySelector(`.product-comparison-option-${option.replaceAll(" ", "_")}`)
              const tableOptions = table.querySelectorAll(`.product-comparison-option-${option.replaceAll(" ", "_")}-${index}`)
              if (tableOptions && tableOptions.length > 0 && itemOptions?.innerHTML?.trim()) {
                tableOptions.forEach(tableOption => {
                  tableOption.innerHTML = itemOptions.innerHTML
                })
              }

              const itemSwatchesOptions = itemHtml.querySelector(`.product-comparison-option-swatches-${option.replaceAll(" ", "_")}`)
              const tableSwatchesOptions = table.querySelectorAll(`.product-comparison-option-swatches-${option.replaceAll(" ", "_")}-${index}`)
              if (tableSwatchesOptions && tableSwatchesOptions.length > 0 && itemSwatchesOptions?.innerHTML?.trim()) {
                tableSwatchesOptions.forEach(tableOption => {
                  tableOption.innerHTML = itemSwatchesOptions.innerHTML
                })
              }

            })

            this.array_product_metafields.map((metafield, i) => {
              const itemMetafield = itemHtml.querySelector(`.product-comparison-metafield-${metafield.replaceAll(".", "_")}`)
              const tableMetafields = table.querySelectorAll(`.product-comparison-metafield-${metafield.replaceAll(".", "_")}-${index}`)
              if (tableMetafields && tableMetafields.length > 0 && itemMetafield?.innerHTML?.trim()) {
                tableMetafields.forEach(tableMetafield => {
                  tableMetafield.innerHTML = itemMetafield.innerHTML;
                })
              }
            })

          })

          if (this.loadingFetchDataPopup) {
            this.loadingFetchDataPopup = false
          }
        });
      },
      showPopup() {
        const delay = DURATION.DRAWER_TRANSITION

        setTimeout(() => {
          this.isShowPopup = true;
          this.listComparisonProductsPopUp = this.listComparisonProducts
          const overlayBodyEle = document.querySelector('.overlay-body');

          if (overlayBodyEle && overlayBodyEle != null) {
            overlayBodyEle.classList.add('is-visible');
          }
          document.body.classList.add("overflow-hidden");
          this.handleDataPopUp()
        }, delay)
      },
      closePopup() {
        if (!this.isShowPopup) return;
        this.isShowPopup = false;
        document.body.classList.remove("overflow-hidden");
        Alpine.store('xFocusElement').removeTrapFocus();
        setTimeout(() => {
          this.listComparisonProductsPopUp.map((item) => {
            const itemData = document.querySelectorAll(`.product-comparison-${item.productHandle}.animation-fade-out.hidden`)
            if (itemData && itemData.length > 0) {
              for (let i = 0; i < itemData.length; i++) {
                if (itemData[i]) {
                  const item = itemData[i]
                  item.classList.remove('animation-fade-out');
                  item.classList.remove('hidden');
                }
              }
            }
          })
        }, 1000)
      }
    })
  })
})
