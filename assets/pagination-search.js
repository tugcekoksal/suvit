if (!window.Maximize.loadedScript.includes('pagination-search.js')) {
  window.Maximize.loadedScript.push('pagination-search.js');

  requestAnimationFrame(() => {
    const defineXPaginationSearch = () => {
      Alpine.data("xPaginationSearch", (sectionId) => ({
        loading: false,
        loadData(url, type, isPaginationType) {
          this.loading = true
          fetch(url)
          .then(response => response.text())
          .then(response => {
            const parser = new DOMParser();
            const html = parser.parseFromString(response,'text/html');
            const productGrid = html.getElementById(`ItemsGrid-${type}`);
            let productsOnPage = document.getElementById(`ItemsGrid-${type}`);
            if (productsOnPage && productGrid) {
              if (isPaginationType) {
                productsOnPage.innerHTML = productGrid.innerHTML;
              } else {
                const newProducts = productGrid.getElementsByClassName('grid-item');
                for (let i = 0; i < newProducts.length; i++) {
                  productsOnPage.insertAdjacentHTML('beforeend', newProducts[i].innerHTML);
                }
              }
              if (typeof initializeScrollAnimationTrigger === 'function') initializeScrollAnimationTrigger();
              this._renderButton(html, type);
            }
          })
          .catch(e => {
            console.error(e);
          })
          .finally(() => {
            this.loading = false;
            if (isPaginationType) {
              document.querySelector(".main-search-form__wrapper").scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            }
          })
        } ,
        _renderButton(html, type) {
          const destination = document.getElementById(`btn-pagination-${type}-${sectionId}`);
          const source = html.getElementById(`btn-pagination-${type}-${sectionId}`);
          if (destination && source) {
            destination.innerHTML = source.innerHTML;
          }
        }
      }));
    };
    if (window.Alpine) {
      defineXPaginationSearch();
    } else {
      document.addEventListener("alpine:init", defineXPaginationSearch);
    }
  });
}
