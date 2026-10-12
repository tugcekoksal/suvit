/**
 * Shared by quick-order-list.js and order-view.js: lazy per-page variant fetching and the raw
 * cart/add.js POST. Business state (cache, qty, reconcile logic) stays in each caller.
 *
 * Plain functions, not window/module exports: no bundler here, and every classic <script> shares
 * one global scope — a top-level `function` is visible by name to both callers, and (unlike
 * `const`/`let`) redeclaring one when the theme editor re-renders a block/section isn't an error.
 */

/**
 * `root` must contain `.variant-loader-body`, `.variant-loader-spinner`, `.variant-loader-error`
 * (starts `hidden`) and (once paginated) `.variant-pagination` — shared class names, so no
 * per-caller selector config is needed.
 *
 * @param {object} options
 * @param {Element} options.root - Group/card element containing the loader's markup
 * @param {string} options.productUrl - `{{ product.url }}` of the product being loaded
 * @param {string} options.sectionId - Section to fetch (quick-order-list-variants / order-view-variants)
 * @param {Map} options.cache - Page number -> fetched inner HTML, owned by the caller
 * @param {string} options.failedMessage - Shown in `.variant-loader-error` if a fetch fails
 * @param {() => void} options.onRender - Called after a page's HTML lands in the body
 * @returns {{ load: (page: number) => Promise<void> }}
 */
function createLazyVariantLoader({ root, productUrl, sectionId, cache, failedMessage, onRender }) {
  let loading = false;
  let pendingPage = null;

  const bodyEl = () => root.querySelector(".variant-loader-body");
  const spinnerEl = () => root.querySelector(".variant-loader-spinner");
  const errorEl = () => root.querySelector(".variant-loader-error");
  const setBusy = (state) => {
    const spinner = spinnerEl();
    if (spinner) spinner.hidden = !state;
    root.querySelector(".variant-pagination")?.setAttribute("aria-busy", String(state));
  };

  const render = (html) => {
    const body = bodyEl();
    if (!body) return;
    body.innerHTML = html;
    const error = errorEl();
    if (error) error.hidden = true;
    onRender();
  };

  async function load(page) {
    const body = bodyEl();
    if (!body || !productUrl) return;

    const cached = cache.get(page);
    if (typeof cached === "string") {
      render(cached);
      return;
    }

    // A click during an in-flight load is remembered, not dropped.
    if (loading) {
      pendingPage = page;
      return;
    }

    loading = true;
    setBusy(true);

    try {
      const separator = productUrl.indexOf("?") === -1 ? "?" : "&";
      const response = await fetch(`${productUrl}${separator}section_id=${sectionId}&page=${page}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const inner = getSectionInnerHTML(html, ".variant-loader-inner") || "";
      cache.set(page, inner);
      render(inner);
    } catch (error) {
      console.error(`[${sectionId}] failed to load variants:`, error);
      body.innerHTML = "";
      const err = errorEl();
      if (err) {
        err.hidden = false;
        err.textContent = failedMessage || "Something went wrong. Please try again.";
      }
    } finally {
      loading = false;
      setBusy(false);

      const pending = pendingPage;
      pendingPage = null;
      if (pending && pending !== page) load(pending);
    }
  }

  return { load };
}

// Callers keep their own status-check/reconcile logic on top of the raw response.
function postCartAdd(items, sections) {
  return fetch(window.Shopify.routes.root + "cart/add.js", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ items, sections }),
  }).then((r) => r.json());
}

// Inventory and cart-headroom are independent ceilings — the smaller wins. `null` = no limit.
function computeMaxQty({ ruleMax, inventoryMax, cartQty }) {
  const inventoryCeiling = inventoryMax === null ? Infinity : inventoryMax;
  if (ruleMax === null) return inventoryCeiling;
  return Math.min(ruleMax - cartQty, inventoryCeiling);
}
