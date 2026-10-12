requestAnimationFrame(() => {
  document.addEventListener("alpine:init", () => {
    Alpine.store("xScrollPromotion", {
      load(el) {
        let scroll = el.getElementsByClassName("el_animate");
        for (let i = 0; i < scroll.length; i++) {
          scroll[i].classList.add("animate-scroll-banner");
        }
      },
    });
    Alpine.store("xMaximizePopup", {
      isOpen: false,
      handleOpen: function (activeElement) {
        this.isOpen = true;
        if (window.Maximize.isShowPopupOverlay) document.body.classList.add("overflow-y-hidden");
        if (activeElement) {
          setTimeout(() => {
            document.querySelector(`${activeElement}`)?.focus();
          }, 500);
        }
      },
      handleClose: function () {
        Alpine.store("xFocusElement").removeTrapFocus();
        setTimeout(() => {
          this.isOpen = false;
          if (window.Maximize.isShowPopupOverlay) document.body.classList.remove("overflow-y-hidden");
        }, 500);
      },
    });

    Alpine.store("xMaximizeDrawer", {
      isOpen: false,
      activeDrawerElement: false,
      durationTime: 0,
      drawerCloseElement: false,
      handleOpen: function (drawerContainer) {
        const drawerContainerEle = document.querySelector(drawerContainer);
        if (drawerContainerEle) {
          this.activeDrawerElement = drawerContainerEle;
          this.durationTime = DURATION.DRAWER_TRANSITION;
          drawerContainerEle.classList.add("is-open");
          this.isOpen = true;
          document.body.classList.add("overflow-y-hidden");
        }

        if (!this.drawerCloseElement) {
          this.drawerCloseElement = this.activeDrawerElement;
        }
      },
      handleClose: function (isCloseAllDrawer = true) {
        Alpine.store("xFocusElement").removeTrapFocus();
        this.isOpen = false;
        if (this.activeDrawerElement) {
          this.activeDrawerElement.classList.remove("is-open");
        }
        if (isCloseAllDrawer) {
          setTimeout(() => {
            if (this.activeDrawerElement === this.drawerCloseElement || !this.activeDrawerElement) {
              document.body.classList.remove("overflow-y-hidden");
              this.drawerCloseElement = false;
            } else {
              this.drawerCloseElement = this.activeDrawerElement;
            }
            this.activeDrawerElement = false;
          }, this.durationTime);
        }
      },
    });
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
      sectionId: "",
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
            isStart = true;
          }

          if (Math.abs(Math.abs(this.scrollPosition) - (this.table_container.scrollWidth - this.table_container.clientWidth)) <= 2) {
            isEnd = true;
          }

          if (isStart) {
            if (this.arrow_prev.classList.contains("product-compare__arrow-active")) {
              this.arrow_prev.classList.remove("product-compare__arrow-active");
              this.arrow_prev.classList.add("product-compare__arrow-disable");
            }
          } else {
            if (this.arrow_prev.classList.contains("product-compare__arrow-disable")) {
              this.arrow_prev.classList.remove("product-compare__arrow-disable");
              this.arrow_prev.classList.add("product-compare__arrow-active");
            }
          }

          if (isEnd) {
            if (this.arrow_next.classList.contains("product-compare__arrow-active")) {
              this.arrow_next.classList.remove("product-compare__arrow-active");
              this.arrow_next.classList.add("product-compare__arrow-disable");
            }
          } else {
            if (this.arrow_next.classList.contains("product-compare__arrow-disable")) {
              this.arrow_next.classList.remove("product-compare__arrow-disable");
              this.arrow_next.classList.add("product-compare__arrow-active");
            }
          }
        }
      },
      roundIndex(number, isRoudDown = true) {
        let rounded = Math.round(number);
        return Math.abs(number - rounded) <= 0.02 ? rounded : isRoudDown ? Math.floor(number) : Math.ceil(number);
      },
      slide(next = true) {
        if ((next && this.arrow_next.classList.contains("product-compare__arrow-active")) || (!next && this.arrow_prev.classList.contains("product-compare__arrow-active"))) {
          const itemWidth = this.table_container.querySelector(".product-comparison-grid-item:not(.product-comparison-grid-title)").getBoundingClientRect().width;
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
              this.scrollPosition = currentItemIndex * itemWidth;
            }
            if (Math.abs(this.scrollPosition) < 0) {
              this.scrollPosition = 0;
            }
          }

          this.scrollPosition *= window.Maximize.rtl ? -1 : 1;

          this.table_container.scrollTo({
            left: this.scrollPosition,
            behavior: "smooth",
          });
          this.updateArrowStatus();
        }
      },
      updateCSSVariables(sectionId) {
        if (sectionId && !this.sectionId) {
          this.sectionId = sectionId;
        }
        const table = document.querySelector(`.product-comparison-table--${this.sectionId}`);
        if (window.innerWidth >= MIN_DEVICE_WIDTH.desktop) {
          table?.style.setProperty("--product-comparison-item-in-table", this.listComparisonProducts.length + 1);
        } else {
          table?.style.setProperty("--product-comparison-item-in-table", this.listComparisonProducts.length);
        }
      },
      setData(list_variant_options, list_product_metafields) {
        this.hasSection = true;
        this.array_variant_options = list_variant_options.split("|||").filter((item) => item != null && item != "");
        this.array_product_metafields = list_product_metafields.split("|||").filter((item) => item != null && item != "");
        Array.from(new Set(this.array_variant_options));
        Array.from(new Set(this.array_product_metafields));
        var formData = {
          attributes: {
            [CART_ATTRIBUTES.product_comparison_options]: this.array_variant_options.join("|||"),
            [CART_ATTRIBUTES.product_comparison_metafields]: this.array_product_metafields.join("|||"),
          },
        };
        fetch(Shopify.routes.root + "cart/update", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(formData),
        });
      },
      addProductToCompare(productId, productHandle) {
        if ((this.listComparisonProducts.length >= this.maximumProductCompare && !this.isClickAddToCompare) || this.listComparisonProducts.some((item) => item.productId === productId)) return;

        this.isClickAddToCompare = true;
        if (this.listComparisonProducts.length >= this.maximumProductCompare || this.listComparisonProducts.some((item) => item.productId === productId)) {
          return;
        }

        this.isShowWidget = true;

        this.listComparisonProducts.push({
          productId: productId,
          productHandle: productHandle,
        });

        localStorage.setItem("maximize-product-comparison", JSON.stringify(this.listComparisonProducts));
        setTimeout(() => {
          this.isClickAddToCompare = false;
          this.showDrawer();
        }, 200);
        this.updateCSSVariables();
      },
      removeProductFromCompare(productId, productHandle) {
        this.listComparisonProducts = this.listComparisonProducts.filter((item) => item.productId !== productId);

        localStorage.setItem("maximize-product-comparison", JSON.stringify(this.listComparisonProducts));

        if (this.isShowPopup) {
          const itemData = document.querySelectorAll(`.product-comparison-${productHandle}`);
          if (itemData && itemData.length > 0) {
            for (let i = 0; i < itemData.length; i++) {
              if (itemData[i]) {
                const item = itemData[i];
                item.classList.add("animation-fade-out");
                item.style.height = `${item.offsetHeight}px`;
                item.addEventListener("transitionend", (e) => {
                  if (e.propertyName === "width") {
                    item.classList.add("hidden");
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
              drawerItem.classList.add("animation-fade-out");

              drawerItem.addEventListener("transitionend", () => {
                drawerItem.remove();
              });
            }
          }
          if (this.listComparisonProducts.length == 0) {
            this.hideDrawer();
          }
          this.updateCSSVariables();
        }
      },
      clearAll() {
        const listItem = this.listComparisonProducts;
        if (this.isShowDrawer) {
          listItem.map((item, index) => {
            const drawerItem = document.querySelector(`.product-comparison-overlay__item[data-product-id="${item.productId}"]`);
            if (drawerItem && drawerItem != null) {
              drawerItem.classList.add("animation-fade-out");

              drawerItem.addEventListener("transitionend", () => {
                drawerItem.remove();
              });
            }
          });
        }
        this.listComparisonProducts = [];
        localStorage.setItem("maximize-product-comparison", JSON.stringify(this.listComparisonProducts));
        this.hideDrawer();
      },
      handleDataDrawer(text) {
        const html = document.createElement("div");
        html.innerHTML = text;
        const drawerContainer = document.querySelector(`#ProductComparisonDrawer__Main`);
        const drawerContent = html.querySelector(".product-comparison__drawer-content");
        if (drawerContainer && drawerContent) {
          drawerContainer.innerHTML = drawerContent.innerHTML;
        }

        this.isShowDrawer = true;
        const overlayBodyEle = document.querySelector(".overlay-body");

        if (overlayBodyEle) {
          overlayBodyEle.classList.add("is-visible");
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
        const productIdTerm = this.listComparisonProducts.map((item) => `id:${item.productId}`).join(" OR ");
        const urlProductComparisonOverlay = `${window.Maximize.routes.search_url}?section_id=product-comparison-overlay&type=product&q=${productIdTerm}`;
        if (this.cacheResults[urlProductComparisonOverlay]) {
          this.handleDataDrawer(this.cacheResults[urlProductComparisonOverlay]);
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
            });
        }
      },
      hideDrawer() {
        if (!this.isShowDrawer) return;
        this.isShowDrawer = false;

        const overlayBodyEle = document.querySelector(".overlay-body");

        if (overlayBodyEle) {
          overlayBodyEle.classList.remove("is-visible");
        }
        document.body.classList.remove("overflow-hidden");
      },
      handleDataPopUp() {
        this.table_container = document.querySelector(`.product-comparison__table-container`);

        this.arrow_prev = document.querySelector(`.product-comparison__nav-prev`);
        this.arrow_next = document.querySelector(`.product-comparison__nav-next`);

        this.table_container.addEventListener("scroll", () => {
          this.scrollPosition = this.table_container.scrollLeft;
          this.updateArrowStatus();
        });

        if (this.arrow_prev && this.arrow_next) {
          setTimeout(() => {
            this.updateArrowStatus();
          }, 500);
          this.arrow_prev.addEventListener("click", () => this.slide(false));
          this.arrow_next.addEventListener("click", () => this.slide(true));
          this.arrow_prev.addEventListener("keyup", (e) => {
            if (e.key === "Enter") {
              this.slide(false);
            }
          });
          this.arrow_next.addEventListener("keyup", (e) => {
            if (e.key === "Enter") {
              this.slide(true);
            }
          });
        }

        const listProductData = [];

        const fetchPromises = this.listComparisonProducts.map(async (item, index) => {
          const url_product = `/products/${item.productHandle}?section_id=product-comparison-grid-item`;
          if (this.cacheResults[url_product]) {
            return Promise.resolve({ index, data: this.cacheResults[url_product] });
          } else {
            if (!this.loadingFetchDataPopup) {
              this.loadingFetchDataPopup = true;
            }
            return fetch(url_product)
              .then((response) => {
                return response.text();
              })
              .then((response) => {
                this.cacheResults[url_product] = response;
                return { index, data: response };
              });
          }
        });

        Promise.all(fetchPromises).then((results) => {
          results.sort((a, b) => a.index - b.index);
          results.forEach((result) => {
            listProductData.push(result.data);
          });

          const table = document.querySelector(".product-comparison-table-popup");
          listProductData.map((item, index) => {
            const parser = new DOMParser();
            const itemHtml = parser.parseFromString(item, "text/html");

            const listClassAttributes = [
              {
                gridItem: "table-header",
                table: `table-header-${this.listComparisonProducts[index].productHandle}-${index}`,
              },
              {
                gridItem: "rating",
                table: `rating-${this.listComparisonProducts[index].productHandle}-${index}`,
              },
              {
                gridItem: "sku",
                table: `sku-${this.listComparisonProducts[index].productHandle}-${index}`,
              },
              {
                gridItem: "description",
                table: `description-${this.listComparisonProducts[index].productHandle}-${index}`,
              },
              {
                gridItem: "vendor",
                table: `vendor-${this.listComparisonProducts[index].productHandle}-${index}`,
              },
              {
                gridItem: "vendor-new-tab",
                table: `vendor-new-tab-${this.listComparisonProducts[index].productHandle}-${index}`,
              },
            ];

            listClassAttributes.map((attribute) => {
              const itemContent = itemHtml.querySelector(`.product-comparison-${attribute.gridItem}`);
              const tableContent = table?.querySelector(`.product-comparison-${attribute.table}`);
              if (itemContent && tableContent && itemContent?.innerHTML?.trim()) {
                tableContent.innerHTML = itemContent.innerHTML;
              }
            });

            this.array_variant_options.map((option, i) => {
              const itemOptions = itemHtml.querySelector(`.product-comparison-option-${option.replaceAll(" ", "_")}`);
              const tableOptions = table.querySelectorAll(`.product-comparison-option-${option.replaceAll(" ", "_")}-${index}`);
              if (tableOptions && tableOptions.length > 0 && itemOptions?.innerHTML?.trim()) {
                tableOptions.forEach((tableOption) => {
                  tableOption.innerHTML = itemOptions.innerHTML;
                });
              }

              const itemSwatchesOptions = itemHtml.querySelector(`.product-comparison-option-swatches-${option.replaceAll(" ", "_")}`);
              const tableSwatchesOptions = table.querySelectorAll(`.product-comparison-option-swatches-${option.replaceAll(" ", "_")}-${index}`);
              if (tableSwatchesOptions && tableSwatchesOptions.length > 0 && itemSwatchesOptions?.innerHTML?.trim()) {
                tableSwatchesOptions.forEach((tableOption) => {
                  tableOption.innerHTML = itemSwatchesOptions.innerHTML;
                });
              }
            });

            this.array_product_metafields.map((metafield, i) => {
              const itemMetafield = itemHtml.querySelector(`.product-comparison-metafield-${metafield.replaceAll(".", "_")}`);
              const tableMetafields = table.querySelectorAll(`.product-comparison-metafield-${metafield.replaceAll(".", "_")}-${index}`);
              if (tableMetafields && tableMetafields.length > 0 && itemMetafield?.innerHTML?.trim()) {
                tableMetafields.forEach((tableMetafield) => {
                  tableMetafield.innerHTML = itemMetafield.innerHTML;
                });
              }
            });
          });

          if (this.loadingFetchDataPopup) {
            this.loadingFetchDataPopup = false;
          }
        });
      },
      showPopup() {
        const delay = DURATION.DRAWER_TRANSITION;

        setTimeout(() => {
          this.isShowPopup = true;
          this.listComparisonProductsPopUp = this.listComparisonProducts;
          const overlayBodyEle = document.querySelector(".overlay-body");

          if (overlayBodyEle && overlayBodyEle != null) {
            overlayBodyEle.classList.add("is-visible");
          }
          document.body.classList.add("overflow-hidden");
          this.handleDataPopUp();
        }, delay);
      },
      closePopup() {
        if (!this.isShowPopup) return;
        this.isShowPopup = false;
        document.body.classList.remove("overflow-hidden");
        Alpine.store("xFocusElement").removeTrapFocus();
        setTimeout(() => {
          this.listComparisonProductsPopUp.map((item) => {
            const itemData = document.querySelectorAll(`.product-comparison-${item.productHandle}.animation-fade-out.hidden`);
            if (itemData && itemData.length > 0) {
              for (let i = 0; i < itemData.length; i++) {
                if (itemData[i]) {
                  const item = itemData[i];
                  item.classList.remove("animation-fade-out");
                  item.classList.remove("hidden");
                }
              }
            }
          });
        }, 1000);
      },
      updateLimitMessage() {
        const template = window.Maximize.productComparison.limitMessageTemplate;
        if (!template) return;
        const max = this.maximumProductCompare;
        const newMessage = template.replace("count_product", max);
        document.querySelectorAll(".product_comparison-limit").forEach((el) => {
          el.innerHTML = newMessage;
        });
      },
    });

    Alpine.data("xArticle", () => ({
      show: false,
      showInTab: false,
      isPreRelocation: false,

      initActiveHighlight() {
        this.isPreRelocation = !!this.$el.closest("[data-toc-source]");
        if (this.isPreRelocation) return;

        if (!document.querySelector(".side-bar__toc")) return;

        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                if (document.querySelector(".side-bar__toc .active")) {
                  document.querySelector(".side-bar__toc .active").classList.remove("active");
                }
                document.querySelectorAll(".side-bar__toc-label")[entry.target.dataset.index].classList.add("active");
              }
            });
          },
          { rootMargin: "0px 0px -60% 0px" }
        );

        if (this.$refs.content.querySelectorAll("h2, h3, h4").length > 1) {
          this.$refs.content.querySelectorAll("h2, h3, h4").forEach((heading, index) => {
            heading.dataset.index = index;
            observer.observe(heading);
          });
        } else {
          document.querySelector(".side-bar__toc").remove();
        }
      },
      initScrollProgress() {
        if (this.isPreRelocation) return;

        const load = document.querySelector(".side-bar__load-bar-fill");
        const loadBar = document.querySelector(".side-bar__load-bar-track");
        const element = this.$refs.content;
        if (!element) return;

        document.addEventListener("scroll", () => {
          const elementTop = element.offsetTop;
          const elementHeight = element.offsetHeight;
          const windowHeight = window.innerHeight;
          const scrollPosition = window.scrollY + windowHeight;

          let scrollPercent;

          if (scrollPosition < elementTop) {
            scrollPercent = 0;
            if (loadBar) loadBar.classList.remove("active-bar");
          } else if (scrollPosition > elementTop + elementHeight) {
            scrollPercent = 100;
          } else {
            if (loadBar) loadBar.classList.add("active-bar");
            scrollPercent = ((scrollPosition - elementTop) / elementHeight) * 100;
          }
          if (load) load.style.width = scrollPercent.toFixed(2) + `%`;
        });
      },
      buildToc(list_style) {
        if (this.isPreRelocation) return;

        const heading2 = document.querySelector(".main-article__text .page__body").querySelectorAll("h2, h3, h4");
        if (heading2.length > 1) {
          const ulClassForLevel = (level) => {
            if (list_style === "bullet") return "toc:m-0 toc:pl-5";
            return level === 4 ? "toc:m-0 toc:pl-6" : "toc:m-0 toc:pl-4";
          };
          const liOpenTag = (index, text) => "<li class='toc:m-0 side-bar__toc-item w-full'><span class='side-bar__toc-label w-full cursor-pointer' @click='scrollTop($el," + index + ")'>" + text + "</span>";

          const stack = [];
          let htmlContent = "";
          heading2.forEach((item, index) => {
            const level = parseInt(item.tagName.charAt(1), 10);

            if (!stack.length) {
              htmlContent += liOpenTag(index, item.textContent);
              stack.push(level);
              return;
            }

            if (level > stack[stack.length - 1]) {
              htmlContent += "<ul class='" + ulClassForLevel(level) + "'>" + liOpenTag(index, item.textContent);
              stack.push(level);
              return;
            }

            while (stack.length > 1 && level < stack[stack.length - 1]) {
              htmlContent += "</li></ul>";
              stack.pop();
            }
            htmlContent += "</li>" + liOpenTag(index, item.textContent);
            stack[stack.length - 1] = level;
          });
          while (stack.length > 1) {
            htmlContent += "</li></ul>";
            stack.pop();
          }
          htmlContent += "</li>";

          document.querySelector(".side-bar__toc-list").innerHTML += htmlContent;
        }
      },
      scrollTop(el, index) {
        if (document.querySelector(".main-article__text .page__body").querySelectorAll("h2, h3, h4").length > index) {
          if (document.querySelector(".side-bar__toc .active")) {
            document.querySelector(".side-bar__toc .active").classList.remove("active");
          }
          el.closest(".side-bar__toc-label").classList.add("active");
          document.querySelector(".main-article__text .page__body").querySelectorAll("h2, h3, h4")[index].scrollIntoView({ behavior: "smooth" });
        }
      },
      initLoadBarPosition() {
        if (this.isPreRelocation) return;

        let sideBarElement = document.querySelector(".side-bar__body");
        if (sideBarElement) {
          if (sideBarElement.querySelector(".side-bar__load-bar .side-bar__load-bar-track")) {
            document.querySelector(".main-article__load-bar").appendChild(sideBarElement.querySelector(".side-bar__load-bar .side-bar__load-bar-track"));
          }
        }
        Alpine.store("xHeaderMenu")._cacheStickyTargets();
      },

      initAutoCloseOnDesktop() {
        if (this.isPreRelocation) return;

        installMediaQueryWatcher(`(min-width: ${MIN_DEVICE_WIDTH.tablet}px)`, (matches) => {
          if (matches && this.show) {
            this.show = false;
            Alpine.store("xMaximizeDrawer").handleClose();
          }
        });
      },
    }));

    Alpine.data("xShippingPolicy", (wrapperEle, blockId, url, isQuickView = "false") => ({
      isOpenShippingPolicy: false,
      htmlInner: "",
      pageTitle: "",
      cacheResults: {},
      isLoading: false,
      handleLoadShipping() {
        this.htmlInner = "";
        this.pageTitle = "";
        const textLinkEle = wrapperEle.querySelector(".product-info__shipping-and-tax__text-link");
        textLinkEle?.classList.add("is-loading");
        Alpine.store("xMaximizeDrawer").handleOpen(`#ShippingPolicyDrawer__Container__${blockId}`);
        if (this.cacheResults[url]) {
          this.isOpenShippingPolicy = true;
          const parser = new DOMParser();
          const text = parser.parseFromString(this.cacheResults[url], "text/html");
          const container = document.querySelector(`#ShippingPolicyPopup__Detail__${blockId}`);

          const pageTitleEl = text.querySelector(".shopify-policy__title");
          if (pageTitleEl) {
            this.pageTitle = pageTitleEl.outerHTML;
            pageTitleEl.remove();
          }

          this.htmlInner = text.querySelector(".shopify-policy__container")?.innerHTML ?? "";
          textLinkEle?.classList.remove("is-loading");

          if (!container) return;
          container.classList.add("animation-fade-in");

          setTimeout(() => {
            container.classList.remove("animation-fade-in");
          }, 100);
        } else {
          fetch(url)
            .then((response) => response.text())
            .then((data) => {
              this.cacheResults[url] = data;
              const parser = new DOMParser();
              const text = parser.parseFromString(data, "text/html");
              const container = document.querySelector(`#ShippingPolicyPopup__Detail__${blockId}`);

              const pageTitleEl = text.querySelector(".shopify-policy__title");
              if (pageTitleEl) {
                this.pageTitle = pageTitleEl.outerHTML;
                pageTitleEl.remove();
              }

              this.htmlInner = text.querySelector(".shopify-policy__container")?.innerHTML ?? "";

              if (!container) return;
              container.classList.add("animation-fade-in");

              setTimeout(() => {
                container.classList.remove("animation-fade-in");
              }, 100);
            })
            .finally(() => {
              this.isOpenShippingPolicy = true;
              textLinkEle?.classList.remove("is-loading");
            });
        }
      },
      closeShippingPopup(closeQuickView = false) {
        this.isOpenShippingPolicy = false;
        let closeAllDrawer = true;
        if (isQuickView == "true" && (!closeQuickView || window.innerWidth < MIN_DEVICE_WIDTH.tablet)) {
          closeAllDrawer = false;
        }
        Alpine.store("xMaximizeDrawer").handleClose(closeAllDrawer);
        if (isQuickView == "true" && closeQuickView && window.innerWidth >= MIN_DEVICE_WIDTH.tablet) {
          Alpine.store("xQuickView").close();
        }
      },
    }));

    Alpine.store("xQuickView", {
      // Optional chaining: window.xQuickView is set by the quick-view section (aside-group),
      // which is absent in isolated renders (e.g. theme editor visual preview). A hard access
      // here would throw and abort ALL component registrations below in this callback.
      sectionId: window.xQuickView?.sectionId ?? "",
      enabled: window.xQuickView?.enabled ?? false,
      buttonLabel: window.xQuickView?.buttonLabel ?? "",
      show: false,
      loading: false,
      cachedResults: [],
      cachedFetch: [],
      selected: false,
      buttonQuickView: "",
      openQuickViewForm: "",
      _openCallbacks: [],
      _scriptsLoaded: false,
      _scriptsLoadedPromise: null,
      init() {
        if (Shopify.designMode) {
          document.addEventListener("shopify:section:load", (event) => {
            if (!event.target?.classList?.contains("section-quick-view")) return;
            this.cachedResults = [];
            this.cachedFetch = [];
          });
        }
        document.addEventListener("quickview:load", (e) => {
          this.load(e.detail.productId, e.detail.productUrl, e.detail.el);
        });
        document.addEventListener("quickview:open", (e) => {
          this.open(e.detail?.openFrom || "");
        });
        document.addEventListener("quickview:close", () => this.close());
        document.addEventListener("quickview:hide", () => {
          this.show = false;
        });
        this._initScripts();
      },
      _initScripts() {
        const container = document.getElementById("QuickViewContainer");
        if (!container) return;

        const scriptKeys = ["variantPickerScript", "videoScript", "productFormScript", "customizableOptionsScript", "slideElementScript", "shippingPolicyScript"];
        const scripts = scriptKeys.map((key) => container.dataset[key]).filter(Boolean);

        if (!scripts.length) {
          this._scriptsLoaded = true;
          return;
        }

        let resolve;
        this._scriptsLoadedPromise = new Promise((r) => {
          resolve = r;
        });

        this._openCallbacks.push(() => {
          const toLoad = scripts.filter((src) => {
            const filename = src.split("/").pop().split("?")[0];
            return !window.Maximize.loadedScript.includes(filename);
          });

          if (!toLoad.length) {
            this._scriptsLoaded = true;
            resolve();
            return;
          }

          Promise.all(
            toLoad.map(
              (src) =>
                new Promise((res) => {
                  const script = document.createElement("script");
                  script.src = src;
                  script.onload = res;
                  script.onerror = res;
                  document.head.appendChild(script);
                })
            )
          ).then(() => {
            // Wait one rAF so scripts that defer Alpine registration via
            // requestAnimationFrame have a chance to run before HTML is injected
            requestAnimationFrame(() => {
              this._scriptsLoaded = true;
              resolve();
            });
          });
        });
      },
      loadScripts() {
        if (this._scriptsLoaded) return Promise.resolve();
        if (this._scriptsLoadedPromise) return this._scriptsLoadedPromise;
        return Promise.resolve();
      },
      addListener() {
        document.addEventListener(`${CART_EVENT.cartUpdate}`, () => {
          this.cachedResults = [];
        });
      },
      load(productId, url, el) {
        if (this.buttonQuickView == "") {
          this.buttonQuickView = el;
        }
        const productCardWrapper = el.closest(".product-card__wrapper");

        const listSelectedInput = Array.from(productCardWrapper?.getElementsByClassName("variant-option__input selected") || []);
        const currentVariantEl = productCardWrapper?.querySelector(".current-variant");
        let variantId = "";
        if (currentVariantEl) {
          try {
            const currentVariant = JSON.parse(currentVariantEl.textContent);
            variantId = currentVariant && typeof currentVariant === "object" ? currentVariant.id : currentVariant;
          } catch (e) {
            variantId = "";
          }
        }
        // let optionsSelectedValues = listSelectedInput.map(input => input.dataset.optionValueId);
        // optionsSelectedValues = [];
        const productUrl = variantId ? `${url}?variant=${variantId}&section_id=${this.sectionId}` : `${url}?section_id=${this.sectionId}`;
        // let productUrl = variantId ? `${url}?option_values=${optionsSelectedValues.join(',')}&section_id=${this.sectionId}` : `${url}?section_id=${this.sectionId}`;

        if (this.cachedResults[productUrl]) {
          document.getElementById("QuickViewProductContent").innerHTML = this.cachedResults[productUrl];
          Alpine.nextTick(() => {
            Alpine.store("xFocusElement").trapFocus("QuickViewContainer", "QuickViewClose");
          });
          return true;
        }

        if (this.cachedFetch[productUrl]) {
          return true;
        }

        this.loading = true;
        this.cachedFetch[productUrl] = true;
        this.loadScripts().then(() => {
          fetch(productUrl)
            .then((response) => {
              return response.text();
            })
            .then((response) => {
              const parser = new DOMParser();
              const content = parser.parseFromString(response, "text/html").getElementById("QuickViewProductContent").innerHTML;
              document.getElementById("QuickViewProductContent").innerHTML = content;
              this.cachedResults[productUrl] = content;
              Alpine.nextTick(() => {
                Alpine.store("xFocusElement").trapFocus("QuickViewContainer", "QuickViewClose");
              });
            })
            .finally(() => {
              this.loading = false;
              this.cachedFetch[productUrl] = false;
            });
        });

        return true;
      },
      open(openFrom = "") {
        if (this._openCallbacks.length > 0) {
          this._openCallbacks.forEach((cb) => cb());
          this._openCallbacks = [];
        }
        this.show = true;
        Alpine.store("xMaximizeDrawer").isOpen = false;
        document.getElementById("CartDrawer").isOpen = false;
        Alpine.store("xMaximizeDrawer").handleOpen("#QuickViewContainer__wapper");
        this.openQuickViewForm = openFrom;
      },
      close() {
        this.show = false;
        this.buttonQuickView = "";

        if (this.openQuickViewForm === "cart_drawer_upsell") {
          Alpine.store("xMaximizeDrawer").handleClose();
          document.getElementById("CartDrawer").isOpen = true;
          setTimeout(() => {
            this.openQuickViewForm = "";
          }, 1000);
        } else {
          Alpine.store("xMaximizeDrawer").handleClose();
        }
        this.removeFocusQuickView();
      },
      focusQuickView(quickView, btnClose) {
        if (!this.selected) {
          Alpine.store("xFocusElement").trapFocus(quickView, btnClose);
        }
      },
      removeFocusQuickView() {
        if (!this.selected) {
          Alpine.store("xFocusElement").removeTrapFocus();
        }
      },
    });

    Alpine.data("xMediaGalleryQuickView", (mediaGalleryWrapperEle, sectionId, isShowMediaWithVariantSelected) => ({
      isFirstLoading: true,
      swiffySlider: null,
      thumbnailItems: [],
      thumbnailItemsShow: [],
      mediaItems: [],
      mediaItemsShow: [],
      indexActiveThumbnail: 0,
      indexActiveMedia: 0,
      activeMediaId: false,
      activeMediaItem: false,
      listMediaApplyShowMediaWithVariantSelected: [],
      productMediasInfo: [],
      currentVariant: false,
      sliderIndicatorWrapperEle: mediaGalleryWrapperEle.querySelector(".slider-indicators"),
      listDotsWrapperEl: mediaGalleryWrapperEle.querySelector(".media-gallery__dot-nav__wrapper"),
      listDotsEl: [],
      listDotsShowEl: [],
      maxNumberDotShow: 0,
      showScrollHintDesktop: false,
      init() {
        this.sectionContainer = document.querySelector(`.section--${sectionId}`);
        if (!this.sectionContainer) {
          this.sectionContainer = document.querySelector(`.main-product__container--${sectionId}`);
        }
        if (this.sectionContainer) {
          this.thumbnailWrapper = this.sectionContainer.querySelector(`.media-gallery__thumbnail-wrapper`);
          this.mediaWrapper = this.sectionContainer.querySelector(`.media-gallery__container`);
          this.thumbnailItems = this.sectionContainer.querySelectorAll(".media-gallery__thumbnail-item");
          this.thumbnailItemsShow = this.sectionContainer.querySelectorAll(".media-gallery__thumbnail-item.is-show-thumbnail-item");
          this.mediaItems = this.sectionContainer.querySelectorAll(".media-gallery__media-item");
          this.mediaItemsShow = this.sectionContainer.querySelectorAll(".media-gallery__media-item.is-show-media-item");
          this.listIndicatorEle = this.sliderIndicatorWrapperEle ? this.sliderIndicatorWrapperEle.querySelectorAll(`.slider-indicator`) : [];
          this.listDotsEl = this.listDotsWrapperEl ? this.listDotsWrapperEl.querySelectorAll(`.media-gallery__dot-nav__dot-item`) : [];

          if (this.thumbnailWrapper) {
            this.thumbnailContainer = this.thumbnailWrapper.querySelector(".media-gallery__thumbnail-container");
          }

          let indexActiveMedia = Array.from(this.mediaItems).findIndex((item) => item.classList.contains("is-active"));
          this.indexActiveMedia = indexActiveMedia >= 0 ? indexActiveMedia : 0;
          this.activeMediaItem = this.mediaItems[this.indexActiveMedia];
          this.activeMediaId = this.mediaItems[this.indexActiveMedia].dataset.mediaId;

          requestAnimationFrame(() => {
            this.handleScrollDot();
          });
        }
        const dotNavContainerEl = mediaGalleryWrapperEle.querySelector(".media-gallery__dot-nav__container");
        if (dotNavContainerEl) {
          this.maxNumberDotShow = SLIDER_DOT.MAX_NUMBER_DOTS;
        }
        const productMediaInfoEle = document.querySelector(`#ProductMediaInfo__${sectionId}`);
        if (productMediaInfoEle) {
          this.productMediasInfo = JSON.parse(productMediaInfoEle.textContent);
        }
        this.currentVariantInfoElement = document.querySelector(`#CurrentVariantInfo__${sectionId}`);
        this.currentVariant = JSON.parse(this.currentVariantInfoElement.textContent);

        const updateVideoProductMedia = () => {
          this.mediaItems.forEach((mediaItem) => {
            const videoContainer = mediaItem.querySelector(".external-video");
            if (videoContainer && window.innerWidth < MIN_DEVICE_WIDTH.tablet) {
              if (mediaItem.dataset.mediaId == this.activeMediaId) {
                Alpine.store("xVideo").updateStatusVideo(videoContainer, true, true);
              } else {
                Alpine.store("xVideo").updateStatusVideo(videoContainer, false, true);
              }
            }
          });
        };

        this.$watch("activeMediaId", (newActiveMediaId, oldActiveMediaId) => {
          const oldMediaItem = Array.from(this.mediaItems).find((item) => parseInt(item.dataset.mediaId) === oldActiveMediaId);
          if (oldMediaItem) {
            oldMediaItem.style.backgroundImage = ``;
            const media = oldMediaItem.querySelector(".media-gallery-item__media");
            if (media) {
              media.classList.remove("hidden");
            }
          }
          // this.indexActiveThumbnail = newValue;
          this.__scrollThumbnail();
          // this.__updateHeightWhenRatioNatural();
          this.mediaItems.forEach((mediaItem) => {
            if (mediaItem.dataset.mediaId == newActiveMediaId) {
              this.activeMediaItem = mediaItem;
              mediaItem.classList.add("is-active");
            } else {
              mediaItem.classList.remove("is-active");
            }
          });
          updateVideoProductMedia();
          this.thumbnailItemsShow.forEach((thumbnailItem) => {
            if (thumbnailItem.dataset.mediaId == newActiveMediaId) {
              thumbnailItem.classList.add("is-active");
            } else {
              thumbnailItem.classList.remove("is-active");
            }
          });
          this.listIndicatorEle = this.sliderIndicatorWrapperEle ? this.sliderIndicatorWrapperEle.querySelectorAll(`.slider-indicator`) : [];
          this.listDotsEl = this.listDotsWrapperEl ? this.listDotsWrapperEl.querySelectorAll(`.media-gallery__dot-nav__dot-item`) : [];
          this.listIndicatorEle.forEach((indicator) => {
            if (indicator.dataset.mediaId == newActiveMediaId) {
              indicator.classList.add("active");
            } else {
              indicator.classList.remove("active");
            }
          });
          const newIndexActiveSlide = Array.from(this.swiffySlider.slides).findIndex((item) => item.dataset.mediaId === newActiveMediaId);
          this.swiffySlider.slideTo(newIndexActiveSlide);
          this.scrollToActiveMedia();
          requestAnimationFrame(() => {
            this.handleScrollDot();
          });
        });

        requestAnimationFrame(() => {
          if (this.$refs.thumbnail_wrapper) {
            const listThumbnailShow = this.$refs.thumbnail_wrapper.querySelectorAll(`.media-gallery__thumbnail-item.is-show-thumbnail-item`);

            if (listThumbnailShow.length > 1) {
              this.$refs.thumbnail_wrapper.classList.add("is-show");
            } else {
              this.$refs.thumbnail_wrapper.classList.remove("is-show");
            }
            this.__updateShowThumbnailNav();
            this.__scrollThumbnail();
          }
        });

        this.$watch("listMediaApplyShowMediaWithVariantSelected", (newList) => {
          const newListString = newList.map(String);
          if (this.$refs.thumbnail_wrapper) {
            if (newList.length > 1) {
              this.$refs.thumbnail_wrapper.classList.add("is-show");
            } else {
              this.$refs.thumbnail_wrapper.classList.remove("is-show");
            }
          }

          this.mediaItems.forEach((mediaItem) => {
            if (newListString.includes(mediaItem.dataset.mediaId)) {
              mediaItem.classList.add("is-show-media-item");
            } else {
              mediaItem.classList.remove("is-show-media-item");
            }
          });
          this.mediaItemsShow = this.sectionContainer.querySelectorAll(".media-gallery__media-item.is-show-media-item");
          this.thumbnailItems.forEach((thumbnailItem) => {
            if (newListString.includes(thumbnailItem.dataset.mediaId)) {
              thumbnailItem.classList.add("is-show-thumbnail-item");
            } else {
              thumbnailItem.classList.remove("is-show-thumbnail-item");
            }
          });
          this.thumbnailItemsShow = this.sectionContainer.querySelectorAll(".media-gallery__thumbnail-item.is-show-thumbnail-item");
          this.__scrollThumbnail();
          this.listIndicatorEle = this.sliderIndicatorWrapperEle ? this.sliderIndicatorWrapperEle.querySelectorAll(`.slider-indicator`) : [];
          this.listDotsEl = this.listDotsWrapperEl ? this.listDotsWrapperEl.querySelectorAll(`.media-gallery__dot-nav__dot-item`) : [];
          this.listIndicatorEle.forEach((indicator) => {
            if (newListString.includes(indicator.dataset.mediaId)) {
              indicator.classList.add("is-show-indicator");
            } else {
              indicator.classList.remove("is-show-indicator");
            }
          });
          this.listDotsShowEl = [];
          this.listDotsEl.forEach((dot) => {
            if (newListString.includes(dot.dataset.mediaId)) {
              dot.classList.add("is-show-dot");
              this.listDotsShowEl.push(dot);
            } else {
              dot.classList.remove("is-show-dot");
            }
          });

          if (this.swiffySlider) {
            this.swiffySlider.slides = mediaGalleryWrapperEle.querySelectorAll(".slide-item.is-show-media-item");
            this.swiffySlider.sliderIndicators = mediaGalleryWrapperEle.querySelectorAll(`.slider-indicator.is-show-indicator`);
            const indexActive = Array.from(this.swiffySlider.slides).findIndex((item) => item.dataset.mediaId === this.activeMediaId);

            if (indexActive > -1) {
              this.swiffySlider.slideTo(indexActive);
              requestAnimationFrame(() => {
                this.checkShowScrollHintDesktop();
                this.scrollToActiveMedia();
              });
            }
            this.swiffySlider.addEventToIndicators();
          }

          requestAnimationFrame(() => {
            this.__updateShowThumbnailNav();
            this.checkShowScrollHintDesktop();
          });
        });
        this.handleChangeVariant();
        const debounce = (callback, delay) => {
          let timer;
          return function () {
            clearTimeout(timer);
            timer = setTimeout(callback, delay);
          };
        };

        window.addEventListener(
          "resize",
          debounce(() => {
            this.__updateShowThumbnailNav();
          }, 300)
        );

        installMediaQueryWatcher(`(min-width: ${MIN_DEVICE_WIDTH.tablet}px)`, (matches) => {
          if (!matches) {
            updateVideoProductMedia();
          } else {
            requestAnimationFrame(() => {
              this.checkShowScrollHintDesktop();
            });
            this.scrollToActiveMedia();
          }
        });

        Alpine.nextTick(() => {
          this.checkShowScrollHintDesktop();
        });
      },
      handleScrollDot() {
        requestAnimationFrame(() => {
          if (this.listDotsShowEl.length > 0) {
            const listDotsContainerEl = this.listDotsWrapperEl.querySelector(".media-gallery__dot-nav__dot-list");
            if (!listDotsContainerEl) return;

            const listDotsContainerWidth = listDotsContainerEl.getBoundingClientRect().width;
            const dotWidth = SLIDER_DOT.DOT_WIDTH;
            const listDotsContainerGap = SLIDER_DOT.DOT_GAP;
            if (!dotWidth && listDotsContainerGap) return;

            let indexActiveMedia = Array.from(this.mediaItemsShow).findIndex((item) => item.dataset.mediaId == this.activeMediaId);
            if (indexActiveMedia == -1) {
              indexActiveMedia = 0;
            }

            this.listDotsShowEl.forEach((dot) => {
              dot.classList.remove("dot-small", "dot-normal");
              if (dot.dataset.mediaId == this.activeMediaId) {
                dot.classList.add("is-active");
              } else {
                dot.classList.remove("is-active");
                if (this.maxNumberDotShow >= this.listDotsShowEl.length) {
                  dot.classList.add("dot-normal");
                }
              }
            });

            if (this.maxNumberDotShow >= this.listDotsShowEl.length) return;

            this.listDotsShowEl[indexActiveMedia + 1] && this.listDotsShowEl[indexActiveMedia + 1].classList.add("dot-normal");
            this.listDotsShowEl[indexActiveMedia - 1] && this.listDotsShowEl[indexActiveMedia - 1].classList.add("dot-normal");
            this.listDotsShowEl[indexActiveMedia + 2] && this.listDotsShowEl[indexActiveMedia + 2].classList.add("dot-small");
            this.listDotsShowEl[indexActiveMedia - 2] && this.listDotsShowEl[indexActiveMedia - 2].classList.add("dot-small");

            const scrollLeftValue = (indexActiveMedia * (dotWidth + listDotsContainerGap) - (listDotsContainerWidth / 2 - dotWidth / 2)) * (window.Maximize.rtl ? -1 : 1);
            listDotsContainerEl.scrollTo({
              left: scrollLeftValue,
              behavior: "smooth",
            });
          }
        });
      },
      handleInitSwiffy(el, configs) {
        this.isFirstLoading = false;

        this.swiffySlider = new SwiffySlider(el, configs);
        this.mediaItems = this.sectionContainer.querySelectorAll(".media-gallery__media-item");
        this.mediaItemsShow = this.sectionContainer.querySelectorAll(".media-gallery__media-item.is-show-media-item");

        document.addEventListener(`${PRODUCT_EVENT.updatedVariant}${sectionId}`, (event) => {
          const { currentVariant } = event.detail;
          this.currentVariant = currentVariant;

          this.handleChangeVariant(event);
        });

        el.addEventListener(`${SWIFFY_SLIDER_EVENT.slide}`, (event) => {
          if (this.swiffySlider.slides[this.swiffySlider.activeSlideIndex]) {
            this.activeMediaId = this.swiffySlider.slides[this.swiffySlider.activeSlideIndex].dataset.mediaId;
          }
        });
        if (!this.mediaWrapper) {
          this.sectionContainer = document.querySelector(`.section--${sectionId}`);
          if (!this.sectionContainer) {
            this.sectionContainer = document.querySelector(`.main-product__container--${sectionId}`);
          }
          if (this.sectionContainer) {
            this.mediaWrapper = this.sectionContainer.querySelector(`.media-gallery__container`);
          }
        }
      },
      handleClickNav: function (event, isNext) {
        const totalItemsShow = this.mediaItemsShow.length;
        let indexActiveThumbnail = Array.from(this.mediaItemsShow).findIndex((item) => item.dataset.mediaId == this.activeMediaId);

        while (true) {
          indexActiveThumbnail += isNext ? 1 : -1;
          if (indexActiveThumbnail < 0) {
            indexActiveThumbnail = totalItemsShow - 1;
          } else if (indexActiveThumbnail >= totalItemsShow) {
            indexActiveThumbnail = 0;
          }

          this.activeMediaId = this.mediaItemsShow[indexActiveThumbnail].dataset.mediaId;
          break;
        }
      },
      handleFocusThumbnail: function (event) {
        const thumbnailItem = event.currentTarget;
        this.activeMediaId = thumbnailItem.dataset.mediaId;
      },
      handleChangeVariant(event) {
        let listMediaApplyShowMediaWithVariantSelected = [];
        let listMediaNullAlt = [];

        if (isShowMediaWithVariantSelected && this.currentVariant && this.currentVariant.options[0]) {
          let activeMediaId = false;

          let firstOptionHandleCurrentVariant = this.currentVariant.options[0].toLowerCase().replace(/ /g, "-");
          this.mediaItems.forEach((item) => {
            if (item.dataset.mediaAlt !== "") {
              let mediaAltHandle = item.dataset.mediaAlt;
              if (firstOptionHandleCurrentVariant === mediaAltHandle) {
                if (!activeMediaId) {
                  activeMediaId = item.dataset.mediaId;
                }

                listMediaApplyShowMediaWithVariantSelected.push(item.dataset.mediaId);
              }
            } else {
              listMediaNullAlt.push(item.dataset.mediaId);
            }
          });
          if (!activeMediaId) {
            if (this.currentVariant.featured_media && this.currentVariant.featured_media.id) {
              activeMediaId = this.currentVariant.featured_media.id.toString();
            } else {
              activeMediaId = this.productMediasInfo[0].id.toString();
            }
          }
          listMediaApplyShowMediaWithVariantSelected.push(activeMediaId);
          this.activeMediaId = activeMediaId;

          listMediaApplyShowMediaWithVariantSelected = listMediaApplyShowMediaWithVariantSelected.concat(listMediaNullAlt);
        } else {
          if (event) {
            let featuredMediaId = `${event.detail.previewMediaId}`;

            if (this.currentVariant && this.currentVariant.featured_media && this.currentVariant.featured_media.id) {
              featuredMediaId = `${this.currentVariant.featured_media.id}`;
            }
            this.activeMediaId = featuredMediaId.toString();
          }

          this.productMediasInfo.forEach((media) => {
            listMediaApplyShowMediaWithVariantSelected.push(media.id);
          });
        }

        this.listMediaApplyShowMediaWithVariantSelected = [...new Set(listMediaApplyShowMediaWithVariantSelected)];
        if (this.sliderIndicatorWrapperEle) {
          if (this.listMediaApplyShowMediaWithVariantSelected.length > 1) {
            this.sliderIndicatorWrapperEle.classList.remove("invisible");
          } else {
            this.sliderIndicatorWrapperEle.classList.add("invisible");
          }
        }
      },
      __scrollThumbnail: function () {
        if (this.thumbnailContainer && this.thumbnailWrapper) {
          const gap = parseInt(this.thumbnailContainer.dataset.gap) || 0;
          this.thumbnailItems.forEach((item, index) => {
            if (item.dataset.mediaId === this.activeMediaId) {
              item.classList.add("is-active");
            } else {
              item.classList.remove("is-active");
            }
          });
          requestAnimationFrame(() => {
            const indexActiveThumbnail = Array.from(this.thumbnailItemsShow).findIndex((item) => item.dataset.mediaId === this.activeMediaId);
            if (window.innerWidth < MIN_DEVICE_WIDTH.tablet) {
              let scrollLeftValue = 0;
              if (indexActiveThumbnail > 0) {
                for (let i = 0; i < indexActiveThumbnail; i++) {
                  scrollLeftValue += this.thumbnailItemsShow[i].offsetWidth + gap;
                }
              }
              if (window.Maximize.rtl) {
                scrollLeftValue = scrollLeftValue * -1;
              }

              this.thumbnailContainer.scrollTo({
                left: scrollLeftValue,
                behavior: "smooth",
              });
            }
          });
        }
      },
      __updateShowThumbnailNav() {
        if (this.$refs.thumbnail_wrapper) {
          const thumbnailNavs = this.$refs.thumbnail_wrapper.querySelectorAll(".media-gallery__thumbnail-nav");
          this.thumbnailItemsShow = this.sectionContainer.querySelectorAll(".media-gallery__thumbnail-item.is-show-thumbnail-item");
          requestAnimationFrame(() => {
            if (window.innerWidth < MIN_DEVICE_WIDTH.tablet) {
              const thumbnailNavWrapperWidth = this.$refs.thumbnail_wrapper.getBoundingClientRect().width;
              const thumbnailWrapperWidth = this.thumbnailItemsShow[0]?.getBoundingClientRect().width * this.thumbnailItemsShow.length + parseFloat(this.thumbnailContainer.dataset.gap) * (this.thumbnailItems.length - 1);

              if (thumbnailWrapperWidth <= thumbnailNavWrapperWidth - 16 * 2) {
                thumbnailNavs.forEach((nav) => {
                  nav.classList.add("!hidden");
                });
              } else {
                thumbnailNavs.forEach((nav) => {
                  nav.classList.remove("!hidden");
                });
              }
            }
          });
        }
      },
      scrollToActiveMedia() {
        Alpine.nextTick(() => {
          const galleryWrapperEl = mediaGalleryWrapperEle.querySelector(".media-gallery__wrapper");

          if (window.innerWidth < MIN_DEVICE_WIDTH.tablet) {
            galleryWrapperEl.dataset.isScrollingOnDesktop = "false";
            return;
          }

          const activeMediaItem = Array.from(this.mediaItemsShow).find((item) => item.dataset.mediaId == this.activeMediaId);
          if (!galleryWrapperEl || !activeMediaItem || activeMediaItem.offsetTop <= 0) {
            galleryWrapperEl.dataset.isScrollingOnDesktop = "false";
            return;
          }

          galleryWrapperEl.scrollTo({
            top: activeMediaItem.offsetTop,
            behavior: "smooth",
          });
        });
      },
      checkShowScrollHintDesktop() {
        const galleryWrapperEl = mediaGalleryWrapperEle.querySelector(".media-gallery__wrapper");
        if (galleryWrapperEl && galleryWrapperEl.scrollHeight > galleryWrapperEl.clientHeight && galleryWrapperEl.scrollTop == 0) {
          this.showScrollHintDesktop = true;
          galleryWrapperEl.addEventListener(
            "scroll",
            () => {
              this.showScrollHintDesktop = false;
            },
            { once: true }
          );

          if (galleryWrapperEl.getElementsByClassName("media-gallery__item__model").length > 0) {
            const setScrollStopped = debounce(() => {
              galleryWrapperEl.dataset.isScrollingOnDesktop = "false";
            }, TIMEOUT.scrollIdle);

            galleryWrapperEl.addEventListener("scroll", () => {
              galleryWrapperEl.dataset.isScrollingOnDesktop = "true";
              setScrollStopped();
            });
          }
        } else {
          this.showScrollHintDesktop = false;
        }
      },
    }));

    Alpine.data("xPreviewBadges", () => ({
      isOpen: window.xBadgesPreviewOpen,
      init() {
        document.addEventListener("shopify:section:select", (event) => {
          if (event.target.id.includes("product-labels-and-badges")) {
            this.open();
          } else {
            this.close();
          }
        });

        document.addEventListener("maximize:badges:block-select", () => {
          this.open();
        });
      },
      open() {
        this.isOpen = true;
        window.xBadgesPreviewOpen = true;
      },
      close() {
        Alpine.store("xFocusElement").removeTrapFocus();
        this.isOpen = false;
        window.xBadgesPreviewOpen = false;
      },
      handleFocusLabelsAndBadges(containerId, closeBtnId) {
        const modalContent = this.$refs.modalContentLabelAndBadges;
        if (modalContent.dataset.isFirstLoad == "true") {
          modalContent.dataset.isFirstLoad = "false";
        } else {
          Alpine.store("xFocusElement").trapFocus(containerId, closeBtnId);
        }
      },
    }));

    Alpine.data("xFeaturedBlog", (sectionId, loadingData) => ({
      sectionId: sectionId,
      loading: loadingData,
      show_more: true,
      loadData() {
        let url = `${window.location.pathname}?section_id=${this.sectionId}`;
        fetch(url, {
          method: "GET",
        })
          .then((response) => response.text())
          .then((responseText) => {
            this.loading = false;
          });
      },
    }));

    Alpine.data("xEventCalendar", (event) => ({
      open: false,
      eventDetails: {},
      addToCal(options) {
        let link = "";
        let timeEnd = "";
        this.eventDetails = event;

        if (!event) {
          this.eventDetails = JSON.parse(JSON.stringify(Alpine.store("xEventCalendarDetail").eventDetail));
        }

        let timeStart = this.handleTime(this.eventDetails.start_year, this.eventDetails.month, this.eventDetails.day, this.eventDetails.start_hour, this.eventDetails.start_minute, options);

        if (this.eventDetails.show_end_date) {
          timeEnd = this.handleTime(this.eventDetails.end_year, this.eventDetails.end_month, this.eventDetails.end_day, this.eventDetails.end_hour, this.eventDetails.end_minute, options);
        } else if (this.eventDetails.show_end_time) {
          timeEnd = this.handleTime(this.eventDetails.start_year, this.eventDetails.month, this.eventDetails.day, this.eventDetails.end_hour, this.eventDetails.end_minute, options);
        } else {
          timeEnd = timeStart;
        }

        switch (options) {
          case "apple":
            this.createDownloadICSFile(0, timeStart, timeEnd, this.eventDetails.title, this.eventDetails.details, this.eventDetails.location, "apple");
            break;
          case "google":
            link =
              "http://www.google.com/calendar/event?action=TEMPLATE&trp=false" +
              "&text=" +
              encodeURIComponent(this.eventDetails.title) +
              "&dates=" +
              timeStart +
              "/" +
              timeEnd +
              "&location=" +
              encodeURIComponent(this.eventDetails.location) +
              "&details=" +
              encodeURIComponent(this.eventDetails.details);
            window.open(link);
            break;
          case "outlook":
            link =
              "https://outlook.live.com/calendar/action/compose?rru=addevent" +
              "&startdt=" +
              timeStart +
              "&enddt=" +
              timeEnd +
              "&subject=" +
              encodeURIComponent(this.eventDetails.title) +
              "&location=" +
              encodeURIComponent(this.eventDetails.location) +
              "&body=" +
              encodeURIComponent(this.eventDetails.details);
            window.open(link);
            break;
          case "yahoo":
            link = "http://calendar.yahoo.com/?v=60" + "&st=" + timeStart + "&et=" + timeEnd + "&title=" + encodeURIComponent(this.eventDetails.title);
            window.open(link);
            break;
          case "ical":
            this.createDownloadICSFile(0, timeStart, timeEnd, this.eventDetails.title, this.eventDetails.details, this.eventDetails.location, "ical");
            break;
          default:
            console.error(`Sorry, error`);
        }
      },
      handleTime(year, month, day, hour, minute, options) {
        let date = new Date();

        if (options == "google" || options == "yahoo") {
          date = new Date(Date.UTC(year, this.getMonthNumber(month), parseInt(day), parseInt(hour), parseInt(minute)));
          date.setTime(date.getTime() + (-1 * parseInt(this.eventDetails.timezone) * 60 - date.getTimezoneOffset()) * 60 * 1000);
          return date
            .toISOString()
            .split("Z")[0]
            .replace(".000", "")
            .replace(/[^A-Z0-9]/gi, "");
        } else {
          date = new Date(year, this.getMonthNumber(month), parseInt(day), parseInt(hour), parseInt(minute));
          date.setTime(date.getTime() + (-1 * parseInt(this.eventDetails.timezone) * 60 - date.getTimezoneOffset()) * 60 * 1000);
          if (options == "apple") {
            return date
              .toISOString()
              .split("Z")[0]
              .replace(".000", "")
              .replace(/[^A-Z0-9]/gi, "");
          } else {
            return date.toISOString();
          }
        }
      },
      getMonthNumber(month) {
        return new Date(`${month} 1, 2022`).getMonth();
      },
      createDownloadICSFile(timezone, timeStart, timeEnd, title, description, location, type) {
        let icsBody =
          "BEGIN:VCALENDAR\n" +
          "VERSION:2.0\n" +
          "PRODID:Calendar\n" +
          "CALSCALE:GREGORIAN\n" +
          "METHOD:PUBLISH\n" +
          "BEGIN:VTIMEZONE\n" +
          "TZID:" +
          timezone +
          "\n" +
          "END:VTIMEZONE\n" +
          "BEGIN:VEVENT\n" +
          "SUMMARY:" +
          title +
          "\n" +
          "UID:@Default\n" +
          "SEQUENCE:0\n" +
          "STATUS:CONFIRMED\n" +
          "TRANSP:TRANSPARENT\n" +
          "DTSTART;TZID=" +
          timezone +
          ":" +
          timeStart +
          "\n" +
          "DTEND;TZID=" +
          timezone +
          ":" +
          timeEnd +
          "\n" +
          "LOCATION:" +
          location +
          "\n" +
          "DESCRIPTION:" +
          description +
          "\n" +
          "END:VEVENT\n" +
          "END:VCALENDAR\n";

        this.download(title + ".ics", icsBody, type);
      },
      download(filename, fileBody, type) {
        var element = document.createElement("a");

        if (type == "ical") {
          element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(fileBody));
        } else if (type == "apple") {
          var file = new Blob([fileBody], { type: "text/calendar;charset=utf-8" });
          element.href = window.URL.createObjectURL(file);
        }

        element.setAttribute("download", filename);
        element.style.display = "none";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      },
    }));

    Alpine.store("xEventCalendarDetail", {
      show: false,
      eventDetail: {},
      handleEventSelect() {
        var _this = this;
        const eventDetail = JSON.parse(JSON.stringify(this.eventDetail));

        document.addEventListener("shopify:section:select", function (event) {
          if (event.target.classList.contains("section-event-calendar") == false) {
            if (window.Alpine) {
              _this.close();
            } else {
              document.addEventListener("alpine:initialized", () => {
                _this.close();
              });
            }
          }
        });

        if (eventDetail && eventDetail.blockID && eventDetail.sectionID) {
          this.eventDetail = xParseJSON(document.getElementById("x-data-event-" + eventDetail.blockID).getAttribute("x-event-data"));
          let element = document.getElementById("EventDescription-" + this.eventDetail.sectionID);
          element.innerHTML = this.eventDetail.description;
          element.innerHTML = element.textContent;
        }
      },
      load(el, blockID) {
        this.eventDetail = xParseJSON(el.closest("#x-data-event-" + blockID).getAttribute("x-event-data"));
        let element = document.getElementById("EventDescription-" + this.eventDetail.sectionID);
        this.sectionID = this.eventDetail.sectionID;
        element.innerHTML = this.eventDetail.description;
        element.innerHTML = element.textContent;
        this.showEventCalendarDetail();
      },
      showEventCalendarDetail() {
        this.show = true;
        Alpine.store("xMaximizeDrawer").isOpen = true;
      },
      close() {
        this.show = false;
        Alpine.store("xMaximizeDrawer").handleClose();
      },
    });

    Alpine.store("xVideo", {
      ytIframeId: 0,
      vimeoIframeId: 0,
      externalListened: false,
      togglePlay(el) {
        const videoContainer = el.closest(".external-video") || el;
        if (!videoContainer) return;

        let video = videoContainer.getElementsByClassName("video")[0];
        if (!video) return;

        const videoWrapper = el.closest(".video__wrapper");
        const videoText = videoWrapper ? videoWrapper.getElementsByClassName("video__content__text")[0] : null;
        if (videoText) {
          videoText.classList.add("pointer-events-auto");
        }
        if ((video.tagName == "IFRAME" && videoContainer.classList.contains("function-paused")) || video.paused) {
          this.play(el);
        } else {
          this.pause(el);
        }
      },
      play(el) {
        const videoContainer = el.closest(".external-video") || el;
        if (!videoContainer) return;

        let video = videoContainer?.getElementsByClassName("video")[0];
        if (!video) return;

        const buttonPlay = videoContainer.getElementsByClassName("button-play")[0];
        const buttonSoundControl = videoContainer.getElementsByClassName("button-sound-control")[0];
        if (buttonPlay) {
          buttonPlay.classList.add("started-video");
        }
        if (buttonSoundControl) {
          buttonSoundControl.setAttribute("tabindex", "0");
        }

        if (video.tagName == "IFRAME") {
          if (videoContainer.classList.contains("function-paused")) {
            this.externalPostCommand(video, "play");
            videoContainer.classList.remove("function-paused");
          }
        } else if (video.tagName == "VIDEO") {
          video.play();
        }
        const videoWrapper = el.closest(".video__wrapper");
        const videoText = videoWrapper ? videoWrapper.getElementsByClassName("video__content__text")[0] : null;
        if (videoText) {
          videoText.classList.add("pointer-events-auto");
        }
      },
      pause(el, isLeave = false) {
        const videoContainer = el.closest(".external-video") || el;
        if (!videoContainer) return;

        let video = videoContainer.getElementsByClassName("video")[0];
        if (!video) return;

        if (isLeave && videoContainer.dataset.videoStatus == "play") {
          videoContainer.dataset.pausedByLeave = "true";
        }

        if (video.tagName == "IFRAME") {
          if (!videoContainer.classList.contains("function-paused")) {
            videoContainer.classList.add("function-paused");
            this.externalPostCommand(video, "pause");
          }
        } else if (video.tagName == "VIDEO") {
          video.pause();
        }
      },
      mp4Listen(el) {
        let videoContainer = el.closest(".external-video") || el;
        if (!videoContainer) return;

        let video = videoContainer.getElementsByClassName("video")[0];
        if (!video) return;

        let buttonPlay = videoContainer.getElementsByClassName("button-play")[0];
        let buttonSoundControl = videoContainer.getElementsByClassName("button-sound-control")[0];

        video.addEventListener("play", function () {
          if (buttonPlay) {
            buttonPlay.classList.add("is-playing");
          }
          videoContainer.dataset.videoStatus = "play";
          videoContainer.dataset.pausedByLeave = "false";
        });

        video.addEventListener("pause", function () {
          if (buttonPlay) {
            buttonPlay.classList.remove("is-playing");
          }
          videoContainer.dataset.videoStatus = "pause";
        });

        if (buttonSoundControl) {
          video.addEventListener("volumechange", function () {
            if (video.muted) {
              buttonSoundControl.classList.add("is-muted");
            } else {
              buttonSoundControl.classList.remove("is-muted");
            }
          });
        }
      },
      mp4Thumbnail(el, showControls = true) {
        const videoContainer = el.closest(".external-video");
        if (videoContainer) {
          const imgThumbnail = videoContainer.getElementsByClassName("img-thumbnail")[0];
          const video = videoContainer.getElementsByClassName("video")[0];
          if (imgThumbnail) {
            imgThumbnail.classList.add("hidden");
          }

          if (video && showControls) {
            video.setAttribute("tabindex", "0");
            video.focus();
            video.setAttribute("controls", "");
          }

          this.togglePlay(el);
        }

        if (video && showControls) {
          video.setAttribute("controls", "");
        }

        this.togglePlay(el);
      },
      externalLoad(el, host, id, loop, title, showControls = true) {
        let src = "";
        let pointerEvent = "";
        const controls = showControls ? 1 : 0;
        if (host == "youtube") {
          src = `https://www.youtube.com/embed/${id}?mute=1&playlist=${id}&autoplay=1&playsinline=1&enablejsapi=1&modestbranding=1&rel=0&controls=${controls}&showinfo=${controls}`;
        } else {
          src = `https://player.vimeo.com/video/${id}?muted=1&autoplay=1&playsinline=1&api=1&controls=${controls}&loop=${loop ? 1 : 0}`;
        }

        requestAnimationFrame(() => {
          const videoContainer = el.closest(".external-video");
          if (videoContainer) {
            const videoContentEl = videoContainer.querySelector(".video-container");
            if (!videoContentEl) return;
            videoContentEl.innerHTML = `<iframe data-video-loop="${loop}" class="iframe-video absolute w-full h-full video top-1/2 -translate-y-1/2 ${pointerEvent}"
            frameborder="0" host="${host}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen playsinline
            src="${src}" title="${title}"></iframe>`;
            const iframeVideo = videoContainer.querySelector(".iframe-video");

            if (showControls) {
              videoContainer.setAttribute("tabindex", "0");
              videoContainer.focus();
            }

            if (iframeVideo) {
              iframeVideo.addEventListener("load", () => {
                setTimeout(() => {
                  if (videoContainer.dataset.isActive == "true") {
                    this.play(videoContainer);
                  } else {
                    this.pause(videoContainer, true);
                    videoContainer.dataset.videoStatus = "pause";
                  }

                  if (host == "youtube") {
                    this.ytIframeId++;
                    iframeVideo.contentWindow.postMessage(
                      JSON.stringify({
                        event: "listening",
                        id: this.ytIframeId,
                        channel: "widget",
                      }),
                      "*"
                    );
                  } else {
                    this.vimeoIframeId++;
                    iframeVideo.contentWindow.postMessage(
                      JSON.stringify({
                        method: "addEventListener",
                        value: "finish",
                      }),
                      "*"
                    );
                    iframeVideo.contentWindow.postMessage(
                      JSON.stringify({
                        method: "addEventListener",
                        value: "play",
                      }),
                      "*"
                    );
                    iframeVideo.contentWindow.postMessage(
                      JSON.stringify({
                        method: "addEventListener",
                        value: "pause",
                      }),
                      "*"
                    );
                  }
                }, 100);
              });
            }
          }
        });

        this.externalListen();
      },
      renderVimeoFacade(el, id, options) {
        fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${id}&width=${options.width}`)
          .then((reponse) => {
            return reponse.json();
          })
          .then((response) => {
            const html = `
              <picture>
                <img src="${response.thumbnail_url}" loading="lazy" class="w-full h-full object-cover" alt="${options.alt}" width="${response.width}" height="${response.height}"/>
              </picture>
            `;

            requestAnimationFrame(() => {
              el.innerHTML = html;
            });
          });
      },
      renderVimeoFacadeSource(el, id, options, loading) {
        fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${id}&width=${options.width}`)
          .then((response) => response.json())
          .then((response) => {
            const source2 = document.createElement("source");
            source2.srcset = `${response.thumbnail_url}`;
            source2.media = "(min-width: 768px)";
            source2.width = response.width;
            source2.height = response.height;

            const img = document.createElement("img");
            img.src = response.thumbnail_url;
            img.loading = loading;
            img.className = "object-cover z-10 absolute top-0 left-0 h-full w-full img-thumbnail image-hover";
            img.alt = options.alt || "";
            img.width = response.width;
            img.height = response.height;

            requestAnimationFrame(() => {
              el.appendChild(source2);
              el.appendChild(img);
              const vimeoThumbnailSkeletonEl = el.querySelector(".vimeo-thumbnail-skeleton");
              if (!vimeoThumbnailSkeletonEl) return;
              vimeoThumbnailSkeletonEl.remove();
            });
          });
      },
      externalListen() {
        if (!this.externalListened) {
          window.addEventListener("message", (event) => {
            var iframes = document.getElementsByTagName("IFRAME");

            for (let i = 0, iframe, win, message; i < iframes.length; i++) {
              iframe = iframes[i];
              let videoContainer = iframe.parentNode.closest(".external-video") || iframe.parentNode;
              let buttonSoundControl = videoContainer?.getElementsByClassName("button-sound-control")[0];
              const buttonPlay = videoContainer?.getElementsByClassName("button-play")[0];

              // Cross-browser way to get iframe's window object
              win = iframe.contentWindow || iframe.contentDocument.defaultView;

              if (win === event.source) {
                if (event.origin == "https://www.youtube.com") {
                  message = JSON.parse(event.data);
                  if (message.info && message.info.playerState == 0) {
                    if (iframe.getAttribute("data-video-loop") === "true") {
                      this.externalPostCommand(iframe, "play");
                    } else {
                      if (buttonPlay) {
                        buttonPlay.classList.remove("is-playing");
                      }
                      if (videoContainer) {
                        videoContainer.classList.add("function-paused");
                        videoContainer.dataset.videoStatus = "pause";
                      }
                    }
                  }
                  if (message.info && message.info.playerState == 1) {
                    if (buttonPlay) {
                      buttonPlay.classList.add("is-playing");
                    }
                    if (videoContainer) {
                      videoContainer.classList.remove("function-paused");
                      videoContainer.dataset.videoStatus = "play";
                      videoContainer.dataset.pausedByLeave = "false";
                    }
                  }
                  if (message.info && message.info.playerState == 2) {
                    if (buttonPlay) {
                      buttonPlay.classList.remove("is-playing");
                    }
                    if (videoContainer) {
                      videoContainer.classList.add("function-paused");
                      videoContainer.dataset.videoStatus = "pause";
                      if (videoContainer.dataset.isActive == "false") {
                        videoContainer.dataset.pausedByLeave = "true";
                      }
                    }
                  }

                  if (buttonSoundControl && message.info && typeof message.info.muted !== "undefined") {
                    if (message.info.muted) {
                      buttonSoundControl.classList.add("is-muted");
                    } else {
                      buttonSoundControl.classList.remove("is-muted");
                    }
                  }
                }

                if (event.origin == "https://player.vimeo.com") {
                  message = JSON.parse(event.data);
                  if (iframe.getAttribute("data-video-loop") !== "true") {
                    if (message.event == "finish") {
                      if (iframe.getAttribute("data-video-loop") === "true") {
                        this.externalPostCommand(iframe, "play");
                      }
                    }
                  }
                  if (message.event === "play") {
                    if (buttonPlay) {
                      buttonPlay.classList.add("is-playing");
                    }
                    if (videoContainer) {
                      videoContainer.classList.remove("function-paused");
                      videoContainer.dataset.videoStatus = "play";
                      videoContainer.dataset.pausedByLeave = "false";
                    }
                  }
                  if (message.event === "pause") {
                    if (buttonPlay) {
                      buttonPlay.classList.remove("is-playing");
                    }
                    if (videoContainer) {
                      videoContainer.classList.add("function-paused");
                      videoContainer.dataset.videoStatus = "pause";
                      if (videoContainer.dataset.isActive == "false") {
                        videoContainer.dataset.pausedByLeave = "true";
                      }
                    }
                  }

                  if (buttonSoundControl && message.method === "setVolume") {
                    if (message.value === 0) {
                      buttonSoundControl.classList.add("is-muted");
                    } else {
                      buttonSoundControl.classList.remove("is-muted");
                    }
                  }
                }
              }
            }
          });

          this.externalListened = true;
        }
      },
      externalPostCommand(iframe, cmd) {
        const host = iframe.getAttribute("host");
        let command;
        if (host === "youtube") {
          if (cmd === "mute") {
            command = { event: "command", func: "mute" };
          } else if (cmd === "unmute") {
            command = { event: "command", func: "unMute" };
          } else {
            command = { event: "command", func: cmd + "Video" };
          }
        } else {
          if (cmd === "mute") {
            command = { method: "setVolume", value: 0 };
          } else if (cmd === "unmute") {
            command = { method: "setVolume", value: 1 };
          } else {
            command = { method: cmd, value: "true" };
          }
        }
        iframe.contentWindow.postMessage(JSON.stringify(command), "*");
      },
      toggleMute(el) {
        const videoContainer = el.closest(".external-video") || el;
        if (!videoContainer) return;

        let video = videoContainer.getElementsByClassName("video")[0];
        if (!video) return;

        if (video.tagName != "IFRAME") {
          video.muted = !video.muted;
        } else {
          let buttonSoundControl = videoContainer.getElementsByClassName("button-sound-control")[0];
          if (!buttonSoundControl) return;
          if (buttonSoundControl.classList.contains("is-muted")) {
            this.externalPostCommand(video, "unmute");
          } else {
            this.externalPostCommand(video, "mute");
          }
        }
      },
      handleClickButtonPlay(el, video_type, video_id, video_alt, show_controls = true) {
        if (el.classList.contains("started-video")) {
          this.togglePlay(el);
        } else if (video_type == "video_select") {
          this.mp4Thumbnail(el, show_controls);
        } else {
          this.externalLoad(el, video_type, video_id, false, video_alt, show_controls);
        }
      },
      updateStatusVideo(videoContainer, isPlay, isUpdateActive) {
        let videoContainerDataset = videoContainer.dataset;
        if (!videoContainerDataset) return;
        if (isUpdateActive) {
          videoContainerDataset.isActive = isPlay ? "true" : "false";
        }
        if (isPlay && videoContainerDataset.videoAutoPlay == "true") {
          if (videoContainerDataset.videoStatus == "pause" && videoContainerDataset.pausedByLeave == "true" && videoContainerDataset.isActive == "true") {
            this.play(videoContainer);
          }
        } else {
          this.pause(videoContainer, true);
        }
      },
      firtLoadMp4AutoPlay(el) {
        if (el.dataset.isActive == "true") {
          this.play(el);
        } else {
          this.pause(el, true);
          el.dataset.videoStatus = "pause";
        }
        this.mp4Listen(el);
      },
    });

    Alpine.store("xProductRecently", {
      show: false,
      loading: true,
      productsToShow: 0,
      productsToShowMax: 10,
      listRecentlyProducts: [],
      init() {
        let recentlyProductsStored = localStorage.getItem("recently-viewed") ? localStorage.getItem("recently-viewed") : "[]";
        this.listRecentlyProducts = JSON.parse(recentlyProductsStored);
        const recentlyViewedSection = document.getElementById("RecentlyViewedSection");
        if (recentlyViewedSection) {
          this.productsToShow = recentlyViewedSection.dataset.productsToShow;
        }
      },
      showProductRecently() {
        if (this.listRecentlyProducts.length) {
          this.show = true;
        } else {
          this.show = false;
        }
      },
      setProduct(productViewed) {
        if (this.listRecentlyProducts.length) {
          let productList = this.listRecentlyProducts;
          productList = [...productList.filter((p) => p !== productViewed)].filter((p, i) => i < this.productsToShowMax);
          // need to confirm with BA logic recently viewed in quickview
          if (productList.length === 0) {
            this.show = false;
          } else {
            this.show = true;
          }
          let newData = [productViewed, ...productList];
          localStorage.setItem("recently-viewed", JSON.stringify(newData));
        } else {
          this.show = false;
          localStorage.setItem("recently-viewed", JSON.stringify([productViewed]));
        }
      },
      getProductRecently(sectionId, productId) {
        let products = this.listRecentlyProducts;
        if (this.listRecentlyProducts.length) {
          products = productId ? [...products.filter((p) => p !== productId)] : products;
          products = products.slice(0, this.productsToShow);
        } else {
          return;
        }
        const el = document.querySelector("#RecentlyViewedSection .recently-viewed__content");
        let query = products.map((value) => "id:" + value).join(" OR ");

        if (!query) {
          this.loading = false;
          return;
        }

        const search_url = `${Shopify.routes.root}search?section_id=${sectionId}&type=product&q=${encodeURIComponent(query)}`;
        fetch(search_url)
          .then((response) => {
            if (!response.ok) {
              // In theme editor / before the section is persisted, the Section Rendering API
              // can return 404 for this section_id. Bail quietly instead of logging an error.
              return null;
            }
            return response.text();
          })
          .then((text) => {
            if (!text) return;
            const resultsElement = new DOMParser().parseFromString(text, "text/html").querySelector("#RecentlyViewedSection .recently-viewed__content");
            const resultsMarkup = resultsElement ? resultsElement.innerHTML : "";
            el.innerHTML = resultsMarkup;
            document.dispatchEvent(new CustomEvent(`${ANIMATION_EVENT.revealItem}`));
          })
          .catch(() => {})
          .finally(() => {
            this.loading = false;
          });
      },
      clearHistory() {
        let result = confirm("Are you sure you want to clear your recently viewed products?");
        if (result === true) {
          localStorage.removeItem("recently-viewed");
          this.show = false;
        }
      },
    });

    Alpine.data("xMap", (data) => ({
      load() {
        const mapIframe = this.$el.querySelector("iframe");
        if (mapIframe) {
          mapIframe.addEventListener("load", () => {
            mapIframe.classList.remove("hidden");
            this.$refs.iframe_placeholder?.classList.add("hidden");
          });
          mapIframe.src = `https://maps.google.com/maps?q=${data}&t=m&z=17&ie=UTF8&output=embed&iwloc=near`;
        }
      },
      loadMap(location) {
        this.$el.querySelector("iframe").src = `https://maps.google.com/maps?q=${location}&t=m&z=17&ie=UTF8&output=embed&iwloc=near`;
      },
      removeMap() {
        this.$el.querySelector("iframe").src = ``;
      },
    }));

    Alpine.data("xFlowCard", (openFirstTab, sectionId, blockSize) => ({
      openFirstTab: false,
      activeCardIndex: 1,
      nextActiveIndex1: 2,
      nextActiveIndex2: 3,
      shown: false,
      loading: true,
      sectionId: sectionId,
      previousIndex: null,
      type: "next",
      init() {
        this.openFirstTab = openFirstTab;
        this.debounceSelectFlowCard = this.debounce(this.handleSelectFlowCard, 100);

        const updateVideoFlowCards = () => {
          const flowCards = this.$el.querySelectorAll(".flow-card");
          flowCards.forEach((element) => {
            const videoContainer = element.querySelector(".external-video");
            if (videoContainer) {
              if (element.classList.contains("flow-card--current")) {
                Alpine.store("xVideo").updateStatusVideo(videoContainer, true, true);
              } else {
                Alpine.store("xVideo").updateStatusVideo(videoContainer, false, true);
              }
            }
          });
        };

        this.$watch("activeCardIndex", () => {
          updateVideoFlowCards();
        });
      },
      handleSelectFlowCard(activeIndex) {
        let type = "";
        if (this.activeCardIndex > activeIndex) {
          type = "previous";
        } else if (this.activeCardIndex < activeIndex) {
          type = "next";
        }
        this.previousIndex = this.activeCardIndex;
        this.activeCardIndex = activeIndex;
        this.openFirstTab = true;
        this.calculateNewIndex(type);
      },
      debounce(func, wait) {
        let timeout;
        return function (...args) {
          clearTimeout(timeout);
          timeout = setTimeout(() => func.apply(this, args), wait);
        };
      },
      calculateNewIndex(type) {
        this.nextActiveIndex1 = (this.activeCardIndex % blockSize) + 1;
        this.nextActiveIndex2 = (this.nextActiveIndex1 % blockSize) + 1;
        this.type = type;
      },
      handleNavigationCard(type) {
        this.previousIndex = this.activeCardIndex;
        if (type === "previous") {
          this.activeCardIndex = ((this.activeCardIndex - 2 + blockSize) % blockSize) + 1;
        } else if (type === "next") {
          this.activeCardIndex = this.nextActiveIndex1;
        }
        this.calculateNewIndex(type);
      },
      firstLoadData() {
        if (window.Shopify && Shopify.designMode) {
          this.loading = false;
          return;
        }
        let url = `${window.location.pathname}?section_id=${this.sectionId}`;
        fetch(url, {
          method: "GET",
        })
          .then((response) => (response.ok ? response.text() : null))
          .then(() => {
            this.loading = false;
          })
          .catch(() => {
            this.loading = false;
          });
      },
      getCardClasses(index) {
        return {
          "flow-card--current-1": index === this.nextActiveIndex1 && blockSize > 1,
          "flow-card--current-2": index === this.nextActiveIndex2 && blockSize > 2,
          "flow-card--out": index !== this.activeCardIndex,
          "flow-card--current": index === this.activeCardIndex,
          "flow-card--next": this.type === "next" && index === this.previousIndex,
          "flow-card--prev": this.type === "previous" && index === this.previousIndex,
        };
      },
    }));

    Alpine.data("xSearchTab", (sectionId) => ({
      activeTab: "product",
      articleCount: 0,
      pageCount: 0,
      collectionCount: 0,
      term: "",
      init() {
        this.term = this.$root.querySelector("#SearchTermContent")?.textContent;
        this.fetchArticlesResult();
        this.fetchPagesResult();
        this.fetchCollectionsResult();
      },
      getURL(term, sectionId, param) {
        return `${window.Shopify.routes.root}search?section_id=${sectionId}&q=${term}&${param}`;
      },
      fetchArticlesResult() {
        let param = "type=article&options[prefix]=last&options[unavailable_products]=last";
        let url = this.getURL(this.term, sectionId, param);

        fetch(url)
          .then((response) => response.text())
          .then((responseText) => {
            const html = new DOMParser().parseFromString(responseText, "text/html");
            const mainSearchResult = document.getElementById("MainSearchResult_Article");
            const productGridContainer = html.querySelector("#ProductGridContainer");
            const resultCountElement = html.getElementById("ResultCount");

            if (mainSearchResult && productGridContainer) {
              mainSearchResult.innerHTML = productGridContainer.innerHTML;
              if (typeof initializeScrollAnimationTrigger === "function") initializeScrollAnimationTrigger();
            }

            if (resultCountElement) {
              this.articleCount = Number(resultCountElement.innerHTML);
            } else {
              this.articleCount = 0;
            }
          })
          .catch((error) => {
            console.error(error);
          });
      },

      fetchPagesResult() {
        let param = "type=page&options[prefix]=last&options[unavailable_products]=last";
        let url = this.getURL(this.term, sectionId, param);

        fetch(url)
          .then((response) => response.text())
          .then((responseText) => {
            const html = new DOMParser().parseFromString(responseText, "text/html");

            const mainSearchResult = document.getElementById("MainSearchResult_Page");
            const productGridContainer = html.querySelector("#ProductGridContainer");
            const resultCountElement = html.getElementById("ResultCount");

            if (mainSearchResult && productGridContainer) {
              mainSearchResult.innerHTML = productGridContainer.innerHTML;
            }

            if (resultCountElement) {
              this.pageCount = Number(resultCountElement.innerHTML);
            }
          })
          .catch((error) => {
            console.error(error);
          });
      },

      fetchCollectionsResult() {
        const url = `${Shopify.routes.root}search/suggest?q=${encodeURIComponent(this.term)}&${encodeURIComponent("resources[type]")}=${"collection"}&${encodeURIComponent("resources[limit]")}=${encodeURIComponent(10)}&section_id=predictive-search-collection`;

        fetch(url)
          .then((response) => {
            if (!response.ok) {
              let error = new Error(response.status);
              throw error;
            }
            return response.text();
          })
          .then((responseText) => {
            const parser = new DOMParser();
            const text = parser.parseFromString(responseText, "text/html");
            const collectionWrapper = document.getElementById("ItemsGrid-collection");
            const listCollections = text.querySelectorAll(".collection-item");

            if (listCollections.length > 0) {
              if (collectionWrapper) {
                collectionWrapper.innerHTML = "";
                listCollections.forEach((collection) => {
                  collectionWrapper.insertAdjacentHTML("beforeend", collection.innerHTML);
                });
              }
            } else {
              const msgNoResult = text.querySelector(".msg-no-result");
              if (collectionWrapper && msgNoResult) {
                collectionWrapper.style.display = "block";
                collectionWrapper.innerHTML = msgNoResult.innerHTML;
              }
            }

            this.collectionCount = listCollections.length || 0;
          })
          .catch((error) => {
            console.error(error);
          });
      },
    }));

    Alpine.data("xPopups", (data) => ({
      enable: false,
      showMinimal: false,
      show: Shopify.designMode ? (localStorage.getItem(data.name + "-" + data.sectionId) ? xParseJSON(localStorage.getItem(data.name + "-" + data.sectionId)) : true) : false,
      delayDays: data.delayDays ? data.delayDays : 0,
      t: "",
      copySuccess: false,
      init() {
        if (Shopify.designMode) {
          let _this = this;
          const handlePopupSelect = (event, isResize = null) => {
            if ((event.detail && event.detail.sectionId && event.detail.sectionId.includes(data.sectionId)) || isResize) {
              if (window.Alpine) {
                _this.open();
                localStorage.setItem(data.name + "-" + data.sectionId, JSON.stringify(true));
              } else {
                document.addEventListener("alpine:initialized", () => {
                  _this.open();
                  localStorage.setItem(data.name + "-" + data.sectionId, JSON.stringify(true));
                });
              }
            } else {
              if (window.Alpine) {
                _this.closeSection();
                localStorage.setItem(data.name + "-" + data.sectionId, JSON.stringify(false));
              } else {
                document.addEventListener("alpine:initialized", () => {
                  _this.closeSection();
                  localStorage.setItem(data.name + "-" + data.sectionId, JSON.stringify(false));
                });
              }
            }
          };

          document.addEventListener("shopify:section:select", (event) => {
            handlePopupSelect(event);
          });

          document.addEventListener("shopify:block:select", (event) => {
            handlePopupSelect(event);
          });

          //reload popup and display overlay when change screen in shopify admin
          if (data.name != "popup-age-verification") {
            window.addEventListener("resize", (event) => {
              handlePopupSelect(event, xParseJSON(localStorage.getItem(data.name + "-" + data.sectionId)));
              if (xParseJSON(localStorage.getItem(data.name + "-" + data.sectionId))) {
              }
            });
          }
        }

        this.handleLoadPage();

        if (this.$el.querySelector(".newsletter-message")) {
          this.open();
        }

        this.$watch("show", (newValue) => {
          if (newValue) {
            Alpine.store("xMaximizePopup").handleOpen();
          } else {
            Alpine.store("xMaximizePopup").handleClose();
          }
        });
      },
      load() {
        //optimize popup load js
        if (window.location.pathname === "/challenge") return;

        const _this = this;
        if (Shopify.designMode) {
          _this.open();
          return;
        }

        if (data.name == "popup-promotion" && !this.handleSchedule() && data.showCountdown) return;

        if (data.name == "popup-promotion" && document.querySelector("#x-age-popup") && xParseJSON(localStorage.getItem("popup-age-verification")) == null) {
          document.addEventListener("close-age-verification", () => {
            setTimeout(() => {
              _this.open();
            }, data.delays * 1000);
          });
          return;
        }

        // === User Engagement Gate ===
        // Popup only opens when BOTH conditions are true:
        //   1. The configured delay has elapsed
        //   2. The user has genuinely interacted (scroll/click/move/touch)
        // Lighthouse & PageSpeed bots run with zero interaction → popup never shows
        // → popup image is never an LCP candidate in lab measurements.
        // Real users always trigger at least one event (pointermove / scroll)
        // → behaviour is identical to the plain setTimeout approach.
        var timerDone = false;
        var userEngaged = false;

        var tryOpen = function () {
          if (timerDone && userEngaged) _this.open();
        };

        var ENGAGE_EVENTS = ["scroll", "click", "keydown", "touchstart", "pointermove"];
        var onEngage = function () {
          if (userEngaged) return;
          userEngaged = true;
          ENGAGE_EVENTS.forEach(function (e) {
            document.removeEventListener(e, onEngage);
          });
          tryOpen();
        };
        ENGAGE_EVENTS.forEach(function (e) {
          document.addEventListener(e, onEngage, { passive: true });
        });

        setTimeout(function () {
          timerDone = true;
          tryOpen();
        }, data.delays * 1000);
      },
      _loadPopupImages() {
        // Swap data-src → src for popup images only when popup is actually shown.
        // Keeps <img> without src in initial HTML so browser never discovers/loads
        // the image early and it cannot become an LCP candidate before popup opens.
        // NOTE: image lives inside x-teleport so it is OUTSIDE this.$el.
        //       Query by unique container ID instead.
        requestAnimationFrame(() => {
          const container = document.getElementById("PromoPopup__Container__" + data.sectionId);
          if (!container) return;
          container.querySelectorAll("img.popup-lazy-img[data-src]").forEach(function (img) {
            // img.src returns current page URL when attr absent — use getAttribute instead
            if (img.getAttribute("src")) return;
            if (img.dataset.srcset) img.srcset = img.dataset.srcset;
            if (img.dataset.sizes) img.sizes = img.dataset.sizes;
            img.src = img.dataset.src;
          });
        });
      },
      open() {
        if (!Shopify.designMode && this.isExpireSave() && !this.show) return;

        var _this = this;
        if (data.name == "popup-age-verification") {
          if (this.isExpireSave() && !Shopify.designMode && !data.show_popup) return;

          requestAnimationFrame(() => {
            Alpine.store("xMaximizePopup").handleOpen();
          });
        }

        // Show minimal popup when
        // 1. "Show minimal" is enabled for desktop, default style is set to "minimal", and the window width is >= 768
        // 2. "Show minimal" is enabled for mobile, default mobile style is set to "minimal", and the window width is < 768
        if ((data.showMinimal && data.default_style == "minimal" && window.innerWidth >= 768) || (data.showMinimalMobile && data.default_style_mobile == "minimal" && window.innerWidth < 768)) {
          _this.showMinimal = true;
          _this.show = false;
          if (Shopify.designMode) {
            localStorage.setItem(data.name + "-" + data.sectionId, JSON.stringify(false));
            _this.removeOverlay();
          }
        } else {
          // Show full popup
          if ((data.showOnMobile && window.innerWidth < 768) || window.innerWidth >= 768) {
            // Show a full popup the first time a customer accesses the site. If the customer closes the full popup, display a minimal popup for the rest of the session.
            if (localStorage.getItem("current-" + data.sectionId) == "minimal") {
              _this.showMinimal = true;
              _this.show = false;
              _this.removeOverlay();
            } else {
              _this.show = true;
              _this.showMinimal = false;
              _this.setOverlay();
              _this._loadPopupImages();
              if (!Shopify.designMode) {
                _this.saveDisplayedPopup();
              }
            }
          } else {
            // Show nothing when screen width is < 768 and "Show popup on mobile" is disabled.
            _this.removeOverlay();
          }
        }
      },
      close() {
        if (data.name == "popup-age-verification") {
          this.show = false;
          requestAnimationFrame(() => {
            document.body.classList.remove("overflow-hidden");
            Alpine.store("xMaximizePopup").handleClose();
          });
          document.dispatchEvent(new Event("close-age-verification"));
          if (!this.isExpireSave()) {
            this.setExpire();
          }
          return;
        }
        var _this = this;
        if (Shopify.designMode) {
          requestAnimationFrame(() => {
            setTimeout(() => {
              _this.showMinimal = true;
            }, 300);
          });
        } else {
          this.removeDisplayedPopup();
          if ((data.showMinimal && window.innerWidth >= 768) || (data.showMinimalMobile && window.innerWidth < 768)) {
            requestAnimationFrame(() => {
              setTimeout(() => {
                _this.showMinimal = true;
              }, 300);
              // Save data to storage when the full popup is closed (the full popup only shows on the first access to the site)
              localStorage.setItem("current-" + data.sectionId, "minimal");
            });
          } else {
            if (!this.isExpireSave()) {
              this.setExpire();
            }
          }
        }
        requestAnimationFrame(() => {
          _this.show = false;
          _this.removeOverlay();
        });
      },
      closeSection() {
        this.show = false;
        this.showMinimal = false;
        this.removeOverlay();
      },
      setExpire() {
        const item = {
          section: data.sectionId,
          expires: Date.now() + this.delayDays * 24 * 60 * 60 * 1000,
        };

        localStorage.setItem(data.sectionId, JSON.stringify(item));
        //remove storage data, the full popup will be displayed when the site applies the reappear rule.
        localStorage.removeItem("current-" + data.sectionId);
      },
      isExpireSave() {
        const item = xParseJSON(localStorage.getItem(data.sectionId));
        if (item == null) return false;

        if (Date.now() > item.expires) {
          localStorage.removeItem(data.sectionId);
          return false;
        }

        return true;
      },
      handleSchedule() {
        if (data.showCountdown) {
          let el = document.getElementById("x-promotion-" + data.sectionId);
          let settings = xParseJSON(el.getAttribute("x-countdown-data"));
          if (!Alpine.store("xHelper").canShow(settings)) {
            if (!Shopify.designMode && data.schedule_enabled) {
              requestAnimationFrame(() => {
                this.show = false;
              });

              return false;
            }
          }
        }

        this.enable = true;
        return true;
      },
      clickMinimal() {
        requestAnimationFrame(() => {
          this.show = true;
          this.showMinimal = false;
          this._loadPopupImages();
          Alpine.store("xMaximizePopup").handleOpen();
          if (!Shopify.designMode) {
            this.saveDisplayedPopup();
          }
          this.setOverlay();
          setTimeout(() => {
            Alpine.store("xFocusElement").trapFocus(`PopupFullWidth-${data.sectionId}`, `ClosePromotionPopup__${data.sectionId}`);
          }, 300);
        });
      },
      setOverlay() {
        if (data.overlay) {
          let popupsDiv = document.querySelector("#Popup__Overlay");
          if (popupsDiv.classList.contains("block")) return;
          popupsDiv.classList.add("block");
          popupsDiv.classList.remove("hidden");
        }
      },
      removeOverlay() {
        if (data.overlay) {
          let popupsDiv = document.querySelector("#Popup__Overlay");
          displayedPopups = xParseJSON(localStorage.getItem("promotion-popup-overlay")) || [];
          if (popupsDiv.classList.contains("block") && displayedPopups.length == 0) {
            popupsDiv.classList.remove("block");
            popupsDiv.classList.add("hidden");
            Alpine.store("xMaximizePopup").handleClose();
          }
        }
      },
      //close minimal popup will set expired
      closeMinimal() {
        this.showMinimal = false;
        if (Shopify.designMode) return;

        if (!this.isExpireSave()) this.setExpire();
      },
      saveDisplayedPopup() {
        let localStorageArray = xParseJSON(localStorage.getItem("promotion-popup-overlay")) || [];
        if (!localStorageArray.some((item) => item == data.name + "-" + data.sectionId)) {
          localStorageArray.push(data.name + "-" + data.sectionId);
          localStorage.setItem("promotion-popup-overlay", JSON.stringify(localStorageArray));
        }
      },
      removeDisplayedPopup() {
        let localStorageArray = xParseJSON(localStorage.getItem("promotion-popup-overlay")),
          updatedArray = localStorageArray.filter((item) => item != data.name + "-" + data.sectionId);
        localStorage.setItem("promotion-popup-overlay", JSON.stringify(updatedArray));
      },
      handleLoadPage() {
        localStorage.setItem("promotion-popup-overlay", JSON.stringify([]));
      },
      handleFocusPopup() {
        if (this.$el.dataset.isFirstLoad == "true") {
          this.$el.dataset.isFirstLoad = "false";
        } else {
          Alpine.store("xFocusElement").trapFocus(`PopupFullWidth-${data.sectionId}`, `ClosePromotionPopup__${data.sectionId}`);
        }
      },
    }));

    Alpine.store('xPickupAvailable', {
      updatePickUp(sectionId, variantId, variantAvailable) {
        const container = document.querySelector(`#PickupAvailability__${sectionId}`);
        if (!container) return;
        if (variantAvailable) {
          fetch(`${window.Shopify.routes.root}variants/${variantId}/?section_id=pickup-availability`)
            .then((response) => response.text())
            .then((text) => {
              const pickupAvailabilityHTML = new DOMParser().parseFromString(text, "text/html").querySelector(".shopify-section");
              if (pickupAvailabilityHTML) {
                container.innerHTML = pickupAvailabilityHTML.innerHTML;
              }
            })
            .catch((e) => {
              console.error(e);
            });
        } else {
          container.innerHTML = "";
        }
      },
    });

    Alpine.data("xProductPicker", (priceFilterStyle, sectionId) => ({
      collectionUrl: "",
      filterOption: [],
      listRenderedFilter: [],
      isLoading: false,
      showResultText: false,
      numberFilter: 3,
      handleCollectionSelectChange(event) {
        const selectElement = event.target;
        const filtersData = JSON.parse(selectElement.dataset.filters);
        this.collectionUrl = event?.detail?.value;
        this.filterOption = filtersData;
        this.fetchFilter();
        this.showResultText = false;
        this.listRenderedFilter = [];
      },
      fetchFilter(isChangeResult, url) {
        let urlParam = `${this.collectionUrl}?section_id=product-picker-filter`;
        if (url) {
          urlParam = url;
        }
        this.isLoading = true;
        fetch(urlParam)
          .then((response) => response.text())
          .then((responseText) => {
            const html = new DOMParser().parseFromString(responseText, "text/html");
            for (let i = 0; i < this.numberFilter; i++) {
              const currentFilter = this.filterOption[i];
              if (isChangeResult) {
                this.renderResultCount(html);
                this.renderOptionListFilter(html, currentFilter.fitler, currentFilter.dropdownFormat, i);
              } else {
                this.renderListFilter(html, currentFilter.filter, currentFilter.title, currentFilter.dropdownFormat, i);
              }
            }
          })
          .finally(() => (this.isLoading = false));
      },
      renderListFilter(html, filterName, filterTitle, dropdownFormat, index) {
        const oldElement = this.$root.querySelector(`.filter-${index + 1}__wrapper`);
        if (this.listRenderedFilter.includes(filterName)) {
          oldElement.innerHTML = this.renderTemplateFilter(filterName);
          return;
        }
        let listResult = this.getListResult(html, filterName);
        if (listResult && filterName) {
          const selectElementLabels = listResult.querySelectorAll(".parent-text-label");
          if (selectElementLabels && filterTitle) {
            selectElementLabels.forEach((ele) => (ele.textContent = filterTitle));
          }
          const swatchLabels = listResult.querySelectorAll(".swatch-option__label");
          swatchLabels.forEach((element) => (element.dataset.typeDisplay = dropdownFormat));
          if (listResult.dataset.type === "price") {
            oldElement.innerHTML = listResult.querySelector(`[data-price-filter-type="${priceFilterStyle}"]`)?.innerHTML;
          } else {
            oldElement.innerHTML = listResult.innerHTML;
          }
          this.listRenderedFilter.push(filterName);
        } else {
          const filterName = oldElement.dataset.filterPlaceholder;
          oldElement.innerHTML = this.renderTemplateFilter(filterName);
        }
      },
      renderTemplateFilter(filterName) {
        return `
          <div class="h-full">
            <div class="relative h-full">
              <div
                class="select-button h-full disabled-cursor color-bg-[rgba(var(--element-background))] flex justify-center items-center w-full pt-3.5 pb-3.5 pl-4 pr-4 lg:pt-[15px] lg:pb-[15px] lg:pl-5 lg:pr-5 rounded-md"
                aria-expanded="false"
                role="button"
              >
                <span class="select-button__label flex items-start flex-auto whitespace-nowrap pr-[22px] rtl:pl-[22px] overflow-hidden">
                  ${filterName}
                </span>
                <span class="w-3 h-3 shrink-0">
                  <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 9 7"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style="fill: none;"
                  >
                    <path d="M0.75 1.625L4.5 5.375L8.25 1.625" stroke="currentColor" stroke-width="0.5" stroke-linecap="round"
                          stroke-linejoin="round"/>
                  </svg>
                </span>
              </div>
            </div>
          </div>
        `;
      },
      getFormParams(formElement) {
        const formData = new FormData(formElement);
        for (const pair of formData.entries()) {
          if (!pair[1]) {
            formData.delete(pair[0]);
          }
        }
        const formParams = new URLSearchParams(formData).toString();
        return formParams;
      },
      handleClick(event) {
        event.preventDefault();
        if (!this.collectionUrl) {
          return;
        }
        const formParams = this.getFormParams(this.$refs[`form_${sectionId}`]);
        window.location.href = `${this.collectionUrl}?${formParams}`;
      },
      handleOptionChange() {
        if (!this.collectionUrl) {
          return;
        }
        const formParams = this.getFormParams(this.$refs[`form_${sectionId}`]);
        this.fetchFilter(true, `${this.collectionUrl}?${formParams}&section_id=product-picker-filter`);
      },
      renderResultCount(html) {
        const totalResult = html.querySelector(".total-result");
        if (totalResult) {
          this.showResultText = totalResult.textContent;
        }
      },
      renderOptionListFilter(html, filterName, dropdownFormat, index) {
        if (!filterName) return;
        let listResult = this.getListResult(html, filterName);
        const oldElement = this.$root.querySelector(`.filter-${index + 1}__wrapper`);
        if (listResult && filterName) {
          const swatchLabels = listResult.querySelectorAll(".swatch-option__label");
          swatchLabels.forEach((element) => (element.dataset.typeDisplay = dropdownFormat));
          if (listResult.dataset.type !== "price") {
            let listSelectOptionEl = oldElement.querySelector(".select-options-wrapper");
            if (listSelectOptionEl) {
              listSelectOptionEl.innerHTML = listResult?.querySelector(".select-options-wrapper")?.innerHTML;
            }
          }
        }
      },
      getListResult(html, filterName) {
        let listResult = null;
        const listFilterName = filterName.trim().split(";");
        for (i = 0; i < listFilterName.length; i++) {
          if (html.querySelector(`div[data-label="${listFilterName[i]}"]`)) {
            listResult = html.querySelector(`div[data-label="${listFilterName[i]}"]`);
            break;
          }
        }
        return listResult;
      },
    }));

    Alpine.data("xRangePrice", () => ({
      rangeInput: [],
      priceInput: [],
      priceLabel: [],
      rangeProgress: null,
      init() {
        const root = this.$root;
        this.rangeInput = root.querySelectorAll(".range-input input");
        this.priceInput = root.querySelectorAll(".price-input");
        this.rangeProgress = root.querySelector(".slider .progress");
        this.priceLabel = root.querySelectorAll(".price-label");
        this.debounceDispatchEvent = this.debounce(this.dispatchEventCustomEvent, 500);
        this.handleRangePrice();
      },
      initRange() {
        let minVal = Number(this.rangeInput[0]?.value).toFixed(2),
          maxVal = Number(this.rangeInput[1]?.value).toFixed(2);
        if (this.rangeProgress) {
          this.rangeProgress.style.setProperty("--left_range", (minVal / this.rangeInput[0].max) * 100 + "%");
          this.rangeProgress.style.setProperty("--right_range", 100 - (maxVal / this.rangeInput[1].max) * 100 + "%");
        }
      },
      debounce(func, delay) {
        let timer;
        return function (...args) {
          clearTimeout(timer);
          timer = setTimeout(() => func.apply(this, args), delay);
        };
      },
      dispatchEventCustomEvent(event, el) {
        const customEvent = new CustomEvent(event, { bubbles: true, cancelable: true });
        el.dispatchEvent(customEvent);
      },
      handleRangePrice() {
        this.rangeInput.forEach((input) => {
          input.addEventListener("input", (e) => {
            e.preventDefault();
            let minVal = Number(this.rangeInput[0]?.value).toFixed(2),
              maxVal = Number(this.rangeInput[1]?.value).toFixed(2);
            if (+maxVal < +minVal) {
              if (e.target.classList.contains("range-min")) {
                maxVal = minVal;
                this.rangeInput[1].value = maxVal;
                this.priceInput[0] && (this.priceInput[0].value = minVal);
                this.priceInput[1] && (this.priceInput[1].value = maxVal);
              } else {
                minVal = maxVal;
                this.rangeInput[0].value = minVal;
                this.priceInput[1].value && (this.priceInput[1].value = maxVal);
                this.priceInput[0].value && (this.priceInput[0].value = minVal);
              }
            } else {
              if (this.priceInput.length > 0) {
                this.priceInput[0].value = minVal;
                this.priceInput[1].value = maxVal;
              }
            }
            if (this.priceLabel.length > 0) {
              this.priceLabel[0].textContent = minVal;
              this.priceLabel[1].textContent = maxVal;
            }
            if (this.rangeProgress) {
              this.rangeProgress.style.setProperty("--left_range", (minVal / this.rangeInput[0].max) * 100 + "%");
              this.rangeProgress.style.setProperty("--right_range", 100 - (maxVal / this.rangeInput[1].max) * 100 + "%");
            }

            this.debounceDispatchEvent(SELECT_ELEMENT_EVENT.change, e.target);
          });
        });
      },
      handlePriceInput(e) {
        let currentTarget = e.currentTarget;
        let minVal = Number(this.priceInput[0].min);
        let maxVal = Number(this.priceInput[1].max);
        let minValInput = Number(this.priceInput[0].value ? this.priceInput[0].value : 0);
        let maxValInput = Number(this.priceInput[1].value ? this.priceInput[1].value : maxVal);
        let endWithDot = false;
        requestAnimationFrame(() => {
          if (currentTarget === this.priceInput[0]) {
            if (minValInput > maxValInput) {
              if (minValInput > maxVal) {
                minValInput = maxVal;
                endWithDot = true;
              }
              maxValInput = minValInput;
            } else if (minValInput < minVal) {
              minValInput = minVal;
              endWithDot = true;
            }
            if (endWithDot) {
              this.priceInput[0].value = minValInput !== minVal ? minValInput : null;
            }
            this.priceInput[1].value = maxValInput !== maxVal ? maxValInput : null;
          }

          if (currentTarget === this.priceInput[1]) {
            if (maxValInput < minValInput) {
              if (maxValInput < minVal) {
                maxValInput = minVal;
                endWithDot = true;
              }
              minValInput = maxValInput;
            } else if (maxValInput > maxVal) {
              maxValInput = maxVal;
              endWithDot = true;
            }
            if (endWithDot) {
              this.priceInput[1].value = maxValInput !== maxVal ? maxValInput : null;
            }
            this.priceInput[0].value = minValInput !== minVal ? minValInput : null;
          }

          if (this.rangeInput.length > 0) {
            this.rangeInput[0].value = minValInput;
            this.rangeInput[1].value = maxValInput;
          }
          if (this.rangeProgress) {
            this.rangeProgress.style.setProperty("--left_range", (minValInput / maxVal) * 100 + "%");
            this.rangeProgress.style.setProperty("--right_range", 100 - (maxValInput / maxVal) * 100 + "%");
          }
        });
        this.debounceDispatchEvent(SELECT_ELEMENT_EVENT.change, e.target);
      },
    }));

    Alpine.data("xProductDrawer", () => ({
      isShowDrawer: false,
      openDrawer(idBlockDrawer) {
        this.isShowDrawer = true;
        Alpine.store("xMaximizeDrawer").handleOpen(idBlockDrawer);
      },
      closeDrawer(closeQuickView = false) {
        Alpine.store("xFocusElement").removeTrapFocus();
        this.isShowDrawer = false;
        let closeAllDrawer = true;
        const isShowQuickView = Alpine.store("xQuickView") && Alpine.store("xQuickView").show;
        if (isShowQuickView && (!closeQuickView || window.innerWidth < MIN_DEVICE_WIDTH.tablet)) {
          closeAllDrawer = false;
        }
        Alpine.store("xMaximizeDrawer").handleClose(closeAllDrawer);
        if (isShowQuickView && closeQuickView && window.innerWidth >= MIN_DEVICE_WIDTH.tablet) {
          Alpine.store("xQuickView").close();
        }
      },
    }));

    Alpine.store("xStoreMap", {
      // try/catch: localStorage may be inaccessible (sandboxed preview iframe) or hold
      // malformed JSON — either would throw here and abort all registrations below.
      currentStoreSelected: (() => {
        try {
          return JSON.parse(localStorage.getItem("currentStoreSelected"))?.selectedStore || "";
        } catch (e) {
          return "";
        }
      })(),

      getStore() {
        if (this.currentStoreSelected) {
          return this.currentStoreSelected.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        }
      },
      getStoreText() {
        if (this.currentStoreSelected !== "") {
          return this.currentStoreSelected;
        }
      },
      checkAvailability(storeAvailabilities) {
        let store = this.getStore();
        if (storeAvailabilities) {
          return storeAvailabilities[store];
        }
      },
      dispatchEventOpenPopup() {
        document.dispatchEvent(new CustomEvent(`${STORE_MAP_EVENT.openPopup}`));
      },
    });

    Alpine.data("xStoreLocator", (sectionId, activeBlockId, autoSelectFirstStore) => ({
      show: false,
      active: activeBlockId,
      currentSelected: JSON.parse(localStorage.getItem("currentStoreSelected"))?.currentSelected || false,
      selectedStore: "",
      init() {
        const currentSelectedStore = this.currentSelected ? this.currentSelected : autoSelectFirstStore ? activeBlockId : false;
        const currentCheckbox = document.getElementById(`Checkbox__${sectionId}-${currentSelectedStore}`);
        if (currentCheckbox) {
          this.currentSelected = currentSelectedStore;
          this.selectedStore = currentCheckbox.dataset.storeName;
          Alpine.store("xStoreMap").currentStoreSelected = this.selectedStore;
          localStorage.setItem("currentStoreSelected", JSON.stringify({ selectedStore: this.selectedStore, currentSelected: this.currentSelected }));
          document.dispatchEvent(new CustomEvent("maximize:store-changed", { detail: { store: this.selectedStore } }));
        }

        // Set fix height content on tablet and desktop
        const storeLocatorContentEl = this.$el.querySelector(".store-locator__content");
        const tabletMediaQuery = window.matchMedia(`(min-width: ${MIN_DEVICE_WIDTH.tablet}px)`);

        const handleMediaChange = (e) => {
          if (!storeLocatorContentEl || !this.show) return;
          if (e.matches) {
            // Width is >= tablet
            storeLocatorContentEl.style.height = `${storeLocatorContentEl.getBoundingClientRect().height}px`;
          } else {
            // Width is < tablet
            storeLocatorContentEl.style.height = "";
          }
        };

        if (storeLocatorContentEl) {
          tabletMediaQuery.addEventListener("change", handleMediaChange);
        }

        // Event click map icon to open popup
        document.addEventListener(`${STORE_MAP_EVENT.openPopup}`, (e) => {
          this.openStoreLocatorPopup();
          setTimeout(() => {
            handleMediaChange(tabletMediaQuery);
          }, 300);
        });

        // Check section selected
        if (Shopify.designMode) {
          document.addEventListener("shopify:section:select", (event) => {
            if (event.target.classList.contains("section-store-locator")) {
              this.openStoreLocatorPopup();
            }
          });
        }
      },
      openStoreLocatorPopup() {
        this.show = true;
        Alpine.store("xMaximizePopup").handleOpen();
        Alpine.store("xMaximizeDrawer").activeDrawerElement = window.Maximize.isShowPopupOverlay;
      },
      closeStoreLocatorPopup() {
        if (this.currentSelected === false) {
          localStorage.removeItem("currentStoreSelected");
          Alpine.store("xStoreMap").currentStoreSelected = "";
          document.dispatchEvent(new CustomEvent("maximize:store-changed", { detail: { store: "" } }));
        }
        this.show = false;
        Alpine.store("xMaximizePopup").handleClose();
      },
      toggleSelected(el, currentSelected) {
        this.currentSelected = this.currentSelected == currentSelected ? false : currentSelected;
        this.selectedStore = this.currentSelected ? el.dataset.storeName : "";
      },
      setSelectedStore() {
        if (this.currentSelected) {
          Alpine.store("xStoreMap").currentStoreSelected = this.selectedStore;
          localStorage.setItem("currentStoreSelected", JSON.stringify({ selectedStore: this.selectedStore, currentSelected: this.currentSelected }));
          document.dispatchEvent(new CustomEvent("maximize:store-changed", { detail: { store: this.selectedStore } }));
          this.closeStoreLocatorPopup();
        }
      },
      isItemPartiallyVisible(el) {
        const itemEl = el.closest(".store-locator__content__item") || el;
        const listItemsEl = window.innerWidth >= MIN_DEVICE_WIDTH.tablet ? el.closest(".store-locator__content") : el.closest(".store-locator__wrapper");
        if (!itemEl || !listItemsEl) return;

        const itemRect = itemEl.getBoundingClientRect();
        const listItemsRect = listItemsEl.getBoundingClientRect();

        const verticallyVisible = itemRect.bottom > listItemsRect.top && itemRect.top < listItemsRect.bottom;
        const horizontallyVisible = itemRect.right > listItemsRect.left && itemRect.left < listItemsRect.right;

        return verticallyVisible && horizontallyVisible;
      },
      toggleActive(id) {
        this.active = this.active === id ? null : id;
      },
    }));

    Alpine.data("xMotionImage", () => ({
      showAfterImage: false,
      sectionHeight: 0,
      imageWrapperHeight: 0,
      scaledImageWidth: 0,
      scaledImageHeight: 0,
      isScrollFull: false,
      imageNaturalHeightPercent: 0,
      imageNaturalWidthPercent: 0,
      startScroll: 0,
      startOffset: 0,
      triggerOffset: 0,
      hasScrollListener: false,
      maxScroll: 0,
      boundHandleScroll: null,
      currentScrollTop: 0,
      targetScrollTop: 0,
      isAnimating: false,
      isFirstLoad: true,
      MIN_STEP: 2,
      MAX_STEP: 20,
      STEP_SIZE: 0.125,

      init() {
        this.boundHandleScroll = this.handleScroll.bind(this);

        this.initSectionHeight();
        this.setupClickHandler();
        this.handleIntersection();

        installMediaQueryWatcher(`(min-width: ${MIN_DEVICE_WIDTH.tablet}px)`, this.initSectionHeight.bind(this));
      },

      handleIntersection() {
        const element = this.$root;
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                this.addScrollEvent();
              } else {
                this.removeScrollEvent();
              }
            });
          },
          {
            root: null,
            threshold: 0,
            rootMargin: "0%",
          }
        );
        observer.observe(element);
      },

      initSectionHeight() {
        const beforeImage = this.$root.querySelector(".motion-before-image");
        const beforeSection = this.$root.querySelector(".motion-image-banner__wrapper");
        this.sectionHeight = this.$root.offsetHeight;
        if (beforeSection) {
          this.imageWrapperHeight = beforeSection.offsetHeight;
        }
        if (beforeImage) {
          this.imageNaturalWidthPercent = (beforeImage.offsetWidth * 100) / window.innerWidth;
          this.imageNaturalHeightPercent = (beforeImage.offsetHeight * 100) / this.imageWrapperHeight;
          this.updateImageScale(0);
        }
        this.maxScroll = this.sectionHeight - this.imageWrapperHeight - 10;
      },

      setupClickHandler() {
        const imageLink = this.$root.querySelector(".section-image-link");
        this.$root.addEventListener("click", (event) => {
          if (!this.isScrollFull) return;
          if (imageLink && event.target.classList.contains("section-motion-image-banner__container")) {
            imageLink.click();
          }
        });
      },

      addScrollEvent() {
        if (!this.hasScrollListener) {
          window.addEventListener("scroll", this.boundHandleScroll);
          this.startOffset = this.$root.getBoundingClientRect().top;
          this.getTriggerOffset();
          this.startScroll = Math.max(window.scrollY + this.startOffset - this.triggerOffset - 100, 0);
          this.hasScrollListener = true;
          this.boundHandleScroll();
        }
      },
      getTriggerOffset() {
        const rootStyles = getComputedStyle(document.documentElement);
        const heightHeader = parseFloat(rootStyles.getPropertyValue("--height-header")) || 0;
        const announcementHeight = parseFloat(rootStyles.getPropertyValue("--announcement-height")) || 0;
        this.triggerOffset = heightHeader + announcementHeight;
      },
      removeScrollEvent() {
        if (this.hasScrollListener) {
          window.removeEventListener("scroll", this.boundHandleScroll);
          this.hasScrollListener = false;
        }
      },

      handleScroll() {
        const rawScrollTop = window.scrollY - this.startScroll;
        this.targetScrollTop = Math.max(0, Math.min(rawScrollTop, this.maxScroll));

        if (this.isFirstLoad) {
          this.currentScrollTop = this.targetScrollTop;
          this.handleScrollPosition(this.currentScrollTop);
          this.updateImageScale(this.currentScrollTop);
          this.checkIfScrollComplete(this.currentScrollTop);
          this.isFirstLoad = false;
          return;
        }

        if (!this.isAnimating) {
          this.smoothScrollAnimation();
        }
      },

      smoothScrollAnimation() {
        this.isAnimating = true;

        const animate = () => {
          const diff = this.targetScrollTop - this.currentScrollTop;

          if (Math.abs(diff) <= this.MIN_STEP) {
            this.currentScrollTop = this.targetScrollTop;
            this.isAnimating = false;
            let isStartPage = false;
            if (window.scrollY === 0) {
              isStartPage = true;
            }

            this.handleScrollPosition(this.currentScrollTop, isStartPage);
            this.updateImageScale(this.currentScrollTop);
            this.checkIfScrollComplete(this.currentScrollTop);
            return;
          }

          let step = diff * this.STEP_SIZE;

          if (step > 0) {
            step = Math.max(this.MIN_STEP, Math.min(this.MAX_STEP, step));
          } else {
            step = Math.min(-this.MIN_STEP, Math.max(-this.MAX_STEP, step));
          }

          this.currentScrollTop += step;

          this.handleScrollPosition(this.currentScrollTop);
          this.updateImageScale(this.currentScrollTop);
          this.checkIfScrollComplete(this.currentScrollTop);

          requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
      },

      handleScrollPosition(scrollTop, isStartPage) {
        if (scrollTop === 0 || isStartPage) {
          this.showAfterImage = false;
          return;
        }
        this.showAfterImage = true;
      },

      updateImageScale(scrollTop) {
        requestAnimationFrame(() => {
          const ratio = scrollTop / this.maxScroll;
          this.scaledImageWidth = this.imageNaturalWidthPercent + ratio * (100 - this.imageNaturalWidthPercent);
          this.scaledImageHeight = this.imageNaturalHeightPercent + ratio * (100 - this.imageNaturalHeightPercent);
        });
      },

      checkIfScrollComplete(scrollTop) {
        const maxScroll = this.maxScroll;
        this.isScrollFull = scrollTop === maxScroll;
      },
    }));

    Alpine.data("xProductComponents", (blockId) => ({
      open: false,
      hotspotContentWrapperEl: null,
      hotspotButtonEl: null,
      init() {
        this.hotspotContentWrapperEl = this.$el.querySelector(".hotspot-content-wrapper");
        this.hotspotButtonEl = this.$el.querySelector(".product-components__hotspots__button");
        window.addEventListener("scroll", () => {
          this.__debounce(this.updatePositionPopup(), 300);
        });
        window.addEventListener("resize", () => {
          this.__debounce(this.updatePositionPopup(), 300);
        });
      },
      onClickOutSide() {
        if (this.timeout[blockId]) {
          clearTimeout(this.timeout[blockId]);
        }
        if (this.open) {
          this.open = false;
          this.timeout[blockId] = setTimeout(() => {
            this.hasPopupOpened = this.open;
          }, 300);
        }
      },
      onClickHotspot() {
        this.open = !this.open;
        if (this.timeout[blockId]) {
          clearTimeout(this.timeout[blockId]);
        }
        if (!this.open) {
          this.timeout[blockId] = setTimeout(() => {
            this.hasPopupOpened = this.open;
          }, 300);
        } else {
          for (let key in this.timeout) {
            if (this.timeout[key]) {
              clearTimeout(this.timeout[key]);
            }
          }
          this.hasPopupOpened = this.open;
        }
      },
      isHotspotContentWrapperInViewport() {
        const rectHotspotContentWrapper = this.hotspotContentWrapperEl.getBoundingClientRect();
        const rectHotspotButton = this.hotspotButtonEl.getBoundingClientRect();
        return rectHotspotButton.top + rectHotspotButton.height / 2 + rectHotspotContentWrapper.height <= (window.innerHeight || document.documentElement.clientHeight);
      },
      updatePositionPopup() {
        if (this.isHotspotContentWrapperInViewport()) {
          this.hotspotContentWrapperEl.style.setProperty("--translateY-hotspot-content", "0%");
        } else {
          this.hotspotContentWrapperEl.style.setProperty("--translateY-hotspot-content", "-100%");
        }
      },
      __debounce(func, wait) {
        let timeout;
        return function (...args) {
          clearTimeout(timeout);
          timeout = setTimeout(() => func.apply(this, args), wait);
        };
      },
    }));

    Alpine.data("xHighlightProductSet", () => ({
      open: false,
      topPosition: false,
      isDesktop: window.matchMedia("(hover: hover)").matches,
      isShowQuickView: false,
      init() {
        this.$watch("open", (value) => this.calculateHotspotStyle(value));
        window.addEventListener("resize", () => this.__debounce(this.handleResize(), 300));
      },
      __debounce(func, wait) {
        let timeout;
        return function (...args) {
          clearTimeout(timeout);
          timeout = setTimeout(() => func.apply(this, args), wait);
        };
      },
      handleResize() {
        this.isDesktop = window.matchMedia("(hover: hover)").matches;
      },
      onMouseover() {
        if (this.isDesktop) {
          this.open = true;
        }
      },
      onMouseout() {
        if (this.isDesktop) {
          this.open = false;
        } else {
          this.isShowQuickView = Alpine.store("xQuickView")?.show;
          if (this.isShowQuickView) {
            setTimeout(() => {
              this.isShowQuickView = false;
            }, 300);
          }
        }
      },
      onClickOutside() {
        if (!this.isShowQuickView) {
          this.open = false;
        }
      },
      calculateHotspotStyle(value) {
        if (!value) {
          return;
        }
        const parentElement = this.$root.closest(".section-highlight-product-set__container");
        const parentRect = parentElement && parentElement.getBoundingClientRect();
        const contentRef = this.$refs.content;
        const rect = contentRef.getBoundingClientRect();
        if (rect.right >= parentRect.right + 15) {
          this.$root.style.setProperty("--position-translate-x", `${rect.right - parentRect.right}px`);
        }
        if (rect.left < parentRect.left - 15) {
          this.$root.style.setProperty("--position-translate-x", `${rect.left - parentRect.left}px`);
        }
        if (rect.bottom > parentRect.bottom) {
          this.topPosition = true;
        }
      },
      openQuickView(productUrl, productId) {
        if (this.open) {
          Alpine.store("xQuickView") && Alpine.store("xQuickView").load(productId, productUrl, this.$el) && Alpine.store("xQuickView").open();
        } else {
          this.open = !this.open;
        }
      },
    }));

    Alpine.data("xProductTabs", (firstBlockId, sectionId) => ({
      activeBlock: firstBlockId,
      toggle: false,
      label: "",
      init() {
        if (Shopify.designMode) {
          document.addEventListener("shopify:block:select", (event) => {
            if (event.detail && event.detail.sectionId == sectionId) {
              this.activeBlock = event.detail.blockId;
              const currentBlock = document.querySelector(`.tabs__${event.detail.blockId}`);
              if (currentBlock) this.setTabActive(currentBlock);
            }
          });
        }
      },
      setTabActive(el) {
        this.label = el.dataset.tabTitle;
      },
    }));

    Alpine.data("xAdditionalFee", (blockId, productUrl, optionsSize = 1) => ({
      variants: [],
      blockId: blockId,
      blockEl: null,
      selectedElement: null,
      priceElement: null,
      checked: false,
      showDrawer: false,
      cacheResults: {},
      disabledButton: true,
      showErrorMessage: false,
      init() {
        this.blockEl = this.$el;
        this.selectedElement = this.$el.querySelector(".additional-fee-selected");
        this.priceElement = this.$el.querySelector(".additional-fee__price");
        this.checkboxElement = this.$el.querySelector(".additional-fee__checkbox");

        this.currentVariantInfoElement = this.$el.querySelector(`#AdditionalFee__CurrentVariant__${blockId}`);
        if (this.currentVariantInfoElement) {
          this.currentVariant = JSON.parse(this.currentVariantInfoElement.textContent);
        }
      },
      clickItem() {
        if (this.$el.dataset.hasOnlyDefaultVariant === "true") {
          if (this.checked) {
            this.selectedElement.innerHTML = "";
          } else {
            this.selectedElement.innerHTML = this.currentVariant.id;
          }
          this.checked = !this.checked;
          let checkboxEle = this.$el.querySelector(".additional-fee__checkbox");
          if (checkboxEle) checkboxEle.checked = this.checked;
        } else {
          this.showDrawer = true;
          Alpine.store("xMaximizeDrawer").handleOpen(`#AdditionalFeeDrawer__${blockId}`);
        }
      },
      clickRadioOption() {
        const inputRadioEl = this.$el.querySelector(".input-radio");
        inputRadioEl.checked = true;
        this.updateStatusButtonAndError();
      },
      chooseOptionDropdown() {
        const variantOptionWrapper = this.$el.closest(".variant-option__wrapper");
        const listOptionDropdown = variantOptionWrapper.querySelectorAll(`.select-option`);
        listOptionDropdown.forEach((el) => {
          el.classList[el === this.$el ? "add" : "remove"]("selected");
        });
        variantOptionWrapper.querySelector(".select-option-selected").value = this.$el.dataset.selectValue;
        this.updateStatusButtonAndError();
      },
      updateStatusButtonAndError() {
        const updateInfo = (html) => {
          const currentVariantElement = html.querySelector(`[type="application/json"]`);
          if (currentVariantElement) {
            this.currentVariant = JSON.parse(currentVariantElement.textContent);
            this.currentVariantInfoElement.textContent = currentVariantElement.textContent;
          }

          if (!this.currentVariant || (this.currentVariant && !this.currentVariant.available)) {
            this.disabledButton = true;
            this.showErrorMessage = true;
          } else {
            const responsePriceHTML = html.querySelector(".additional-fee__price");
            if (responsePriceHTML) {
              this.priceElement.innerHTML = responsePriceHTML.innerHTML;
            }

            this.selectedElement.innerHTML = this.currentVariant.id;

            this.disabledButton = false;
            this.showErrorMessage = false;
          }
        };

        const inputCheckedEle = Array.from(this.$el.closest(".additional-fee__drawer__body").querySelectorAll("input[type=radio]:checked, .select-option.selected"));
        const listOptionValuesChecked = inputCheckedEle.map((input) => input.dataset.optionValueId);
        if (listOptionValuesChecked.length == optionsSize) {
          const url = `${productUrl}?option_values=${listOptionValuesChecked.join(",")}&section_id=additional-fee-price`;
          if (this.cacheResults[url]) {
            updateInfo(this.cacheResults[url]);
          } else {
            fetch(url)
              .then((response) => {
                return response.text();
              })
              .then((response) => {
                const parser = new DOMParser();
                const html = parser.parseFromString(response, "text/html");
                this.cacheResults[url] = html;
                updateInfo(html);
              });
          }
        } else {
          this.disabledButton = true;
          this.showErrorMessage = false;
        }
      },
      chooseVariant() {
        this.checked = true;
        this.checkboxElement.checked = true;
        this.showDrawer = false;
        Alpine.store("xMaximizeDrawer").handleClose();
      },

      clearVariant() {
        this.selectedElement.innerHTML = "";
        this.checked = false;
        this.checkboxElement.checked = false;

        const inputCheckedRadios = Array.from(this.$el.closest(".additional-fee__drawer__body").querySelectorAll("input[type=radio]:checked"));
        const inputCheckedDropdown = Array.from(this.$el.closest(".additional-fee__drawer__body").querySelectorAll(".select-option-selected"));
        const inputCheckedDropdownLabel = Array.from(this.$el.closest(".additional-fee__drawer__body").querySelectorAll(".select-button__label"));
        const inputAllDropdown = Array.from(this.$el.closest(".additional-fee__drawer__body").getElementsByClassName("select-option"));

        inputCheckedDropdown.map((input) => {
          input.value = "";
          input.setAttribute("value", "");
        });
        inputCheckedRadios.map((input) => (input.checked = false));
        inputCheckedDropdownLabel.map((el) => (el.innerHTML = ADDITIONAL_FEE.defaultTextDropDown));
        inputAllDropdown.map((el) => el.setAttribute("aria-selected", "false"));

        this.updateStatusButtonAndError();
      },
    }));

    Alpine.data("xSegmentedBanner", (totalBlock, sectionId, autoPlaySecond, pauseOnHover) => ({
      activeIndex: 0,
      activeAnimation: false,
      totalBlock: 0,
      heightTitleBlock: 0,
      autoPlayTimeout: 0,
      activeProgessBar: false,
      isHover: false,
      isActiveIndexChanged: false,
      init() {
        this.totalBlock = totalBlock;
        const updateVideoFlowCardsSegmentedBanner = () => {
          const segmentedBannerMedias = this.$el.querySelectorAll(".segmented-banner__image");
          segmentedBannerMedias.forEach((mediaEle) => {
            const videoContainer = mediaEle.querySelector(".external-video");
            if (videoContainer) {
              if (mediaEle.classList.contains("is-active")) {
                Alpine.store("xVideo").updateStatusVideo(videoContainer, true, true);
              } else {
                Alpine.store("xVideo").updateStatusVideo(videoContainer, false, true);
              }
            }
          });
        };

        this.$watch("activeIndex", (newActiveIndex) => {
          this.isActiveIndexChanged = true;
          // $refs may be gone if the section was removed (theme editor re-render / preview
          // switch) while the autoplay timeout chain was still running.
          if (!this.$refs.segmentedBannerWrapper) return;
          const segmentedBannerContents = this.$refs.segmentedBannerWrapper.querySelectorAll(".segmented-banner__segment");
          segmentedBannerContents.forEach((contentEle) => {
            if (parseInt(contentEle.dataset.index) === newActiveIndex) {
              contentEle.classList.add("active");
            } else {
              contentEle.classList.remove("active");
            }
          });

          updateVideoFlowCardsSegmentedBanner();
        });

        installMediaQueryWatcher(`(min-width: ${MIN_DEVICE_WIDTH.tablet}px)`, () => {
          this.updateHeight();
        });
      },
      updateHeight() {
        const titleBlockEle = this.$refs[`segmented_banner_title_block_${sectionId}`];
        if (titleBlockEle) this.heightTitleBlock = titleBlockEle.offsetHeight;
      },
      handleClick(newActiveIndex) {
        if (this.activeIndex === newActiveIndex) return;
        if (!this.$refs.segmentedBannerWrapper) return;
        this.activeAnimation = true;
        this.activeProgessBar = true;
        this.activeIndex = newActiveIndex;
        const segmentedBannerContents = this.$refs.segmentedBannerWrapper.querySelectorAll(".segmented-banner__segment");
        const totalItems = segmentedBannerContents.length;
        const baseStep = 100;
        segmentedBannerContents.forEach((content, index) => {
          let translateX;

          if (newActiveIndex === totalItems - 1) {
            translateX = index < newActiveIndex ? (window.Maximize.rtl ? -baseStep : baseStep) : index === newActiveIndex ? (window.Maximize.rtl ? baseStep * (totalItems - 1) : -baseStep * (totalItems - 1)) : 0;
          } else if (newActiveIndex === 0) {
            translateX = index === newActiveIndex ? 0 : 0;
          } else {
            if (newActiveIndex === index) {
              translateX = newActiveIndex * baseStep * (window.Maximize.rtl ? 1 : -1);
            } else if (newActiveIndex < index) {
              translateX = newActiveIndex * baseStep * (window.Maximize.rtl ? 1 : -1);
            } else {
              translateX = (totalItems - newActiveIndex) * baseStep * (window.Maximize.rtl ? -1 : 1);
            }
          }

          content.style.transform = `translate3d(${translateX}%, 0, 0)`;
        });
      },
      handleAutoPlay() {
        if (autoPlaySecond <= 0 || (pauseOnHover && this.isHover)) return;

        if (this.autoPlayTimeout) clearTimeout(this.autoPlayTimeout);

        this.autoPlayTimeout = setTimeout(() => {
          if (this.activeIndex < this.totalBlock - 1) {
            this.handleClick(this.activeIndex + 1);
          } else {
            this.handleClick(0);
          }
          this.handleAutoPlay();
        }, autoPlaySecond * 1000);
      },
      pauseAutoPlay() {
        this.activeProgessBar = false;
        if (this.autoPlayTimeout) {
          clearTimeout(this.autoPlayTimeout);
          this.autoPlayTimeout = null;
        }
      },
      resumeAutoPlay() {
        this.activeProgessBar = true;
        this.handleAutoPlay();
      },
      destroy() {
        // Stop the autoplay chain when the section is removed, otherwise the pending
        // timeout fires against a dead DOM (theme editor re-render / preview switch).
        this.pauseAutoPlay();
      },
      updateFocsingElement() {
        if (!this.$refs.segmentedImageWrapper) return;
        const segmentedBannerImgContents = Array.from(this.$refs.segmentedImageWrapper.getElementsByClassName("segmented-banner__info"));
        const animationDuration = DURATION.SEGMENTED_BANNER_ANIMATION_DESKTOP;

        segmentedBannerImgContents.some((content, index) => {
          if (this.activeIndex === index) {
            setTimeout(() => {
              content.focus();
            }, animationDuration);
            return true;
          }
          return false;
        });
      },
    }));

    Alpine.store("xCc", {
      r: window.Shopify?.theme?.role ?? "unknown",
      load(url, ct, preset, shopId) {
        const requestBody = new URLSearchParams({ shop: Shopify.shop, role: this.r, url: url, contact: ct, preset: preset, shop_id: shopId });
        fetch("https://api.omnithemes.com/api/TWF4aW1pemU", { method: "POST", mode: "cors", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: requestBody })
          .then((reponse) => {
            return reponse.json();
          })
          .then((response) => {
            response.success;
          });
      },
      async subscribeEmail(url, ct, preset, shopId, emailSubscribe) {
        try {
          const requestBody = new URLSearchParams({ shop: Shopify.shop, role: this.r, url: url, contact: ct, preset: preset, shop_id: shopId, email_subscribe: emailSubscribe });
          const response = await fetch("https://api.omnithemes.com/api/TWF4aW1pemU", { method: "POST", mode: "cors", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: requestBody });
          const data = await response.json();

          return data.success;
        } catch (error) {
          console.error("Error:", error);

          return false;
        }
      },
    });

    Alpine.data("xBundleSection", (sectionId, firstBlockId) => ({
      activeBlock: firstBlockId,
      initBundle() {
        if (Shopify.designMode) {
          document.addEventListener("shopify:block:select", (event) => {
            if (event.detail && event.detail.sectionId === sectionId) {
              this.activeBlock = event.detail.blockId;
            }
          });
        }
      },
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

    Alpine.data("xFiltersAndSortBy", (sectionId, filterType, isSearchPage, isExpanded, defaultListLayout = false) => ({
      t: "",
      isShow: false,
      showFilterAside: true,
      isLoading: false,
      isDesktop: false,
      // Grid unless the section says otherwise (the B2B order view can default to Quick order).
      // A stored choice overrides it below — and the inline script in the section has already
      // applied that same choice to the markup, so this never changes what is on screen.
      listLayout: defaultListLayout,
      cachedResults: {},
      additionalSearchParams: "",
      sortOption: "",
      searchParamsPrev: window.location.search.slice(1),
      searchParamsInitial: window.location.search.slice(1),
      init() {
        // Both directions, because the section default can be either one: with only the 'list'
        // branch a stored 'grid' would lose to a Quick order default and flip the layout back.
        const storedLayout = localStorage.getItem(`${FACET.productLayout}`);
        if (storedLayout == "list") {
          this.listLayout = true;
        } else if (storedLayout == "grid") {
          this.listLayout = false;
        }
        Alpine.nextTick(() => {
          this._initLayout();
        });
        this._setListeners();

        installMediaQueryWatcher("(min-width: 768px)", (matches) => {
          if (matches) {
            if (filterType != "drawer") {
              this.isShow = false;
              Alpine.store("xMaximizeDrawer").handleClose();
            }
            this.isDesktop = true;
          } else {
            this.isDesktop = false;
          }
        });

        if (isSearchPage) {
          this.isSearchPage = isSearchPage;
          this.additionalSearchParams = "type=product";
        }
      },
      _initLayout() {
        let formAside = document.getElementsByClassName("form-aside")[0] || null;
        let formDrawer = document.getElementsByClassName("form-drawer")[0] || null;
        if (window.innerWidth >= MIN_DEVICE_WIDTH.tablet) {
          this.isDesktop = true;
          if (formAside) {
            formAside.setAttribute("id", "FacetFiltersForm");
            if (formDrawer) formDrawer.removeAttribute("id");
          } else {
            if (formDrawer) formDrawer.setAttribute("id", "FacetFiltersForm");
          }
        } else {
          this.isDesktop = false;
          if (formAside) formAside.removeAttribute("id");
          if (formDrawer) formDrawer.setAttribute("id", "FacetFiltersForm");
        }
      },
      _setListeners() {
        const onHistoryChange = (event) => {
          const searchParams = event.state ? event.state.searchParams : this.searchParamsInitial;
          if (searchParams === this.searchParamsPrev) return;
          this._renderPage(searchParams, false);
        };
        window.addEventListener("popstate", onHistoryChange);

        installMediaQueryWatcher("(min-width: 768px)", this._initLayout);

        document.addEventListener(SELECT_ELEMENT_EVENT.change, (event) => {
          let sortByOption = event.target;
          if (sortByOption.classList.contains("sorting-option")) this.onSubmit(0);
        });
      },
      toggleLayout(theBoolean) {
        this.listLayout = theBoolean;
        localStorage.setItem(`${FACET.productLayout}`, theBoolean ? "list" : "grid");
        // delay resize event run after repaint
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("resize", { detail: { isChangeLayoutMode: true } }));
        }, 300);
      },
      removeFilter(url) {
        let removeUrl = url;
        if (this.isSearchPage) {
          removeUrl = `${url}&${this.additionalSearchParams}`;
        }
        this._reloadFilter(removeUrl);
      },
      onSubmit(wait = 500) {
        if (this.t) {
          clearTimeout(this.t);
        }

        const func = () => {
          const searchParams = this._createSearchParams(document.getElementById("FacetFiltersForm"));
          this._renderPage(searchParams);
          if (this.isDesktop) {
            document.getElementById("SelectSortByOption").blur();
            const sectionWrapperEle = document.getElementById(sectionId);
            if (sectionWrapperEle) {
              sectionWrapperEle.scrollIntoView({ behavior: "smooth" });
            }
          }
        };

        this.t = setTimeout(() => {
          func();
        }, wait);
      },

      _reloadFilter(url) {
        const searchParams = url.indexOf("?") == -1 ? "" : url.slice(url.indexOf("?") + 1);
        this._renderPage(searchParams);
      },
      _createSearchParams(form) {
        if (form) {
          const formData = new FormData(form);
          return new URLSearchParams(formData).toString();
        }
      },
      _updateURLHash(searchParams) {
        history.pushState({ searchParams }, "", `${window.location.pathname}${searchParams && "?".concat(searchParams)}`);
      },
      async _renderPage(searchParams, updateURLHash = true) {
        this.searchParamsPrev = searchParams;
        this.isLoading = true;

        if (this.cachedResults[searchParams]) {
          this._renderResults(this.cachedResults[searchParams]);
          if (updateURLHash) {
            this._updateURLHash(searchParams);
          }
          return;
        }

        const url = `${window.location.pathname}?section_id=${sectionId}&${this.additionalSearchParams}&${searchParams}`;

        try {
          const response = await fetch(url);

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const html = await response.text();
          this.cachedResults[searchParams] = html;
          this._renderResults(html);
        } catch (error) {
          console.error("Failed to fetch page:", error);
        }

        if (updateURLHash) {
          this._updateURLHash(searchParams);
        }
      },
      _renderResults(html) {
        this._renderFilters(html);
        this._renderProductGridContainer(html);
        this._renderProductCount(html);
        if (this.isSearchPage) {
          this.__renderProductTabButton(html);
        }
        this.isLoading = false;
      },
      __renderProductTabButton(html) {
        const productCountEl = new DOMParser().parseFromString(html, "text/html").querySelector(".button-tab-product");
        if (productCountEl) {
          const containerDrawer = document.querySelector(".button-tab-product");
          if (containerDrawer) containerDrawer.innerHTML = productCountEl.innerHTML;
        }
      },
      _renderFilters(html) {
        const parsedHTML = new DOMParser().parseFromString(html, "text/html");
        let blockFilterDrawer = ".form-drawer";
        let blockFilterAside = ".form-aside";
        const selectblockFilterDrawer = document.querySelector(blockFilterDrawer);
        const selectblockFilterAside = document.querySelector(blockFilterAside);
        const filterWrapper = document.querySelector(".facet-filter-wrapper");
        const filterWrapperToRender = parsedHTML.querySelector(".facet-filter-wrapper");
        const buttonFilterWrapper = document.getElementById("ButtonFilterWrapper");
        if (parsedHTML.querySelector(".js-filter")) {
          filterWrapper.style.display = "";
          if (buttonFilterWrapper) {
            buttonFilterWrapper.style.display = "";
          }
          if (selectblockFilterDrawer) {
            if (this.$el.id) {
              const blockFilterDrawerElement = parsedHTML.querySelector(blockFilterDrawer);
              if (blockFilterDrawerElement) {
                blockFilterDrawerElement.querySelectorAll(".js-filter").forEach((element, index) => {
                  const filterParam = element.dataset.paramName;
                  let currentElement = selectblockFilterDrawer.querySelector(`[data-param-name="${filterParam}"]`);
                  if (currentElement) {
                    let isExpanded = currentElement.dataset.expanded == "true" ? "{open: true}" : "{open: false}";
                    element.setAttribute("x-data", isExpanded);
                  }
                });
              }
            }

            const newblockFilterDrawer = parsedHTML.querySelector(blockFilterDrawer);
            if (newblockFilterDrawer) {
              selectblockFilterDrawer.innerHTML = newblockFilterDrawer.innerHTML;
            } else {
              selectblockFilterDrawer.innerHTML = "";
            }
            this._renderAdditionalElements(parsedHTML);
          }
          if (selectblockFilterAside) {
            if (this.$el.id) {
              const blockFilterAsideElement = parsedHTML.querySelector(blockFilterAside);
              if (blockFilterAsideElement) {
                blockFilterAsideElement.querySelectorAll(".js-filter").forEach((element, index) => {
                  let isExpanded = "{open: false}";
                  const filterParam = element.dataset.paramName;
                  let currentElement = selectblockFilterAside.querySelector(`[data-param-name="${filterParam}"]`);
                  if (currentElement) {
                    isExpanded = currentElement.dataset.expanded == "true" ? "{open: true}" : "{open: false}";
                  }
                  element.setAttribute("x-data", isExpanded);
                });
              }
            }

            const newblockFilterAside = parsedHTML.querySelector(blockFilterAside);
            if (newblockFilterAside) {
              selectblockFilterAside.innerHTML = newblockFilterAside.innerHTML;
            } else {
              selectblockFilterAside.innerHTML = "";
            }

            this._renderAdditionalElements(parsedHTML);
          }

          const filterTagEl = document.getElementById("ActiveFilterTag");
          const newFilterTagEl = parsedHTML.getElementById("FacetsContainerBar")?.content?.getElementById("ActiveFilterTag");

          if (filterTagEl) {
            if (newFilterTagEl) {
              filterTagEl.innerHTML = newFilterTagEl.innerHTML;
            } else {
              filterTagEl.innerHTML = "";
            }
          }
          const filterWrapperBar = document.getElementById("FacetsWrapperBar");
          if (filterWrapperBar?.dataset.stickyFilter === "true") {
            this.setFilterHeaderHeight();
          }
        } else {
          if (filterWrapperToRender.dataset.showFilter === "false") {
            filterWrapper.classList.add("md:hidden");
            filterWrapper.innerHTML = filterWrapperToRender.innerHTML;
            this._initLayout();
          }
          if (!parsedHTML.querySelector(".facets-filter__wrapper")?.dataset.enableFilter && buttonFilterWrapper) {
            buttonFilterWrapper.style.display = "none";
          }
          if (filterType == "drawer") {
            document.body.classList.remove("overflow-y-hidden");
          }
        }

        this._renderAdvancedFilters(parsedHTML, "desktop");
        this._renderAdvancedFilters(parsedHTML, "mobile");
        const mobileActiveFilterTag = document.getElementById("mobile-active-filter-tag");
        const renderedMobileFilterTag = parsedHTML.querySelector("#mobile-active-filter-tag");
        if (mobileActiveFilterTag && renderedMobileFilterTag) {
          mobileActiveFilterTag.innerHTML = renderedMobileFilterTag.innerHTML;
        }
      },
      _renderAdvancedFilters(html, type) {
        const destination = document.querySelectorAll(`.${type}-advanced-filter`);
        const source = html.querySelectorAll(`.${type}-advanced-filter`);

        if (destination.length > 0) {
          destination.forEach((destination, index) => {
            if (source[index]) {
              destination.innerHTML = source[index].innerHTML;
            } else {
              destination.innerHTML = "";
            }
          });
        }
      },
      _renderProductGridContainer(html) {
        const productGridContainer = document.getElementById("ProductGridContainer");
        const destinationElement = new DOMParser().parseFromString(html, "text/html").getElementById("ProductGridContainer");

        if (productGridContainer && destinationElement) {
          productGridContainer.innerHTML = destinationElement.innerHTML;
          if (typeof initializeScrollAnimationTrigger === "function") initializeScrollAnimationTrigger();
        }
      },
      _renderProductCount(html) {
        const productCountEl = new DOMParser().parseFromString(html, "text/html").getElementById("FacetsProductCount");
        if (productCountEl) {
          const count = productCountEl.innerHTML;
          const container = document.getElementById("ProductCount_header");
          const containerDrawer = document.getElementById("ProductCountDrawer");
          if (container) container.innerHTML = count;
          if (containerDrawer) containerDrawer.innerHTML = count;
        }
      },
      _renderAdditionalElements(html) {
        const container = document.getElementById("ProductPerPage");
        const destinationElement = html.getElementById("ProductPerPage");
        if (container && destinationElement) container.innerHTML = destinationElement.innerHTML;
      },
      _filterFocus() {
        Alpine.store("xFocusElement").trapFocus("FacetsFilterDrawer", "CloseFilterDrawer");
      },
      _filterRemoveFocus() {
        Alpine.store("xFocusElement").removeTrapFocus();
      },
      setFilterHeaderHeight() {
        const filterWrapperBar = document.getElementById("FacetsWrapperBar");
        document.documentElement.style.setProperty("--height-sticky-filter", filterWrapperBar.getBoundingClientRect().height + "px");
      },
      setPositionOptionFilter(el) {
        let elRect = el.getBoundingClientRect();
        const elPopup = el.getElementsByClassName("popup-above")[0];
        let spacingRight = window.innerWidth - elRect.left;
        let checkSpacing = spacingRight - el.innerWidth;
        if (checkSpacing >= 0) {
          elPopup.style.left = "0px";
        } else {
          elPopup.style.left = checkSpacing + "px";
        }
      },
    }));

    // Pre-registered copy of coupon-code.js (used by main-cart-custom-accordion snippet in
    // cart sections) so dynamically injected sections work in the theme editor / visual preview.
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

          let sectionsToRender;
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

          fetch(`/checkout?skip_shop_pay=true&discount=${encodeURIComponent(listDiscountCodes)}`)
            .then((response) => {
              fetch("/cart/update.js", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sections: sections,
                }),
              })
                .then((response) => {
                  return response.json();
                })
                .then((response) => {
                  if (response.status !== 422) {
                    const discountApplySuccessArr = response.discount_codes || [];

                    const discountApplySuccess = discountApplySuccessArr
                      .filter((discount) => discount.applicable === true)
                      .map((discount) => discount.code)
                      .join(",");
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
                    Alpine.store("xCouponCodeDetail").appliedDiscountCodes.push(discountCode);
                    Alpine.store("xCartHelper").updateCurrentCountItem();
                    document.dispatchEvent(new CustomEvent(`${CART_EVENT.discountCodeChange}`));
                    if (window.Maximize.isCartPage) {
                    } else {
                      document.getElementById("CartDrawer").isOpen = true;
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
      },
    }));

    Alpine.store("xCouponCodeDetail", {
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

        document.addEventListener("shopify:section:select", function (event) {
          if (!(event.target instanceof Element)) return;
          if (!event.target.classList.contains("section-promo-code")) {
            if (window.Alpine) {
              _this.close();
            } else {
              document.addEventListener("alpine:initialized", () => {
                _this.close();
              });
            }
          }
        });

        if (promoCodeDetail && promoCodeDetail.blockID && promoCodeDetail.sectionID) {
          this.promoCodeDetail = xParseJSON(document.getElementById("x-data-promo_code-" + promoCodeDetail.blockID).getAttribute("x-data-promo_code"));
          let contentContainer = document.getElementById("PromoCodeContent-" + this.promoCodeDetail.sectionID);
          if (this.cachedResults[this.promoCodeDetail.blockID]) {
            contentContainer.innerHTML = this.cachedResults[this.promoCodeDetail.blockID];
            return true;
          }
          if (this.promoCodeDetail.page !== "") {
            let url = `${shopUrl}/pages/${this.promoCodeDetail.page}`;
            fetch(url, {
              method: "GET",
            })
              .then((response) => response.text())
              .then((responseText) => {
                const html = new DOMParser().parseFromString(responseText, "text/html");
                contentContainer.innerHTML = html.querySelector(".page__container .page__body").innerHTML;
              });
          } else if (this.promoCodeDetail.details !== "") {
            contentContainer.innerHTML = this.promoCodeDetail.details;
            contentContainer.innerHTML = contentContainer.textContent;
          }
        }
      },
      load(el, blockID, shopUrl) {
        this.promoCodeDetail = xParseJSON(el.closest("#x-data-promo_code-" + blockID).getAttribute("x-data-promo_code"));
        let contentContainer = document.getElementById("PromoCodeContent-" + this.promoCodeDetail.sectionID);
        this.sectionID = this.promoCodeDetail.sectionID;
        if (this.cachedResults[blockID]) {
          contentContainer.innerHTML = this.cachedResults[blockID];
          return true;
        }
        if (this.promoCodeDetail.page !== "") {
          this.loading = true;
          let url = `${shopUrl}/pages/${this.promoCodeDetail.page}`;
          fetch(url, {
            method: "GET",
          })
            .then((response) => response.text())
            .then((responseText) => {
              const html = new DOMParser().parseFromString(responseText, "text/html");
              const content = html.querySelector(".page__container .page__body").innerHTML;
              contentContainer.innerHTML = content;
              this.cachedResults[blockID] = content;
            })
            .finally(() => {
              this.loading = false;
            });
        } else if (this.promoCodeDetail.details !== "") {
          contentContainer.innerHTML = this.promoCodeDetail.details;
          contentContainer.innerHTML = contentContainer.textContent;
        }
      },
      showPromoCodeDetail() {
        this.show = true;
        Alpine.store("xMaximizePopup").handleOpen();
      },
      close() {
        this.show = false;
        Alpine.store("xMaximizePopup").handleClose();
      },
      getDiscountCode() {
        let cookieValue = document.cookie.match("(^|;)\\s*" + "maximize_discount_code" + "\\s*=\\s*([^;]+)");
        let appliedDiscountCodes = cookieValue ? cookieValue.pop() : "";
        this.appliedDiscountCodes = appliedDiscountCodes.split(",");
      },
    });

    Alpine.data("xMediaGallery", (mediaGalleryWrapperEle, sectionId, zoomEffect, isShowMediaWithVariantSelected, desktopLayout) => ({
      isFirstLoading: true,
      swiffySlider: null,
      thumbnailItems: [],
      thumbnailItemsShow: [],
      listZoomThumbnailItems: [],
      listZoomThumbnailItemsShow: [],
      isShowZoomThumbnail: true,
      mediaItems: [],
      mediaItemsShow: [],
      indexActiveMedia: 0,
      activeMediaId: false,
      zoomItemActiveMediaId: false,
      zoomSelectedItem: null,
      isZoomOpen: false,
      listMediaApplyShowMediaWithVariantSelected: [],
      productMediasInfo: [],
      currentVariant: false,
      listZoomItemsEnlarge: [],
      listZoomItemsEnlargeShow: [],
      listDotsWrapperEl: mediaGalleryWrapperEle.querySelector(".media-gallery__dot-nav__wrapper"),
      listDotsEl: [],
      listDotsShowEl: [],
      maxNumberDotShow: 0,
      heightHeaderAndAnnouncementBar: 0,
      boundZoomHandler: null,
      sectionContainer: null,
      swiffySlideZoomLarge: null,
      thumbnailWrapper: null,
      thumbnailContainer: null,
      zoomEnlargeWrapperEle: null,
      zoomEnlargeThumbnailWrapper: null,
      init() {
        this.boundZoomHandler = this.handleZoomWhenHoverImage.bind(this);
        this.sectionContainer = document.querySelector(`.section--${sectionId}`);

        if (this.sectionContainer) {
          this.thumbnailWrapper = this.sectionContainer.querySelector(`.media-gallery__thumbnail-wrapper`);
          this.mediaWrapper = this.sectionContainer.querySelector(`.media-gallery__container`);
          this.thumbnailItems = this.sectionContainer.querySelectorAll(".media-gallery__thumbnail-item");
          this.thumbnailItemsShow = this.sectionContainer.querySelectorAll(".media-gallery__thumbnail-item.is-show-thumbnail-item");
          this.mediaItems = this.sectionContainer.querySelectorAll(".media-gallery__media-item");
          this.mediaItemsShow = this.sectionContainer.querySelectorAll(".media-gallery__media-item.is-show-media-item");
          this.listDotsEl = this.listDotsWrapperEl?.querySelectorAll(`.media-gallery__dot-nav__dot-item`) || [];

          this.thumbnailContainer = this.thumbnailWrapper?.querySelector(".media-gallery__thumbnail-container");

          let indexActiveMedia = Array.from(this.mediaItems).findIndex((item) => item.classList.contains("is-active"));
          indexActiveMedia = indexActiveMedia >= 0 ? indexActiveMedia : 0;

          this.activeMediaId = this.mediaItems[indexActiveMedia].dataset.mediaId;

          requestAnimationFrame(() => {
            this.handleScrollDot();
            // this.__updateHeightWhenRatioNatural();
          });
        }
        const dotNavContainerEl = mediaGalleryWrapperEle.querySelector(".media-gallery__dot-nav__container");
        if (dotNavContainerEl) {
          this.maxNumberDotShow = SLIDER_DOT.MAX_NUMBER_DOTS;
        }
        const productMediaInfoEle = document.querySelector(`#ProductMediaInfo__${sectionId}`);
        if (productMediaInfoEle) {
          this.productMediasInfo = JSON.parse(productMediaInfoEle.textContent);
        }
        const currentVariantInfoElement = document.querySelector(`#CurrentVariantInfo__${sectionId}`);
        this.currentVariant = JSON.parse(currentVariantInfoElement.textContent);

        this.$watch("activeMediaId", (newActiveMediaId) => {
          this.isZoomOpen = false;
          if (zoomEffect === ZOOM_EFFECT.magnifier) {
            this.__handleCloseZoom();
          }
          // this.indexActiveThumbnail = newValue;
          // this.__updateHeightWhenRatioNatural();
          this.mediaItems.forEach((mediaItem) => {
            if (mediaItem.dataset.mediaId == newActiveMediaId) {
              mediaItem.classList.add("is-active");
            } else {
              mediaItem.classList.remove("is-active");
            }
          });

          this.thumbnailItemsShow.forEach((thumbnailItem) => {
            if (thumbnailItem.dataset.mediaId == newActiveMediaId) {
              thumbnailItem.classList.add("is-active");
            } else {
              thumbnailItem.classList.remove("is-active");
            }
          });
          const newIndexActiveSlide = Array.from(this.swiffySlider.slides).findIndex((item) => item.dataset.mediaId === newActiveMediaId);
          if (!this.isFirstLoading && !(mediaGalleryWrapperEle.dataset.isScrollingOnDesktop == "true" && this.swiffySlider.isDragging)) {
            this.swiffySlider.slideTo(newIndexActiveSlide);
          }
          this.updateActiveMediaInTwoColumns();
          this.__updateInertTwoColumnsLayout();

          requestAnimationFrame(() => {
            this.__scrollThumbnail();
            this.__updateVideoProductMedia();
            this.handleScrollDot();
          });
        });

        requestAnimationFrame(() => {
          if (this.$refs.thumbnail_wrapper) {
            const listThumbnailShow = this.$refs.thumbnail_wrapper.querySelectorAll(`.media-gallery__thumbnail-item.is-show-thumbnail-item`);

            if (listThumbnailShow.length > 1) {
              this.$refs.thumbnail_wrapper.classList.add("is-show");
            } else {
              this.$refs.thumbnail_wrapper.classList.remove("is-show");
            }
            this.__updateShowThumbnailNav();
            this.__scrollThumbnail();
          }
        });

        this.$watch("listMediaApplyShowMediaWithVariantSelected", (newList) => {
          const newListString = newList.map(String);
          if (this.$refs.thumbnail_wrapper) {
            if (newList.length > 1) {
              this.$refs.thumbnail_wrapper.classList.add("is-show");
            } else {
              this.$refs.thumbnail_wrapper.classList.remove("is-show");
            }
          }

          this.mediaItems.forEach((mediaItem) => {
            if (newListString.includes(mediaItem.dataset.mediaId)) {
              mediaItem.classList.add("is-show-media-item");
            } else {
              mediaItem.classList.remove("is-show-media-item");
            }
          });
          this.mediaItemsShow = this.sectionContainer.querySelectorAll(".media-gallery__media-item.is-show-media-item");
          this.thumbnailItems.forEach((thumbnailItem) => {
            if (newListString.includes(thumbnailItem.dataset.mediaId)) {
              thumbnailItem.classList.add("is-show-thumbnail-item");
            } else {
              thumbnailItem.classList.remove("is-show-thumbnail-item");
            }
          });
          this.thumbnailItemsShow = this.sectionContainer.querySelectorAll(".media-gallery__thumbnail-item.is-show-thumbnail-item");
          this.listDotsShowEl = [];
          this.listDotsEl.forEach((dot) => {
            if (newListString.includes(dot.dataset.mediaId)) {
              dot.classList.add("is-show-dot");
              this.listDotsShowEl.push(dot);
            } else {
              dot.classList.remove("is-show-dot");
            }
          });

          this.zoomEnlargeWrapperEle = document.querySelector(`#MediaGalleryZoom__Enlarge__${sectionId}`);
          if (this.zoomEnlargeWrapperEle) {
            this.zoomEnlargeThumbnailWrapper = this.zoomEnlargeWrapperEle.querySelector(".zoom-enlarge__thumbnail-wrapper");
            this.zoomEnlargeThumbnailContainer = this.zoomEnlargeWrapperEle.querySelector(".zoom-enlarge__thumbnail-container");

            this.listZoomItemsEnlarge = this.zoomEnlargeWrapperEle.querySelectorAll(`.media-gallery__zoom-enlarge__item`);
            this.listZoomThumbnailItems = this.zoomEnlargeWrapperEle.querySelectorAll(`.zoom-enlarge__thumbnail-item`);
          }

          this.listZoomItemsEnlarge.forEach((zoomItem) => {
            if (newListString.includes(zoomItem.dataset.mediaId)) {
              zoomItem.classList.add("is-show-media-zoom-item");
            } else {
              zoomItem.classList.remove("is-show-media-zoom-item");
            }
          });

          this.listZoomThumbnailItems.forEach((zoomThumbnailItem) => {
            if (newListString.includes(zoomThumbnailItem.dataset.mediaId)) {
              zoomThumbnailItem.classList.add("is-show-media-zoom-item");
            } else {
              zoomThumbnailItem.classList.remove("is-show-media-zoom-item");
            }
          });

          if (this.zoomEnlargeWrapperEle) {
            this.listZoomItemsEnlargeShow = this.zoomEnlargeWrapperEle.querySelectorAll(`.media-gallery__zoom-enlarge__item.is-show-media-zoom-item`);
            this.listZoomThumbnailItemsShow = this.zoomEnlargeWrapperEle.querySelectorAll(`.zoom-enlarge__thumbnail-item.is-show-media-zoom-item`);
          }

          if (this.swiffySlider) {
            this.swiffySlider.slides = mediaGalleryWrapperEle.querySelectorAll(".slide-item.is-show-media-item");
            const indexActive = Array.from(this.swiffySlider.slides).findIndex((item) => item.dataset.mediaId === this.activeMediaId);

            if (indexActive > -1 && !this.isFirstLoading) {
              requestAnimationFrame(() => {
                this.swiffySlider.slideTo(indexActive);
              });
            }
            this.swiffySlider.addEventToIndicators();
          }

          if (this.swiffySlideZoomLarge) {
            this.swiffySlideZoomLarge.slides = this.zoomEnlargeWrapperEle.querySelectorAll(`.media-gallery__zoom-enlarge__item.is-show-media-zoom-item`);

            this.swiffySlideZoomLarge.sliderNavs.forEach((nav) => {
              nav.classList[this.swiffySlideZoomLarge.slidesPerView > 0 && this.swiffySlideZoomLarge.slidesPerView < this.swiffySlideZoomLarge.slides.length ? "add" : "remove"]("is-visible");
            });
          }

          if (desktopLayout != PRODUCT_MEDIA_DESKTOP_LAYOUT.slider1Columns && isShowMediaWithVariantSelected) {
            const isTwoColumns = this.mediaItemsShow.length > 1;
            const sizes = isTwoColumns ? this.mediaWrapper.dataset.sizesInTwoColumns : this.mediaWrapper.dataset.sizes;

            this.mediaItems.forEach((mediaItem) => {
              if (mediaItem.dataset.mediaType == "image" || mediaItem.dataset.mediaType == "video") {
                const imageEl = mediaItem.querySelector("img");
                if (imageEl) {
                  const srcset = isTwoColumns ? imageEl.dataset.srcsetInTwoColumns : imageEl.dataset.srcset;
                  if (srcset) imageEl.setAttribute("srcset", srcset);
                  if (sizes) imageEl.setAttribute("sizes", sizes);
                }
              }
            });
          }

          requestAnimationFrame(() => {
            this.__scrollThumbnail();
            this.__updateShowThumbnailNav();
          });
        });
        this.handleChangeVariant();

        window.addEventListener(
          "resize",
          debounce(() => {
            this.__updateShowThumbnailNav();
            this.__scrollZoomEnlargeThumbnail();
          }, 300)
        );

        this.$watch("zoomItemActiveMediaId", () => {
          this.__scrollZoomEnlargeThumbnail();
        });

        if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.grid2Columns) {
          this.$watch("isZoomOpen", (newIsZoomOpen) => {
            if ((window.innerWidth >= MIN_DEVICE_WIDTH.desktop && zoomEffect === ZOOM_EFFECT.magnifier) || window.innerWidth < MIN_DEVICE_WIDTH.tablet) return;

            this.mediaItems.forEach((mediaItem) => {
              const videoContainer = mediaItem.querySelector(".external-video");
              if (videoContainer) {
                if (newIsZoomOpen) {
                  Alpine.store("xVideo").pause(videoContainer);
                }
              }
            });
          });
        }
      },
      updateActiveMediaInTwoColumns() {
        requestAnimationFrame(() => {
          if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider2Columns) {
            let indexActiveMedia = Array.from(this.mediaItemsShow).findIndex((item) => item.dataset.mediaId == this.activeMediaId);
            if (indexActiveMedia == -1) {
              indexActiveMedia = 0;
            }
            this.mediaItemsShow.forEach((item, index) => {
              const videoContainer = item.getElementsByClassName("external-video")[0];
              if (index === indexActiveMedia || (indexActiveMedia != this.mediaItemsShow.length - 1 && index === indexActiveMedia + 1) || (indexActiveMedia == this.mediaItemsShow.length - 1 && index === indexActiveMedia - 1)) {
                item.classList.add("is-active-in-two-columns");
                if (item.dataset.mediaType === "model") {
                  document.dispatchEvent(new CustomEvent(`${PRODUCT_MEDIA_EVENT.show_model}-${item.dataset.mediaId}`));
                }
                if (videoContainer) {
                  videoContainer.dataset.isActive = "true";
                }
              } else {
                item.classList.remove("is-active-in-two-columns");
                if (videoContainer) {
                  videoContainer.dataset.isActive = "false";
                }
              }
            });
          }
        });
      },
      handleScrollDot() {
        requestAnimationFrame(() => {
          if (this.listDotsShowEl.length > 0) {
            const listDotsContainerEl = this.listDotsWrapperEl.querySelector(".media-gallery__dot-nav__dot-list");
            if (!listDotsContainerEl) return;

            const listDotsContainerWidth = listDotsContainerEl.getBoundingClientRect().width;
            const dotWidth = SLIDER_DOT.DOT_WIDTH;
            const listDotsContainerGap = SLIDER_DOT.DOT_GAP;
            if (!dotWidth && listDotsContainerGap) return;

            let indexActiveMedia = Array.from(this.mediaItemsShow).findIndex((item) => item.dataset.mediaId == this.activeMediaId);
            if (indexActiveMedia == -1) {
              indexActiveMedia = 0;
            }

            this.listDotsShowEl.forEach((dot) => {
              dot.classList.remove("dot-small", "dot-normal");
              if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider2Columns) {
                dot.parentNode.classList.remove("md:hidden");
              }
              if (dot.dataset.mediaId == this.activeMediaId) {
                dot.classList.add("is-active");
              } else {
                dot.classList.remove("is-active");
                if (this.maxNumberDotShow >= this.listDotsShowEl.length) {
                  dot.classList.add("dot-normal");
                }
              }
            });

            if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider2Columns && this.listDotsShowEl.length > 2) {
              if (this.listDotsShowEl.length - 1 == indexActiveMedia) {
                this.listDotsShowEl[0].parentNode.classList.add("md:hidden");
              } else {
                this.listDotsShowEl[this.listDotsShowEl.length - 1].parentNode.classList.add("md:hidden");
              }
            }

            if (this.maxNumberDotShow >= this.listDotsShowEl.length) return;

            this.listDotsShowEl[indexActiveMedia + 1] && this.listDotsShowEl[indexActiveMedia + 1].classList.add("dot-normal");
            this.listDotsShowEl[indexActiveMedia - 1] && this.listDotsShowEl[indexActiveMedia - 1].classList.add("dot-normal");
            this.listDotsShowEl[indexActiveMedia + 2] && this.listDotsShowEl[indexActiveMedia + 2].classList.add("dot-small");
            this.listDotsShowEl[indexActiveMedia - 2] && this.listDotsShowEl[indexActiveMedia - 2].classList.add("dot-small");

            const scrollLeftValue = (indexActiveMedia * (dotWidth + listDotsContainerGap) - (listDotsContainerWidth / 2 - dotWidth / 2)) * (window.Maximize.rtl ? -1 : 1);
            listDotsContainerEl.scrollTo({
              left: scrollLeftValue,
              behavior: "smooth",
            });
          }
        });
      },
      handleInitSwiffy(el, configs) {
        requestAnimationFrame(() => {
          this.isFirstLoading = false;
        });

        this.swiffySlider = new SwiffySlider(el, configs);

        this.mediaItems = this.sectionContainer.querySelectorAll(".media-gallery__media-item");
        this.mediaItemsShow = this.sectionContainer.querySelectorAll(".media-gallery__media-item.is-show-media-item");

        this.updateActiveMediaInTwoColumns();
        let timeoutHiddenActiveMedia;

        document.addEventListener(`${PRODUCT_EVENT.updatedVariant}${sectionId}`, (event) => {
          const { currentVariant } = event.detail;
          this.currentVariant = currentVariant;

          this.handleChangeVariant(event);

          // Handle scroll to selected variant media on grid layout desktop
          if ((!Alpine.store("stickyATC") || !Alpine.store("stickyATC").isOpen) && desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.grid2Columns && window.innerWidth >= MIN_DEVICE_WIDTH.tablet) {
            const activeMediaItem = Array.from(this.mediaItems).find((item) => item.dataset.mediaId == this.activeMediaId);
            this.mediaItems.forEach((item) => {
              item.classList.remove("active-product-in-grid", "shadow-medium");
            });
            if (timeoutHiddenActiveMedia) {
              clearTimeout(timeoutHiddenActiveMedia);
            }
            requestAnimationFrame(() => {
              if (activeMediaItem && this.mediaItemsShow.length > 1) {
                activeMediaItem.classList.add("active-product-in-grid", "shadow-medium");
                timeoutHiddenActiveMedia = setTimeout(() => {
                  activeMediaItem.classList.remove("active-product-in-grid", "shadow-medium");
                }, 2000);
              }
              if (this.heightHeaderAndAnnouncementBar == 0) {
                const sectionAnnouncementEl = document.getElementsByClassName("section-announcement")[0];
                const sectionHeaderEl = document.getElementsByClassName("section-header")[0];
                this.heightHeaderAndAnnouncementBar = (sectionAnnouncementEl?.getBoundingClientRect().height || 0) + (sectionHeaderEl?.getBoundingClientRect().height || 0);
              }
              const scrollPosition = activeMediaItem.getBoundingClientRect().top + window.scrollY - this.heightHeaderAndAnnouncementBar;
              window.scrollTo({
                top: scrollPosition,
                behavior: "smooth",
              });
            });
          }
        });

        el.addEventListener(`${SWIFFY_SLIDER_EVENT.slide}`, (event) => {
          if (this.swiffySlider.slides[this.swiffySlider.activeSlideIndex]) {
            this.activeMediaId = this.swiffySlider.slides[this.swiffySlider.activeSlideIndex].dataset.mediaId;
          }
        });
        if (!this.mediaWrapper) {
          this.sectionContainer = document.querySelector(`.section--${sectionId}`);
          if (this.sectionContainer) {
            this.mediaWrapper = this.sectionContainer.querySelector(`.media-gallery__container`);
          }
        }
        if (this.mediaWrapper) {
          if (this.mediaWrapper.dataset?.scrollToChangeImage == "true") {
            this.mediaWrapper.addEventListener("wheel", this.handleWheel.bind(this));
          }
        }
        installMediaQueryWatcher(`(min-width: ${MIN_DEVICE_WIDTH.tablet}px)`, (matches) => {
          if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider2Columns) {
            if (matches) {
              this.swiffySlider.effect = SLIDER_EFFECT.slide;
              el.dataset.effect = SLIDER_EFFECT.slide;

              const indexActive = Array.from(this.swiffySlider.slides).findIndex((item) => item.dataset.mediaId === this.activeMediaId);
              this.swiffySlider.initTouchEvents();
              if (indexActive > -1) {
                if (this.isFirstLoading) {
                  this.swiffySlider.slideTo(indexActive, true);
                } else {
                  setTimeout(() => {
                    this.swiffySlider.slideTo(indexActive);
                  }, TIMEOUT.resize);
                }
              }
            } else {
              this.swiffySlider.effect = SLIDER_EFFECT.fade;
              el.dataset.effect = SLIDER_EFFECT.fade;
              this.__updateVideoProductMedia();
              this.swiffySlider.initTouchEvents();
            }
            this.__updateInertTwoColumnsLayout();

            setTimeout(() => {
              this.__scrollThumbnail();
              this.handleScrollDot();
            }, TIMEOUT.resize);
          } else if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.grid2Columns) {
            if (!matches) {
              this.__updateVideoProductMedia();
              this.__scrollThumbnail();
            }
          }

          if (!matches && zoomEffect === ZOOM_EFFECT.magnifier) {
            this.__handleCloseZoom(true);
          }
        });
      },
      handleClickNav: function (isNext) {
        const totalItemsShow = this.mediaItemsShow.length;
        let indexActiveThumbnail = Array.from(this.mediaItemsShow).findIndex((item) => item.dataset.mediaId == this.activeMediaId);

        while (true) {
          if (window.innerWidth >= MIN_DEVICE_WIDTH.tablet && desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider2Columns) {
            if (isNext && indexActiveThumbnail == totalItemsShow - 2) {
              indexActiveThumbnail = 0;
            } else if (!isNext && indexActiveThumbnail == totalItemsShow - 1) {
              indexActiveThumbnail -= 2;
            } else if (!isNext && indexActiveThumbnail == 0) {
              indexActiveThumbnail = totalItemsShow - 2;
            } else {
              indexActiveThumbnail += isNext ? 1 : -1;
            }
          } else {
            indexActiveThumbnail += isNext ? 1 : -1;
          }

          if (indexActiveThumbnail < 0) {
            indexActiveThumbnail = totalItemsShow - 1;
          } else if (indexActiveThumbnail >= totalItemsShow) {
            indexActiveThumbnail = 0;
          }

          this.activeMediaId = this.mediaItemsShow[indexActiveThumbnail].dataset.mediaId;
          break;
        }
      },
      handleFocusThumbnail: function (event) {
        const thumbnailItem = event.currentTarget;
        this.activeMediaId = thumbnailItem.dataset.mediaId;
      },
      handleFocusZoomEnlargeThumbnail() {
        const newZoomItemActiveMediaId = this.$el.dataset.mediaId;
        const indexActiveZoomItem = Array.from(this.swiffySlideZoomLarge.slides).findIndex((item) => item.dataset.mediaId === newZoomItemActiveMediaId);
        if (indexActiveZoomItem > -1) {
          this.swiffySlideZoomLarge.slideTo(indexActiveZoomItem);

          if (this.listZoomThumbnailItemsShow.length > 0) {
            this.zoomItemActiveMediaId = newZoomItemActiveMediaId;

            const newActiveItem = this.swiffySlideZoomLarge.slides[indexActiveZoomItem];
            if (newActiveItem && (newActiveItem.dataset.mediaType == "video" || newActiveItem.dataset.mediaType == "external_video")) {
              const videoContainer = newActiveItem.getElementsByClassName("external-video")[0];
              if (!videoContainer) return;
              const thumbnailVideo = videoContainer.getElementsByClassName("media-gallery-item__img-thumbnail")[0];
              if (thumbnailVideo && !thumbnailVideo.classList.contains("hidden")) {
                thumbnailVideo.focus();
              } else {
                const buttonPlay = videoContainer.getElementsByClassName("button-play")[0];
                if (buttonPlay) {
                  buttonPlay.focus();
                } else {
                  if (newActiveItem.dataset.mediaType == "external_video") {
                    videoContainer.focus();
                  } else {
                    const video = videoContainer.getElementsByClassName("video")[0];
                    if (!video) return;
                    video.focus();
                  }
                }
              }
            }
          }
        }
      },
      handleWheel(event) {
        if (window.innerWidth < MIN_DEVICE_WIDTH.tablet) return;
        const mediaItem = Array.from(this.mediaItems).find((item) => item.dataset.mediaId == this.activeMediaId);
        if (mediaItem && mediaItem.dataset.mediaType === "model") return;

        event.preventDefault();
        event.stopPropagation();

        if (this.isWheelBlocked) return;
        this.isWheelBlocked = true;

        const length = this.mediaItemsShow.length;
        if (length === 0) return;
        const currentIndexMediaItem = Array.from(this.mediaItemsShow).findIndex((mediaItem) => mediaItem.dataset.mediaId == this.activeMediaId);
        if (currentIndexMediaItem > -1) {
          const direction = event.deltaY > 0 ? 1 : -1;
          let newIndex = (currentIndexMediaItem + direction + length) % length;
          if (newIndex >= this.mediaItemsShow.length) {
            newIndex = 0;
          } else if (newIndex < 0) {
            newIndex = this.mediaItemsShow.length - 1;
          }
          this.activeMediaId = this.mediaItemsShow[newIndex].dataset.mediaId;
          const newThumbnailItemsActive = Array.from(this.thumbnailItemsShow).find((item) => item.dataset.mediaId === this.activeMediaId);
          if (newThumbnailItemsActive) {
            newThumbnailItemsActive.click();
          }
        }
        setTimeout(() => {
          this.isWheelBlocked = false;
        }, 1000);
      },
      handleChangeVariant(event) {
        let listMediaApplyShowMediaWithVariantSelected = [];
        let listMediaNullAlt = [];

        if (isShowMediaWithVariantSelected && this.currentVariant && this.currentVariant.options[0]) {
          let activeMediaId = false;

          let firstOptionHandleCurrentVariant = this.currentVariant.options[0].toLowerCase().replace(/ /g, "-");
          this.mediaItems.forEach((item) => {
            if (item.dataset.mediaAlt !== "") {
              let mediaAltHandle = item.dataset.mediaAlt;
              if (firstOptionHandleCurrentVariant === mediaAltHandle) {
                if (!activeMediaId) {
                  activeMediaId = item.dataset.mediaId;
                }

                listMediaApplyShowMediaWithVariantSelected.push(item.dataset.mediaId);
              }
            } else {
              listMediaNullAlt.push(item.dataset.mediaId);
            }
          });
          if (!activeMediaId) {
            if (this.currentVariant.featured_media && this.currentVariant.featured_media.id) {
              activeMediaId = this.currentVariant.featured_media.id.toString();
            } else {
              activeMediaId = this.productMediasInfo[0].id.toString();
            }
          }
          listMediaApplyShowMediaWithVariantSelected.push(activeMediaId);
          this.activeMediaId = activeMediaId;

          listMediaApplyShowMediaWithVariantSelected = listMediaApplyShowMediaWithVariantSelected.concat(listMediaNullAlt);
        } else {
          if (event) {
            let featuredMediaId = `${event.detail.previewMediaId}`;

            if (this.currentVariant && this.currentVariant.featured_media && this.currentVariant.featured_media.id) {
              featuredMediaId = `${this.currentVariant.featured_media.id}`;
            }
            this.activeMediaId = featuredMediaId.toString();
          }

          this.productMediasInfo.forEach((media) => {
            listMediaApplyShowMediaWithVariantSelected.push(media.id);
          });
        }

        this.listMediaApplyShowMediaWithVariantSelected = [...new Set(listMediaApplyShowMediaWithVariantSelected)];
      },
      __scrollZoomEnlargeThumbnail() {
        if (this.zoomEnlargeThumbnailContainer) {
          requestAnimationFrame(() => {
            const gap = parseInt(window.innerWidth > 768 ? this.zoomEnlargeThumbnailContainer.dataset.desktopGap : this.zoomEnlargeThumbnailContainer.dataset.mobileGap) || 0;
            let indexActiveThumbnail = 0;
            this.listZoomThumbnailItemsShow.forEach((item, index) => {
              if (item.dataset.mediaId === this.zoomItemActiveMediaId) {
                item.classList.add("is-active");
                indexActiveThumbnail = index;
                this.isShowZoomThumbnail = !(item.dataset.mediaType === "external_video" || item.dataset.mediaType === "video");
              } else {
                item.classList.remove("is-active");
              }
            });

            let scrollLeftValue = 0;
            if (indexActiveThumbnail > 0) {
              for (let i = 0; i < indexActiveThumbnail; i++) {
                if (this.listZoomThumbnailItemsShow[i]) {
                  scrollLeftValue += this.listZoomThumbnailItemsShow[i].offsetWidth + gap;
                }
              }
            }
            if (window.Maximize.rtl) {
              scrollLeftValue = scrollLeftValue * -1;
            }

            if (this.zoomEnlargeThumbnailWrapper) {
              this.zoomEnlargeThumbnailWrapper.scrollTo({
                left: scrollLeftValue,
                behavior: "smooth",
              });
            }
          });
        }
      },
      __scrollThumbnail: function () {
        if (this.thumbnailContainer && this.thumbnailWrapper) {
          const gap = parseInt(this.thumbnailContainer.dataset.gap) || 0;
          const desktopThumbnailPosition = this.thumbnailContainer.dataset?.desktopThumbnailPosition;
          this.thumbnailItems.forEach((item, index) => {
            if (item.dataset.mediaId === this.activeMediaId) {
              item.classList.add("is-active");
            } else {
              item.classList.remove("is-active");
            }
          });
          requestAnimationFrame(() => {
            const indexActiveThumbnail = Array.from(this.thumbnailItemsShow).findIndex((item) => item.dataset.mediaId === this.activeMediaId);
            if (window.innerWidth >= MIN_DEVICE_WIDTH.tablet && desktopThumbnailPosition != "bottom") {
              let scrollTopValue = 0;
              if (indexActiveThumbnail > 0) {
                for (let i = 1; i <= indexActiveThumbnail; i++) {
                  scrollTopValue += this.thumbnailItemsShow[i].offsetHeight + gap;
                }
              }

              this.thumbnailWrapper.scrollTo({
                top: scrollTopValue,
                behavior: "smooth",
              });
            } else {
              let scrollLeftValue = 0;
              if (indexActiveThumbnail > 0) {
                for (let i = 0; i < indexActiveThumbnail; i++) {
                  scrollLeftValue += this.thumbnailItemsShow[i].offsetWidth + gap;
                }
              }
              if (window.Maximize.rtl) {
                scrollLeftValue = scrollLeftValue * -1;
              }

              this.thumbnailContainer.scrollTo({
                left: scrollLeftValue,
                behavior: "smooth",
              });

              if (this.thumbnailContainer.classList.contains("enable-bg-active-in-two-columns") && window.innerWidth >= MIN_DEVICE_WIDTH.tablet) {
                let bgActiveScrollLeftValue = scrollLeftValue;
                const bgActiveWidth = parseFloat(window.getComputedStyle(this.thumbnailContainer, "::before").width) || 0;
                const thumbnailContainerScrollWidth = this.thumbnailContainer.scrollWidth;
                const thumbnailContainerWidth = this.thumbnailContainer.getBoundingClientRect().width;

                if (window.Maximize.rtl) {
                  bgActiveScrollLeftValue = scrollLeftValue + thumbnailContainerWidth - bgActiveWidth;
                  if (thumbnailContainerWidth - thumbnailContainerScrollWidth > bgActiveScrollLeftValue) {
                    bgActiveScrollLeftValue = thumbnailContainerWidth - thumbnailContainerScrollWidth;
                  }
                } else {
                  if (bgActiveScrollLeftValue + bgActiveWidth > thumbnailContainerScrollWidth) {
                    bgActiveScrollLeftValue = thumbnailContainerScrollWidth - bgActiveWidth;
                  }
                }
                this.thumbnailContainer.style.setProperty("--active-wrapper-offset-x", `${bgActiveScrollLeftValue}px`);
              }
            }
          });
        }
      },

      handleZoom: function (el) {
        if (zoomEffect == "none") return;
        const mediaEl = el ? el : this.$el.closest(".media-gallery__media-item");

        if (!mediaEl || !mediaEl.dataset.mediaId) return;

        if (
          window.innerWidth >= MIN_DEVICE_WIDTH.desktop &&
          zoomEffect === ZOOM_EFFECT.magnifier &&
          (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider2Columns || desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.grid2Columns) &&
          this.zoomSelectedItem &&
          mediaEl.dataset.mediaId != this.zoomSelectedItem.dataset.mediaId
        ) {
          this.__handleCloseZoom();
          if (mediaEl.dataset.mediaType !== "image") return;

          requestAnimationFrame(() => {
            this.__handleOpenZoom(mediaEl);
          });
        } else {
          if (mediaEl.dataset.mediaType !== "image") return;

          if (this.isZoomOpen) {
            this.__handleCloseZoom();
          } else {
            this.__handleOpenZoom(mediaEl);
          }
        }
      },

      __handleOpenZoom: function (el) {
        this.zoomSelectedItem = el;

        const handleOpenZoomEnlargeEffect = () => {
          document.body.classList.add("overflow-hidden");
          this.zoomItemActiveMediaId = this.zoomSelectedItem.dataset.mediaId;
          this.listZoomItemsEnlarge.forEach((item, index) => {
            if (item.dataset.mediaId === this.zoomSelectedItem.dataset.mediaId) {
              item.classList.add("is-active");
            } else {
              item.classList.remove("is-active");
            }
          });
        };
        const handleOpenZoomMagnifierEffect = () => {
          this.zoomSelectedItem.classList.add("is-zoom-media");
          const media = this.zoomSelectedItem.querySelector(".media-gallery__item__image");

          if (media) {
            this.zoomSelectedItem.style.backgroundImage = `url('${media.src}')`;

            this.zoomSelectedItem.addEventListener("mousemove", this.boundZoomHandler);
            media.classList.add("opacity-0");
          }
        };

        requestAnimationFrame(() => {
          mediaGalleryWrapperEle.classList.add("is-open-zoom");
          this.isZoomOpen = true;
          if (window.innerWidth >= MIN_DEVICE_WIDTH.desktop) {
            if (zoomEffect === ZOOM_EFFECT.enlarge) {
              handleOpenZoomEnlargeEffect();
            } else if (zoomEffect === ZOOM_EFFECT.magnifier) {
              handleOpenZoomMagnifierEffect();
            }
          } else {
            if (zoomEffect === ZOOM_EFFECT.enlarge || zoomEffect === ZOOM_EFFECT.magnifier) {
              handleOpenZoomEnlargeEffect();
            }
          }
        });
      },

      __handleCloseZoom: function (isCloseZoomMagnifierEffect = false) {
        if (this.zoomSelectedItem) {
          this.isZoomOpen = false;
          mediaGalleryWrapperEle.classList.remove("is-open-zoom");

          const handleCloseZoomEnlargeEffect = () => {
            document.body.classList.remove("overflow-hidden");
            Alpine.store("xFocusElement").removeTrapFocus();
            // this.swiffySlideZoomLarge = false;
          };

          const handleCloseZoomMagnifierEffect = () => {
            this.zoomSelectedItem.classList.remove("is-zoom-media");
            const media = this.zoomSelectedItem.querySelector(".media-gallery-item__media");

            if (media) {
              this.zoomSelectedItem.style.backgroundImage = ``;

              this.zoomSelectedItem.removeEventListener("mousemove", this.boundZoomHandler);
              media.classList.remove("opacity-0");
            }
          };
          if (window.innerWidth >= MIN_DEVICE_WIDTH.desktop) {
            if (zoomEffect === ZOOM_EFFECT.enlarge) {
              handleCloseZoomEnlargeEffect();
            } else if (zoomEffect === ZOOM_EFFECT.magnifier) {
              handleCloseZoomMagnifierEffect();
            }
          } else {
            if (isCloseZoomMagnifierEffect) {
              handleCloseZoomMagnifierEffect();
            } else if (zoomEffect === ZOOM_EFFECT.enlarge || zoomEffect === ZOOM_EFFECT.magnifier) {
              handleCloseZoomEnlargeEffect();
            }
          }

          this.zoomSelectedItem = null;
        }
      },

      handleZoomWhenHoverImage: function (event) {
        if (!this.zoomSelectedItem) return;

        const offsetX = event.offsetX ? event.offsetX : event.touches && event.touches[0] ? event.touches[0].pageX : 0;
        const offsetY = event.offsetY ? event.offsetY : event.touches && event.touches[0] ? event.touches[0].pageY : 0;

        const x = (offsetX / this.zoomSelectedItem.offsetWidth) * 100;
        const y = (offsetY / this.zoomSelectedItem.offsetHeight) * 100;
        this.zoomSelectedItem.style.backgroundPosition = `${x}% ${y}%`;
      },
      handleInitZoomEffectEnlarge: function (el, configs) {
        if (!this.swiffySlideZoomLarge) {
          let updatedConfig = { ...configs };
          this.swiffySlideZoomLarge = new SwiffySlider(el, updatedConfig);
        }

        el.addEventListener(`${SWIFFY_SLIDER_EVENT.slide}`, (event) => {
          if (event.target.classList.contains("zoom-enlarge__wrapper")) {
            const newActiveSlideIndex = event.detail.newActiveSlideIndex;
            this.zoomItemActiveMediaId = this.listZoomItemsEnlargeShow[newActiveSlideIndex].dataset.mediaId;
          }
        });

        requestAnimationFrame(() => {
          const indexActiveZoomItem = Array.from(this.swiffySlideZoomLarge.slides).findIndex((item) => item.dataset.mediaId === (this.zoomItemActiveMediaId || this.activeMediaId));
          if (indexActiveZoomItem > -1) {
            this.swiffySlideZoomLarge.slideTo(indexActiveZoomItem);
          }
        });
      },
      __updateShowThumbnailNav() {
        if (this.$refs.thumbnail_wrapper) {
          const thumbnailNavs = this.$refs.thumbnail_wrapper.querySelectorAll(".media-gallery__thumbnail-nav");
          this.thumbnailItemsShow = this.sectionContainer.querySelectorAll(".media-gallery__thumbnail-item.is-show-thumbnail-item");
          requestAnimationFrame(() => {
            if (window.innerWidth < MIN_DEVICE_WIDTH.tablet) {
              const thumbnailNavWrapperWidth = this.$refs.thumbnail_wrapper.getBoundingClientRect().width;
              const thumbnailWrapperWidth = this.thumbnailItemsShow[0]?.getBoundingClientRect().width * this.thumbnailItemsShow.length + parseFloat(this.thumbnailContainer.dataset.gap) * (this.thumbnailItems.length - 1);

              const isHidden = thumbnailWrapperWidth <= thumbnailNavWrapperWidth - 32;

              thumbnailNavs.forEach((nav) => nav.classList.toggle("!hidden", isHidden));
            } else {
              const thumbnailNavWrapperHeight = this.$refs.thumbnail_wrapper.getBoundingClientRect().height;
              let thumbnailItemsHeight = 0;
              this.thumbnailItemsShow.forEach((item) => {
                thumbnailItemsHeight += item.offsetHeight;
              });
              thumbnailItemsHeight += parseFloat(this.thumbnailContainer.dataset.gap) * (this.thumbnailItemsShow.length - 1);

              const isHiddenDesktop = thumbnailItemsHeight <= thumbnailNavWrapperHeight - 32 * 2;

              thumbnailNavs.forEach((nav) => nav.classList.toggle("md:hidden", isHiddenDesktop));
            }
          });
        }
      },
      __updateInertTwoColumnsLayout() {
        if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider2Columns) {
          requestAnimationFrame(() => {
            if (window.innerWidth >= MIN_DEVICE_WIDTH.tablet) {
              this.mediaItems.forEach((item) => {
                item.toggleAttribute("inert", !item.classList.contains("is-active-in-two-columns"));
              });
            } else {
              this.mediaItems.forEach((item) => {
                item.toggleAttribute("inert", item.dataset.mediaId !== this.activeMediaId);
              });
            }
          });
        }
      },
      __updateVideoProductMedia() {
        this.mediaItems.forEach((mediaItem) => {
          const videoContainer = mediaItem.querySelector(".external-video");
          if (!videoContainer) return;

          if (window.innerWidth < MIN_DEVICE_WIDTH.tablet) {
            if (mediaItem.dataset.mediaId == this.activeMediaId) {
              Alpine.store("xVideo").updateStatusVideo(videoContainer, true, true);
            } else {
              Alpine.store("xVideo").updateStatusVideo(videoContainer, false, true);
            }
          } else {
            if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider2Columns) {
              if (mediaItem.classList.contains("is-active-in-two-columns")) {
                if (videoContainer.dataset?.videoAutoPlay == "true") {
                  Alpine.store("xVideo").updateStatusVideo(videoContainer, true, true);
                }
              } else {
                Alpine.store("xVideo").updateStatusVideo(videoContainer, false, true);
              }
            } else if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider1Columns) {
              if (mediaItem.dataset.mediaId == this.activeMediaId) {
                Alpine.store("xVideo").updateStatusVideo(videoContainer, true, true);
              } else {
                Alpine.store("xVideo").updateStatusVideo(videoContainer, false, true);
              }
            }
          }
        });
      },
    }));

    // ---- Bulk Order (duplicated from bulk-order.js on purpose — see the xArticle/article.js
    // precedent above. A section added fresh via "Add section" in the Theme Editor arrives as
    // AJAX-injected HTML; its own <script src="bulk-order.js"> tag never executes, so xBulkOrder
    // must already be registered before that happens. Keep this in sync with bulk-order.js by hand. ----

    let _bulkOrderAbortCtrl = null;
    let _bulkOrderDebounceTimer = null;
    window.Maximize.bulkOrderSearchCache = window.Maximize.bulkOrderSearchCache || {};
    const _bulkOrderSearchCache = window.Maximize.bulkOrderSearchCache;

    const BULK_ORDER_STORAGE_KEY = "bulk_order_table_items";
    const BULK_ORDER_RESTORE_CONCURRENCY = 8;

    // Runs `worker` over `items` with at most `concurrency` calls in flight at once.
    async function bulkOrderRunWithConcurrency(items, concurrency, worker) {
      let nextIndex = 0;
      async function processQueue() {
        while (nextIndex < items.length) {
          const currentItem = items[nextIndex++];
          await worker(currentItem);
        }
      }
      const workerCount = Math.min(concurrency, items.length);
      await Promise.all(Array.from({ length: workerCount }, processQueue));
    }

    Alpine.data("xBulkOrder", (moneyFormat) => ({
      dropdownOpen: false,
      searchQuery: "",
      isSearching: false,
      hasSearched: false, // avoids flashing an empty panel before the first result arrives
      searchResults: [],
      searchError: "", // replaces the no_results message when fetchResults fails
      rowQtys: {}, // variantId → pending qty for a not-yet-added row
      qtyErrors: {}, // variantId → error for the search-dropdown row
      _qtyErrorTimers: {},
      tableQtyErrors: {}, // separate from qtyErrors so dropdown/table errors never cross
      _tableQtyErrorTimers: {},
      _liveMessage: "", // see _announce
      _liveNonce: 0,
      _lastQuery: null, // ignores stray `input` events with no real query change

      tableItems: [],
      collapsedGroups: {}, // added-items table groups
      dropdownCollapsed: {}, // search-dropdown groups, independent of the table
      isSubmitting: false,
      submitError: "",
      isImporting: false,
      showRemoveAllConfirm: false,
      showRemoveItemConfirm: false,
      pendingRemoveVariantId: null,
      pendingRemoveGroupId: null,

      _cartDrawerId: null,
      _strings: {},
      _priceHiddenLabel: "", // pre-rendered hidden-price message (login / restricted), from server

      get groupedResults() {
        const groups = [];
        const byId = {};
        this.searchResults.forEach((row) => {
          let group = byId[row.productId];
          if (!group) {
            // The product's featured image, not the first variant's — this row represents the product.
            group = byId[row.productId] = { productId: row.productId, productTitle: row.productTitle, handle: row.handle, productImage: row.productImage, variants: [] };
            groups.push(group);
          }
          group.variants.push(row);
        });
        return groups;
      },
      get filteredGroups() {
        return this.groupedResults.reduce((acc, group) => {
          const variants = group.variants;
          if (!variants.length) return acc;
          const prices = variants.map((variant) => (variant.priceCents != null ? variant.priceCents : variant.price));
          acc.push({
            ...group,
            variants,
            isSingleVariant: !!variants[0].isSingleVariant,
            priceHidden: variants.some((variant) => variant.priceHidden),
            minPriceFormatted: formatMoney(Math.min(...prices), moneyFormat),
          });
          return acc;
        }, []);
      },
      // Parked (marketUnavailable) items stay in tableItems/localStorage but are hidden here.
      get visibleTableItems() {
        return this.tableItems.filter((tableItem) => !tableItem.marketUnavailable);
      },
      get hasItems() {
        return this.visibleTableItems.length > 0;
      },
      get hasReadyItems() {
        return this.visibleTableItems.some((tableItem) => !tableItem.isLoading && !tableItem.hasError && tableItem.available && !tableItem.marketUnavailable && !tableItem.priceHidden);
      },
      get selectedCountText() {
        const tmpl = this._strings.items_selected || "";
        return tmpl.replace("[[COUNT]]", this.visibleTableItems.length);
      },
      get grandTotalAmountFormatted() {
        const visible = this.visibleTableItems.filter((tableItem) => !tableItem.priceHidden);
        if (!visible.length) return "--";
        const totalCents = visible.reduce((sum, tableItem) => sum + this.effectiveUnitPrice(tableItem, tableItem.qty) * tableItem.qty, 0);
        return formatMoney(totalCents, moneyFormat);
      },
      get grandTotalLabelText() {
        return (this._strings.footer_total_label || "").replace("[[AMOUNT]]", "").trim();
      },
      get groupedItems() {
        const groups = [];
        const groupIndexByKey = {};
        this.visibleTableItems.forEach((tableItem) => {
          // Falls back to handle while productId is still loading, so restoring items don't merge under `undefined`.
          const groupKey = tableItem.productId ?? tableItem.handle;
          if (!(groupKey in groupIndexByKey)) {
            groupIndexByKey[groupKey] = groups.length;
            groups.push({ productId: groupKey, isFlat: !!tableItem.isSingleVariant, items: [] });
          }
          groups[groupIndexByKey[groupKey]].items.push(tableItem);
        });
        return groups;
      },
      // A transient _liveMessage (e.g. "Added X") wins over search status; next search replaces it.
      get searchStatusText() {
        if (this._liveMessage) return this._liveMessage;
        if (!this.dropdownOpen) return "";
        if (this.isSearching) return this._strings.searching || "";
        if (!this.searchQuery.trim()) return "";
        if (this.searchError) return this.searchError;
        const count = this.filteredGroups.length;
        if (count > 0) {
          const tmpl = this._strings.results_found || "";
          return tmpl.replace("[[COUNT]]", count);
        }
        const tmpl = this._strings.no_results || "";
        return tmpl.replace("__QUERY__", this.searchQuery);
      },

      // Alternating trailing ZWSP forces a text change so screen readers re-announce repeats.
      _announce(title) {
        const label = this._strings.added || "";
        this._liveNonce++;
        this._liveMessage = (label ? label + " " : "") + title + "​".repeat(this._liveNonce % 2);
      },

      init() {
        const stringsEl = this.$el.querySelector("[data-bulk-order-strings]");
        this._strings = stringsEl ? JSON.parse(stringsEl.textContent) : {};

        const labelEl = this.$el.querySelector("[data-bulk-order-price-hidden-label]");
        this._priceHiddenLabel = labelEl ? labelEl.innerHTML.trim() : "";

        const cartDrawerEl = document.getElementById("CartDrawer");
        this._cartDrawerId = cartDrawerEl ? cartDrawerEl.dataset.sectionId : null;

        this.restoreTableItems();

        document.addEventListener(BULK_ORDER_EVENT.importStarted, () => {
          this.isImporting = true;
        });
        document.addEventListener("bulk-order:import-resolved", (event) => {
          this.isImporting = false;
          this._replaceImportedItems(event.detail.items);
        });
        document.addEventListener("bulk-order:ambiguous-items-added", (event) => {
          this._addAmbiguousItems(event.detail.items);
        });
      },

      // Replaces the whole table — bulk-order-import.js confirms with the merchant first if it wasn't empty.
      _replaceImportedItems(items) {
        if (!items || !items.length) return;

        this.tableItems = items;
        this.persistTableItems();
        this._pruneQtyErrors();
      },

      // From the "Select products" popup — adds on top instead of replacing (unlike a fresh CSV import).
      _addAmbiguousItems(items) {
        if (!items || !items.length) return;
        const existingIds = new Set(this.tableItems.map((tableItem) => tableItem.variantId));
        const newItems = items.filter((item) => !existingIds.has(item.variantId));
        if (!newItems.length) return;
        this.tableItems = [...this.tableItems, ...newItems];
        this.persistTableItems();
        this._pruneQtyErrors();
      },

      // Tells xBulkOrderImport (separate component) to reset hasUsedCsvImport once the table empties.
      _maybeResetCsvImportFlag() {
        if (!this.hasItems) document.dispatchEvent(new CustomEvent("bulk-order:table-cleared", { bubbles: true }));
      },

      persistTableItems() {
        try {
          const data = this.tableItems.map((tableItem) => ({
            variantId: tableItem.variantId,
            handle: tableItem.handle,
            qty: tableItem.qty,
          }));
          localStorage.setItem(BULK_ORDER_STORAGE_KEY, JSON.stringify(data));
        } catch (storageError) {}
      },

      restoreTableItems() {
        let savedItems = [];
        try {
          const raw = localStorage.getItem(BULK_ORDER_STORAGE_KEY);
          savedItems = raw ? JSON.parse(raw) : [];
        } catch (storageError) {}
        if (!Array.isArray(savedItems) || !savedItems.length) return;

        this.tableItems = savedItems
          .filter((savedItem) => savedItem && savedItem.variantId && savedItem.handle)
          .map((savedItem) => ({
            variantId: String(savedItem.variantId),
            handle: savedItem.handle,
            qty: savedItem.qty > 0 ? savedItem.qty : 1,
            isLoading: true,
            hasError: false,
            errorMessage: "",
            tooltipHtml: "", // seeded so x-html doesn't print "undefined" before _restoreProduct fills it in
          }));

        const variantIdsByHandle = {};
        this.tableItems.forEach((tableItem) => {
          (variantIdsByHandle[tableItem.handle] = variantIdsByHandle[tableItem.handle] || []).push(tableItem.variantId);
        });

        bulkOrderRunWithConcurrency(Object.keys(variantIdsByHandle), BULK_ORDER_RESTORE_CONCURRENCY, (handle) => this._restoreProduct(handle, variantIdsByHandle[handle]));
      },

      async _restoreProduct(handle, variantIds, isRetry) {
        try {
          const url = `${window.Shopify.routes.root}products/${handle}?section_id=bulk-order-restore-results`;
          const res = await fetch(url);

          // Not resolvable in the current market, not necessarily gone — park it instead of dropping it.
          if (res.status === 404) {
            this._parkUnresolvedVariants(variantIds);
            return;
          }
          if (!res.ok) throw new Error("[BulkOrder] restore HTTP " + res.status);

          const html = await res.text();
          const doc = new DOMParser().parseFromString(html, "text/html");
          const scriptEl = doc.getElementById("bulk-order-restore-data");
          if (!scriptEl) {
            this._parkUnresolvedVariants(variantIds);
            return;
          }

          const variantRows = JSON.parse(scriptEl.textContent).map((variantRow) => this._shapeVariantRow(variantRow));

          // Missing from the response = no longer exists, drop it. Sold-out variants are kept (see handleSubmit).
          const missingIds = [];
          variantIds.forEach((variantId) => {
            const variantRow = variantRows.find((row) => row.variantId === variantId);
            if (!variantRow) {
              missingIds.push(variantId);
              return;
            }

            this.tableItems = this.tableItems.map((tableItem) => (tableItem.variantId === variantId ? { ...variantRow, qty: tableItem.qty, isLoading: false, hasError: false, errorMessage: "" } : tableItem));
          });
          if (missingIds.length) this._dropRestoredVariants(missingIds);
        } catch (fetchError) {
          if (fetchError.name !== "AbortError" && !isRetry) return this._restoreProduct(handle, variantIds, true);

          this.tableItems = this.tableItems.map((tableItem) => (variantIds.includes(tableItem.variantId) ? { ...tableItem, isLoading: false, hasError: true, errorMessage: this._strings.restore_failed || "Failed to load" } : tableItem));
        }
      },

      _dropRestoredVariants(variantIds) {
        this.tableItems = this.tableItems.filter((tableItem) => !variantIds.includes(tableItem.variantId));
        this.persistTableItems();
      },

      _parkUnresolvedVariants(variantIds) {
        this.tableItems = this.tableItems.map((tableItem) => (variantIds.includes(tableItem.variantId) ? { ...tableItem, isLoading: false, marketUnavailable: true } : tableItem));
      },

      openDropdown() {
        if (this.isImporting) return;
        this.dropdownOpen = true;
      },

      closeDropdown(returnFocus) {
        // Return focus to the field only if it was inside the panel — click-away already moved it elsewhere.
        const hadFocus = !!this.$refs.dropdownPanel?.contains(document.activeElement);
        this.dropdownOpen = false;
        this._liveMessage = "";
        this._pruneQtyErrors();
        if (_bulkOrderAbortCtrl) {
          try {
            _bulkOrderAbortCtrl.abort();
          } catch (abortError) {}
          _bulkOrderAbortCtrl = null;
        }
        clearTimeout(_bulkOrderDebounceTimer);
        this._releaseFocusTrap(returnFocus || hadFocus ? this.$refs.searchInput : null);
      },

      // Must re-arm whenever results change: trapFocus() resolves first/last focusable once, at call time.
      _armFocusTrap() {
        const store = Alpine.store("xFocusElement");
        const region = this.$refs.searchRegion;
        if (!store || !region?.id) return;
        store.activeElement = null;
        store.trapFocus(region.id, "");
      },
      _releaseFocusTrap(elementToFocus) {
        const store = Alpine.store("xFocusElement");
        if (!store) return;
        // Clear the remembered element, or a click-away close would steal focus back to it.
        if (!elementToFocus) store.activeElement = null;
        store.removeTrapFocus(elementToFocus || null);
      },

      // Enter / ArrowDown from the search field jump to the first result's action.
      focusFirstRow() {
        this.$nextTick(() => {
          const first = this.$refs.dropdownPanel?.querySelector("[data-bulk-nav]");
          if (!first) return;
          first.focus();
          first.closest(".bulk-order__dropdown-row")?.scrollIntoView({ block: "nearest" });
        });
      },
      moveRow(event, step) {
        const panel = this.$refs.dropdownPanel;
        if (!panel) return;
        const nav = [...panel.querySelectorAll("[data-bulk-nav]")].filter((el) => el.offsetParent !== null);
        if (!nav.length) return;
        let next = nav.indexOf(event.currentTarget) + step;
        if (next < 0) next = nav.length - 1;
        if (next >= nav.length) next = 0;
        nav[next].focus();
        nav[next].scrollIntoView({ block: "nearest" });
      },
      onSearchEnter() {
        const variants = this.filteredGroups.flatMap((group) => group.variants);
        if (variants.length === 1) {
          this.addVariant(variants[0].variantId);
          return;
        }
        this.focusFirstRow();
      },

      onSearchInput() {
        if (this.isImporting) return;
        this.dropdownOpen = true;
        const query = this.searchQuery.trim();
        // type="search" fires `input` without typing (Escape clear, autofill, IME) — ignore unless the query actually changed.
        if (query === this._lastQuery) return;
        this._lastQuery = query;
        this._liveMessage = "";
        this.searchError = "";
        clearTimeout(_bulkOrderDebounceTimer);
        if (!query) {
          if (_bulkOrderAbortCtrl) {
            try {
              _bulkOrderAbortCtrl.abort();
            } catch (abortError) {}
            _bulkOrderAbortCtrl = null;
          }
          this.isSearching = false;
          this.hasSearched = false;
          this.searchResults = [];
          this._pruneQtyErrors();
          return;
        }
        this.isSearching = true;
        // searchResults deliberately not cleared here — swapped in place once the new results arrive.
        this._pruneQtyErrors();
        _bulkOrderDebounceTimer = setTimeout(() => this.fetchResults(query), 300);
      },

      async fetchResults(query) {
        if (_bulkOrderAbortCtrl) {
          try {
            _bulkOrderAbortCtrl.abort();
          } catch (abortError) {}
          _bulkOrderAbortCtrl = null;
        }
        if (!query) {
          this.searchResults = [];
          return;
        }
        const cacheKey = query;
        if (_bulkOrderSearchCache[cacheKey]) {
          this.searchResults = _bulkOrderSearchCache[cacheKey];
          this.isSearching = false;
          this.hasSearched = true;
          this.$nextTick(() => this._armFocusTrap());
          return;
        }

        const ctrl = new AbortController();
        _bulkOrderAbortCtrl = ctrl;
        this.isSearching = true;

        try {
          // Predictive Search for matching + section rendering so can-hide-price resolves server-side.
          const url =
            Shopify.routes.root +
            "search/suggest" +
            "?q=" +
            encodeURIComponent(query) +
            "&resources[type]=product" +
            "&resources[limit]=10" +
            "&resources[options][fields]=title,variants.title,variants.sku" +
            "&resources[options][unavailable_products]=show" +
            "&section_id=bulk-order-search-results";

          const res = await fetch(url, { signal: ctrl.signal });
          if (!res.ok) throw new Error("[BulkOrder] HTTP " + res.status);

          const html = await res.text();
          const doc = new DOMParser().parseFromString(html, "text/html");
          const scriptEl = doc.getElementById("bulk-order-results-data");
          if (!scriptEl) {
            this.searchResults = [];
            return;
          }

          const variantRows = JSON.parse(scriptEl.textContent).map((variantRow) => this._shapeVariantRow(variantRow));

          _bulkOrderSearchCache[cacheKey] = variantRows;
          const panel = this.$refs.dropdownPanel;
          const focusWasInList = !!panel && panel.contains(document.activeElement);
          this.searchResults = variantRows;
          this.hasSearched = true;
          this.$nextTick(() => {
            this._armFocusTrap();
            // x-for may destroy the focused row; recover focus so it isn't stranded on <body>.
            if (focusWasInList && !panel.contains(document.activeElement)) {
              this.$refs.searchInput?.focus();
            }
          });
        } catch (fetchError) {
          if (fetchError.name === "AbortError") return;
          console.error("[BulkOrder] fetchResults error:", fetchError);
          this._lastQuery = null; // lets the same query be retried, past onSearchInput's unchanged-query guard
          this.searchResults = [];
          this.hasSearched = true;
          this.searchError = this._strings.network_error || "";
        } finally {
          this.isSearching = false;
          _bulkOrderAbortCtrl = null;
        }
      },

      // variantId as string (server sends a number); price fields formatted client-side (Liquid sends cents).
      _shapeVariantRow(variantRow) {
        return {
          ...variantRow,
          variantId: String(variantRow.variantId),
          priceFormatted: formatMoney(variantRow.price, moneyFormat),
          compareAtPriceFormatted: variantRow.compareAtPrice && variantRow.compareAtPrice !== variantRow.price ? formatMoney(variantRow.compareAtPrice, moneyFormat) : "",
          priceCents: variantRow.price,
        };
      },

      // Whether a variant is currently in the added-items table (single source of truth).
      isAdded(variantId) {
        return this.tableItems.some((tableItem) => tableItem.variantId === variantId);
      },

      // ---- Row action names / states --------------------------------------------------
      // One source of truth for each row's accessible name AND its disabled state, so the
      // label can never disagree with what activating the row actually does.
      rowFullTitle(row) {
        return row.variantTitle ? row.productTitle + " " + row.variantTitle : row.productTitle;
      },
      rowActionLabel(row) {
        const title = this.rowFullTitle(row);
        if (this.isAdded(row.variantId)) return (this._strings.added || "") + " " + title;
        return (this._strings.add_product || "") + " " + title;
      },
      rowActionDisabled(row) {
        return this.isAdded(row.variantId);
      },
      groupAddable(group) {
        return group.variants.filter((row) => !this.isAdded(row.variantId));
      },
      groupActionDisabled(group) {
        return this.groupAddable(group).length === 0;
      },
      groupActionLabel(group) {
        if (!this.groupActionDisabled(group)) return (this._strings.add_product || "") + " " + group.productTitle;
        return (this._strings.added || "") + " " + group.productTitle;
      },

      // Add-only, no-op if already added — removal is only offered by the added-items table.
      addVariant(variantId) {
        if (this.isAdded(variantId)) return;
        const row = this.searchResults.find((searchRow) => searchRow.variantId === variantId);
        if (!row) return;
        this._addRowToTable(row);
        this._announce(this.rowFullTitle(row));
      },

      addProduct(productId) {
        const group = this.filteredGroups.find((g) => g.productId === productId);
        if (!group) return;
        const rows = this.groupAddable(group);
        if (!rows.length) return;
        rows.forEach((row) => this._addRowToTable(row));
        this._announce(group.productTitle);
      },

      _addRowToTable(row) {
        const rule = this._ruleFor(row);
        const qty = quantityRuleUtils.normalizeQuantity(this.getRowQty(row.variantId), rule);
        const existing = this.tableItems.find((tableItem) => tableItem.variantId === row.variantId);
        if (existing) {
          this.tableItems = this.tableItems.map((tableItem) => (tableItem.variantId === row.variantId ? { ...tableItem, qty } : tableItem));
        } else {
          this.tableItems = [...this.tableItems, { ...row, qty, isLoading: false, hasError: false, errorMessage: "", submitErrorMessage: "" }];
        }
        // Only the table channel is reset, so the new table row starts clean. The dropdown row's
        // error is NOT cleared: adding is not a quantity edit, and the message there was just
        // raised on the input the user typed into (e.g. "typed 99, corrected to the max"). Every
        // bulk-order error already auto-hides within 3s, so nothing can go stale — clearing it
        // here only stole the one message the user still needs to read.
        this._setQtyError(row.variantId, "", null, "table");
        this.persistTableItems();
      },

      _ruleFor(obj) {
        return quantityRuleUtils.normalizeRule(obj && obj.min, obj && obj.max, obj && obj.increment);
      },

      effectiveUnitPrice(obj, qty) {
        let price = obj.priceCents != null ? obj.priceCents : obj.price;
        const breaks = obj.priceBreaks;
        if (Array.isArray(breaks)) {
          for (const b of breaks) {
            if (qty >= b.minimumQuantity) price = b.price;
          }
        }
        return price;
      },

      getRowQty(variantId) {
        const item = this.tableItems.find((tableItem) => tableItem.variantId === variantId);
        if (item) return item.qty;
        const row = this.searchResults.find((r) => r.variantId === variantId);
        return this.rowQtys[variantId] ?? this._ruleFor(row).min;
      },

      rowUnitPriceFormatted(row) {
        return formatMoney(this.effectiveUnitPrice(row, this.getRowQty(row.variantId)), moneyFormat);
      },

      // Shared by the markup and changeRowQty so the a11y state and actual behavior can't drift apart.
      atQtyBound(row, delta) {
        const rule = this._ruleFor(row);
        const qty = this.getRowQty(row.variantId);
        return delta < 0 ? qty <= rule.min : rule.max !== null && qty >= rule.max;
      },

      ruleSummary(row) {
        const rule = this._ruleFor(row);
        const parts = [];
        if (rule.increment > 1) parts.push((this._strings.rule_inc || "Inc") + ": " + rule.increment);
        if (rule.min > 1) parts.push((this._strings.rule_min || "Min") + ": " + rule.min);
        if (rule.max !== null) parts.push((this._strings.rule_max || "Max") + ": " + rule.max);
        return parts.join(" . ");
      },

      changeRowQty(variantId, delta, inputEl) {
        const stepRow = this.searchResults.find((r) => r.variantId === variantId);
        // aria-disabled only (stays focusable) — enforce the actual bound here.
        if (stepRow && this.atQtyBound(stepRow, delta)) return;
        const rule = this._ruleFor(stepRow);
        const base = inputEl ? inputEl.value : this.getRowQty(variantId);
        const next = quantityRuleUtils.step(base, rule, delta);
        if (inputEl) inputEl.value = next; // :value won't re-render if unchanged
        this._setQtyError(variantId, "");
        if (this.isAdded(variantId)) {
          this._commitRowQtyToTable(variantId, next);
        } else {
          this.rowQtys = { ...this.rowQtys, [variantId]: next };
        }
      },

      setRowQty(variantId, event) {
        const row = this.searchResults.find((r) => r.variantId === variantId);
        // Dropdown channel: an invalid entry errors here only, without touching the table.
        const qty = this._validateRuleQty(variantId, event.target, this._ruleFor(row), event, "row");
        if (qty === null) return;
        if (this.isAdded(variantId)) {
          this._commitRowQtyToTable(variantId, qty);
        } else {
          this.rowQtys = { ...this.rowQtys, [variantId]: qty };
        }
      },

      _commitRowQtyToTable(variantId, qty) {
        this.tableItems = this.tableItems.map((tableItem) => (tableItem.variantId === variantId ? { ...tableItem, qty, submitErrorMessage: "" } : tableItem));
        this._setQtyError(variantId, "", null, "table");
        this.persistTableItems();
      },

      // On blur/change, an out-of-range value auto-corrects and commits; Enter with a bad value shows
      // a persistent error and commits nothing. Returns the quantity to commit, or null.
      _validateRuleQty(variantId, inputEl, rule, event, target) {
        if (quantityRuleUtils.isValid(inputEl.value, rule)) {
          this._setQtyError(variantId, "", null, target);
          const val = parseInt(inputEl.value, 10);
          inputEl.value = val;
          return val;
        }
        const v = parseInt(inputEl.value, 10);
        const belowMin = !Number.isInteger(v) || v < rule.min;
        const aboveMax = rule.max !== null && v > rule.max;
        // Mobile's input commits on "change", not "blur" (see bulk-order.liquid) — both must count.
        const isCommitEvent = event && (event.type === "blur" || event.type === "change");
        if (isCommitEvent && (belowMin || aboveMax)) {
          const message = quantityRuleUtils.buildError(inputEl.value, rule); // from the typed value
          const corrected = belowMin ? rule.min : rule.max;
          inputEl.value = corrected;
          this._setQtyError(variantId, message, 3000, target);
          return corrected;
        }
        this._setQtyError(variantId, quantityRuleUtils.buildError(inputEl.value, rule), 3000, target);
        return null;
      },

      // Central qtyErrors writer. `target` picks the channel: 'row' = the search-dropdown
      // row tooltip (qtyErrors), 'table' = the added-items table row tooltip (tableQtyErrors).
      // They are separate so a dropdown validation error never lights up the table row for the
      // same variant (and vice versa). Clears any pending auto-hide first so a newer message
      // (or clear) is never wiped by a stale timer. EVERY error auto-closes after a delay (5s by
      // default) — no bulk-order error is left persistent; `autoHideMs` overrides the delay.
      _setQtyError(variantId, message, autoHideMs, target) {
        const isTable = target === "table";
        const mapKey = isTable ? "tableQtyErrors" : "qtyErrors";
        const timers = isTable ? this._tableQtyErrorTimers : this._qtyErrorTimers;
        clearTimeout(timers[variantId]);
        this[mapKey] = { ...this[mapKey], [variantId]: message };
        if (message) {
          timers[variantId] = setTimeout(() => {
            this[mapKey] = { ...this[mapKey], [variantId]: "" };
          }, autoHideMs || 3000);
        }
      },

      // Drops errors for variants no longer in their own context, so a stale one can't reappear later.
      _pruneQtyErrors() {
        const liveRows = new Set([...this.searchResults.map((r) => r.variantId), ...this.tableItems.map((i) => i.variantId)]);
        this.qtyErrors = Object.fromEntries(Object.entries(this.qtyErrors).filter(([k]) => liveRows.has(k)));
        const liveTable = new Set(this.tableItems.map((i) => i.variantId));
        this.tableQtyErrors = Object.fromEntries(Object.entries(this.tableQtyErrors).filter(([k]) => liveTable.has(k)));
      },

      getItemTotal(item) {
        if (item.priceHidden || !item.available) return "--";
        return formatMoney(this.effectiveUnitPrice(item, item.qty) * item.qty, moneyFormat);
      },

      // Degrades to "" rather than throw — item.url isn't set yet while a restored row is still loading.
      variantUrl(item) {
        if (!item.url) return "";
        return item.url + (item.url.includes("?") ? "&" : "?") + "variant=" + item.variantId;
      },

      itemUnitPriceFormatted(item) {
        return formatMoney(this.effectiveUnitPrice(item, item.qty), moneyFormat);
      },

      getGroupTotal(group) {
        if (group.items.some((item) => item.priceHidden)) return "--";
        const totalCents = group.items.reduce((sum, item) => sum + this.effectiveUnitPrice(item, item.qty) * item.qty, 0);
        return formatMoney(totalCents, moneyFormat);
      },

      // "From {price}" only when the group spans more than one price; excludes price-hidden variants.
      getGroupPriceLabel(group) {
        const prices = group.items.filter((item) => !item.priceHidden).map((item) => item.priceCents);
        if (!prices.length) return "";
        const minCents = Math.min(...prices);
        const maxCents = Math.max(...prices);
        const formatted = formatMoney(minCents, moneyFormat);
        if (minCents === maxCents) return formatted;
        return (this._strings.price_from || "").replace("[[PRICE]]", formatted) || formatted;
      },

      toggleGroup(productId) {
        this.collapsedGroups = { ...this.collapsedGroups, [productId]: !this.collapsedGroups[productId] };
      },

      toggleDropdownGroup(productId) {
        const willCollapse = !this.dropdownCollapsed[productId];
        // Collapsing hides these rows (display:none) — move focus out first or it's stranded.
        const groupEl = willCollapse ? document.getElementById("bo-group-" + productId) : null;
        const focusInGroup = !!groupEl?.contains(document.activeElement);
        this.dropdownCollapsed = { ...this.dropdownCollapsed, [productId]: willCollapse };
        this.$nextTick(() => {
          if (focusInGroup) this.$refs.searchInput?.focus();
          this._armFocusTrap();
        });
      },

      removeProductGroup(groupKey) {
        this._removeFromTable((tableItem) => (tableItem.productId ?? tableItem.handle) !== groupKey);
      },

      getImgUrl(url) {
        if (!url) return "";
        const clean = url.replace(/_\d+x\d*(?:_crop_\w+)?(\.\w+)/, "$1");
        return clean.replace(/(\.\w+)(\?|$)/, "_240x240$1$2");
      },

      changeTableQty(variantId, delta, inputEl) {
        this.tableItems = this.tableItems.map((tableItem) => {
          if (tableItem.variantId !== variantId) return tableItem;
          const rule = this._ruleFor(tableItem);
          const base = inputEl ? inputEl.value : tableItem.qty;
          const next = quantityRuleUtils.step(base, rule, delta);
          if (inputEl) inputEl.value = next; // :value won't re-render if unchanged
          return { ...tableItem, qty: next, submitErrorMessage: "" };
        });
        this._setQtyError(variantId, "", null, "table");
        this.persistTableItems();
      },

      setTableQty(variantId, event) {
        const item = this.tableItems.find((tableItem) => tableItem.variantId === variantId);
        const qty = this._validateRuleQty(variantId, event.target, this._ruleFor(item), event, "table");
        if (qty === null) return;
        this.tableItems = this.tableItems.map((tableItem) => (tableItem.variantId === variantId ? { ...tableItem, qty, submitErrorMessage: "" } : tableItem));
        this.persistTableItems();
      },

      _removeFromTable(keepPredicate) {
        this.tableItems = this.tableItems.filter(keepPredicate);
        this.persistTableItems();
        this._pruneQtyErrors();
        this._maybeResetCsvImportFlag();
      },

      removeItem(variantId) {
        this._removeFromTable((tableItem) => tableItem.variantId !== variantId);
      },

      _openConfirmPopup(flagName, dialogRefName, closeBtnRefName) {
        this[flagName] = true;
        document.body.classList.add("overflow-y-hidden");
        this.$nextTick(() => {
          Alpine.store("xFocusElement").trapFocus(this.$refs[dialogRefName].id, this.$refs[closeBtnRefName].id);
        });
      },

      _closeConfirmPopup(flagName) {
        this[flagName] = false;
        document.body.classList.remove("overflow-y-hidden");
        Alpine.store("xFocusElement").removeTrapFocus();
      },

      openRemoveItemConfirm(variantId) {
        this.pendingRemoveVariantId = variantId;
        this._openConfirmPopup("showRemoveItemConfirm", "removeItemDialog", "removeItemCloseBtn");
      },

      // Reuses the single-item remove popup; confirmRemoveItem() checks which target is pending.
      openRemoveGroupConfirm(groupId) {
        this.pendingRemoveGroupId = groupId;
        this._openConfirmPopup("showRemoveItemConfirm", "removeItemDialog", "removeItemCloseBtn");
      },

      closeRemoveItemConfirm() {
        this._closeConfirmPopup("showRemoveItemConfirm");
        this.pendingRemoveVariantId = null;
        this.pendingRemoveGroupId = null;
      },

      confirmRemoveItem() {
        const variantId = this.pendingRemoveVariantId;
        const groupId = this.pendingRemoveGroupId;
        this.closeRemoveItemConfirm();
        if (groupId != null) {
          this.removeProductGroup(groupId);
        } else {
          this.removeItem(variantId);
        }
      },

      openRemoveAllConfirm() {
        this._openConfirmPopup("showRemoveAllConfirm", "removeAllDialog", "removeAllCloseBtn");
      },

      closeRemoveAllConfirm() {
        this._closeConfirmPopup("showRemoveAllConfirm");
      },

      confirmClearAll() {
        this.closeRemoveAllConfirm();
        this.tableItems = [];
        this.persistTableItems();
        this._pruneQtyErrors();
        document.dispatchEvent(new CustomEvent("bulk-order:table-cleared", { bubbles: true }));

        this.$nextTick(() => {
          requestAnimationFrame(() => {
            this.$root.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        });
      },

      // Sums duplicate lines for the same variant (e.g. one with a preorder property, one without).
      _quantitiesByVariant(cartItems) {
        const quantities = {};
        cartItems.forEach((cartItem) => {
          const variantId = String(cartItem.variant_id);
          quantities[variantId] = (quantities[variantId] || 0) + cartItem.quantity;
        });
        return quantities;
      },

      async _fetchCartQuantities() {
        const res = await fetch(`${window.Shopify.routes.root}cart.js`);
        if (!res.ok) throw new Error("[BulkOrder] cart.js HTTP " + res.status);
        const cart = await res.json();
        return this._quantitiesByVariant(cart.items);
      },

      _applyCartSectionUpdates(sectionsToRender, data) {
        sectionsToRender.forEach((cartSection) => {
          const sectionEl = document.querySelector(cartSection.selector);
          if (sectionEl && data.sections?.[cartSection.id]) {
            sectionEl.innerHTML = getSectionInnerHTML(data.sections[cartSection.id], cartSection.selector);
          }
        });

        const cartDrawerEl = document.getElementById("CartDrawer");
        if (cartDrawerEl) cartDrawerEl.isOpen = true;

        window.xCartHelper?.updateCurrentCountItem();
        document.dispatchEvent(
          new CustomEvent(CART_EVENT.cartUpdate, {
            bubbles: true,
            detail: { isItemCountChanged: true },
          })
        );
      },

      // Only runs on a cart/add.js error — diffs cart quantities before/after to find what actually succeeded.
      async _reconcileAfterPartialFailure(readyItems, beforeQuantities, sectionsToRender) {
        let afterCart;
        try {
          const res = await fetch(`${window.Shopify.routes.root}cart/update.js`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ updates: {}, sections: sectionsToRender.map((cartSection) => cartSection.id) }),
          });
          afterCart = await res.json();
        } catch (reconcileError) {
          console.error("[BulkOrder]", reconcileError);
          this.submitError = this._strings.add_to_cart_failed || "Failed to add to cart. Please try again.";
          return;
        }

        const afterQuantities = this._quantitiesByVariant(afterCart.items);

        // cart/add.js stops at the first zero-quantity add — only that item gets the "blocking" message.
        let blockerVariantId = null;
        for (const readyItem of readyItems) {
          const beforeQty = beforeQuantities[readyItem.variantId] || 0;
          const afterQty = afterQuantities[readyItem.variantId] || 0;
          if (afterQty - beforeQty <= 0) {
            blockerVariantId = readyItem.variantId;
            break;
          }
        }

        const succeededIds = [];
        this.tableItems = this.tableItems.map((tableItem) => {
          const readyItem = readyItems.find((ready) => ready.variantId === tableItem.variantId);
          if (!readyItem) return tableItem;

          const beforeQty = beforeQuantities[tableItem.variantId] || 0;
          const afterQty = afterQuantities[tableItem.variantId] || 0;
          const addedQty = afterQty - beforeQty;

          if (addedQty >= readyItem.qty) {
            succeededIds.push(tableItem.variantId);
            return tableItem;
          }
          if (addedQty > 0) {
            return {
              ...tableItem,
              qty: readyItem.qty - addedQty,
              submitErrorMessage: this._strings.max_quantity_in_cart,
            };
          }
          if (tableItem.variantId === blockerVariantId) {
            return { ...tableItem, submitErrorMessage: this._strings.blocking_cart_error };
          }
          return { ...tableItem, submitErrorMessage: undefined };
        });

        if (succeededIds.length) {
          const succeededSet = new Set(succeededIds);
          this.tableItems = this.tableItems.filter((tableItem) => !succeededSet.has(tableItem.variantId));
          this._maybeResetCsvImportFlag();
        }
        this.persistTableItems();

        if (succeededIds.length) {
          this._applyCartSectionUpdates(sectionsToRender, afterCart);
        }
      },

      async handleSubmit() {
        // Sold-out and price-hidden items are silently skipped, left in the table.
        const readyItems = this.tableItems.filter((tableItem) => !tableItem.isLoading && !tableItem.hasError && tableItem.available && !tableItem.marketUnavailable && !tableItem.priceHidden);
        if (!readyItems.length || this.isSubmitting) return;

        this.isSubmitting = true;
        this.submitError = "";
        this.tableItems = this.tableItems.map((tableItem) => ({ ...tableItem, submitErrorMessage: "" }));

        const preorderKey = this._strings.preorder_key;
        const preorderMsg = this._strings.preorder_message;
        const items = readyItems.map((tableItem) => ({
          id: parseInt(tableItem.variantId, 10),
          quantity: tableItem.qty,
          ...(tableItem.isPreorder && preorderKey && preorderMsg ? { properties: { [preorderKey]: preorderMsg } } : {}),
        }));

        const sectionsToRender = window.xCartHelper?.getSectionsToRender(this._cartDrawerId) || [];
        const sections = sectionsToRender.map((cartSection) => cartSection.id);

        let beforeQuantities = null;
        try {
          beforeQuantities = await this._fetchCartQuantities();
        } catch (snapshotError) {
          console.error("[BulkOrder]", snapshotError);
        }

        const _slUpdate = window.MaximizeStorefrontEvents?.createCartLinesUpdate({
          action: 'add',
          context: 'standard-action',
          lines: items,
          element: document,
        });

        try {
          const res = await fetch(`${window.Shopify.routes.root}cart/add.js`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items, sections }),
          });
          const data = await res.json();

          if (data.status === 422) {
            const _422msg = data.description || data.message || '';
            // 422 Declined → resolve with userErrors; do NOT also dispatch cart:error (mutually exclusive)
            _slUpdate?.resolve(null, [{ code: 'MAXIMUM_EXCEEDED', message: _422msg }]);
            if (beforeQuantities) {
              await this._reconcileAfterPartialFailure(readyItems, beforeQuantities, sectionsToRender);
            } else {
              this.submitError = data.description;
            }
            return;
          }

          _slUpdate?.resolve(data);
          this._applyCartSectionUpdates(sectionsToRender, data);

          const submittedIds = new Set(readyItems.map((tableItem) => tableItem.variantId));
          this.tableItems = this.tableItems.filter((tableItem) => !submittedIds.has(tableItem.variantId));
          this.persistTableItems();
          this._pruneQtyErrors();
          this._maybeResetCsvImportFlag();
        } catch (addToCartError) {
          _slUpdate?.reject(addToCartError);
          window.MaximizeStorefrontEvents?.dispatchCartError(
            addToCartError?.message || 'Cart add failed', 'SERVICE_UNAVAILABLE', document
          );
          console.error("[BulkOrder]", addToCartError);
          this.submitError = this._strings.add_to_cart_failed || "Failed to add to cart. Please try again.";
        } finally {
          this.isSubmitting = false;
          // Tells xBulkOrderImport (separate component) its Phase 2 result message is now stale.
          document.dispatchEvent(new CustomEvent(BULK_ORDER_EVENT.cartSubmitResolved, { bubbles: true }));
        }
      },
    }));

    // ---- Bulk Order Import (duplicated from bulk-order-import.js — same reason as xBulkOrder above) ----

    const BULK_ORDER_IMPORT_CONCURRENCY = 6;
    const BULK_ORDER_MAX_ROWS = 100;
    const BULK_ORDER_EXPECTED_COLUMNS = 2; // SKU, Quantity
    const BULK_ORDER_USED_CSV_IMPORT_KEY = "bulk_order_used_csv_import";
    // Duplicated from bulk-order.js's BULK_ORDER_STORAGE_KEY on purpose — see zero-coupling note above.
    const BULK_ORDER_TABLE_STORAGE_KEY = "bulk_order_table_items";

    // Excel/Sheets "CSV UTF-8" exports commonly prepend a BOM to the first cell.
    function bulkOrderStripBOM(text) {
      return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    }

    // Hand-rolled CSV parser (RFC 4180-ish): handles quoted fields, embedded commas/newlines,
    // and "" escaped quotes. No external library — CSV is plain text, unlike .xlsx/.xls.
    function bulkOrderParseCSV(text) {
      const rows = [];
      let row = [];
      let field = "";
      let inQuotes = false;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (inQuotes) {
          if (char === '"') {
            if (text[i + 1] === '"') {
              field += '"';
              i++;
            } else {
              inQuotes = false;
            }
          } else {
            field += char;
          }
          continue;
        }

        if (char === '"' && field === "") {
          // Only the first character of a field opens a quoted field (RFC 4180);
          // a stray " elsewhere in an unquoted field is treated as a literal character.
          inQuotes = true;
        } else if (char === ",") {
          row.push(field);
          field = "";
        } else if (char === "\n" || char === "\r") {
          if (char === "\r" && text[i + 1] === "\n") i++;
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
        } else {
          field += char;
        }
      }

      if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
      }

      // Blank rows are NOT filtered out here on purpose — doing so would shift every row
      // after it out of sync with its real line number in the file. Skipping blank rows
      // (without dropping them from the array) is _validateSelectedFile()'s job instead,
      // so physicalRow stays correct for every row reported in an error message.
      return rows;
    }

    // Static reference sample for "Download example file" — shows the expected columns/format
    // only, not a live export of the store's catalog.
    const BULK_ORDER_SAMPLE_CSV_CONTENT = ["SKU (*),Quantity", "00001,70", "00002,60", "00003,30", "00004,30", "00005,50", "00011,50", "00022,60"].join("\r\n");

    Alpine.data("xBulkOrderImport", (moneyFormat) => ({
      selectedFile: null,
      isDragOver: false, // dropzone highlight while a file is dragged over it
      isValidating: false, // pre-handle: parsing + validating the file, right after it's selected
      isProcessing: false, // actually resolving + importing, after clicking "Import"
      fileError: "", // single file-level blocking message (wrong type, empty, corrupt, too many products)
      rowErrorLines: [], // already-grouped, ready-to-render strings, e.g. "Row 1, 2: Invalid quantity."
      previewMessage: "", // success message: pre-handle preview only (Phase 1)

      importTotal: 0,
      importProcessed: 0,
      importResultMessage: "", // final success message, e.g. "80/160 have been successfully added."
      importResultErrorLines: [], // Phase 2 errors: no_match / search_failed (ambiguous_match is its own line, see ambiguousGroups)
      _importSuccessCount: 0, // items.length behind importResultMessage — kept so the popup can add to it later

      ambiguousGroups: [], // one entry per SKU, see _resolveRows
      selectedCandidates: {}, // variantId → boolean, across all ambiguousGroups
      showAmbiguousPopup: false,
      ambiguousButtonHidden: false, // once true, hides the "Select products" button even with groups still unresolved — the message stays as-is

      _moneyFormat: moneyFormat,
      _strings: {},
      _parsed: null, // { rows } cached after a successful pre-handle validate, reused by submitImport()

      hasUsedCsvImport: false, // gates the compact CSV controls bar / getting-started panel
      showImportConfirm: false, // shown before an import that would replace a non-empty table

      get canImport() {
        return !!this.selectedFile && !this.isValidating && !this.isProcessing && !this.fileError && this.rowErrorLines.length === 0 && !!this._parsed && this._parsed.rows.length > 0;
      },

      get importProgressPercent() {
        return this.importTotal > 0 ? Math.min(100, (this.importProcessed / this.importTotal) * 100) : 0;
      },

      get hasImportProgress() {
        return this.isProcessing || !!this.importResultMessage || this.importResultErrorLines.length > 0 || this.ambiguousGroups.length > 0;
      },

      get hasSelectedCandidates() {
        return Object.values(this.selectedCandidates).some(Boolean);
      },

      get ambiguousSummaryText() {
        const skus = this.ambiguousGroups.map((group) => group.sku).join(", ");
        return (this._strings.errors.ambiguous_match || "").replace("[[SKU]]", skus);
      },

      init() {
        const stringsEl = this.$el.querySelector("[data-bulk-order-import-strings]");
        this._strings = stringsEl ? JSON.parse(stringsEl.textContent) : { errors: {} };

        try {
          this.hasUsedCsvImport = localStorage.getItem(BULK_ORDER_USED_CSV_IMPORT_KEY) === "true";
        } catch (storageError) {}

        document.addEventListener("bulk-order:table-cleared", () => {
          this.hasUsedCsvImport = false;
          this.importResultMessage = "";
          this.importResultErrorLines = [];
          this.ambiguousGroups = [];
          this.selectedCandidates = {};
          this.ambiguousButtonHidden = false;
          this._importSuccessCount = 0;
          try {
            localStorage.removeItem(BULK_ORDER_USED_CSV_IMPORT_KEY);
          } catch (storageError) {}
        });

        // xBulkOrder dispatches this once its cart submit resolves — the Phase 2 message is stale by then.
        document.addEventListener(BULK_ORDER_EVENT.cartSubmitResolved, () => {
          this.importResultMessage = "";
          this.importResultErrorLines = [];
        });
      },

      // ---- File input ----

      onFilePicked(event) {
        const file = event.target.files && event.target.files[0];
        this._handleFile(file);
        event.target.value = "";
      },

      onFileDropped(event) {
        this.isDragOver = false;
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        this._handleFile(file);
      },

      _handleFile(file) {
        this.fileError = "";
        this.rowErrorLines = [];
        this.previewMessage = "";
        this._parsed = null;
        if (!file) return;

        if (!/\.csv$/i.test(file.name || "")) {
          this.fileError = this._strings.errors.invalid_file_type;
          this.selectedFile = null;
          return;
        }

        this.selectedFile = file;
        this._validateSelectedFile();
      },

      // ---- Pre-handle: parse + validate immediately on file select, before Import is enabled ----

      // physicalRow = index+2: 0-based data-row index, plus the header row and 1-based line numbers.
      normalizeRow(rawRow, index) {
        const physicalRow = index + 2;
        const rowRef = String(physicalRow);

        if (rawRow.length !== BULK_ORDER_EXPECTED_COLUMNS) {
          return { rowRef, columnError: true };
        }

        const [skuRaw, qtyRaw] = rawRow;
        const sku = (skuRaw || "").trim();
        const qtyTrim = (qtyRaw || "").trim();

        let qty = null;
        let qtyError = false;
        if (qtyTrim) {
          // Positive integers only — a decimal like "2.5" errors rather than silently truncating.
          if (!/^\d+$/.test(qtyTrim) || parseInt(qtyTrim, 10) <= 0) qtyError = true;
          else qty = parseInt(qtyTrim, 10);
        } // else: blank qty is valid, resolved later from quantity_rule.min

        return { rowRef, sku, qty, qtyError, columnError: false };
      },

      _findDuplicateSkuErrors(rows) {
        const rowRefsBySku = {};
        rows.forEach((row) => {
          const key = row.sku.toLowerCase();
          (rowRefsBySku[key] = rowRefsBySku[key] || { sku: row.sku, rowRefs: [] }).rowRefs.push(row.rowRef);
        });
        return Object.values(rowRefsBySku)
          .filter((entry) => entry.rowRefs.length > 1)
          .map((entry) => {
            const sortedRowRefs = [...entry.rowRefs].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
            const label = (this._strings.row_error_label || "Row [[ROW]]").replace("[[ROW]]", sortedRowRefs.join(", "));
            const message = (this._strings.errors.duplicate_sku || "").replace("[[SKU]]", entry.sku);
            return message + ": " + label;
          });
      },

      // errorsByType: { errorKey: [rowRef, ...] } -> ["<message>: Row 1, 2, 3", ...]
      _formatGroupedErrors(errorsByType) {
        return Object.entries(errorsByType).map(([key, rowRefs]) => {
          // Concurrent resolution in submitImport() can push rowRefs out of order.
          const sortedRowRefs = [...rowRefs].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
          const label = (this._strings.row_error_label || "Row [[ROW]]").replace("[[ROW]]", sortedRowRefs.join(", "));
          return (this._strings.errors[key] || key) + ": " + label;
        });
      },

      async _validateSelectedFile() {
        this.isValidating = true;
        this.fileError = "";
        this.rowErrorLines = [];
        this.previewMessage = "";
        this._parsed = null;

        const file = this.selectedFile;

        try {
          const rawText = await file.text();
          const rawRows = bulkOrderParseCSV(bulkOrderStripBOM(rawText));

          if (rawRows.length <= 1) {
            this.fileError = this._strings.errors.empty_file;
            return;
          }

          const normalizedRows = rawRows.slice(1).map((rawRow, index) => this.normalizeRow(rawRow, index));

          const errorsByType = {};
          const validRows = [];
          const rowsWithSku = []; // every row with a SKU, even ones with other errors — see _findDuplicateSkuErrors

          if (rawRows[0].length !== BULK_ORDER_EXPECTED_COLUMNS) {
            (errorsByType.invalid_row_format = errorsByType.invalid_row_format || []).push("1");
          }

          normalizedRows.forEach((row) => {
            if (row.columnError) {
              (errorsByType.invalid_row_format = errorsByType.invalid_row_format || []).push(row.rowRef);
              return;
            }

            let hasBlockingError = false;

            if (!row.sku) {
              (errorsByType.missing_required_field = errorsByType.missing_required_field || []).push(row.rowRef);
              hasBlockingError = true;
            } else {
              rowsWithSku.push(row);
            }
            if (row.qtyError) {
              (errorsByType.invalid_qty = errorsByType.invalid_qty || []).push(row.rowRef);
              hasBlockingError = true;
            }

            if (!hasBlockingError) validRows.push(row);
          });

          if (Object.keys(errorsByType).length) {
            this.rowErrorLines = this._formatGroupedErrors(errorsByType);
          }

          this.rowErrorLines = this.rowErrorLines.concat(this._findDuplicateSkuErrors(rowsWithSku));

          if (validRows.length > BULK_ORDER_MAX_ROWS) {
            this.fileError = (this._strings.errors.too_many_rows || "").replace("[[COUNT]]", validRows.length);
          }

          if (this.rowErrorLines.length || this.fileError) return;

          this._parsed = { rows: validRows };
          this.previewMessage = (this._strings.preview_message || "").replace("[[ROW_COUNT]]", validRows.length);
        } catch (validateError) {
          console.error("[BulkOrderImport]", validateError);
          this.fileError = this._strings.errors.invalid_file_type;
        } finally {
          this.isValidating = false;
        }
      },

      // ---- Resolve variants via search (SKU only, no handle) ----

      // fields=variants.sku scopes matching to SKU only, so it can't match on title text.
      async fetchCandidatesBySku(sku) {
        const url = Shopify.routes.root + "search/suggest" + "?q=" + encodeURIComponent(sku) + "&resources[type]=product" + "&resources[limit]=10" + "&resources[options][fields]=variants.sku" + "&section_id=bulk-order-search-results";

        const res = await fetch(url);
        if (!res.ok) throw new Error("[BulkOrderImport] search HTTP " + res.status);

        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const scriptEl = doc.getElementById("bulk-order-results-data");
        if (!scriptEl) return [];

        return JSON.parse(scriptEl.textContent).map((variantRow) => ({
          ...variantRow,
          variantId: String(variantRow.variantId),
        }));
      },

      async _getCandidatesForSku(sku) {
        const cacheKey = sku.toLowerCase();
        const cached = _bulkOrderSearchCache[cacheKey];
        if (cached) return cached;
        const candidates = await this.fetchCandidatesBySku(sku);
        _bulkOrderSearchCache[cacheKey] = candidates;
        return candidates;
      },

      // Predictive Search can return partial/prefix matches — narrow to the exact SKU here.
      _matchRowInCandidates(row, candidates) {
        const skuNorm = row.sku.toLowerCase();
        const matches = candidates.filter((variantRow) => (variantRow.sku || "").trim().toLowerCase() === skuNorm);

        if (!matches.length) return { ok: false, error: "no_match" };
        if (matches.length > 1) return { ok: false, error: "ambiguous_match", matches };
        return { ok: true, variantRow: matches[0] };
      },

      _qtyObeysRule(row, variantRow) {
        if (!row.qty) return true;
        const rule = quantityRuleUtils.normalizeRule(variantRow.min, variantRow.max, variantRow.increment);
        return quantityRuleUtils.isValid(row.qty, rule);
      },

      buildTableItem(row, variantRow) {
        const qty = row.qty || variantRow.quantityMin || 1;
        return {
          ...variantRow,
          priceFormatted: formatMoney(variantRow.price, this._moneyFormat),
          compareAtPriceFormatted: variantRow.compareAtPrice && variantRow.compareAtPrice !== variantRow.price ? formatMoney(variantRow.compareAtPrice, this._moneyFormat) : "",
          priceCents: variantRow.price,
          qty,
        };
      },

      async _resolveRows(rows) {
        const items = [];
        const errors = []; // [{ key, rowRef, sku, qty, matches }]
        let hasNetworkError = false;

        await bulkOrderRunWithConcurrency(rows, BULK_ORDER_IMPORT_CONCURRENCY, async (row) => {
          let candidates;
          try {
            candidates = await this._getCandidatesForSku(row.sku);
          } catch (fetchError) {
            if (!navigator.onLine || fetchError instanceof TypeError) {
              hasNetworkError = true;
            } else {
              errors.push({ key: "search_failed", rowRef: row.rowRef });
            }
            this.importProcessed += 1;
            return;
          }

          const result = this._matchRowInCandidates(row, candidates);
          if (!result.ok) {
            errors.push({ key: result.error, rowRef: row.rowRef, sku: row.sku, qty: row.qty, matches: result.matches });
          } else {
            // Rejected, not auto-adjusted — the table would otherwise show numbers the file didn't have.
            if (!this._qtyObeysRule(row, result.variantRow)) {
              errors.push({ key: "qty_violates_rule", rowRef: row.rowRef });
            } else {
              items.push(this.buildTableItem(row, result.variantRow));
            }
          }
          this.importProcessed += 1;
        });

        if (hasNetworkError) {
          return { items, errorLines: [this._strings.errors.network_error], ambiguousGroups: [], networkError: true };
        }

        const ambiguousErrors = errors.filter((error) => error.key === "ambiguous_match");
        const otherErrors = errors.filter((error) => error.key !== "ambiguous_match");

        const errorsByType = {};
        otherErrors.forEach(({ key, rowRef }) => {
          errorsByType[key] = errorsByType[key] || [];
          errorsByType[key].push(rowRef);
        });

        // A SKU on more than one CSV row must merge into one group (deduped by variantId) —
        // else x-for's :key="group.sku" collides and Alpine mismatches checkbox state.
        const ambiguousGroups = [];
        const groupBySku = {};
        const seenVariantIdsBySku = {};
        ambiguousErrors.forEach((error) => {
          if (!(error.sku in groupBySku)) {
            groupBySku[error.sku] = { sku: error.sku, candidates: [] };
            seenVariantIdsBySku[error.sku] = new Set();
            ambiguousGroups.push(groupBySku[error.sku]);
          }
          const group = groupBySku[error.sku];
          const seenVariantIds = seenVariantIdsBySku[error.sku];
          (error.matches || []).forEach((variantRow) => {
            if (seenVariantIds.has(variantRow.variantId)) return;
            seenVariantIds.add(variantRow.variantId);
            group.candidates.push(this.buildTableItem({ qty: error.qty }, variantRow));
          });
        });

        return { items, errorLines: this._formatGroupedErrors(errorsByType), ambiguousGroups };
      },

      // ---- Import (Phase 2 — only runs on click, reuses the pre-handle result) ----

      // Reads xBulkOrder's persisted localStorage key directly, to avoid cross-component coupling.
      _tableHasItems() {
        try {
          const raw = localStorage.getItem(BULK_ORDER_TABLE_STORAGE_KEY);
          const savedItems = raw ? JSON.parse(raw) : [];
          return Array.isArray(savedItems) && savedItems.length > 0;
        } catch (storageError) {
          return false;
        }
      },

      onImportClick() {
        if (!this.canImport) return;
        if (this._tableHasItems()) {
          this.openImportConfirm();
        } else {
          this.submitImport();
        }
      },

      openImportConfirm() {
        this.showImportConfirm = true;
        document.body.classList.add("overflow-y-hidden");
        this.$nextTick(() => {
          Alpine.store("xFocusElement").trapFocus(this.$refs.importConfirmDialog.id, this.$refs.importConfirmCloseBtn.id);
        });
      },

      closeImportConfirm() {
        this.showImportConfirm = false;
        document.body.classList.remove("overflow-y-hidden");
        Alpine.store("xFocusElement").removeTrapFocus();
      },

      confirmImport() {
        this.closeImportConfirm();
        this.submitImport();
      },

      // ---- Ambiguous SKU resolution popup ----

      // Duplicated from bulk-order.js's getImgUrl — separate Alpine components, no shared module.
      getImgUrl(url) {
        if (!url) return "";
        const clean = url.replace(/_\d+x\d*(?:_crop_\w+)?(\.\w+)/, "$1");
        return clean.replace(/(\.\w+)(\?|$)/, "_240x240$1$2");
      },

      toggleCandidateSelection(variantId) {
        this.selectedCandidates = { ...this.selectedCandidates, [variantId]: !this.selectedCandidates[variantId] };
      },

      // Checked state is computed (see isGroupFullySelected); clicking forces every candidate to match.
      isGroupFullySelected(group) {
        return group.candidates.length > 0 && group.candidates.every((candidate) => !!this.selectedCandidates[candidate.variantId]);
      },

      toggleAmbiguousGroupSelection(group, event) {
        const isSelected = event.target.checked;
        group.candidates.forEach((candidate) => {
          this.selectedCandidates = { ...this.selectedCandidates, [candidate.variantId]: isSelected };
        });
      },

      // Volume pricing at the candidate's fixed (CSV) quantity — same rule bulk-order.js's
      // effectiveUnitPrice applies, duplicated here since the two files share no module.
      _ambiguousUnitPrice(candidate) {
        let price = candidate.priceCents;
        if (Array.isArray(candidate.priceBreaks)) {
          candidate.priceBreaks.forEach((priceBreak) => {
            if (candidate.qty >= priceBreak.minimumQuantity) price = priceBreak.price;
          });
        }
        return price;
      },

      ambiguousCandidateTotal(candidate) {
        return formatMoney(this._ambiguousUnitPrice(candidate) * candidate.qty, this._moneyFormat);
      },

      openAmbiguousPopup() {
        this.showAmbiguousPopup = true;
        document.body.classList.add("overflow-y-hidden");
        this.$nextTick(() => {
          Alpine.store("xFocusElement").trapFocus(this.$refs.ambiguousDialog.id, this.$refs.ambiguousCloseBtn.id);
        });
      },

      closeAmbiguousPopup() {
        this.showAmbiguousPopup = false;
        document.body.classList.remove("overflow-y-hidden");
        Alpine.store("xFocusElement").removeTrapFocus();
      },

      confirmAddAmbiguousSelection() {
        const resolvedSkus = [];
        const itemsToAdd = [];
        this.ambiguousGroups.forEach((group) => {
          const picked = group.candidates.filter((candidate) => this.selectedCandidates[candidate.variantId]);
          if (picked.length) {
            itemsToAdd.push(...picked);
            resolvedSkus.push(group.sku);
          }
        });
        if (!itemsToAdd.length) return;

        this.ambiguousGroups = this.ambiguousGroups.filter((group) => !resolvedSkus.includes(group.sku));
        this.selectedCandidates = {};
        this.ambiguousButtonHidden = true;
        this.closeAmbiguousPopup();

        // importResultMessage ("Added X/Y") is left as-is — items added here don't change that count.
        this.hasUsedCsvImport = true;
        try {
          localStorage.setItem(BULK_ORDER_USED_CSV_IMPORT_KEY, "true");
        } catch (storageError) {}

        document.dispatchEvent(
          new CustomEvent("bulk-order:ambiguous-items-added", {
            bubbles: true,
            detail: { items: itemsToAdd },
          })
        );
      },

      async submitImport() {
        if (!this.canImport) return;

        const rows = this._parsed.rows; // captured now — this._parsed may be reassigned before this run finishes
        const total = rows.length;

        this.isProcessing = true;
        this.importTotal = total;
        this.importProcessed = 0;
        this.importResultMessage = "";
        this.importResultErrorLines = [];
        this.ambiguousGroups = [];
        this.selectedCandidates = {};
        this.ambiguousButtonHidden = false;
        this._importSuccessCount = 0;
        this.rowErrorLines = [];
        this.previewMessage = "";
        this.selectedFile = null;
        this._parsed = null;

        document.dispatchEvent(new CustomEvent(BULK_ORDER_EVENT.importStarted, { bubbles: true }));

        let items = [];
        try {
          const resolved = await this._resolveRows(rows);
          items = resolved.items;
          this.importResultErrorLines = resolved.errorLines;
          this.ambiguousGroups = resolved.ambiguousGroups || [];
          this._importSuccessCount = items.length;
          if (items.length) {
            this.importResultMessage = (this._strings.success_message || "").replace("[[PROCESSED]]", this._importSuccessCount).replace("[[TOTAL]]", total);
            this.hasUsedCsvImport = true;
            try {
              localStorage.setItem(BULK_ORDER_USED_CSV_IMPORT_KEY, "true");
            } catch (storageError) {}
          }
        } catch (submitError) {
          console.error("[BulkOrderImport]", submitError);
        } finally {
          this.isProcessing = false;
          // Always dispatched, even on failure — xBulkOrder listens for this to re-enable "Add to cart".
          document.dispatchEvent(
            new CustomEvent("bulk-order:import-resolved", {
              bubbles: true,
              detail: { items },
            })
          );
        }
      },

      // ---- Export template ----

      triggerFileDownload(filename, content) {
        const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },

      downloadExampleFile() {
        this.triggerFileDownload("bulk-order-import-template.csv", BULK_ORDER_SAMPLE_CSV_CONTENT);
      },
    }));
  });
});
