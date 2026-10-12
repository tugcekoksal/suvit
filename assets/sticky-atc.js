if (!window.Maximize.loadedScript.includes('sticky-atc.js')) {
  window.Maximize.loadedScript.push('sticky-atc.js');

  requestAnimationFrame(() => {
    const defineStickyAtc = () => {
      Alpine.store('stickyATC', {
        isOpen: false,
        isFooterShow: false,
        isProductInfoOutOfView: false,
        isOpenDetailOnMobile: false,
        _observer: null,
        handleInit(sectionId) {
          if (this._observer) {
            this._observer.disconnect();
            this._observer = null;
          }

          this.scrollY = window.scrollY;
          let contentWrapperEle = document.querySelector(`.section--${sectionId} .product-template__content-wrapper`);
          let mediaWrapperEle = document.querySelector(`.section--${sectionId} .product-template__media-wrapper`);
          let productDetailsEle = document.querySelector(`.section-main-product + .section-product-details product-details`);
          const footerElement = document.getElementById("x-footer");
          const sectionElements = document.querySelectorAll(".x-bundle-section");
          const visibleSections = new Set();

          const observer = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.target.classList.contains('x-bundle-section')) {
                  if (entry.isIntersecting) {
                    visibleSections.add(entry.target);
                  } else {
                    visibleSections.delete(entry.target);
                  }
                }
                else if (entry.target === contentWrapperEle || entry.target === mediaWrapperEle || entry.target === productDetailsEle) {
                  const contentBottom = contentWrapperEle?.getBoundingClientRect().bottom ?? 0;
                  const mediaAndDetailsEl = productDetailsEle || mediaWrapperEle;
                  const mediaAndDetailsBottom = mediaAndDetailsEl?.getBoundingClientRect().bottom ?? 0;

                  if (contentBottom <= mediaAndDetailsBottom && entry.target === mediaAndDetailsEl) {
                    this.isProductInfoOutOfView = !entry.isIntersecting && (mediaAndDetailsBottom < window.innerHeight);
                  } else if (contentBottom > mediaAndDetailsBottom && entry.target === contentWrapperEle) {
                    this.isProductInfoOutOfView = !entry.isIntersecting && (contentBottom < window.innerHeight);
                  }
                } else if (entry.target.id === "x-footer") {
                  this.isFooterShow = entry.isIntersecting;
                }
              });
              const isAnySectionVisible = window.innerWidth < MIN_DEVICE_WIDTH.desktop && visibleSections.size > 0;
              this.isOpen = !this.isFooterShow && this.isProductInfoOutOfView && !isAnySectionVisible;
            },
            {root: null, threshold: 0, rootMargin: "0px 0px -10px 0px"}
          );

          this._observer = observer;

          if (footerElement) {
            observer.observe(footerElement);
          }
          if (productDetailsEle) {
            observer.observe(productDetailsEle);
          } else if (mediaWrapperEle) {
            observer.observe(mediaWrapperEle);
          }
          sectionElements.forEach(el => {
            if (el) observer.observe(el);
          });

          if (contentWrapperEle) observer.observe(contentWrapperEle);
        }
      })

      Alpine.data('xStickyATC', (stickyATCContainerEl, sectionId, hasOnlyDefaultVariant) => ({
        isOpenDetailOnMobile: false,
        isFirstLoading: true,
        isMobile: window.innerWidth < MIN_DEVICE_WIDTH.desktop,
        availableOptions: [],
        variantOptionsEle: [],
        options: [],
        optionsSelectedValues: [],
        init() {
          this.optionElements = this.$el.querySelectorAll(`#StickyAddToCart__Variant__${sectionId} .variant-option`)
          this.optionsSelectedValues = this.updateOptionSelectedValues();

          const isMobile = window.matchMedia(`(max-width: ${MIN_DEVICE_WIDTH.desktop - 1}px`);

          const handleMediaChange = (e) => {
            if (e.matches && !hasOnlyDefaultVariant) {
              this.isMobile = true;
              if (!this.isFirstLoading) Alpine.store("stickyATC").isOpenDetailOnMobile = true;
            } else {
              this.isMobile = false;
              Alpine.store("stickyATC").isOpenDetailOnMobile = false;
            }
          };

          handleMediaChange(isMobile);
          isMobile.addEventListener('change', handleMediaChange);
          this.isFirstLoading = false;
        },
        selectOptionSticky(event) {
          const targetOption = event.currentTarget;
          let position = targetOption.dataset.optionPosition;

          this.optionsSelectedValues[Number(position) - 1] = targetOption.dataset.optionValueId;

          document.dispatchEvent(new CustomEvent(`${STICKY_ATC_EVENT.optionChange}-${sectionId}`, {
            detail: {
              optionsSelectedValues: this.optionsSelectedValues,
              productUrl: targetOption.dataset.productUrl || null
            }
          }));
        },
        updateOptionSelectedValues() {
          const newOptionsSelectedValues = [];

          this.optionElements.forEach((optionEle) => {
            const optionPosition = optionEle.dataset.optionPosition;
            const idx = Number(optionPosition) - 1;
            if (optionEle.classList.contains('selected')) {
              newOptionsSelectedValues[idx] = optionEle.dataset.optionValueId;
            }
          });

          return newOptionsSelectedValues;
        }
      }))
    };
    if (window.Alpine) {
      defineStickyAtc();
    } else {
      document.addEventListener('alpine:init', defineStickyAtc);
    }
  })
}
