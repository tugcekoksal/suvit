if (!window.Maximize.loadedScript.includes("recently-viewed.js")) {
  window.Maximize.loadedScript.push("recently-viewed.js");

  requestAnimationFrame(() => {
    const defineXProductRecently = () => {
      Alpine.store("xProductRecently", {
        show: false,
        loading: true,
        productsToShow: 0,
        productsToShowMax: 10,
        listRecentlyProducts: [],
        init() {
          let recentlyProductsStored = localStorage.getItem("recently-viewed") ? localStorage.getItem("recently-viewed") : "[]";
          this.listRecentlyProducts = JSON.parse(recentlyProductsStored);
          const recentlyViewedSection = document.getElementById("RecentlyViewedSection")
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
    };
    if (window.Alpine) {
      defineXProductRecently();
    } else {
      document.addEventListener("alpine:init", defineXProductRecently);
    }
  });
}
