if(window.Maximize.checkFileNotLoaded()) {
  const _registerShippingPolicy = () => {
    Alpine.data('xShippingPolicy', (wrapperEle, blockId, url, isQuickView = 'false') => ({
        isOpenShippingPolicy: false,
        htmlInner: '',
        pageTitle: '',
        cacheResults: {},
        isLoading: false,
        handleLoadShipping() {
          this.htmlInner = '';
          this.pageTitle = '';
          const textLinkEle = wrapperEle.querySelector('.product-info__shipping-and-tax__text-link');
          textLinkEle?.classList.add('is-loading');
          Alpine.store('xMaximizeDrawer').handleOpen(`#ShippingPolicyDrawer__Container__${blockId}`);
          if (this.cacheResults[url]) {
            this.isOpenShippingPolicy = true;
            const parser = new DOMParser();
            const text = parser.parseFromString(this.cacheResults[url], 'text/html');
            const container = document.querySelector(`#ShippingPolicyPopup__Detail__${blockId}`);
            
            const pageTitleEl = text.querySelector('.shopify-policy__title');
            if (pageTitleEl) {
              this.pageTitle = pageTitleEl.outerHTML;
              pageTitleEl.remove();
            }

            this.htmlInner = text.querySelector('.shopify-policy__container')?.innerHTML ?? '';
            textLinkEle?.classList.remove('is-loading');
  
            if (!container) return;
            container.classList.add('animation-fade-in');
  
            setTimeout(() => {
              container.classList.remove('animation-fade-in');
            }, 100);
          }
          else {
            fetch(url)
              .then(response => response.text())
              .then(data => {
                this.cacheResults[url] = data
                const parser = new DOMParser();
                const text = parser.parseFromString(data, 'text/html');
                const container = document.querySelector(`#ShippingPolicyPopup__Detail__${blockId}`);

                const pageTitleEl = text.querySelector('.shopify-policy__title');
                if (pageTitleEl) {
                  this.pageTitle = pageTitleEl.outerHTML;
                  pageTitleEl.remove();
                }
                
                this.htmlInner = text.querySelector('.shopify-policy__container')?.innerHTML ?? '';
  
                if (!container) return;
                container.classList.add('animation-fade-in');
  
                setTimeout(() => {
                  container.classList.remove('animation-fade-in');
                }, 100);
              })
              .finally(() => {
                this.isOpenShippingPolicy = true;
                textLinkEle?.classList.remove('is-loading');
              })
          }
        },
        closeShippingPopup(closeQuickView = false) {
          this.isOpenShippingPolicy = false;
          let closeAllDrawer = true;
          if (isQuickView == 'true' && (!closeQuickView || window.innerWidth < MIN_DEVICE_WIDTH.tablet)) {
            closeAllDrawer = false
          }
          Alpine.store('xMaximizeDrawer').handleClose(closeAllDrawer);
          if (isQuickView == 'true' && closeQuickView && window.innerWidth >= MIN_DEVICE_WIDTH.tablet) {
            Alpine.store('xQuickView').close();
          }
        }
      }))
  };

  if (window.Alpine) {
    _registerShippingPolicy();
  } else {
    document.addEventListener('alpine:init', _registerShippingPolicy);
  }
}