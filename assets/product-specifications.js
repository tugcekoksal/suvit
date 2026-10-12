if(window.Maximize.checkFileNotLoaded()) {
  // Cache parsed section documents per fetch URL (shared across spec section instances).
  const specSectionCache = {};

  requestAnimationFrame(() => {
    document.addEventListener("alpine:init", () => {
      Alpine.data("xProductSpecifications", (sectionId, productId, productUrl) => ({
        sectionUpdateController: null,
        init() {
          // Self-update the specification content when the main product variant changes.
          if (!productId || !this.$el.querySelector('.spec-col-content')) return;

          document.addEventListener(`${PRODUCT_EVENT.updatedProductSections}${productId}`, (event) => {
            this.sectionUpdateController?.abort();
            this.sectionUpdateController = new AbortController();
            this.renderSpecContent(event.detail.productUrl || productUrl, event.detail.optionsSelectedValues);
          });
        },
        // Fetch this spec section for the selected option values and replace its content.
        renderSpecContent(productUrl, optionsSelectedValues) {
          const selector = `.section--${sectionId} .spec-col-content`;
          const url = `${productUrl}?option_values=${(optionsSelectedValues || []).join(',')}&section_id=${sectionId}`;
          if (specSectionCache[url]) {
            updateElements(document, specSectionCache[url], selector);
            return;
          }
          fetch(url, { signal: this.sectionUpdateController.signal })
            .then((response) => response.text())
            .then((text) => {
              const doc = new DOMParser().parseFromString(text, 'text/html');
              specSectionCache[url] = doc;
              updateElements(document, doc, selector);
            })
            .catch((error) => {
              if (error.name !== 'AbortError') console.error(error);
            });
        }
      }));
    });
  });
}
