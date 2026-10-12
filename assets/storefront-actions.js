/**
 * Shopify Standard Actions — Maximize theme configuration
 * Docs: https://shopify.dev/docs/api/storefront-events-and-actions/actions/configure
 *
 * Configures openCart and updateCart so that third-party apps that trigger
 * those actions work with Maximize's cart drawer (not the default /cart redirect).
 *
 * Must run after DOMContentLoaded so the CartDrawer custom element is defined.
 */
document.addEventListener('DOMContentLoaded', function () {
  if (!window.Shopify || !window.Shopify.actions) return;

  // ── openCart ─────────────────────────────────────────────────────────────
  // Open the CartDrawer custom element instead of navigating to /cart.
  if (window.Shopify.actions.openCart) {
    try {
      window.Shopify.actions.openCart.configure({
        handler: function () {
          if (!window.Maximize || !window.Maximize.isEnableCartDrawer) {
            var cartUrl = (window.Maximize && window.Maximize.routes && window.Maximize.routes.cart) || '/cart';
            window.location.href = cartUrl;
            return;
          }
          var cartDrawerEl = document.getElementById('CartDrawer');
          if (cartDrawerEl) {
            cartDrawerEl.isOpen = true;
            var wrapper = document.getElementById('CartDrawer__Wrapper');
            if (wrapper) wrapper.classList.add('is-visible');
          }
        },
      });
    } catch (e) {
      console.warn('[Maximize] Could not configure openCart action:', e);
    }
  }

  // ── updateCart ───────────────────────────────────────────────────────────
  // Route standard action events to the right host element so CartDrawer /
  // product-form custom elements receive them and can show loading states.
  if (window.Shopify.actions.updateCart) {
    try {
      window.Shopify.actions.updateCart.configure({
        eventTarget: function (meta) {
          var type   = meta && meta.type;
          var action = meta && meta.action;

          if (type === 'shopify:cart:lines-update' && action === 'add') {
            return document.querySelector('product-form') || document;
          }
          if (type === 'shopify:cart:lines-update') {
            return document.getElementById('CartDrawer')
              || document.querySelector('#MainCart__Items')
              || document;
          }
          if (type === 'shopify:cart:note-update') {
            return document.querySelector('cart-note') || document;
          }
          if (type === 'shopify:cart:discount-update') {
            return document.querySelector('[data-discount-form]') || document;
          }
          return document;
        },
      });
    } catch (e) {
      console.warn('[Maximize] Could not configure updateCart action:', e);
    }
  }
});
