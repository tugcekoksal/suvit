(function () {
  const _s = {
    currentItemCount: 0,
    cartShareUrl: '',
    validated: true,
    openField: '',
    isOpenDiscountCodeMainCart: false,
    isCopiedCart: false,
    pendingUpdates: 0,
  };

  function _dispatch(name, detail) {
    document.dispatchEvent(new CustomEvent(name, {detail}));
  }

  function initCartIconFallback() {
    const cartIcon = document.getElementById('cart-icon');
    if (!cartIcon) return;
    const handleCartClick = (e) => {
      e.preventDefault();
      const isDrawerEnabled = window.Maximize?.isEnableCartDrawer;
      if (isDrawerEnabled) {
        const cartDrawerEl = document.getElementById('CartDrawer');
        if (cartDrawerEl) {
          cartDrawerEl.isOpen = true;
          document.getElementById('CartDrawer__Wrapper')?.classList.add('is-visible');
          if (cartDrawerEl._isOpenUpsell) {
            const upsellEl = cartDrawerEl.querySelector('cart-drawer-upsell');
            if (upsellEl) {
              cartDrawerEl.removeAttribute('upsell-open');
              upsellEl.isOpen = true;
            }
          }
        }
      } else {
        window.location.href = '/cart';
      }
    };
    cartIcon.addEventListener('click', handleCartClick);
    cartIcon.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') handleCartClick(e);
    });
  }

  window.xCartHelper = {
    items: [],

    get currentItemCount() { return _s.currentItemCount; },
    set currentItemCount(v) { _s.currentItemCount = v; },

    get validated() { return _s.validated; },
    set validated(v) { _s.validated = v; },

    get isOpenDiscountCodeMainCart() { return _s.isOpenDiscountCodeMainCart; },
    set isOpenDiscountCodeMainCart(v) { _s.isOpenDiscountCodeMainCart = v; },

    get openField() { return _s.openField; },
    set openField(v) {
      _s.openField = v;
      _dispatch('cart:fieldchange', {field: v});
    },

    get isCopiedCart() { return _s.isCopiedCart; },
    set isCopiedCart(v) {
      _s.isCopiedCart = v;
      _dispatch('cart:copiedchange', {copied: v});
    },

    get isUpdating() { return _s.pendingUpdates > 0; },
    set isUpdating(value) {
      const checkoutBtn = document.querySelector(".cart-drawer__checkout");
      const viewCartBtn = document.querySelector(".cart-drawer__view-cart");
      if (viewCartBtn) viewCartBtn.ariaDisabled = value;
      if (checkoutBtn) checkoutBtn.ariaDisabled = value;
      _s.isUpdating = value;
      },
    beginUpdate() { _s.pendingUpdates++; },
    endUpdate() { _s.pendingUpdates = Math.max(0, _s.pendingUpdates - 1); },

    get cartShareUrl() { return _s.cartShareUrl; },
    set cartShareUrl(v) {
      _s.cartShareUrl = v;
      _dispatch('cart:shareurlchange', {url: v});
    },

    // ── Cart API ──────────────────────────────────────────────────────────

    addItems(items) {
      const cartDrawerEl = document.querySelector('#CartDrawer');
      const sectionId = cartDrawerEl?.dataset.sectionId;
      const sectionsToRender = this.getSectionsToRender(sectionId);
      const sections = sectionsToRender.map(s => s.id);
      this.isUpdating = true;

      const _slUpdate = window.MaximizeStorefrontEvents?.createCartLinesUpdate({
        action: 'add',
        context: 'dialog',
        lines: items,
        element: cartDrawerEl || document,
      });

      fetch(Shopify.routes.root + 'cart/add.js', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Accept: 'application/json'},
        body: JSON.stringify({items, sections}),
      })
        .then(async response => {
          const body = await response.json();
          if (response.status === 422) {
            const msg = body.description || body.message || "";
            _slUpdate?.resolve(null, [{ code: "MAXIMUM_EXCEEDED", message: msg }]);
            return;
          }
          _slUpdate?.resolve(body);
          sectionsToRender.forEach(section => {
            const el = document.querySelector(section.selector);
            if (el && body.sections[section.id]) {
              el.innerHTML = getSectionInnerHTML(body.sections[section.id], section.selector);
            }
          });
          document.dispatchEvent(new CustomEvent(CART_EVENT.cartUpdate, {detail: {openMiniCart: true}}));
        })
        .catch(e => {
          _slUpdate?.reject(e);
          window.MaximizeStorefrontEvents?.dispatchCartError(
            e?.message || 'Cart add failed', 'SERVICE_UNAVAILABLE', cartDrawerEl || document
          );
          console.error(e);
        })
        .finally(() => {
          this.isUpdating = false;
        });
    },

    updateCart(data, needValidate = false) {
      this.isUpdating = true;
      return fetch(Shopify.routes.root + 'cart/update.js', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Accept: 'application/json'},
        body: JSON.stringify(data),
      }).then(() => {
        if (needValidate) this.validateCart();
      }).finally(() => {
        this.isUpdating = false;
      });
    },

    // Unlike updateCart() which discards the response body, reads it
    // so the CartNoteUpdateEvent promise can resolve with current cart state.
    updateCartNote(note, context, element) {
      this.isUpdating = true;
      const _slNote = window.MaximizeStorefrontEvents?.createCartNoteUpdate(note, context, element);
      return fetch(Shopify.routes.root + 'cart/update.js', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Accept: 'application/json'},
        body: JSON.stringify({ note }),
      })
        .then(r => r.json())
        .then(response => {
          _slNote?.resolve(response);
        })
        .catch(err => {
          _slNote?.reject(err);
          window.MaximizeStorefrontEvents?.dispatchCartError(
            err?.message || 'Cart note update failed', 'SERVICE_UNAVAILABLE', element || document
          );
        })
        .finally(() => {
          this.isUpdating = false;
        });
    },

    changeCart(data) {
      return fetch(Shopify.routes.root + 'cart/change.js', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data),
      }).then(r => r.text());
    },

    // ── Validation ────────────────────────────────────────────────────────

    validateCart() {
      this.validated = true;

      const carTerm = document.querySelector(`cart-term`);
      if (carTerm) this.validated = carTerm._isChecked;
      document.dispatchEvent(new CustomEvent(CART_EVENT.validate));
    },

    goToCheckout(e) {
      if (this.isUpdating) {
        e.preventDefault();
        return;
      }
      this.validateCart();

      if (this.validated) {
        fetch(Shopify.routes.root + 'cart/update', {
          method: 'POST',
          headers: {'Content-Type': 'application/json', Accept: 'application/json'},
          body: JSON.stringify({
            attributes: {
              'collection-pagination': null,
              'blog-pagination': null,
              'choose_option_id': null,
              'datetime-updated': null,
              'datetime-created': null,
              [CART_ATTRIBUTES.product_comparison_options]: null,
              [CART_ATTRIBUTES.product_comparison_metafields]: null,
            },
          }),
        });
      } else {
        e.preventDefault();
      }
    },

    // ── Sections ──────────────────────────────────────────────────────────

    getSectionsToRender(sectionId) {
      const sectionsToRender = [
        {id: 'cart-icon-bubble', selector: '#cart-icon-bubble'},
        {id: `${sectionId}`, selector: '.cart__shipping-and-delivery-wrapper'},
      ];

      if (window.Maximize.isCartPage) {
        sectionsToRender.push({id: `${sectionId}`, selector: '#MainCart__Items'});
      } else if (sectionId) {
        sectionsToRender.push({id: `${sectionId}`, selector: '#CartDrawer'});
      }

      return sectionsToRender;
    },

    // ── Share cart ────────────────────────────────────────────────────────

    generateUrl() {
      fetch(Shopify.routes.root + 'cart.js', {
        method: 'GET',
        headers: {'Content-Type': 'application/json'},
      })
        .then(r => r.json())
        .then(response => {
          this.items = response.items;
          const serialize = (obj) =>
            Object.entries(obj)
              .reduce((str, [k, v]) => str.concat(`${encodeURIComponent(k)}:${encodeURIComponent(v.toString())},`), '')
              .slice(0, -1);

          const filteredCart = this.items.map(item => ({id: item.variant_id, quantity: item.quantity}));
          filteredCart.push({share_cart: true});
          this.cartShareUrl = `${window.location.origin}?&${filteredCart.map(serialize).join('&')}`;
        });
    },

    copyURL() {
      const input = document.querySelector('#cart-share');
      if (input) {
        input.select();
        document.execCommand('copy');
        this.isCopiedCart = true;
      }
    },

    handleSharedCart() {
      if (!location.search.includes('share_cart')) return;
      const queryString = window.location.search.substring(1);
      if (!queryString.includes('share_cart:true')) return;

      const pairs = queryString.match(/id:\d+,quantity:\d+/g);
      if (!pairs) return;

      const items = pairs.map(pair => {
        const [idPart, qtyPart] = pair.split(',');
        return {id: Number(idPart.split(':')[1]), quantity: Number(qtyPart.split(':')[1])};
      });

      if (items.length) this.addItems(items);
    },

    // ── UI helpers ────────────────────────────────────────────────────────

    updateCurrentCountItem() {
      const container = document.querySelector('#cart-icon-bubble .cart-bubble__container');
      this.currentItemCount = parseInt(container?.dataset.countItem || 0);
    },

    closeField(isCloseMiniCart = false) {
      this.isCopiedCart = false;
      if (isCloseMiniCart) {
        setTimeout(() => { this.openField = ''; }, DURATION.DRAWER_TRANSITION);
      } else {
        this.openField = '';
      }
    },
  };

  initCartIconFallback();
  // Initialize currentItemCount from server-rendered DOM (script runs deferred, DOM is ready)
  window.xCartHelper.updateCurrentCountItem();
})();
