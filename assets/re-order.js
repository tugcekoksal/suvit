if (!window.Maximize.loadedScript.includes('re-order.js')) {
  window.Maximize.loadedScript.push('re-order.js');

  requestAnimationFrame(() => {
    const defineXReOrder = () => {
      Alpine.store('xReOrder', {
        show: false,
        orderName: '',
        itemsCart: '',
        itemsCartNew: [],
        errorMessage: false,
        loading: false,
        clearSuccess: false,
        loadingClearCart: false,
        disableReorder: false,
        cartDrawerId: null,
        formatJson(jsonString) {
          let newJsonString = String.raw`${jsonString}`;
          newJsonString = newJsonString.replaceAll('\\', '&#92;');
        
          return JSON.parse(newJsonString);
        },
        load(el, orderName) {
          this.errorMessage = false;
          this.showReorderPopup();
          let data = el.closest('.re-order-action').querySelector('.x-order-data').getAttribute('x-order-data');
          this.orderName = orderName;
          // check value of available 
          this.itemsCart = this.formatJson(data).map((product) => (product.variant_available && product.available ) ? product : { ...product, disable: true } );
          this.disableReorder = this.itemsCart.findIndex((element) => !element.disable) == -1 ? true : false;

          this.itemsCartNew = this.itemsCart;
          this.cartDrawerId = this.getCartDrawerId();
        },
        decodeHtmlEntities(str) {
          const textarea = document.createElement('textarea');
          textarea.innerHTML = str;
          return textarea.value;
        },
        setItemsCart(product) {
          let newItems = [];
          this.itemsCartNew.forEach((cartItem) => {
            if (cartItem.id == product.id && cartItem.variant_id == product.variant_id) {
              cartItem.quantity = product.quantity;
            }
            newItems.push(cartItem);
          });
          this.itemsCartNew = newItems;
        },
        handleAddToCart(el) {
          this.loading = true;
          this.clearSuccess = false;
          let items = [];

          JSON.parse(JSON.stringify(this.itemsCartNew)).filter(itemCart => !itemCart.disable && items.push({ "id": itemCart.variant_id, "quantity": itemCart.quantity }));

          const sectionsToRender = window.xCartHelper.getSectionsToRender(this.cartDrawerId);
          const sections = sectionsToRender.map((s) => s.id);

          const formData = {
            'items': items,
            'sections': sections
          }

          const _slUpdate = window.MaximizeStorefrontEvents?.createCartLinesUpdate({
            action: 'add',
            context: 'dialog',
            lines: items,
            element: document,
          });

          fetch(window.Shopify.routes.root + 'cart/add.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
          }).then((response) => {
            return response.json();
          }).then((response) => {
            if (response.status == '422') {
              const _422msg = response.description || response.message || '';
              _slUpdate?.resolve(null, [{ code: 'MAXIMUM_EXCEEDED', message: _422msg }]);
              const error_message = el.closest('.reorder-popup').querySelector('.cart-warning');
              this.errorMessage = true;
              if (error_message) {
                error_message.textContent = response.description;
              }
              return;
            }
            _slUpdate?.resolve(response);
            this.closeReorderPopup();
            window.xCartHelper.getSectionsToRender(this.cartDrawerId).forEach((section) => {
              const sectionElement = document.querySelector(section.selector);

              if (sectionElement) {
                if (response.sections[section.id]) sectionElement.innerHTML = getSectionInnerHTML(response.sections[section.id], section.selector);
              }
            });
            if (Alpine.store('xQuickView') && Alpine.store('xQuickView').show) {
              Alpine.store('xQuickView').show = false;
            }

            document.getElementById('CartDrawer').isOpen = true;
            window.xCartHelper.updateCurrentCountItem();
            document.dispatchEvent(new CustomEvent(`${CART_EVENT.cartUpdate}`, {
              bubbles: true,
              detail: {
                isItemCountChanged: true,
              }
            }));
          })
          .catch((error) => {
            _slUpdate?.reject(error);
            window.MaximizeStorefrontEvents?.dispatchCartError(
              error?.message || 'Cart add failed', 'SERVICE_UNAVAILABLE', document
            );
            console.error('Error:', error);
          }).finally(() => {
            this.loading = false;
          })
        },
        clearCart() {
          this.loadingClearCart = true;
          this.errorMessage = false;

          // lines: [] — cart/clear.js removes all lines; individual IDs not available here
          const _slClear = window.MaximizeStorefrontEvents?.createCartLinesUpdate({
            action: 'remove',
            context: 'dialog',
            lines: [],
            element: document.getElementById('CartDrawer') || document,
          });

          fetch(window.Shopify.routes.root + "cart/clear.js", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ sections: window.xCartHelper.getSectionsToRender(this.cartDrawerId).map((section) => section.id) }),
          })
            .then((response) => response.json())
            .then((response) => {
              _slClear?.resolve(response);
              this.clearSuccess = true;
              window.xCartHelper.getSectionsToRender(this.cartDrawerId).forEach((section) => {
                const sectionElement = document.querySelector(section.selector);
                if (sectionElement) {
                  if (response.sections[section.id]) sectionElement.innerHTML = getSectionInnerHTML(response.sections[section.id], section.selector);
                }
              });
              window.xCartHelper.updateCurrentCountItem();
              document.dispatchEvent(
                new CustomEvent(`${CART_EVENT.cartUpdate}`, {
                  bubbles: true,
                  detail: {
                    isItemCountChanged: true,
                  },
                })
              );
            })
            .catch((error) => {
              _slClear?.reject(error);
              window.MaximizeStorefrontEvents?.dispatchCartError(
                error?.message || 'Cart clear failed', 'SERVICE_UNAVAILABLE',
                document.getElementById('CartDrawer') || document
              );
              console.error("Error:", error);
            })
            .finally(() => {
              this.loadingClearCart = false;
            });
        },
        showReorderPopup() {
          this.show = true;
          Alpine.store('xMaximizePopup').handleOpen();
        },
        closeReorderPopup() {
          this.show = false;
          this.clearSuccess = false;
          this.errorMessage = false;
          Alpine.store('xMaximizePopup').handleClose();
        },
        getCartDrawerId() {
          const cartDrawer = document.getElementById('CartDrawer');
          if (cartDrawer) {
            return cartDrawer.getAttribute('data-section-id');
          }
          return null;
        }
      });
    };
    if (window.Alpine) {
      defineXReOrder();
    } else {
      document.addEventListener("alpine:init", defineXReOrder);
    }
  });
}
