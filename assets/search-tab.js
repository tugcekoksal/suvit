requestAnimationFrame(() => {
  document.addEventListener("alpine:init", () => {
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
              if (typeof initializeScrollAnimationTrigger === 'function') initializeScrollAnimationTrigger();
            }

            if (resultCountElement) {
              this.articleCount = Number(resultCountElement.innerHTML);
            } else {
              this.articleCount = 0;
            }
          })
          .catch((error) => {
            console.error( error);
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
                if (typeof initializeScrollAnimationTrigger === 'function') initializeScrollAnimationTrigger();
              }
            } else {
              const msgNoResult = text.querySelector(".msg-no-result");
              if (collectionWrapper && msgNoResult) {
                collectionWrapper.style.display = "block"
                collectionWrapper.innerHTML = msgNoResult.innerHTML
              }
            }

            this.collectionCount = listCollections.length || 0;
          })
          .catch((error) => {
            console.error(error);
          });
      },
    }));
  });
});
