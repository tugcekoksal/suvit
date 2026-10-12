if (!window.Maximize.loadedScript.includes("store-locator.js")) {
  window.Maximize.loadedScript.push("store-locator.js");

  requestAnimationFrame(() => {
    const defineXStoreLocator = () => {
      Alpine.data('xStoreLocator', (sectionId, activeBlockId, autoSelectFirstStore) => ({
        show: false,
        active: activeBlockId,
        currentSelected: JSON.parse(localStorage.getItem("currentStoreSelected"))?.currentSelected || false,
        selectedStore: "",
        init() {
          const currentSelectedStore = this.currentSelected ? this.currentSelected : (autoSelectFirstStore ? activeBlockId : false);
          const currentCheckbox = document.getElementById(`Checkbox__${sectionId}-${currentSelectedStore}`);
          if (currentCheckbox) {
            this.currentSelected = currentSelectedStore;
            this.selectedStore = currentCheckbox.dataset.storeName;
            Alpine.store('xStoreMap').currentStoreSelected = this.selectedStore;
            localStorage.setItem('currentStoreSelected', JSON.stringify({ selectedStore: this.selectedStore, currentSelected: this.currentSelected }));
            document.dispatchEvent(new CustomEvent('maximize:store-changed', { detail: { store: this.selectedStore } }));
          }

          // Set fix height content on tablet and desktop 
          const storeLocatorContentEl = this.$el.querySelector('.store-locator__content');
          const tabletMediaQuery = window.matchMedia(`(min-width: ${MIN_DEVICE_WIDTH.tablet}px)`);

          const handleMediaChange = (e) => {

            if (!storeLocatorContentEl || !this.show) return;
            if (e.matches) {
              // Width is >= tablet
              storeLocatorContentEl.style.height = `${storeLocatorContentEl.getBoundingClientRect().height}px`
            } else {
              // Width is < tablet
              storeLocatorContentEl.style.height = '';
            }
          };
          
          if (storeLocatorContentEl) {
            tabletMediaQuery.addEventListener('change', handleMediaChange);
          }

          // Event click map icon to open popup
          document.addEventListener(`${STORE_MAP_EVENT.openPopup}`, (e) => {
            this.openStoreLocatorPopup();
            setTimeout(() => {
              handleMediaChange(tabletMediaQuery)
            }, 300)
          });

          // Check section selected
          if (Shopify.designMode) {
            document.addEventListener('shopify:section:select', (event) => {
              if (event.target.classList.contains('section-store-locator')) {
                this.openStoreLocatorPopup();
              }
            })
          }
        },
        openStoreLocatorPopup() {
          this.show = true;
          Alpine.store("xMaximizePopup").handleOpen();
          Alpine.store("xMaximizeDrawer").activeDrawerElement = window.Maximize.isShowPopupOverlay;
        },
        closeStoreLocatorPopup() {
          if (this.currentSelected === false) {
            localStorage.removeItem("currentStoreSelected");
            Alpine.store('xStoreMap').currentStoreSelected = "";
            document.dispatchEvent(new CustomEvent('maximize:store-changed', { detail: { store: '' } }));
          }
          this.show = false;
          Alpine.store("xMaximizePopup").handleClose();
        },
        toggleSelected(el, currentSelected) {
          this.currentSelected = this.currentSelected == currentSelected ? false : currentSelected;
          this.selectedStore = this.currentSelected ? el.dataset.storeName : "";
        },
        setSelectedStore() {
          if (this.currentSelected) {
            Alpine.store('xStoreMap').currentStoreSelected = this.selectedStore;
            localStorage.setItem("currentStoreSelected", JSON.stringify({ selectedStore: this.selectedStore, currentSelected: this.currentSelected }));
            document.dispatchEvent(new CustomEvent('maximize:store-changed', { detail: { store: this.selectedStore } }));
            this.closeStoreLocatorPopup();
          }
        },
        isItemPartiallyVisible(el) {
          const itemEl = el.closest('.store-locator__content__item') || el;
          const listItemsEl = window.innerWidth >= MIN_DEVICE_WIDTH.tablet ? el.closest('.store-locator__content') : el.closest('.store-locator__wrapper');
          if (!itemEl || !listItemsEl) return;
  
          const itemRect = itemEl.getBoundingClientRect();
          const listItemsRect = listItemsEl.getBoundingClientRect();
  
          const verticallyVisible = itemRect.bottom > listItemsRect.top && itemRect.top < listItemsRect.bottom;
          const horizontallyVisible = itemRect.right > listItemsRect.left && itemRect.left < listItemsRect.right;
  
          return verticallyVisible && horizontallyVisible;
        },
        toggleActive(id) {
          this.active = this.active === id ? null : id;
        }
      }))
    };
    if (window.Alpine) {
      defineXStoreLocator();
    } else {
      document.addEventListener("alpine:init", defineXStoreLocator);
    }
  });
}
