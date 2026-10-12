if (!window.Maximize.loadedScript.includes('product-sibling.js')) {
  window.Maximize.loadedScript.push('product-sibling.js');

  requestAnimationFrame(() => {
    const defineXProductSibling = () => {
      Alpine.data("xProductSibling", (sectionId, defaultSelectedValue, isProductPage, linkOption) => ({
        cachedResults: [],
        selectedValue: defaultSelectedValue,
        updateProductInfo(url) {
          if (linkOption == 'redirect') {
            window.location.href = url;
            return
          }
          const link = `${url}`;

          if (this.cachedResults[link]) {
            const html = this.cachedResults[link];
            this.__handleSwapProduct(html);
          } else {
            fetch(link)
              .then((response) => response.text())
              .then((responseText) => {
                const html = new DOMParser().parseFromString(responseText, 'text/html');

                this.__updateTitle(html);
                this.__handleSwapProduct(html);
                this.__handleSwapBreadcrumb(html);
                this.cachedResults[link] = html;
              })
          }
          this.__updateURL(url);
        },
        handleSelectOption(event) {
          const option = event.target;
          this.__changeOption(option);
        },
        handleFocus(event) {
          const optionLabel = event.target;
          if (optionLabel) this.__changeOption(optionLabel);
        },
        __changeOption(optionValue) {
          this.selectedValue = optionValue.dataset.value;
          const targetUrl = optionValue.dataset.productUrl;
          this.updateProductInfo(targetUrl);
        },
        __updateURL(url) {
          if (!isProductPage) return;
          window.history.replaceState({}, '', `${url}`);
        },
        __handleSwapProduct(html) {
          const destination = document.querySelector(`.main-product__container`);
          const source = html.querySelector(`.main-product__container`);

          if (source && destination) destination.innerHTML = source.innerHTML;
        },
        __handleSwapBreadcrumb(html) {
          const destination = document.querySelector(`#Breadcrumbs__${sectionId}`);
          const source = html.querySelector(`#Breadcrumbs__${sectionId}`);
          if (source && destination) destination.innerHTML = source.innerHTML;
        },
        __updateTitle(html) {
          if (!isProductPage) return;
          document.querySelector('head title').textContent = html.querySelector('.product-title').textContent;
        },
      }));
    };
    if (window.Alpine) {
      defineXProductSibling();
    } else {
      document.addEventListener("alpine:init", defineXProductSibling);
    }
  });
}
