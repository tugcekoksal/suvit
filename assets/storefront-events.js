/**
 * Shopify Standard Events — Maximize theme integration
 * Docs: https://shopify.dev/docs/api/storefront-events-and-actions/events
 *
 * Exposes window.MaximizeStorefrontEvents with dispatch helpers.
 * Gracefully no-ops when @shopify/standard-events isn't loaded yet.
 *
 * Called from:
 *   - layout/theme.liquid    → dispatchPageView()
 *   - assets/new-cart-helper.js → createCartLinesUpdate()
 *   - assets/product-form.js   → createCartLinesUpdate()
 *   - assets/cart-drawer.js    → createCartLinesUpdate(), createCartNoteUpdate(), dispatchCartView()
 *   - assets/cart.js (Alpine)  → createCartLinesUpdate(), dispatchCartView()
 *   - snippets/main-cart-custom-accordion.liquid → createCartNoteUpdate() (via xCartHelper.updateCartNote)
 *   - assets/variant-picker.js → dispatchProductSelect()
 *   - assets/facets.js         → createSearchUpdate() (search page), createCollectionUpdate() (collection page)
 *   - assets/theme.js          → createSearchUpdate() (predictive search modal)
 *   - <product-view-trigger> CE → dispatchProductView() (main-product, product-three-columns, product-showcase, quick-view)
 *   - x-intersect.once (cart drawer upsell items) → dispatchProductView()
 *   - layout/theme.liquid (collection template) → dispatchCollectionView()
 */
(function () {
  'use strict';

  /**
   * Safe accessor — returns null if StandardEvents isn't loaded yet
   * or doesn't expose the named class.
   */
  function SE(name) {
    return window.StandardEvents?.[name] ?? null;
  }

  // ── _mapCart (shared) ────────────────────────────────────────────────────
  // Map raw Shopify AJAX full-cart response → StandardEventCart.
  // discountField: 'applications' (change.js/cart.js) | 'codes' (update.js)
  function _mapCart(data, discountField) {
    if (!data || typeof data.item_count !== 'number') return null;
    try {
      const currency = data.currency
        || (window.Shopify && window.Shopify.currency && window.Shopify.currency.active)
        || 'USD';
      const discountCodes = discountField === 'codes'
        ? (data.discount_codes || []).map(function (d) { return { code: d.code, applicable: !!d.applicable }; })
        : (data.cart_level_discount_applications || []).map(function (d) { return { code: d.title, applicable: d.total_allocated_amount > 0 }; });
      return {
        id: data.token || null,
        totalQuantity: data.item_count,
        cost: {
          totalAmount: {
            amount: String((data.total_price || 0) / 100),
            currencyCode: currency,
          },
        },
        lines: (data.items || []).map(function (item) {
          return {
            quantity: item.quantity,
            cost: {
              totalAmount: {
                amount: String((item.final_line_price || 0) / 100),
                currencyCode: currency,
              },
            },
          };
        }),
        discountCodes: discountCodes,
      };
    } catch (_) { return null; }
  }

  // ── createCartLinesUpdate ────────────────────────────────────────────────
  /**
   * Dispatch shopify:cart:lines-update BEFORE the fetch, then return a deferred
   * so the caller can resolve/reject once the fetch settles.
   *
   * @param {Object}                          opts
   * @param {'add'|'update'|'remove'}         opts.action
   * @param {'product'|'cart'|'dialog'|'standard-action'} opts.context
   * @param {Array}   opts.lines  add: [{merchandiseId|id (numeric variant id), quantity}]; update/remove: [{id (cart line key), quantity}]
   * @param {Element}                         [opts.element]  event target (defaults to document)
   * @returns {{ resolve: Function, reject: Function } | null}
   */
  function createCartLinesUpdate({ action, context, lines, element }) {
    const Cls = SE('CartLinesUpdateEvent');
    if (!Cls) return null;
    let lineItems = lines || [];

    let deferred;
    try { deferred = Cls.createPromise(); } catch (_) { return null; }

    const payload = {
      action,
      context,
      lines: Array.from(lineItems).map(function (l) {
        if (action === 'add') {
          // add: l.id is a numeric variant ID → convert to GID; l.merchandiseId already a GID
          const mid = l.merchandiseId || (l.id ? 'gid://shopify/ProductVariant/' + l.id : null);
          return { merchandiseId: mid, quantity: Number(l.quantity) || 1 };
        }
        // update / remove: l.id is the cart line item key (e.g. "39779016769669:null")
        return { id: l.id || null, quantity: Number(l.quantity) || 0 };
      }),
      promise: deferred.promise,
    };

    try {
      (element || document).dispatchEvent(new Cls(payload));
    } catch (_) { /* non-fatal */ }

    return {
      /**
       * Call after a cart operation completes — including declined changes (422).
       *
       * Per Shopify spec:
       *   - SUCCESS (change.js / update.js): pass full cart response → cart mapped directly
       *   - SUCCESS (add.js): pass add.js response → auto-fetches /cart.js for full cart state
       *   - DECLINED (422): pass null + userErrors → resolves with { cart: null, userErrors }
       *   - NETWORK FAILURE: call .reject() instead
       *
       * @param {Object|null} rawResponse  raw Shopify AJAX response (null for declined 422)
       * @param {Array}       [userErrors] CartMutationUserError[] — { code, field?, message }
       * @param {Array}       [warnings]   CartMutationWarning[]   — always [] for AJAX API
       */
      resolve: function (rawResponse, userErrors, warnings) {
        function _settle(cart) {
          try {
            deferred.resolve({
              cart: cart,
              // AJAX Cart API has no field path — normalize to CartMutationUserError shape
              userErrors: (userErrors || []).map(function (e) {
                return { code: e.code || '', field: e.field || [], message: e.message || '' };
              }),
              // AJAX Cart API does not return warnings; Storefront GraphQL only
              warnings: warnings || [],
            });
          } catch (_) {}
        }

        if (!rawResponse) { _settle(null); return; }

        if (typeof rawResponse.item_count === 'number') { _settle(_mapCart(rawResponse)); return; }

        // add.js response — has items[] but no item_count; fetch full cart for accurate state
        fetch((window.Shopify && window.Shopify.routes && window.Shopify.routes.root || '/') + 'cart.js')
          .then(function (r) { return r.json(); })
          .then(function (cartData) { _settle(_mapCart(cartData)); })
          .catch(function () { _settle(null); });
      },
      reject: function (err) { try { deferred.reject(err); } catch (_) {} },
    };
  }

  // ── dispatchCartView ─────────────────────────────────────────────────────
  /**
   * Dispatch shopify:cart:view when the cart page or cart drawer becomes visible.
   *
   * @param {'page'|'dialog'}   context
   * @param {Object|null}       cartData  parsed /cart.js response (optional)
   * @param {Element}           [element]
   */
  function dispatchCartView(context, cartData, element) {
    const Cls = SE('CartViewEvent');
    if (!Cls) return;

    let cart = null;
    if (cartData && cartData.item_count > 0) {
      let currency = cartData.currency || (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'USD';
      cart = {
        id: cartData.token || null,
        totalQuantity: cartData.item_count || 0,
        cost: {
          totalAmount: {
            amount: String((cartData.total_price || 0) / 100),
            currencyCode: currency,
          },
        },
        lines: (cartData.items || []).map(function (item) {
          return {
            quantity: item.quantity,
            cost: {
              totalAmount: {
                amount: String((item.final_line_price || 0) / 100),
                currencyCode: currency,
              },
            },
          };
        }),
        discountCodes: (cartData.cart_level_discount_applications || []).map(function (d) {
          return { code: d.title, applicable: d.total_allocated_amount > 0 };
        }),
      };
    }

    try {
      (element || document).dispatchEvent(new Cls({ context: context, cart: cart }));
    } catch (_) {}
  }

  // ── dispatchPageView ─────────────────────────────────────────────────────
  /**
   * Dispatch shopify:page:view once per page load.
   * Called from layout/theme.liquid on DOMContentLoaded.
   */
  function dispatchPageView() {
    let Cls = SE('PageViewEvent');
    if (!Cls) return;
    try {
      let templateMatch = document.body.className.match(/theme-template-(\w+)/);
      document.dispatchEvent(new Cls({
        page: {
          template: templateMatch ? templateMatch[1] : 'unknown',
          title: document.title,
          url: window.location.href,
        },
      }));
    } catch (_) {}
  }

  // ── dispatchProductSelect ────────────────────────────────────────────────
  /**
   * Dispatch shopify:product:select when a buyer changes variant options.
   *
   * @param {Object}       product          { id (numeric or GID), title, handle }
   * @param {Array}        selectedOptions  [{ name, value }]
   * @param {Element}      [element]
   * @param {Object|null}  [variant]        ProductVariant payload (Shopify spec shape); null if no variant matches
   */
  function dispatchProductSelect(product, selectedOptions, element, variant) {
    let Cls = SE('ProductSelectEvent');
    if (!Cls) return;

    let deferred;
    try { deferred = Cls.createPromise(); } catch (_) { return; }

    try {
      (element || document).dispatchEvent(new Cls({
        product: product,
        selectedOptions: selectedOptions || [],
        promise: deferred.promise,
      }));
    } catch (_) {}

    try { deferred.resolve({ variant: variant ?? null }); } catch (_) {}
  }

  // ── dispatchCartError ────────────────────────────────────────────────────
  /**
   * Dispatch shopify:cart:error when a cart operation fails (fetch rejection).
   *
   * @param {string}  error   human-readable message
   * @param {string}  [code]  CartErrorCode enum value (default: 'SERVICE_UNAVAILABLE')
   * @param {Element} [element]
   */
  function dispatchCartError(error, code, element) {
    let Cls = SE('CartErrorEvent');
    if (!Cls) return;
    try {
      (element || document).dispatchEvent(new Cls({
        error: String(error),
        code: code || 'SERVICE_UNAVAILABLE',
      }));
    } catch (_) {}
  }

  // ── createCartDiscountUpdate ─────────────────────────────────────────────
  /**
   * Dispatch shopify:cart:discount-update BEFORE the fetch, then return a deferred
   * so the caller can resolve/reject once the fetch settles.
   *
   * Per Shopify spec, discountCodes is the FULL set replacing existing codes.
   *
   * @param {string[]} discountCodes  full set of codes to apply (empty array = clear all)
   * @param {Element}  [element]      event target (defaults to document)
   * @returns {{ resolve: Function, reject: Function } | null}
   */
  function createCartDiscountUpdate(discountCodes, element) {
    let Cls = SE('CartDiscountUpdateEvent');
    if (!Cls) return null;

    let deferred;
    try { deferred = Cls.createPromise(); } catch (_) { return null; }

    try {
      (element || document).dispatchEvent(new Cls({
        discountCodes: (discountCodes || []).map(function (code) { return { code: String(code) }; }),
        promise: deferred.promise,
      }));
    } catch (_) { /* non-fatal */ }

    return {
      /**
       * Call after the /cart/update.js response settles.
       *
       * Per Shopify spec:
       *   - SUCCESS: pass full cart response → cart mapped directly
       *   - INVALID CODE (non-applicable): still resolve (applicable: false in discountCodes)
       *   - NETWORK FAILURE: call .reject() instead
       *
       * @param {Object|null} rawResponse  raw /cart/update.js response
       * @param {Array}       [userErrors] CartMutationUserError[] — { code, field?, message }
       * @param {Array}       [warnings]   CartMutationWarning[]   — always [] for AJAX API
       */
      resolve: function (rawResponse, userErrors, warnings) {
        // /cart/update.js uses discount_codes field (not cart_level_discount_applications)
        const cart = _mapCart(rawResponse, 'codes');
        try {
          deferred.resolve({
            cart: cart,
            userErrors: (userErrors || []).map(function (e) {
              return { code: e.code || '', field: e.field || [], message: e.message || '' };
            }),
            warnings: warnings || [],
          });
        } catch (_) {}
      },
      reject: function (err) { try { deferred.reject(err); } catch (_) {} },
    };
  }

  // ── createSearchUpdate ───────────────────────────────────────────────────
  /**
   * Dispatch shopify:search:update BEFORE the fetch, then return a deferred
   * so the caller can resolve/reject once the fetch settles.
   *
   * @param {Object}   searchQuery
   * @param {string}   searchQuery.query           raw search term
   * @param {Array}    searchQuery.productFilters  ProductFilter[] (empty for predictive search)
   * @param {string}   searchQuery.sortKey         'RELEVANCE' | 'PRICE'
   * @param {Element}  [element]                   event target (defaults to document)
   * @returns {{ resolve: Function, reject: Function } | null}
   */
  function createSearchUpdate(searchQuery, element) {
    let Cls = SE('SearchUpdateEvent');
    if (!Cls) return null;

    let deferred;
    try { deferred = Cls.createPromise(); } catch (_) { return null; }

    try {
      (element || document).dispatchEvent(new Cls({
        search: {
          query: searchQuery.query || '',
          productFilters: searchQuery.productFilters || [],
          sortKey: searchQuery.sortKey || 'RELEVANCE',
        },
        promise: deferred.promise,
      }));
    } catch (_) { /* non-fatal */ }

    return {
      /**
       * Call after results are available.
       * @param {number} totalCount  total number of products matching the search
       */
      resolve: function (totalCount) {
        try { deferred.resolve({ totalCount: Number(totalCount) || 0 }); } catch (_) {}
      },
      reject: function (err) { try { deferred.reject(err); } catch (_) {} },
    };
  }

  // ── createCollectionUpdate ───────────────────────────────────────────────
  /**
   * Dispatch shopify:collection:update BEFORE the fetch, then return a deferred
   * so the caller can resolve/reject once the fetch settles.
   *
   * @param {Object}   collectionQuery
   * @param {Object}   collectionQuery.collection               { id, handle, productsCount }
   * @param {string|null} collectionQuery.collection.id        GID or null (nullable for built-in collections)
   * @param {string}   collectionQuery.collection.handle       collection handle
   * @param {number}   collectionQuery.collection.productsCount total products before filters (note: plural)
   * @param {Array}    collectionQuery.filters                ProductFilter[]
   * @param {string}   collectionQuery.sort                   CollectionSortKey enum
   * @param {Element}  [element]                              event target (defaults to document)
   * @returns {{ resolve: Function, reject: Function } | null}
   */
  function createCollectionUpdate(collectionQuery, element) {
    let Cls = SE('CollectionUpdateEvent');
    if (!Cls) return null;

    let deferred;
    try { deferred = Cls.createPromise(); } catch (_) { return null; }

    try {
      (element || document).dispatchEvent(new Cls({
        collection: {
          id: (collectionQuery.collection && collectionQuery.collection.id) || null,
          handle: (collectionQuery.collection && collectionQuery.collection.handle) || '',
          productsCount: Number((collectionQuery.collection && collectionQuery.collection.productsCount) || 0),
        },
        filters: collectionQuery.filters || [],
        sort: collectionQuery.sort || 'COLLECTION_DEFAULT',
        promise: deferred.promise,
      }));
    } catch (_) { /* non-fatal */ }

    return {
      /**
       * Call after results are available.
       * @param {number} productsCount  number of products after applying filters/sort
       */
      resolve: function (productsCount) {
        try { deferred.resolve({ productsCount: Number(productsCount) || 0 }); } catch (_) {}
      },
      reject: function (err) { try { deferred.reject(err); } catch (_) {} },
    };
  }

  // ── dispatchProductView ──────────────────────────────────────────────────
  /**
   * Read the pre-built `view-event-payload` attribute from `element` (JSON
   * generated by Shopify's `standard_event_data` Liquid filter) and dispatch
   * shopify:product:view. Fire-and-forget — no promise needed.
   *
   * Used by:
   *   - <product-view-trigger> CE  → main-product, product-three-columns,
   *                                  product-showcase, quick-view
   *   - x-intersect.once on cart drawer upsell items
   *
   * @param {Element} element  element carrying the `view-event-payload` attribute
   */
  function dispatchProductView(element) {
    const Cls = SE('ProductViewEvent');
    if (!Cls) return;
    const raw = element.getAttribute('view-event-payload');
    if (!raw) return;
    let payload;
    try { payload = JSON.parse(raw); } catch (_) { return; }
    try { element.dispatchEvent(new Cls(payload)); } catch (_) {}
  }

  // ── <product-view-trigger> CE ────────────────────────────────────────────
  /**
   * Lightweight custom element that dispatches shopify:product:view once when
   * it connects to the DOM. Works independently of the variant-picker block —
   * fires even when a product has only one default variant or when the merchant
   * has not added a variant-picker block.
   *
   * Timing: placed in product-template.liquid and blocks/_product-details.liquid.
   * - Page load: customElements.define() upgrades all existing elements →
   *   connectedCallback() fires for each.
   * - Quick-view innerHTML replace: new CE instance connects → fires immediately
   *   (define() has already run).
   * The `_fired` flag is a safety guard against double-dispatch on reconnects.
   */
  class ProductViewTrigger extends HTMLElement {
    connectedCallback() {
      if (this._fired) return;
      this._fired = true;
      dispatchProductView(this);
    }
  }
  if (!customElements.get('product-view-trigger')) {
    customElements.define('product-view-trigger', ProductViewTrigger);
  }

  // ── dispatchCollectionView ───────────────────────────────────────────────
  /**
   * Dispatch shopify:collection:view when a buyer navigates to a collection page.
   * Called from layout/theme.liquid on DOMContentLoaded (collection template only).
   *
   * Per Shopify docs: "You can use this to know which collection a buyer is browsing,
   * and how many products are in it. The product count comes with the event, so you
   * can tell a full collection from an empty one without a follow-up request."
   *
   * @param {Object}      data
   * @param {string|null} data.id            Collection GID ("gid://shopify/Collection/…"),
   *                                         or null for built-in collections (e.g. all-products)
   * @param {string}      data.handle        Collection URL handle
   * @param {number}      data.productsCount Total products (collection.all_products_count)
   */
  function dispatchCollectionView(data) {
    const Cls = SE('CollectionViewEvent');
    if (!Cls) return;
    try {
      document.dispatchEvent(new Cls({
        collection: {
          id: data.id || null,
          handle: data.handle || '',
          productsCount: Number(data.productsCount) || 0,
        },
      }));
    } catch (_) {}
  }

  // ── createCartNoteUpdate ─────────────────────────────────────────────────
  /**
   * Dispatch shopify:cart:note-update BEFORE the fetch, then return a deferred
   * so the caller can resolve/reject once the fetch settles.
   *
   * Called via xCartHelper.updateCartNote() from:
   *   - assets/cart-drawer.js  → [data-note-input] textarea (context: 'dialog')
   *   - snippets/main-cart-custom-accordion.liquid → @change on textarea (context: 'cart')
   *
   * @param {string}  note     new note content (empty string = clear note)
   * @param {'cart'|'dialog'|'product'|'standard-action'} context
   * @param {Element} [element]  event target (defaults to document)
   * @returns {{ resolve: Function, reject: Function } | null}
   */
  function createCartNoteUpdate(note, context, element) {
    const Cls = SE('CartNoteUpdateEvent');
    if (!Cls) return null;

    let deferred;
    try { deferred = Cls.createPromise(); } catch (_) { return null; }

    try {
      (element || document).dispatchEvent(new Cls({
        context: context || 'cart',
        note: note || '',
        promise: deferred.promise,
      }));
    } catch (_) { /* non-fatal */ }

    return {
      /**
       * Call after /cart/update.js settles.
       * /cart/update.js returns a full cart → _mapCart works directly.
       * AJAX Cart API has no note validation errors → userErrors always [].
       *
       * @param {Object|null} rawResponse  raw /cart/update.js response
       */
      resolve: function (rawResponse) {
        try {
          deferred.resolve({
            // update.js returns full cart with item_count; discount_codes field
            cart: _mapCart(rawResponse, 'applications'),
            // AJAX Cart API has no note-length validation errors
            userErrors: [],
            // AJAX Cart API does not return warnings; Storefront GraphQL only
            warnings: [],
          });
        } catch (_) {}
      },
      reject: function (err) { try { deferred.reject(err); } catch (_) {} },
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────
  window.MaximizeStorefrontEvents = {
    createCartLinesUpdate: createCartLinesUpdate,
    createCartDiscountUpdate: createCartDiscountUpdate,
    createCartNoteUpdate: createCartNoteUpdate,
    createSearchUpdate: createSearchUpdate,
    createCollectionUpdate: createCollectionUpdate,
    dispatchCartView: dispatchCartView,
    dispatchPageView: dispatchPageView,
    dispatchProductSelect: dispatchProductSelect,
    dispatchCartError: dispatchCartError,
    dispatchProductView: dispatchProductView,
    dispatchCollectionView: dispatchCollectionView,
  };
})();
