if (!customElements.get(`product-info`)) {
  class ProductInfo extends HTMLElement {
    constructor() {
      super();

      this.sectionId = this.dataset.sectionId;
      this.isEnabledStickyContent = this.dataset.enabledStickyContent === 'true';
      if (this.isEnabledStickyContent) {
        this.setStickyHeight();
        window.addEventListener('resize', this.setStickyHeight.bind(this));
        document.addEventListener(`${PRODUCT_EVENT.updatedVariant}${this.sectionId}`, () => {
          this.setStickyHeight();
        });
        if (Shopify.designMode) {
          document.addEventListener("shopify:section:load", (event) => {
            if (!event.target.classList.contains('section-product-details') && !event.target.classList.contains('section-main-product')) return;
            this.setStickyHeight();
          });

          document.addEventListener("shopify:section:reorder", () => {
            this.setStickyHeight();
          });
        }
      }
    }

    setStickyHeight() {
      const contentSideEle = this.querySelector(`.product-template__content-wrapper[data-section-id="${this.sectionId}"]`);
      if (window.innerWidth >= MIN_DEVICE_WIDTH.tablet) {
        requestAnimationFrame(() => {
          let totalHeightMediaSide = 0;
          let totalHeightContentSide = 0;
          document.querySelectorAll(`.product-template__media-wrapper[data-section-id="${this.sectionId}"], .section-main-product + .section-product-details product-details`).forEach((elem) => {
            totalHeightMediaSide += elem.getBoundingClientRect().height;
          });
          const contentSideEle = this.querySelector(`.product-template__content-wrapper[data-section-id="${this.sectionId}"]`)
  
          this.querySelectorAll(`.product-template__content-wrapper[data-section-id="${this.sectionId}"]`).forEach((elem) => {
            totalHeightContentSide += elem.getBoundingClientRect().height;
          });
  
          const contentSideContainerEle = contentSideEle.querySelector(`.product-template__content__container`);
          contentSideEle.style.minHeight = `${totalHeightMediaSide}px`;
          if (totalHeightMediaSide >= contentSideEle.getBoundingClientRect().height) {
            if (contentSideContainerEle) {
              contentSideContainerEle.classList.add(`md:sticky`);
            }
          } else {
            if (contentSideContainerEle) {
              contentSideContainerEle.classList.remove(`md:sticky`);
            }
          }
        })
      } else {
        contentSideEle.style.minHeight = 'auto';
      }
    }
  }

  customElements.define(`product-info`, ProductInfo);
}