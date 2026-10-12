if (!window.Maximize.loadedScript.includes("quick-order-list.js")) {
  window.Maximize.loadedScript.push("quick-order-list.js");

  const define = () => requestAnimationFrame(() => {
    const money = (cents, format) => (typeof window.formatMoney === "function" ? window.formatMoney(cents, format) : (cents / 100).toFixed(2));
    if (!customElements.get("quick-order-list")) {
      class QuickOrderList extends HTMLElement {
        constructor() {
          super();
          this.moneyFormat = this.dataset.moneyFormat;
          this.totalItems = 0;
          this.subtotal = 0;
          this.isSubmitting = false;
          this.errorMessages = {}; // server errors → inline toast
          this._qtyRuleErrorTimers = {};
          // variantId -> {price, priceBreaks, rule, inventoryMax, groupEl}, filled in as rows load.
          this.rows = new Map();
          // variantId -> qty queued for the next "Add to cart" click; always starts at 0.
          this.qty = {};
          this._submittingIds = new Set();
          this.variantPreorder = {};
          this._onDocumentClick = this._handleDocumentClick.bind(this);
        }

        connectedCallback() {
          this._scanRows(this);
          this._bindEvents();
          this._renderAll();
          this._syncAddToCartButtonsDisabled();

          // A group can start expanded server-side (default_open: true) with no click to load it.
          this.querySelectorAll('.qol-group[data-default-open="true"]').forEach((groupEl) => {
            this._ensureGroupLoaded(groupEl);
          });

          document.addEventListener("click", this._onDocumentClick);
        }

        // Reads .qol-row data-* attrs into this.rows; called at connect and after each page fetch.
        _scanRows(root) {
          root.querySelectorAll(".qol-row[data-variant-id]").forEach((rowEl) => {
            const variantId = parseInt(rowEl.dataset.variantId, 10);
            if (Number.isNaN(variantId)) return;

            if (!this.rows.has(variantId)) {
              let rawBreaks = [];
              try {
                rawBreaks = JSON.parse(rowEl.dataset.priceBreaks || "[]");
              } catch (e) {
                rawBreaks = [];
              }
              this.rows.set(variantId, {
                price: parseInt(rowEl.dataset.price, 10) || 0,
                priceBreaks: rawBreaks.map(([minimumQuantity, price]) => ({ minimumQuantity, price })),
                rule: {
                  min: parseInt(rowEl.dataset.ruleMin, 10) || 1,
                  max: rowEl.dataset.ruleMax ? parseInt(rowEl.dataset.ruleMax, 10) : null,
                  increment: parseInt(rowEl.dataset.ruleInc, 10) || 1,
                },
                inventoryMax: rowEl.dataset.inventoryMax ? parseInt(rowEl.dataset.inventoryMax, 10) : null,
                cartQty: parseInt(rowEl.dataset.cartQty, 10) || 0,
                groupEl: rowEl.closest(".qol-group"),
              });
            }

            if (rowEl.dataset.preorder === "true") this.variantPreorder[variantId] = true;
          });
        }

        _loaderFor(groupEl) {
          if (!groupEl._qolLoader) {
            groupEl._qolLoader = createLazyVariantLoader({
              root: groupEl,
              productUrl: groupEl.dataset.productUrl,
              sectionId: "quick-order-list-variants",
              cache: new Map(),
              failedMessage: this.dataset.addToCartFailed,
              onRender: () => {
                const bodyEl = groupEl.querySelector(".variant-loader-body");
                this._scanRows(bodyEl);
                this._renderAll();
              },
            });
          }
          return groupEl._qolLoader;
        }

        _ensureGroupLoaded(groupEl) {
          if (groupEl._qolLoaded) return;
          groupEl._qolLoaded = true;
          this._loaderFor(groupEl).load(1);
        }

        _loadPage(groupEl, page) {
          this._loaderFor(groupEl).load(page);
        }

        disconnectedCallback() {
          document.removeEventListener("click", this._onDocumentClick);
        }

        _bindEvents() {
          this.addEventListener("click", (e) => {
            const stepEl = e.target.closest("[data-qty-step]");
            const viewCart = e.target.closest(".qol-summary__view-cart-btn");
            const errorEl = e.target.closest(".flash-message.error-message");
            const pageLink = e.target.closest(".variant-pagination a[href]");
            const groupHeader = e.target.closest(".qol-group__header");

            if (stepEl) {
              if (!this.isSubmitting) this._stepQty(parseInt(stepEl.dataset.variantId, 10), parseInt(stepEl.dataset.qtyStep, 10), stepEl);
            } else if (viewCart) {
              this._handleAddToCartClick(viewCart);
            } else if (errorEl) {
              this._hideToast(parseInt(errorEl.dataset.variantId, 10));
            } else if (pageLink) {
              // Real links (progressive enhancement): intercept only to fetch instead of navigate.
              e.preventDefault();
              const groupEl = pageLink.closest(".qol-group");
              if (groupEl) {
                const page = parseInt(new URL(pageLink.href, window.location.origin).searchParams.get("page"), 10) || 1;
                this._loadPage(groupEl, page);
              }
            } else if (groupHeader) {
              const groupEl = groupHeader.closest(".qol-group");
              if (groupEl) this._ensureGroupLoaded(groupEl);
            }
          });

          this.addEventListener("keyup", (e) => {
            if (e.key !== "Enter") return;
            const stepEl = e.target.closest("[data-qty-step]");
            const groupHeader = e.target.closest(".qol-group__header");
            if (stepEl) {
              if (!this.isSubmitting) this._stepQty(parseInt(stepEl.dataset.variantId, 10), parseInt(stepEl.dataset.qtyStep, 10), stepEl);
            } else if (groupHeader) {
              const groupEl = groupHeader.closest(".qol-group");
              if (groupEl) this._ensureGroupLoaded(groupEl);
            }
          });

          this.addEventListener("change", (e) => {
            const input = e.target.closest(".order-row__qty-input");
            if (input) {
              const id = parseInt(input.dataset.variantId, 10);
              if (!this.isSubmitting) this._commitTypedQty(id, input);
            }
          });
        }

        // Steps by one increment of the variant's quantity rule, not a flat 1.
        _stepQty(variantId, delta, stepEl) {
          if (Number.isNaN(variantId)) return;
          const rowEl = stepEl ? stepEl.closest(".qol-row") : null;

          const rule = this._ruleFor(variantId);
          const currentQty = this.getVariantQty(variantId);

          if (delta < 0) {
            if (currentQty <= 0) return;
            const next = quantityRuleUtils.step(currentQty, rule, -1);
            // Already at the floor if step() couldn't lower it — remove the line instead.
            this._clearQtyRuleError(variantId, rowEl);
            this.updateQty(variantId, next >= currentQty ? 0 : next);
            return;
          }

          const max = this.getVariantMaxQty(variantId);
          if (currentQty >= max) return;
          // The first press has to reach the minimum, not 1.
          const next = currentQty <= 0 ? rule.min : quantityRuleUtils.step(currentQty, rule, 1);
          this._clearQtyRuleError(variantId, rowEl);
          this.updateQty(variantId, Math.min(next, max));
        }

        // rowEl scopes the message to the .qol-row that was actually edited, since the same variant
        // can be on screen twice (main table + "View all" popup).
        _addQtyRuleError(variantId, message, autoHideMs, rowEl) {
          const textEl = rowEl ? rowEl.querySelector(".variant-qty-error-text") : null;
          if (!textEl) return;
          clearTimeout(this._qtyRuleErrorTimers[variantId]);
          textEl.innerHTML = message;
          if (message && autoHideMs) {
            this._qtyRuleErrorTimers[variantId] = setTimeout(() => this._clearQtyRuleError(variantId, rowEl), autoHideMs);
          }
        }

        _clearQtyRuleError(variantId, rowEl) {
          const textEl = rowEl ? rowEl.querySelector(".variant-qty-error-text") : null;
          if (!textEl) return;
          clearTimeout(this._qtyRuleErrorTimers[variantId]);
          textEl.innerHTML = ""; // empty content closes the popup (MutationObserver)
        }

        // Same policy as cart.js validateItemQty: out-of-range values auto-correct with a 3s message; in-range but off-grid values keep a persistent message uncommitted.
        _commitTypedQty(variantId, inputEl) {
          const rule = this._ruleFor(variantId);
          const rowEl = inputEl.closest(".qol-row");
          const maxInCartMessage = this.dataset.maxQuantityInCart || "The maximum quantity of this item is already in your cart";

          // No real quantity rule to snap to (non-B2B, or a B2B variant with the default
          // min:1/max:null/increment:1) — post as typed, only inventory/cart headroom applies.
          const hasRule = window.Maximize.isB2BCustomer && (rule.min > 1 || rule.max !== null || rule.increment > 1);
          if (!hasRule) {
            const max = this.getVariantMaxQty(variantId);
            const typed = parseInt(inputEl.value, 10) || 0;
            if (typed > max) {
              inputEl.value = max;
              this._addQtyRuleError(variantId, maxInCartMessage, 3000, rowEl);
              this.updateQty(variantId, max);
              return;
            }
            this._clearQtyRuleError(variantId, rowEl);
            this.updateQty(variantId, typed);
            return;
          }

          const max = this.getVariantMaxQty(variantId);
          const typed = parseInt(inputEl.value, 10);
          // Rounds down onto the grid, not up — up could exceed max.
          const clampToMax = () => (max < rule.min ? 0 : rule.min + Math.floor((max - rule.min) / rule.increment) * rule.increment);

          if (typed === 0) {
            this._clearQtyRuleError(variantId, rowEl);
            this.updateQty(variantId, 0);
            return;
          }

          if (quantityRuleUtils.isValid(typed, rule) && typed <= max) {
            this._clearQtyRuleError(variantId, rowEl);
            this.updateQty(variantId, typed);
            return;
          }

          // Phase 1: violate the B2B rule itself (min/max/increment), independent of inventory/cart.
          const belowMin = !Number.isInteger(typed) || typed < rule.min;
          const aboveRuleMax = rule.max !== null && typed > rule.max;

          let corrected = typed;
          let message = null;

          if (belowMin || aboveRuleMax) {
            message = quantityRuleUtils.buildError(inputEl.value, rule);
            corrected = rule.min;
            if (aboveRuleMax) {
              corrected = rule.min + Math.floor((rule.max - rule.min) / rule.increment) * rule.increment;
              if (corrected < rule.min) corrected = rule.min;
            }
          }

          // Phase 2: the effective max (inventory/cart headroom) always wins over the rule message.
          if (corrected > max) {
            corrected = clampToMax();
            inputEl.value = corrected;
            this._addQtyRuleError(variantId, maxInCartMessage, 3000, rowEl);
            this.updateQty(variantId, corrected);
            return;
          }

          if (message !== null) {
            inputEl.value = corrected;
            this._addQtyRuleError(variantId, message, 3000, rowEl);
            this.updateQty(variantId, corrected);
            return;
          }

          // In range, off the increment grid: say which values are valid and commit nothing.
          this._addQtyRuleError(variantId, quantityRuleUtils.buildError(inputEl.value, rule), null, rowEl);
        }

        _renderAll() {
          this._renderSummary();
          this.rows.forEach((_row, variantId) => this._renderVariant(variantId));
          this._renderGroupTotals();
        }

        _renderSummary() {
          // Main table and "View all" popup each render their own copy of these nodes — update both.
          this.querySelectorAll(".qol-summary__total-items").forEach((el) => {
            el.textContent = this.totalItems;
          });

          this.querySelectorAll(".qol-summary__subtotal").forEach((el) => {
            el.innerHTML = money(this.subtotal, this.moneyFormat);
          });
        }

        _renderVariant(variantId) {
          const qty = this.getVariantQty(variantId);
          const row = this.rows.get(variantId);
          // Effective per-unit price at the current qty (applies volume-pricing tiers).
          const unitPrice = row ? quantityRuleUtils.priceForQuantity(row.price, row.priceBreaks, qty) : 0;
          const isSubmittingRow = this._submittingIds.has(variantId);

          this.querySelectorAll(`.order-row__qty-input[data-variant-id="${variantId}"]`).forEach((input) => {
            if (document.activeElement !== input) input.value = qty;
          });

          const maxQty = this.getVariantMaxQty(variantId);
          const isAtMax = maxQty !== Infinity && qty >= maxQty;
          this.querySelectorAll(`[data-qty-step="1"][data-variant-id="${variantId}"]`).forEach((el) => {
            if (!isSubmittingRow) {
              el.setAttribute("aria-disabled", String(isAtMax));
              el.tabIndex = isAtMax ? -1 : 0;
            }
            el.classList.toggle("is-disabled", isAtMax);
          });

          // Frozen (spinner instead) while the row's Add-to-cart request is in flight.
          if (!isSubmittingRow) {
            this.querySelectorAll(`.order-row__total[data-variant-id="${variantId}"]`).forEach((el) => {
              el.innerHTML = money(qty * unitPrice, this.moneyFormat);
              el.classList.toggle("order-row__total--active", qty > 0);
            });
            // Per-each price column follows the volume tier as qty changes.
            this.querySelectorAll(`.order-row__price-each-amount[data-variant-id="${variantId}"]`).forEach((el) => {
              el.innerHTML = money(unitPrice, this.moneyFormat);
            });
          }

          const msg = this.errorMessages[variantId] || "";
          this.querySelectorAll(`.flash-message.error-message[data-variant-id="${variantId}"]`).forEach((el) => {
            el.classList.toggle("hidden", !msg);
            if (msg) el.textContent = msg;
          });
        }

        // Group-header Total: sum from `this.qty`, not rendered rows — a paged-away group has none.
        _renderGroupTotals() {
          const totalsByGroup = new Map();
          Object.entries(this.qty).forEach(([key, qty]) => {
            if (qty <= 0) return;
            const row = this.rows.get(parseInt(key, 10));
            if (!row || !row.groupEl) return;
            const unitPrice = quantityRuleUtils.priceForQuantity(row.price, row.priceBreaks, qty);
            totalsByGroup.set(row.groupEl, (totalsByGroup.get(row.groupEl) || 0) + qty * unitPrice);
          });

          this.querySelectorAll(".qol-group").forEach((groupEl) => {
            const totalEl = groupEl.querySelector(".qol-group__total");
            if (!totalEl) return;
            if (groupEl.dataset.priceHidden === "true") {
              totalEl.textContent = "--";
              return;
            }
            totalEl.innerHTML = money(totalsByGroup.get(groupEl) || 0, this.moneyFormat);
          });
        }

        async fetchCart() {
          return fetch(window.Shopify.routes.root + "cart.js").then((r) => r.json());
        }

        getVariantQty(variantId) {
          return this.qty[variantId] || 0;
        }

        isVariantPreorder(variantId) {
          return this.variantPreorder[variantId] === true;
        }

        getVariantMaxQty(variantId) {
          const row = this.rows.get(variantId);
          if (!row) return Infinity;
          return computeMaxQty({
            ruleMax: this._ruleFor(variantId).max,
            inventoryMax: this.__inventoryMaxQty(variantId),
            cartQty: row.cartQty,
          });
        }

        __inventoryMaxQty(variantId) {
          const row = this.rows.get(variantId);
          if (!row) return Infinity;
          if (this.isVariantPreorder(variantId)) return Infinity;
          if (row.inventoryMax != null) return row.inventoryMax;
          return Infinity;
        }

        _ruleFor(variantId) {
          const rule = (this.rows.get(variantId) || {}).rule || {};
          return quantityRuleUtils.normalizeRule(rule.min, rule.max, rule.increment);
        }

        calculateTotals() {
          let itemsCount = 0;
          let total = 0;
          Object.entries(this.qty).forEach(([key, qty]) => {
            if (qty <= 0) return;
            const row = this.rows.get(parseInt(key, 10));
            if (!row) return;
            itemsCount += qty;
            total += qty * quantityRuleUtils.priceForQuantity(row.price, row.priceBreaks, qty);
          });
          this.totalItems = itemsCount;
          this.subtotal = total;
        }

        _getCartSections() {
          let cartSectionEl = document.querySelector("#CartDrawer");
          let cartSectionId = cartSectionEl?.dataset.sectionId || false;
          if (window.Maximize.isCartPage) {
            cartSectionEl = document.querySelector("#MainCart__Items");
            cartSectionId = cartSectionEl?.dataset.sectionId || false;
          }
          const sectionsToRender = window.xCartHelper?.getSectionsToRender(cartSectionId) || [];
          return { sectionsToRender, sections: sectionsToRender.map((s) => s.id) };
        }

        _renderCartSections(sectionsToRender, sections) {
          if (!sections) return;
          sectionsToRender.forEach((section) => {
            const el = document.querySelector(section.selector);
            if (!el || !sections[section.id]) return;
            const html = getSectionInnerHTML(sections[section.id], section.selector);
            if (section.selector === "#CartDrawer") {
              const wrapperVisible = el.querySelector("#CartDrawer__Wrapper")?.classList.contains("is-visible");
              el.innerHTML = html ?? "";
              if (wrapperVisible) el.querySelector("#CartDrawer__Wrapper")?.classList.add("is-visible");
            } else {
              el.innerHTML = html ?? "";
            }
          });
        }

        _notifyCartUpdate(detail = { isItemCountChanged: true }) {
          window.xCartHelper?.updateCurrentCountItem?.();
          document.dispatchEvent(new CustomEvent(CART_EVENT.cartUpdate, { bubbles: true, detail }));
        }

        _quantitiesByVariant(cartItems) {
          const quantities = {};
          cartItems.forEach((item) => {
            quantities[item.variant_id] = (quantities[item.variant_id] || 0) + item.quantity;
          });
          return quantities;
        }

        async _fetchCartQuantities() {
          const cart = await this.fetchCart();
          return this._quantitiesByVariant(cart.items);
        }

        // Only updates the queued amount + totals — nothing is sent until "Add to cart".
        updateQty(variantId, newQty) {
          if (newQty < 0) newQty = 0;
          this.qty[variantId] = newQty;

          this.calculateTotals();
          this.errorMessages[variantId] = "";
          this._renderVariant(variantId);
          this._renderGroupTotals();
          this._renderSummary();
          this._syncAddToCartButtonsDisabled();
        }

        _setVariantSubmitting(variantId, submitting) {
          this.querySelectorAll(`.qol-row[data-variant-id="${variantId}"]`).forEach((row) => {
            row.classList.toggle("is-updating", submitting);
          });
          this.querySelectorAll(`.order-row__qty-input[data-variant-id="${variantId}"]`).forEach((el) => {
            el.disabled = submitting;
          });
          this.querySelectorAll(`.order-row__cell--total[data-variant-id="${variantId}"] .order-row__total-spinner`).forEach((el) => {
            el.classList.toggle("hidden", !submitting);
          });
          this.querySelectorAll(`.order-row__total[data-variant-id="${variantId}"]`).forEach((el) => {
            el.classList.toggle("invisible", submitting);
          });
        }

        _syncAddToCartButtonsDisabled() {
          const hasItems = Object.values(this.qty).some((qty) => qty > 0);
          const disabled = this.isSubmitting || !hasItems;
          this.querySelectorAll(".qol-summary__view-cart-btn").forEach((btn) => {
            btn.disabled = disabled;
            btn.setAttribute("aria-disabled", String(disabled));
          });
        }

        // Diffs cart quantities before/after to see which items succeeded, partially succeeded, or never got attempted — mirrors bulk-order.js's _reconcileAfterPartialFailure.
        async _reconcileIncreaseFailure(increaseItems, beforeQuantities, sectionsToRender) {
          let afterCart;
          try {
            const res = await fetch(window.Shopify.routes.root + "cart/update.js", {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ updates: {}, sections: sectionsToRender.map((s) => s.id) }),
            });
            afterCart = await res.json();
          } catch (err) {
            console.error("Quick order list – reconcile error:", err);
            increaseItems.forEach((item) => {
              this.errorMessages[item.id] = this.dataset.addToCartFailed || "Something went wrong. Please try again.";
            });
            return;
          }

          const afterQuantities = this._quantitiesByVariant(afterCart.items);

          // cart/add.js stops at the first item that adds zero — only that one gets the "blocking" message.
          let blockerVariantId = null;
          for (const item of increaseItems) {
            const before = beforeQuantities[item.id] || 0;
            const after = afterQuantities[item.id] || 0;
            if (after - before <= 0) {
              blockerVariantId = item.id;
              break;
            }
          }

          increaseItems.forEach((item) => {
            const before = beforeQuantities[item.id] || 0;
            const after = afterQuantities[item.id] || 0;
            const added = after - before;

            if (added >= item.quantity) {
              delete this.errorMessages[item.id];
              return;
            }
            if (added > 0) {
              // Pull the qty back to how many actually made it in, so the row isn't overstating it.
              this.qty[item.id] = added;
              this.errorMessages[item.id] = this.dataset.maxQuantityInCart || "The maximum quantity of this item is already in your cart";
              return;
            }
            if (item.id === blockerVariantId) {
              this.errorMessages[item.id] = this.dataset.blockingCartError || "This item can't be added.";
            }
            // Items after the blocker were never attempted — leave qty as-is so a retry picks them up.
          });

          this._renderCartSections(sectionsToRender, afterCart);
        }

        // Every queued row is a straight addition (qty always starts at 0, nothing to decrease).
        async _handleAddToCartClick(triggerEl) {
          if (this.isSubmitting) return;

          const addIds = Object.entries(this.qty)
            .filter(([, qty]) => qty > 0)
            .map(([id]) => parseInt(id, 10));
          if (!addIds.length) return;

          this.isSubmitting = true;
          addIds.forEach((id) => this._submittingIds.add(id));
          addIds.forEach((id) => this._setVariantSubmitting(id, true));
          this._syncAddToCartButtonsDisabled();
          if (triggerEl) triggerEl.disabled = true;

          const { sectionsToRender, sections } = this._getCartSections();

          const increaseItems = addIds.map((id) => {
            const item = { id, quantity: this.qty[id] };
            const preOrderEl = this.querySelector(`.order-row__preorder[data-variant-id="${id}"]`);
            if (preOrderEl) {
              item.properties = { [preOrderEl.dataset.preOrderName]: preOrderEl.dataset.preOrderValue };
            }
            return item;
          });

          let beforeQuantities = null;
          try {
            beforeQuantities = await this._fetchCartQuantities();
          } catch (err) {
            console.error("Quick order list – snapshot error:", err);
          }

          const _slUpdate = window.MaximizeStorefrontEvents?.createCartLinesUpdate({
            action: "add",
            context: "standard-action",
            lines: increaseItems,
            element: this,
          });

          try {
            const addData = await postCartAdd(increaseItems, sections);

            if (addData.status === 422) {
              const _422msg = addData.description || addData.message || "";
              _slUpdate?.resolve(null, [{ code: "MAXIMUM_EXCEEDED", message: _422msg }]);
              if (beforeQuantities) {
                await this._reconcileIncreaseFailure(increaseItems, beforeQuantities, sectionsToRender);
              } else {
                addIds.forEach((id) => {
                  this.errorMessages[id] = addData.description || addData.message || this.dataset.addToCartFailed || "Unable to add item.";
                });
              }
            } else {
              _slUpdate?.resolve(addData);
              this._renderCartSections(sectionsToRender, addData.sections || {});
            }

            // Anything without an error is fully added — reset its queued qty.
            addIds.forEach((id) => {
              if (!this.errorMessages[id]) {
                this.qty[id] = 0;
              }
            });

            this.calculateTotals();
            this._notifyCartUpdate();

            if (!addIds.some((id) => this.errorMessages[id])) {
              this.viewCart();
            }
          } catch (err) {
            _slUpdate?.reject(err);
            window.MaximizeStorefrontEvents?.dispatchCartError(err?.message || "Cart add failed", "SERVICE_UNAVAILABLE", this);
            console.error("Quick order list – add to cart error:", err);
            addIds.forEach((id) => {
              this.errorMessages[id] = this.dataset.addToCartFailed || "An error occurred. Please try again.";
            });
          } finally {
            addIds.forEach((id) => {
              this._submittingIds.delete(id);
              this._setVariantSubmitting(id, false);
            });
            this.isSubmitting = false;
            this._syncAddToCartButtonsDisabled();
            if (triggerEl) triggerEl.disabled = false;
            this._renderAll();
          }
        }

        _hideToast(variantId) {
          this.errorMessages[variantId] = "";
          this._renderVariant(variantId);
        }

        _handleDocumentClick(e) {
          this.querySelectorAll(".flash-message.error-message:not(.hidden)").forEach((el) => {
            if (!el.contains(e.target)) {
              this._hideToast(parseInt(el.dataset.variantId, 10));
            }
          });
        }

        viewCart() {
          const cartDrawerEl = document.getElementById("CartDrawer");
          if (cartDrawerEl && window.Maximize.isEnableCartDrawer) {
            cartDrawerEl.returnFocusEl = this.querySelector(".qol-summary__view-cart-btn");
            cartDrawerEl.isOpen = true;
            document.getElementById("CartDrawer__Wrapper")?.classList.add("is-visible");
          } else {
            window.location.href = window.Shopify.routes.root + "cart";
          }
        }
      }

      customElements.define("quick-order-list", QuickOrderList);
    }
  });

  // theme.js (which defines quantityRuleUtils) loads after this script, so wait for it unless
  // it's already there (e.g. a section re-run in the editor).
  if (typeof quantityRuleUtils !== "undefined") define();
  else document.addEventListener("DOMContentLoaded", define, { once: true });
}
