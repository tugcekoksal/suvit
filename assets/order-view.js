/**
 * B2B order view — one custom element per product card of the collection "Quick order" layout.
 * Custom element, not Alpine: facets re-renders the grid via innerHTML, and custom elements
 * upgrade themselves through that with no re-init hook needed.
 * Quantities are staged in memory and sent only on "Add to cart" (unlike the product-page quick
 * order list, which writes every keystroke to the cart). Variant rows fetch lazily, 250 per page,
 * and stay cached once fetched.
 */
if (window.Maximize.checkFileNotLoaded()) {
  (() => {
  if (window.customElements.get("order-view-card")) return;

  const VARIANTS_SECTION_ID = "order-view-variants";
  const CART_UPDATE_EVENT = typeof CART_EVENT !== "undefined" ? CART_EVENT.cartUpdate : "maximize:cart:updated";
  // Listened for by the Alpine `x-data` on <order-view-card> — see snippets/order-view-row.liquid.
  const ADDED_EVENT = typeof ORDER_VIEW_EVENT !== "undefined" ? ORDER_VIEW_EVENT.added : "maximize:order-view:added";

  // Every message on this surface clears itself: a stale warning outlives the quantity it was
  // about, and the card collapses out of view where nothing would dismiss it by hand.
  const QTY_RULE_ERROR_HIDE_MS = 3000; // matches the product-page quick order list
  const CART_ERROR_HIDE_MS = 5000;

  // Every card on the page hears the same cart-updated event; they share one request.
  let cartQuantitiesRequest = null;
  const fetchCartQuantities = () => {
    if (cartQuantitiesRequest) return cartQuantitiesRequest;
    cartQuantitiesRequest = fetch(`${window.Shopify.routes.root}cart.js`)
      .then((response) => response.json())
      .then((cart) => {
        const quantities = {};
        (cart.items || []).forEach((item) => {
          quantities[item.variant_id] = (quantities[item.variant_id] || 0) + item.quantity;
        });
        return quantities;
      })
      .catch((error) => {
        console.error("[OrderView] failed to read cart quantities:", error);
        return null;
      })
      .finally(() => {
        cartQuantitiesRequest = null;
      });
    return cartQuantitiesRequest;
  };

  const toInt = (value, fallback = 0) => {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : fallback;
  };

  // Guarded fallback in case theme.js's formatMoney hasn't loaded yet.
  const money = (cents, format) =>
    typeof window.formatMoney === "function" ? window.formatMoney(cents, format) : (cents / 100).toFixed(2);

  class OrderViewCard extends HTMLElement {
    connectedCallback() {
      // Outside the guard below: a reconnected element has already been through it, but its
      // listener was dropped on disconnect. Re-adding the same reference is a no-op.
      // `cartQty` comes from a Liquid render, so removing a line anywhere else (mini cart, cart
      // page) would otherwise leave this card enforcing a ceiling that no longer applies.
      if (!this._boundCartUpdate) this._boundCartUpdate = () => this._syncCartQuantities();
      document.addEventListener(CART_UPDATE_EVENT, this._boundCartUpdate);

      if (this._initialised) return;
      this._initialised = true;

      // variantId -> {price, breaks, rule, available, cartQty, inventoryMax}
      this.rows = new Map();
      // variantId -> staged quantity
      this.staged = new Map();
      // page number -> innerHTML of .variant-loader-inner
      this.pages = new Map();
      this.currentPage = 1;
      this._variantsLoaded = false;

      this._submitting = false;
      this._errorTimers = {}; // variantId -> auto-hide timer for the plain row-error fallback
      this._qtyRuleErrorTimers = {}; // variantId -> auto-hide timer for the quantity-rule popup
      this._cartErrorTimers = {}; // variantId -> auto-hide timer for the row's cart error
      this._cardErrorTimer = null; // auto-hide timer for the card-level error

      this.totalEl = this.querySelector(".order-view__card-total");
      this.atcEl = this.querySelector(".order-view__atc");
      this.cardErrorEl = this.querySelector(".order-view__card-error");

      const list = this.closest(".order-view-list");
      this.moneyFormat = (list && list.dataset.moneyFormat) || "";
      this.strings = {
        maxInCart: (list && list.dataset.strMaxInCart) || "",
        addFailed: (list && list.dataset.strAddFailed) || "",
        maxAvailable: (list && list.dataset.strMaxAvailable) || "",
      };

      this._variantLoader = createLazyVariantLoader({
        root: this,
        productUrl: this.productUrl,
        sectionId: VARIANTS_SECTION_ID,
        cache: this.pages,
        failedMessage: this.strings.addFailed,
        onRender: () => {
          this._scanRows();
          this._updateTotals();
        },
      });

      this.addEventListener("click", this._onClick);
      this.addEventListener("change", this._onChange);
      this.addEventListener("keydown", this._onKeydown);

      this._scanRows();
      this._updateTotals();
    }

    // Called from the Alpine `@click` in order-view-row.liquid on first expand.
    _ensureVariantsLoaded() {
      if (this._variantsLoaded) return;
      this._variantsLoaded = true;
      this._variantLoader.load(this.currentPage);
    }

    // A facets re-render replaces the whole grid, so a card can leave mid-countdown.
    disconnectedCallback() {
      document.removeEventListener(CART_UPDATE_EVENT, this._boundCartUpdate);
      Object.values(this._errorTimers).forEach(clearTimeout);
      Object.values(this._qtyRuleErrorTimers).forEach(clearTimeout);
      Object.values(this._cartErrorTimers).forEach(clearTimeout);
      clearTimeout(this._cardErrorTimer);
      this._errorTimers = {};
      this._qtyRuleErrorTimers = {};
      this._cartErrorTimers = {};
      this._cardErrorTimer = null;
    }

    /* ------------------------------------------------------------------ state */
    /* Accessors, not plain fields: assigning the state IS what updates the DOM. */

    get productUrl() {
      return this.dataset.productUrl || "";
    }

    get submitting() {
      return this._submitting;
    }

    set submitting(state) {
      this._submitting = state;
      this.classList.toggle("is-submitting", state);
      if (this.atcEl) {
        this.atcEl.setAttribute("aria-busy", String(state));
        const spinner = this.atcEl.querySelector(".order-view__atc-spinner");
        if (spinner) spinner.hidden = !state;
      }
      this._syncAtc();
    }

    // `staged` only ever holds already-valid quantities.
    get canSubmit() {
      return !this.submitting && this.staged.size > 0;
    }

    // The one writer of the button's disabled state.
    _syncAtc() {
      if (this.atcEl) this.atcEl.disabled = !this.canSubmit;
    }

    get total() {
      let total = 0;
      this.staged.forEach((quantity, variantId) => {
        const row = this.rows.get(variantId);
        if (row) total += quantity * this._unitPrice(row, quantity);
      });
      return total;
    }

    /* ---------------------------------------------------------------- events */

    _onClick = (event) => {
      const stepEl = event.target.closest("[data-qty-step]");
      if (stepEl && this.contains(stepEl)) {
        const controls = stepEl.closest(".order-row__qty-controls");
        const input = controls && controls.querySelector(`.order-row__qty-input[data-variant-id="${stepEl.dataset.variantId}"]`);
        if (input) this._step(input, toInt(stepEl.dataset.qtyStep, 1));
        return;
      }

      if (this.atcEl && event.target.closest(".order-view__atc")) {
        this._addToCart();
        return;
      }

      const errorEl = event.target.closest(".order-row__error");
      if (errorEl && this.contains(errorEl)) {
        this._clearCartError(errorEl.dataset.variantId);
        return;
      }

      const pageLink = event.target.closest(".variant-pagination a[href]");
      if (pageLink && this.contains(pageLink)) {
        event.preventDefault();
        // pagination.liquid strips `page=1` from the first page's href, so a missing param is page 1.
        this.currentPage = toInt(new URL(pageLink.href, window.location.origin).searchParams.get("page"), 1);
        this._variantLoader.load(this.currentPage);
      }
      // Expand/collapse is handled declaratively by Alpine — see order-view-row.liquid.
    };

    _onChange = (event) => {
      const input = event.target.closest(".order-row__qty-input");
      if (input && this.contains(input)) this._commit(input);
    };

    _onKeydown = (event) => {
      if (event.key !== "Enter") return;
      const input = event.target.closest(".order-row__qty-input");
      if (input && this.contains(input)) {
        event.preventDefault();
        this._commit(input);
      }
    };

    /* ----------------------------------------------------------------- rows */

    // Reads every row in the DOM into `this.rows`, restoring any staged quantity.
    _scanRows() {
      this.querySelectorAll(".order-view__row[data-variant-id]").forEach((rowEl) => {
        const variantId = rowEl.dataset.variantId;
        if (!this.rows.has(variantId)) {
          let breaks = [];
          try {
            breaks = JSON.parse(rowEl.dataset.priceBreaks || "[]");
          } catch (error) {
            breaks = [];
          }
          breaks.sort((a, b) => a[0] - b[0]);

          this.rows.set(variantId, {
            price: toInt(rowEl.dataset.price),
            breaks,
            rule: quantityRuleUtils.normalizeRule(rowEl.dataset.ruleMin, rowEl.dataset.ruleMax || null, rowEl.dataset.ruleInc),
            available: rowEl.dataset.available === "true",
            cartQty: toInt(rowEl.dataset.cartQty),
            inventoryMax: rowEl.dataset.inventoryMax ? toInt(rowEl.dataset.inventoryMax) : null,
          });
        }

        const input = rowEl.querySelector(".order-row__qty-input");
        if (input) {
          input.value = this.staged.get(variantId) || 0;
          // Hand the row over rather than looking it up again: a product can bring 250 of them.
          this._renderLine(variantId, rowEl);
        }
      });
    }

    // The cart is the authority — overwrite, never accumulate (the optimistic bump in
    // _addToCart() is a guess that this corrects).
    async _syncCartQuantities() {
      const quantities = await fetchCartQuantities();
      if (!quantities || !this.isConnected) return;

      this.rows.forEach((row, variantId) => {
        row.cartQty = quantities[variantId] || 0;
        this._clearQtyRuleError(variantId);
      });

      // Fetched variant pages carry a server-rendered data-cart-qty; drop them so a later page
      // turn doesn't reintroduce the number we just corrected.
      this.pages.clear();
      this._updateTotals();
    }

    _rowEl(variantId) {
      return this.querySelector(`.order-view__row[data-variant-id="${variantId}"]`);
    }

    // Volume pricing: the last price break whose minimum quantity is reached wins.
    _unitPrice(row, quantity) {
      let price = row.price;
      row.breaks.forEach(([minimumQuantity, breakPrice]) => {
        if (quantity >= minimumQuantity) price = breakPrice;
      });
      return price;
    }

    /* ------------------------------------------------------------ quantities */

    /**
     * Inventory headroom, not the raw stock level: quantities here are staged to be ADDED, so what
     * the cart already holds is gone from the shelf. `null` = the cart will never refuse this row
     * over stock — the variant is untracked or oversellable, so nothing caps it.
     *
     * Read only when an add has already failed (see _refusalMessage): stock never limits what may
     * be typed. Preorder is not exempt either — a preorder row backed by tracked stock is still
     * refused once that stock runs out, and it is the row the message belongs to.
     */
    _inventoryHeadroom(row) {
      if (row.inventoryMax === null) return null;
      return Math.max(0, row.inventoryMax - row.cartQty);
    }

    _step(input, direction) {
      const row = this.rows.get(input.dataset.variantId);
      if (!row) return;

      const current = toInt(input.value);
      let next;
      if (direction > 0) {
        // 0 means "not ordered", so the first press jumps to the rule's minimum.
        next = current <= 0 ? row.rule.min : quantityRuleUtils.step(current, row.rule, 1);
      } else {
        next = current <= row.rule.min ? 0 : quantityRuleUtils.step(current, row.rule, -1);
      }
      this._setQuantity(input, next);
    }

    _commit(input) {
      const row = this.rows.get(input.dataset.variantId);
      if (!row) return;

      const typed = toInt(input.value, -1);
      if (typed <= 0) {
        this._setQuantity(input, 0);
        return;
      }
      if (!quantityRuleUtils.isValid(typed, row.rule)) {
        this._setQtyRuleError(input.dataset.variantId, quantityRuleUtils.buildError(typed, row.rule), QTY_RULE_ERROR_HIDE_MS);
        this._setQuantity(input, quantityRuleUtils.normalizeQuantity(typed, row.rule), true);
        return;
      }
      this._setQuantity(input, typed);
    }

    _setQuantity(input, value, keepError = false) {
      const variantId = input.dataset.variantId;
      const row = this.rows.get(variantId);
      if (!row) return;
      if (!keepError) this._clearQtyRuleError(variantId);

      // Only the quantity rule constrains what may be typed (quantityRuleUtils caps at rule.max).
      // What the cart already holds — and what is left on the shelf — is deliberately NOT taken off
      // here: the shopper stages freely and the cart has the last word, reported per row after the
      // add (see _reportAddError).
      const quantity = Math.max(0, toInt(value));

      if (quantity > 0) this.staged.set(variantId, quantity);
      else this.staged.delete(variantId);

      input.value = quantity;
      this._renderLine(variantId);
      this._updateTotals();
    }

    /* -------------------------------------------------------------- rendering */

    _renderLine(variantId, knownRowEl) {
      const row = this.rows.get(variantId);
      const rowEl = knownRowEl || this._rowEl(variantId);
      if (!row || !rowEl) return;

      const quantity = this.staged.get(variantId) || 0;
      const unitPrice = this._unitPrice(row, quantity);

      const totalEl = rowEl.querySelector(".order-row__line-total");
      if (totalEl) totalEl.innerHTML = money(quantity * unitPrice, this.moneyFormat);

      // The per-each price column follows the volume tier as the quantity changes — same contract
      // as the product-page quick order list (see assets/quick-order-list.js).
      const priceEachEl = rowEl.querySelector(`.order-row__price-each-amount[data-variant-id="${variantId}"]`);
      if (priceEachEl) priceEachEl.innerHTML = money(unitPrice, this.moneyFormat);
    }

    _updateTotals() {
      if (this.totalEl) this.totalEl.innerHTML = money(this.total, this.moneyFormat);
      this._syncAtc();
    }

    /**
     * "The maximum is already in your cart" is only true when nothing more may be added. While
     * room remains — the shopper simply asked for more than the rule's ceiling leaves — say how
     * many they can have instead. Reached only from the add-error path: how much room the cart
     * leaves is a fact about the cart, so the cart is what reports it.
     */
    _ceilingMessage(max) {
      if (max > 0 && this.strings.maxAvailable) {
        return this.strings.maxAvailable.replace("[quantity]", String(max));
      }
      return this.strings.maxInCart;
    }

    // Fallback for rows with no dedicated popup/toast — only the single-variant parent row.
    _setRowError(variantId, message) {
      const rowEl = this._rowEl(variantId);
      // Falls back to the card-level error if the row isn't rendered (collapsed card).
      const errorEl = (rowEl && rowEl.querySelector(".order-view__row-error")) || this.cardErrorEl;
      if (!errorEl) return;

      errorEl.textContent = message || "";
      errorEl.hidden = !message;

      clearTimeout(this._errorTimers[variantId]);
      if (!message) return;
      this._errorTimers[variantId] = setTimeout(() => {
        errorEl.textContent = "";
        errorEl.hidden = true;
      }, 5000);
    }

    /**
     * Card-level error, for a message that belongs to the whole batch rather than to any one row —
     * the cart refused the add for a reason no row owns (locked cart, an app's validation, a
     * network failure). Never used to park a row's message on the card: attributing one row's
     * refusal to whichever row happened to be first is the bug this replaced.
     */
    _setCardError(message) {
      if (!this.cardErrorEl) return;
      this.cardErrorEl.textContent = message || "";
      this.cardErrorEl.hidden = !message;

      clearTimeout(this._cardErrorTimer);
      if (!message) return;
      this._cardErrorTimer = setTimeout(() => {
        this.cardErrorEl.textContent = "";
        this.cardErrorEl.hidden = true;
      }, CART_ERROR_HIDE_MS);
    }

    // Quantity-rule popup — separate from the cart error below.
    _setQtyRuleError(variantId, message, autoHideMs) {
      const el = document.getElementById(`VariantQtyRuleError-${variantId}`);
      if (!el) {
        this._setRowError(variantId, message);
        return;
      }
      clearTimeout(this._qtyRuleErrorTimers[variantId]);
      const textEl = el.getElementsByClassName("variant-qty-error-text")[0];
      if (textEl) textEl.innerHTML = message;
      if (message && autoHideMs) {
        this._qtyRuleErrorTimers[variantId] = setTimeout(() => this._clearQtyRuleError(variantId), autoHideMs);
      }
    }

    _clearQtyRuleError(variantId) {
      const el = document.getElementById(`VariantQtyRuleError-${variantId}`);
      if (!el) {
        this._setRowError(variantId, "");
        return;
      }
      clearTimeout(this._qtyRuleErrorTimers[variantId]);
      const textEl = el.getElementsByClassName("variant-qty-error-text")[0];
      if (textEl) textEl.innerHTML = ""; // empty content closes the popup (MutationObserver)
    }

    /* -------------------------------------------------------------- cart error */

    // Inline error under the row's title (merged variant rows); falls back to `_setRowError` otherwise.
    _setCartError(variantId, message) {
      const rowEl = this._rowEl(variantId);
      const el = rowEl && rowEl.querySelector(`.order-row__error[data-variant-id="${variantId}"]`);
      if (!el) {
        this._setRowError(variantId, message);
        return;
      }
      el.classList.toggle("hidden", !message);
      el.textContent = message || "";

      // Collapsing the card only hides its rows, so an error left standing here is what the shopper
      // meets when they expand it again — every message gets its own countdown.
      clearTimeout(this._cartErrorTimers[variantId]);
      if (!message) return;
      this._cartErrorTimers[variantId] = setTimeout(() => this._clearCartError(variantId), CART_ERROR_HIDE_MS);
    }

    _clearCartError(variantId) {
      this._setCartError(variantId, "");
    }

    /* ------------------------------------------------------------ add to cart */

    // Preorder rows carry their line-item property in the DOM — same contract as the product-page
    // quick order list and the buy buttons, so the cart shows one consistent "Preorder" note.
    _cartLine(variantId, quantity) {
      const line = { id: toInt(variantId), quantity };
      const preOrderEl = this.querySelector(`.order-row__preorder[data-variant-id="${variantId}"]`);
      if (preOrderEl) {
        line.properties = { [preOrderEl.dataset.preOrderName]: preOrderEl.dataset.preOrderValue };
      }
      return line;
    }

    /**
     * Put a failed add's message where the shopper can act on it: on the row (or rows) that caused
     * it. /cart/add.js is all-or-nothing and names no variant id, so the rows are identified from
     * what the page already knows — the quantity rule's room once the cart is counted, and the
     * stock behind the row.
     */
    _reportAddError(sent, message) {
      const rowMessages = sent
        .map(([variantId, quantity]) => {
          const row = this.rows.get(variantId);
          return [variantId, row ? this._refusalMessage(row, quantity, message) : ""];
        })
        .filter(([, rowMessage]) => rowMessage);

      if (!rowMessages.length) {
        this._setCardError(message);
        return;
      }
      this._setCardError("");
      rowMessages.forEach(([variantId, rowMessage]) => this._setCartError(variantId, rowMessage));
    }

    /**
     * Why the cart would refuse THIS row, or "" if it would not — this is where what the cart
     * already holds is accounted for, deliberately after the add rather than while the shopper
     * types. The rule ceiling is answered in the theme's own words (it knows the rule); stock is
     * answered with whatever the cart said, since only the cart knows how much is really left.
     */
    _refusalMessage(row, quantity, fallback) {
      if (row.rule.max !== null) {
        const remaining = row.rule.max - row.cartQty;
        if (remaining <= 0 || quantity > remaining) return this._ceilingMessage(Math.max(0, remaining));
      }
      const headroom = this._inventoryHeadroom(row);
      if (headroom !== null && quantity > headroom) return fallback;
      return "";
    }

    async _addToCart() {
      if (!this.canSubmit) return;

      // Snapshot of what's SENT — the shopper can keep editing while the request is in flight.
      const sent = Array.from(this.staged.entries());
      const items = sent.map(([variantId, quantity]) => this._cartLine(variantId, quantity));

      this.submitting = true;

      const cartDrawerEl = document.getElementById("CartDrawer");
      const sectionsToRender = window.xCartHelper?.getSectionsToRender(cartDrawerEl ? cartDrawerEl.dataset.sectionId : null) || [];

      try {
        const data = await postCartAdd(items, sectionsToRender.map((section) => section.id));

        if (data.status) {
          this._reportAddError(sent, data.description || data.message || this.strings.addFailed);
          return;
        }

        // Only the sent quantity clears — an edit made mid-request stays staged.
        sent.forEach(([variantId, quantity]) => {
          const row = this.rows.get(variantId);
          if (row) row.cartQty += quantity;
          if (this.staged.get(variantId) === quantity) this.staged.delete(variantId);
          this._clearCartError(variantId);
        });
        this.querySelectorAll(".order-row__qty-input").forEach((input) => {
          const variantId = input.dataset.variantId;
          input.value = this.staged.get(variantId) || 0;
          this._renderLine(variantId, input.closest(".order-view__row"));
        });
        this._updateTotals();

        this._applyCartSections(sectionsToRender, data);

        // Alpine owns the open/closed state; this is how it hears the card is done.
        this.dispatchEvent(new CustomEvent(ADDED_EVENT));
      } catch (error) {
        console.error("[OrderView] add to cart failed:", error);
        this._reportAddError(sent, this.strings.addFailed);
      } finally {
        this.submitting = false;
      }
    }

    _applyCartSections(sectionsToRender, data) {
      sectionsToRender.forEach((cartSection) => {
        const sectionEl = document.querySelector(cartSection.selector);
        if (sectionEl && data.sections?.[cartSection.id]) {
          sectionEl.innerHTML = getSectionInnerHTML(data.sections[cartSection.id], cartSection.selector);
        }
      });

      const cartDrawerEl = document.getElementById("CartDrawer");
      if (cartDrawerEl && window.Maximize?.isEnableCartDrawer) {
        cartDrawerEl.isOpen = true;
        document.getElementById("CartDrawer__Wrapper")?.classList.add("is-visible");
      }

      window.xCartHelper?.updateCurrentCountItem();
      document.dispatchEvent(
        new CustomEvent(CART_UPDATE_EVENT, {
          bubbles: true,
          detail: { isItemCountChanged: true },
        })
      );
    }
  }

  const define = () => window.customElements.define("order-view-card", OrderViewCard);

  // theme.js (which defines quantityRuleUtils) loads after this script, so wait for it unless
  // it's already there (e.g. a section re-run in the editor).
  if (typeof quantityRuleUtils !== "undefined") define();
  else document.addEventListener("DOMContentLoaded", define, { once: true });
})();
}
