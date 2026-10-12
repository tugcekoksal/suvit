if(window.Maximize.checkFileNotLoaded()) {
  // Cache parsed section documents per fetch URL (shared across tab section instances).
  const tabsSectionCache = {};

  requestAnimationFrame(() => {
    document.addEventListener("alpine:init", () => {
      Alpine.data("xProductTabs", (firstBlockId, sectionId, productId, productUrl) => ({
        activeBlock: firstBlockId,
        toggle: false,
        label: '',
        sectionUpdateController: null,
        init() {
          if (Shopify.designMode) {
            document.addEventListener('shopify:block:select', (event) => {
              if (event.detail && event.detail.sectionId == sectionId) {
                this.activeBlock = event.detail.blockId;
                const currentBlock = document.querySelector(`.tabs__${event.detail.blockId}`);
                if (currentBlock) this.setTabActive(currentBlock);
              }
            })
          }

          // Self-update the specification content when the main product variant changes.
          if (productId && this.$el.querySelector('.tabs__content__specification')) {
            document.addEventListener(`${PRODUCT_EVENT.updatedProductSections}${productId}`, (event) => {
              this.sectionUpdateController?.abort();
              this.sectionUpdateController = new AbortController();
              this.renderSpecContent(event.detail.productUrl || productUrl, event.detail.optionsSelectedValues);
            });
          }
        },
        // Fetch this tab section for the selected option values and replace its specification content.
        renderSpecContent(productUrl, optionsSelectedValues) {
          const selector = `.section--${sectionId} .tabs__content__specification`;
          const url = `${productUrl}?option_values=${(optionsSelectedValues || []).join(',')}&section_id=${sectionId}`;
          if (tabsSectionCache[url]) {
            updateElements(document, tabsSectionCache[url], selector);
            return;
          }
          fetch(url, { signal: this.sectionUpdateController.signal })
            .then((response) => response.text())
            .then((text) => {
              const doc = new DOMParser().parseFromString(text, 'text/html');
              tabsSectionCache[url] = doc;
              updateElements(document, doc, selector);
            })
            .catch((error) => {
              if (error.name !== 'AbortError') console.error(error);
            });
        },
        setTabActive(el) {
          this.label = el.dataset.tabTitle;
        }
      }));
    });
  });
}
