class ProductDetails extends HTMLElement {
  constructor() {
    super();
    this.sectionId = this.dataset.sectionId;
    this.mainProductWrapperEle = document.querySelector(`.section-main-product`);
    this.sectionProductDetails = this.closest('.section-product-details');
    this.minTabletWidth = MIN_DEVICE_WIDTH.tablet;
    this.scrollBarWidth = 3;
    this.defaultPageWidthMargin = '2rem';

    if (this.mainProductWrapperEle && this.parentElement.previousSibling === this.mainProductWrapperEle) {
      this.setupHighlightFeature();
      this.updateProductDetailsMargin();
      this.updateProductDetailsPadding();
    }

    this.classList.remove('hidden');
    window.addEventListener('resize', this.debounce(() => {
      this.updateProductDetailsMargin();
    }, 200));

    if (Shopify.designMode) {
      window.addEventListener('shopify:section:load', (event) => {
        if (this.mainProductWrapperEle && this.parentElement.previousSibling 
            && this.parentElement.previousSibling.id === this.mainProductWrapperEle.id 
            && this.mainProductWrapperEle.id.includes(event.detail.sectionId)
        ) {
          this.updateProductDetailsMargin();
          this.setupHighlightFeature();
        }
      });
      window.addEventListener('shopify:section:reorder', (event) => {
        if (event.detail.sectionId === this.sectionId) {
          this.setupHighlightFeature();
          this.updateProductDetailsPadding();
        }
      });
    }
  }

  setupHighlightFeature() {
    const productInfoEle = this.mainProductWrapperEle.querySelector('.product-template__wrapper');
    const highlightFeatureWrappers = this.querySelectorAll('.product-details__highlight-grid');

    if (!productInfoEle) return;

    var maxGridColumn = "4";
    if (this.mainProductWrapperEle && this.parentElement.previousSibling === this.mainProductWrapperEle) {
      maxGridColumn = productInfoEle.dataset.desktopMediaWidth === 'default' ? "2" : "3";
    }

    highlightFeatureWrappers.forEach(wrapper => {
      wrapper.dataset.maxGridColumn = maxGridColumn;
      wrapper.style.display = 'flex';
    });
  }

  updateProductDetailsMargin() {
    this.mainProductWrapperEle = document.querySelector(`.section-main-product`);
    if (!this.mainProductWrapperEle || !this.sectionProductDetails) return;

    const mainProductContainer = this.mainProductWrapperEle.querySelector('.main-product__container.page-width');
    if (!mainProductContainer) {
      this.sectionProductDetails.style.marginLeft = ''
    } else {
      if (window.innerWidth >= this.minTabletWidth && this.mainProductWrapperEle && this.parentElement.previousSibling === this.mainProductWrapperEle) {
        const marginValue = this.getMarginValue(mainProductContainer);
        if (window.Maximize.rtl) {
          this.sectionProductDetails.style.marginRight = marginValue;
        } else {
          this.sectionProductDetails.style.marginLeft = marginValue;
        }
      } else {
        this.sectionProductDetails.style.marginLeft = '0px';
        this.sectionProductDetails.style.marginRight = '0px';
      }
      this.sectionProductDetails.style.visibility = 'visible';
    }
  }

  updateProductDetailsPadding() {
    if (!this.mainProductWrapperEle || !this.sectionProductDetails) return;

    const mainProductContentWrapper = this.mainProductWrapperEle.querySelector('.product-template__content-wrapper');
    if (!mainProductContentWrapper) return;

    if (this.mainProductWrapperEle && this.parentElement.previousSibling === this.mainProductWrapperEle) {
      this.sectionProductDetails.style.paddingBottom = 
        (window.innerWidth <= this.minTabletWidth) ? '0px' : mainProductContentWrapper.dataset.paddingBottom;
    } else {
      this.sectionProductDetails.style.paddingBottom = '0px';
    }
  }

  getMarginValue(element) {
    const elementRect = element.getBoundingClientRect();
    const computedMargin = window.Maximize.rtl 
      ? window.innerWidth - elementRect.right - this.scrollBarWidth
      : elementRect.left;
      
    return computedMargin !== '0px' ? `calc(` + this.defaultPageWidthMargin + ` + ${computedMargin}px)` : this.defaultPageWidthMargin;
  }

  debounce(func, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }
}

if (!customElements.get('product-details')) {
  customElements.define('product-details', ProductDetails);
}
