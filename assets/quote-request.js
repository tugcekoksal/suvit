/*
 * Request for quote — the one modal every entry point shares.
 *
 * A quote request is NOT an order: quantity rules are shown but never enforced, so `setQty` only
 * clamps at zero — the opposite of `quantityRuleUtils.normalizeQuantity` that every order path uses.
 *
 * Item shape the readers produce; only `variantId` and `productTitle` are required:
 *   { variantId, productId, productTitle, variantTitle, sku, url, image, productImage, qty,
 *     available, inventoryText, inventoryStatus, price, compareAtPrice, measurementPrice,
 *     hasOnlyDefaultVariant, rule, priceBreaks, tooltipHtml }
 *
 * `measurementPrice` is Shopify's unit price ("$4.50/100ml"), already formatted by the surface —
 * NOT `unitPriceFormatted()`, which is this modal's price-per-item after volume pricing.
 */
if (!window.__quoteRequestInit) {
  window.__quoteRequestInit = true;

  // This file is fetched on demand by the boot script in `quote-request-modal.liquid`, so it
  // almost always arrives AFTER `alpine:init` has already fired. Register straight away when
  // Alpine is up and only fall back to the event otherwise — the same shape every other
  // lazily-loaded script in the theme uses (cart-term, coupon-code, estimate-shipping-rate).
  const _registerQuoteRequest = () => {
    Alpine.store("xQuoteRequest", {
      show: false,
      items: [],
      source: null,
      collapsedGroups: {},
      contactOpen: false,
      isSubmitting: false,
      // null | 'success' | 'error' | 'no_items'
      status: null,

      _config: null,
      get config() {
        if (this._config) return this._config;
        const el = document.querySelector("[data-quote-request-config]");
        if (!el) return {};
        try {
          this._config = JSON.parse(el.textContent);
        } catch (error) {
          this._config = {};
        }
        return this._config;
      },

      /* ── Reading the surfaces ──────────────────────────────────────────────────────────
       * Read from HERE so no section's JS knows this modal exists; a button declares its source.
       *
       * WARNING — implicit dependency that has already cost us once: the quick order list was read
       * through `productVariants`, a refactor renamed it, and quotes broke SILENTLY. Standing bets:
       * `visibleTableItems` (bulk-order.js), `staged`/`pages` (order-view.js), `qty` (QOL).
       */      _rule(min, max, increment) {
        return typeof quantityRuleUtils !== "undefined"
          ? quantityRuleUtils.normalizeRule(min, max, increment)
          : { min: parseInt(min) || 1, max: parseInt(max) || null, increment: parseInt(increment) || 1 };
      },

      _readers: {
        // Union of variant page 1 and everything typed — a quantity staged on page 3 must not vanish.
        async "order-view"(card) {
          const staged = card.staged instanceof Map ? card.staged : new Map();
          const items = (await this._orderViewPageRows(card)).map((row) => this._orderViewItem(row, card, staged));

          const onPage = new Set(items.map((item) => item.variantId));
          const index = this._orderViewRowIndex(card);
          staged.forEach((qty, variantId) => {
            const id = String(variantId);
            if (onPage.has(id)) return;
            const row = index.get(id);
            if (row) items.push(this._orderViewItem(row, card, staged));
          });

          return items;
        },

        // Every product in the block. QOL's page cache lives in a closure, so a quantity typed on a page
        // since left cannot be recovered — those are warned about and skipped.
        async "quick-order-list"(root) {
          const groups = this._qolGroups(root);
          const pages = await Promise.all(
            Array.from(groups.values()).map((groupEl) => this._qolGroupRows(groupEl))
          );

          const seen = new Set();
          const items = [];
          Array.from(groups.values()).forEach((groupEl, index) => {
            pages[index].forEach((row) => {
              const variantId = row.dataset.variantId;
              if (seen.has(variantId)) return;
              seen.add(variantId);
              items.push(this._qolItem(row, groupEl, root));
            });
          });

          const typed = root.qty && typeof root.qty === "object" ? root.qty : {};
          const lost = Object.keys(typed).filter((variantId) => typed[variantId] > 0 && !seen.has(variantId));
          if (lost.length) console.warn("[QuoteRequest] quantities typed on a variant page that is no longer rendered:", lost);

          return items;
        },

        // Alpine's public `$data`: the rendered rows carry no variant id, only a `table-qty-<id>` input.
        "bulk-order"(root) {
          const data = typeof Alpine !== "undefined" && Alpine.$data ? Alpine.$data(root) : null;
          if (!data || !Array.isArray(data.visibleTableItems)) return [];
          return data.visibleTableItems.map((tableItem) => ({
            variantId: tableItem.variantId,
            productId: tableItem.productId,
            sku: tableItem.sku || "",
            productTitle: tableItem.productTitle || "",
            variantTitle: tableItem.variantTitle || "",
            url: tableItem.url || "",
            image: tableItem.image || "",
            productImage: tableItem.productImage || "",
            qty: tableItem.qty,
            available: tableItem.available !== false,
            inventoryText: tableItem.inventoryText || "",
            inventoryStatus: tableItem.inventoryStatus || "",
            price: tableItem.priceCents,
            compareAtPrice: tableItem.compareAtPrice || null,
            measurementPrice: tableItem.unitPrice || "",
            hasOnlyDefaultVariant: !!tableItem.isSingleVariant,
            rule: this._rule(tableItem.min, tableItem.max, tableItem.increment),
            priceBreaks: tableItem.priceBreaks || [],
            tooltipHtml: tableItem.tooltipHtml || "",
          }));
        },

        // The WHOLE cart. A line without `data-quote-*` is an additional-fee surcharge and is skipped.
        cart(root) {
          return this._readCartLines(root);
        },

        "cart-drawer"(root) {
          return this._readCartLines(root);
        },
      },

      _readCartLines(root) {
        return Array.from(root.querySelectorAll(".cart-item__wrapper[data-quote-variant-id]")).map((row) => {
          const qtyInput = row.querySelector('.cart-item__quantity-input, [data-action="update-qty"]');
          return {
            variantId: row.dataset.quoteVariantId,
            productId: row.dataset.quoteProductId || "",
            sku: row.dataset.quoteSku || "",
            productTitle: row.dataset.quoteProductTitle || "",
            variantTitle: row.dataset.quoteVariantTitle || "",
            url: row.dataset.quoteUrl || "",
            image: row.dataset.quoteImage || "",
            productImage: row.dataset.quoteProductImage || "",
            qty: qtyInput ? parseInt(qtyInput.value) || 0 : 0,
            available: true,
            price: this._toCents(row.dataset.quotePrice),
            compareAtPrice: parseInt(row.dataset.quoteCompareAtPrice) || null,
            measurementPrice: this._unitPriceFrom(row),
            hasOnlyDefaultVariant: row.dataset.quoteDefaultVariant === "true",
            rule: qtyInput
              ? this._rule(qtyInput.dataset.qtyMin, qtyInput.dataset.qtyMax, qtyInput.dataset.qtyIncrement)
              : null,
            priceBreaks: this._parseBreaks(row.dataset.quotePriceBreaks),
            // Cart renders its tooltip without `disabled_rule_note`, so a cart-sourced row repeats
            // min/max/inc inside the popup as well as in `ruleSummary()` underneath the box. Left as
            // is: dropping the note is the cart page's own call, not this modal's.
            tooltipHtml: this._tooltipFrom(row),
          };
        });
      },

      _orderViewItem(row, card, staged) {
        const image = row.querySelector("img");
        const productImage = card.dataset.productImage || "";
        return {
          variantId: row.dataset.variantId,
          productId: card.dataset.productId || "",
          sku: row.dataset.sku || "",
          productTitle: card.dataset.productTitle || "",
          variantTitle: row.dataset.variantTitle || "",
          url: card.dataset.productUrl || "",
          image: this._orderViewImage(image && image.getAttribute("src")) || productImage,
          productImage: productImage,
          qty: staged.get(row.dataset.variantId) || 0,
          // `data-sold-out` first: a preorder variant is orderable while `variant.available` is false. The
          // parent row of a single-variant card has no `data-sold-out`, hence the fallback.
          available: row.dataset.soldOut ? row.dataset.soldOut !== "true" : row.dataset.available === "true",
          price: this._toCents(row.dataset.price),
          compareAtPrice: parseInt(row.dataset.compareAtPrice) || null,
          measurementPrice: this._unitPriceFrom(row),
          // NOT `data-single`: a product whose one variant is named "Red" is single too, and a flat row
          // would drop that name.
          hasOnlyDefaultVariant: card.dataset.hasOnlyDefaultVariant === "true",
          rule: this._rule(row.dataset.ruleMin, row.dataset.ruleMax, row.dataset.ruleInc),
          priceBreaks: this._parseBreaks(row.dataset.priceBreaks),
          tooltipHtml: this._tooltipFrom(row),
        };
      },

      _orderViewImage(url) {
        if (!url) return "";
        return url.replace(/([?&])width=\d+/, "$1width=104");
      },

      async _orderViewPageRows(card) {
        if (card.dataset.single === "true") {
          return Array.from(card.querySelectorAll(".order-view__row[data-variant-id]"));
        }

        const cached = card.pages instanceof Map ? card.pages.get(1) : null;
        let html = typeof cached === "string" && cached ? cached : card._quotePage1;
        if (typeof html !== "string" || !html) {
          html = await this._fetchVariantPage(card.dataset.productUrl, "order-view-variants", 1);
          card._quotePage1 = html;
        }
        return this._parseRows(html);
      },

      async _fetchVariantPage(productUrl, sectionId, page) {
        if (!productUrl) return "";
        const separator = productUrl.indexOf("?") === -1 ? "?" : "&";
        const response = await fetch(productUrl + separator + "section_id=" + sectionId + "&page=" + page);
        if (!response.ok) throw new Error("HTTP " + response.status);
        // Bare identifier: theme.js declares it with a top-level `const`, never on `window`.
        return (typeof getSectionInnerHTML === "function" && getSectionInnerHTML(await response.text(), ".variant-loader-inner")) || "";
      },

      // Volume pricing is a server-rendered popup (`quantity-rule-tooltip` -> `custom-tooltip`), and
      // every B2B row already carries one, so the modal lifts that markup instead of rebuilding a
      // price-break table in JS. Cloned HTML upgrades to the custom element on insertion, the same
      // way `product-card.js` swaps `.quantity-rule-tooltip-anchor` contents.
      //
      // The clone also carries `data-clamp-boundary` from the source surface ("order-view__card",
      // …). That class does not exist inside the modal; `_applyHorizontalClamp` returns early when
      // `closest()` misses, so the popup simply falls back to the viewport clamp.
      _tooltipFrom(row) {
        const tooltip = row && row.querySelector(".quantity-rule-tooltip");
        return tooltip ? tooltip.outerHTML : "";
      },

      // Shopify's unit price, lifted as text from the source row rather than re-formatted here: the
      // measurement string ("$4.50/100ml") is Liquid's to build, and every surface already prints one.
      // Absent whenever the variant has no `unit_price_measurement` — then the modal simply omits it.
      _unitPriceFrom(row) {
        const unitPrice =
          row && row.querySelector(".order-row__unit-price, .cart-item__unit-price, .cart-drawer-item__unit-price");
        return unitPrice ? unitPrice.textContent.trim() : "";
      },

      _parseRows(html) {
        if (!html) return [];
        return Array.from(new DOMParser().parseFromString(html, "text/html").body.querySelectorAll(".order-view__row[data-variant-id]"));
      },

      _showsFirstPage(groupEl) {
        const current = groupEl.querySelector('.variant-pagination [aria-current="page"]');
        return !current || current.textContent.trim() === "1";
      },

      // A product appears twice when it is in both the capped list and the "View all" popup.
      _qolGroups(root) {
        const groups = new Map();
        root.querySelectorAll(".qol-group[data-product-id]").forEach((groupEl) => {
          const productId = groupEl.dataset.productId;
          const existing = groups.get(productId);
          if (existing && (this._qolRenderedRows(existing).length || !this._qolRenderedRows(groupEl).length)) return;
          groups.set(productId, groupEl);
        });
        return groups;
      },

      _qolRenderedRows(groupEl) {
        return Array.from(groupEl.querySelectorAll(".order-view__row[data-variant-id]"));
      },

      async _qolGroupRows(groupEl) {
        const rendered = this._qolRenderedRows(groupEl);
        if (rendered.length && this._showsFirstPage(groupEl)) return rendered;

        if (typeof groupEl._quotePage1 !== "string") {
          groupEl._quotePage1 = await this._fetchVariantPage(groupEl.dataset.productUrl, "quick-order-list-variants", 1);
        }
        return rendered.concat(this._parseRows(groupEl._quotePage1));
      },

      _qolItem(row, groupEl, root) {
        const image = row.querySelector("img");
        const productImage = groupEl.dataset.productImage || "";
        return {
          variantId: row.dataset.variantId,
          productId: groupEl.dataset.productId || "",
          sku: row.dataset.sku || "",
          productTitle: groupEl.dataset.productTitle || "",
          variantTitle: row.dataset.variantTitle || "",
          url: groupEl.dataset.productUrl || "",
          image: this._orderViewImage(image && image.getAttribute("src")) || productImage,
          productImage: productImage,
          qty: typeof root.getVariantQty === "function" ? root.getVariantQty(row.dataset.variantId) : 0,
          available: row.dataset.soldOut ? row.dataset.soldOut !== "true" : row.dataset.available === "true",
          price: this._toCents(row.dataset.price),
          compareAtPrice: parseInt(row.dataset.compareAtPrice) || null,
          measurementPrice: this._unitPriceFrom(row),
          hasOnlyDefaultVariant: groupEl.dataset.hasOnlyDefaultVariant === "true",
          rule: this._rule(row.dataset.ruleMin, row.dataset.ruleMax, row.dataset.ruleInc),
          priceBreaks: this._parseBreaks(row.dataset.priceBreaks),
          tooltipHtml: this._tooltipFrom(row),
        };
      },

      _orderViewRowIndex(card) {
        const index = new Map();
        const add = (root) => {
          root.querySelectorAll(".order-view__row[data-variant-id]").forEach((row) => {
            if (!index.has(row.dataset.variantId)) index.set(row.dataset.variantId, row);
          });
        };

        add(card);

        if (card.pages instanceof Map) {
          const parser = new DOMParser();
          card.pages.forEach((html) => {
            if (typeof html !== "string" || !html) return;
            add(parser.parseFromString(html, "text/html").body);
          });
        }

        return index;
      },

      // Every surface emits the same `[[minimumQuantity, price], ...]` tuples — order view, quick
      // order list and the cart lines — so this is the only price-break parser.
      _parseBreaks(raw) {
        let parsed = [];
        try {
          parsed = JSON.parse(raw || "[]");
        } catch (error) {
          return [];
        }
        if (!Array.isArray(parsed)) return [];
        return parsed.map(([minimumQuantity, price]) => ({ minimumQuantity, price }));
      },

      _sourceRoot(buttonEl, source) {
        const selector = '[data-quote-root="' + source + '"]';
        return buttonEl.closest(selector) || document.querySelector(selector);
      },

      // Token + `isConnected`: a slower open must not land on top of a later click, and facets can
      // replace the card mid-fetch.
      openFrom(buttonEl) {
        const source = buttonEl && buttonEl.dataset.quoteSource;
        const reader = source && this._readers[source];
        if (!reader) return;

        const root = this._sourceRoot(buttonEl, source);
        if (!root) return;

        const token = (this._openToken || 0) + 1;
        this._openToken = token;

        const result = reader.call(this, root);
        if (!result || typeof result.then !== "function") {
          this.open(result, source);
          return;
        }

        this._setOpenBusy(buttonEl, true);
        return result
          .then((items) => {
            if (token !== this._openToken || !root.isConnected) return;
            this.open(items, source);
          })
          .catch((error) => {
            console.error("[QuoteRequest] could not load the products to quote:", error);
            if (token !== this._openToken) return;
            this.open([], source);
            this.status = "load_error";
          })
          .finally(() => this._setOpenBusy(buttonEl, false));
      },

      // Never the `disabled` attribute: bulk order binds it through Alpine and the two would fight.
      _setOpenBusy(buttonEl, busy) {
        if (!buttonEl) return;
        buttonEl.classList.toggle("is-loading", busy);
        buttonEl.setAttribute("aria-busy", String(busy));
        const spinner = buttonEl.querySelector("[data-quote-open-spinner]");
        if (spinner) spinner.hidden = !busy;
      },

      // ── Opening / closing ───────────────────────────────────────────────────────────────
      open(items, source) {
        this.items = (Array.isArray(items) ? items : []).map((item, index) => this._normalizeItem(item, index));
        this.source = source || null;
        this.collapsedGroups = {};
        this.contactOpen = false;
        this.status = null;
        this.isSubmitting = false;
        this.show = true;
        Alpine.store("xMaximizePopup").handleOpen();
        this._lockScroll();
      },

      // `status` is NOT cleared here: that would swap the confirmation back for the closing transition.
      close() {
        this.show = false;
        Alpine.store("xMaximizePopup").handleClose();
        this._unlockScroll();
      },

      // `handleOpen` only locks when the overlay setting is on; this modal always has a backdrop.
      _lockedScroll: false,

      _lockScroll() {
        if (document.body.classList.contains("overflow-y-hidden")) return;
        document.body.classList.add("overflow-y-hidden");
        this._lockedScroll = true;
      },

      _unlockScroll() {
        if (!this._lockedScroll) return;
        document.body.classList.remove("overflow-y-hidden");
        this._lockedScroll = false;
      },

      // `key`, not `variantId`: the cart can hold two lines of the same variant, and a colliding
      // `x-for` key would send every quantity edit to the first one.
      _normalizeItem(item, index) {
        const rule = item && item.rule ? item.rule : null;
        const variantId = String((item && item.variantId) || "");
        return {
          key: index + ":" + variantId,
          variantId: variantId,
          productId: String((item && item.productId) || variantId),
          sku: (item && item.sku) || "",
          productTitle: (item && item.productTitle) || "",
          variantTitle: (item && item.variantTitle) || "",
          url: (item && item.url) || "",
          // Trimmed: a blank-but-truthy string would pass the modal's `x-if` and paint a broken image.
          image: this._toUrl(item && item.image),
          productImage: this._toUrl(item && item.productImage) || this._toUrl(item && item.image),
          available: !(item && item.available === false),
          inventoryText: (item && item.inventoryText) || "",
          inventoryStatus: (item && item.inventoryStatus) || "",
          price: Number.isFinite(item && item.price) ? item.price : null,
          compareAtPrice: Number.isFinite(item && item.compareAtPrice) ? item.compareAtPrice : null,
          measurementPrice: (item && item.measurementPrice) || "",
          hasOnlyDefaultVariant: !!(item && item.hasOnlyDefaultVariant),
          rule: rule
            ? {
                min: parseInt(rule.min) || 1,
                max: Number.isInteger(parseInt(rule.max)) ? parseInt(rule.max) : null,
                increment: parseInt(rule.increment) || 1,
              }
            : { min: 1, max: null, increment: 1 },
          priceBreaks: Array.isArray(item && item.priceBreaks) ? item.priceBreaks : [],
          tooltipHtml: (item && item.tooltipHtml) || "",
          qty: this._toQty(item && item.qty),
        };
      },

      // One variant WITH an option keeps its parent row, so the buyer sees which variant is quoted.
      _groupByProduct(items) {
        const groups = [];
        const byId = {};
        items.forEach((item) => {
          let group = byId[item.productId];
          if (!group) {
            group = {
              productId: item.productId,
              productTitle: item.productTitle,
              productImage: item.productImage,
              url: item.url,
              items: [],
            };
            byId[item.productId] = group;
            groups.push(group);
          }
          group.items.push(item);
        });
        return groups.map((group) => ({
          ...group,
          isFlat: group.items.length === 1 && group.items[0].hasOnlyDefaultVariant,
          variantCount: group.items.length,
        }));
      },

      get groupedItems() {
        if (this._groupCacheKey !== this.items) {
          this._groupCacheKey = this.items;
          this._groupCache = this._groupByProduct(this.items);
        }
        return this._groupCache;
      },

      isGroupOpen(productId) {
        return !this.collapsedGroups[productId];
      },

      toggleGroup(productId) {
        this.collapsedGroups = { ...this.collapsedGroups, [productId]: !this.collapsedGroups[productId] };
      },

      removeGroup(productId) {
        this.items = this.items.filter((item) => item.productId !== productId);
      },

      get submittableItems() {
        return this.items.filter((item) => item.qty > 0);
      },

      get hasSubmittableItems() {
        return this.submittableItems.length > 0;
      },

      // ── Quantity ────────────────────────────────────────────────────────────────────────
      _toUrl(value) {
        return typeof value === "string" ? value.trim() : "";
      },

      _toQty(value) {
        const qty = parseInt(value);
        if (!Number.isInteger(qty) || qty < 0) return 0;
        return qty;
      },

      // NOT `parseInt(…) || null`: a free item (price 0) is a legitimate quote line — a B2B catalogue
      // prices "on request" at 0 — and `||` would fold it into the same null as a missing attribute,
      // blanking its price, its line total and its share of every total.
      _toCents(value) {
        const cents = parseInt(value);
        return Number.isFinite(cents) ? cents : null;
      },

      // `inputEl` is passed on `change` only: `_toQty` rewrites "-5", "2.5", "abc" and "" to 0 in the
      // store, but `:value="item.qty"` re-renders nothing when the number did not actually change, so
      // the rejected text stays in the box until the DOM is written back. Same write-back `stepQty`
      // does below. Not done on `input` — clearing the field to retype would snap it to 0 mid-edit.
      setQty(key, value, inputEl) {
        const item = this.items.find((entry) => entry.key === key);
        if (!item) return;
        item.qty = this._toQty(value);
        if (inputEl) inputEl.value = item.qty;
        if (this.status === "no_items" && item.qty > 0) this.status = null;
      },

      stepQty(key, direction, inputEl) {
        const item = this.items.find((entry) => entry.key === key);
        if (!item) return;
        const base = inputEl ? inputEl.value : item.qty;
        // Plain +/- 1, NOT `quantityRuleUtils.step` — that snaps onto the rule's min/increment grid,
        // which is enforcement. A quote may ask for any quantity; `item.rule` stays for `ruleSummary`
        // to state read-only. `_toQty` clamps at zero, so "-" still stops there.
        item.qty = this._toQty(this._toQty(base) + direction);
        if (inputEl) inputEl.value = item.qty; // value may be unchanged → :value would not re-render
        if (this.status === "no_items" && item.qty > 0) this.status = null;
      },

      removeItem(key) {
        this.items = this.items.filter((entry) => entry.key !== key);
      },

      // "1 variant" / "2 variants". The label cannot be resolved in Liquid because the count is only
      // known once the items are grouped client-side, so both forms come through the config.
      variantCountLabel(group) {
        const count = (group && group.variantCount) || 0;
        const label = count === 1 ? this.config.variantLabel : this.config.variantLabelPlural;
        return count + " " + (label || "");
      },

      ruleSummary(item) {
        const rule = item && item.rule;
        if (!rule) return "";
        const labels = this.config.ruleLabels || {};
        const parts = [];
        if (rule.increment > 1) parts.push((labels.inc || "Inc") + ": " + rule.increment);
        if (rule.min > 1) parts.push((labels.min || "Min") + ": " + rule.min);
        if (rule.max !== null) parts.push((labels.max || "Max") + ": " + rule.max);
        return parts.join(" . ");
      },

      hasVolumePricing(item) {
        return !!(item && item.priceBreaks && item.priceBreaks.length);
      },

      statusText(item) {
        if (item.inventoryText) return item.inventoryText;
        return item.available ? this.config.inStock || "" : this.config.soldOut || "";
      },

      statusKey(item) {
        if (item.inventoryStatus) return item.inventoryStatus;
        return item.available ? "in-stock" : "out-of-stock";
      },

      groupAvailable(group) {
        return group.items.some((item) => item.available);
      },

      effectiveUnitPrice(item, qty) {
        let price = item.price;
        if (!Number.isFinite(price)) return null;
        (item.priceBreaks || []).forEach((priceBreak) => {
          if (qty >= parseInt(priceBreak.minimumQuantity)) price = priceBreak.price;
        });
        return price;
      },

      unitPriceFormatted(item) {
        return this.formatMoney(this.effectiveUnitPrice(item, item.qty));
      },

      compareAtFormatted(item) {
        const unit = this.effectiveUnitPrice(item, item.qty);
        if (!Number.isFinite(item.compareAtPrice) || !Number.isFinite(unit)) return "";
        if (item.compareAtPrice <= unit) return "";
        return this.formatMoney(item.compareAtPrice);
      },

      isDiscounted(item) {
        return this.compareAtFormatted(item) !== "";
      },

      lineTotalFormatted(item) {
        const unit = this.effectiveUnitPrice(item, item.qty);
        if (!Number.isFinite(unit)) return "";
        return this.formatMoney(unit * item.qty);
      },

      groupTotalFormatted(group) {
        const total = group.items.reduce((sum, item) => {
          const unit = this.effectiveUnitPrice(item, item.qty);
          return Number.isFinite(unit) ? sum + unit * item.qty : sum;
        }, 0);
        return this.formatMoney(total);
      },

      groupPriceFormatted(group) {
        const prices = group.items.map((item) => item.price).filter(Number.isFinite);
        if (!prices.length) return "";
        const min = Math.min(...prices);
        const formatted = this.formatMoney(min);
        if (min === Math.max(...prices)) return formatted;
        return (this.config.priceFrom || "").replace("[[PRICE]]", formatted) || formatted;
      },

      formatMoney(cents) {
        if (!Number.isFinite(cents)) return "";
        if (typeof window.formatMoney !== "function") return String(cents);
        return window.formatMoney(cents, this.config.moneyFormat || "");
      },

      imgUrl(url) {
        if (!url) return "";
        // Cart URLs are already sized by `image_url`; adding the CDN's legacy `_240x240` on top yields a
        // URL Shopify does not serve.
        if (/[?&](width|height)=/.test(url)) return url;
        const clean = url.replace(/_\d+x\d*(?:_crop_\w+)?(\.\w+)/, "$1");
        return clean.replace(/(\.\w+)(\?|$)/, "_240x240$1$2");
      },

      // ── Submit ─────────────────────────────────────────────────────────────────────────
      /*
       * One `contact[…]` field per product. Shopify prints the field name on one line and the
       * value under it, keeping newlines — so one field can print as several lines:
       *
       *   Product 1:
       *   SKU: MUG-01 | White mug | Quantity: 3     <- no options: one line
       *
       *   Product 2:
       *   Basic tee                                 <- has options: title, then a line per variant
       *   SKU: TS-RED-M | Red / M | Quantity: 5
       *   SKU: TS-BLU-L | Blue / L | Quantity: 4
       *
       * Two rules to keep: field names must be UNIQUE (a repeated name prints only once), and they
       * get lowercased when printed ("SKU" -> "Sku") — that is why labels live in the value.
       */
      // One line: "SKU: <sku> | <title> | Quantity: <n>".
      _lineFieldValue(item, title) {
        const cols = this.config.cols || {};
        const empty = cols.empty || "—";

        return [
          (cols.sku || "SKU") + ": " + (item.sku || empty),
          title,
          (cols.quantity || "Quantity") + ": " + item.qty,
        ].join(" | ");
      },

      // No options: one line. Has options: the title, then a line per variant.
      _productFieldValue(group) {
        if (group.isFlat) return this._lineFieldValue(group.items[0], group.items[0].productTitle);

        return [group.productTitle]
          .concat(group.items.map((item) => this._lineFieldValue(item, item.variantTitle || item.productTitle)))
          .join("\n");
      },

      _quoteSummaryValue(groups, items) {
        const units = this.config.summaryUnits || {};
        const totalUnits = items.reduce((sum, item) => sum + item.qty, 0);
        return [
          groups.length + " " + (units.products || "products"),
          items.length + " " + (units.variants || "variants"),
          totalUnits + " " + (units.units || "units"),
        ].join(" | ");
      },

      _writeProductFields(formEl, items) {
        const host = formEl.querySelector("[data-quote-products-fields]");
        if (!host) return;

        host.replaceChildren();

        const addField = (name, value) => {
          const field = document.createElement("input");
          field.type = "hidden";
          field.name = "contact[" + name + "]";
          field.value = value;
          host.appendChild(field);
        };

        // "Product N" numbers products, not variants — a two-variant product is just Product 1.
        const groups = this._groupByProduct(items);

        addField(this.config.summaryLabel || "Quote summary", this._quoteSummaryValue(groups, items));

        const productLabel = this.config.productField || "Product";

        groups.forEach((group, index) => {
          addField(productLabel + " " + (index + 1), this._productFieldValue(group));
        });
      },

      // NOT disabled while invalid: the fields sit in a collapsed panel, so a disabled button would be
      // a dead end. An invalid attempt opens the panel and focuses the first gap.
      attemptSubmit(formEl, isValid) {
        if (this.isSubmitting || !formEl) return;
        if (isValid) {
          this.submit(formEl);
          return;
        }
        this.contactOpen = true;
        this._focusFirstIncomplete(formEl);
      },

      _focusFirstIncomplete(formEl) {
        const fields = Array.from(formEl.querySelectorAll("input[required], textarea[required]"));
        const target = fields.find((field) => !field.value || !field.value.trim()) || fields[0];
        if (!target) return;
        // Next frame: focusing into a panel `x-collapse` still has at zero height mis-scrolls it.
        requestAnimationFrame(() => target.focus());
      },

      // No submit button in the markup, so the browser never POSTs it itself — that competing path
      // once turned one click into two emails.
      async submit(formEl) {
        if (this.isSubmitting || !formEl) return;
        this.isSubmitting = true;

        const items = this.submittableItems;
        if (!items.length) {
          this.status = "no_items";
          this.isSubmitting = false;
          return;
        }

        this._writeProductFields(formEl, items);
        this.status = null;

        try {
          const response = await fetch(formEl.action, {
            method: "POST",
            body: new FormData(formEl),
            headers: { Accept: "text/html" },
          });
          this.status = (await this._resolveStatus(response)) ? "success" : "error";
          if (this.status === "success") this._resetForm(formEl);
        } catch (error) {
          this.status = "error";
        } finally {
          this.isSubmitting = false;
        }
      },

      async _resolveStatus(response) {
        if (!response.ok) return false;
        if (/contact_posted=true/i.test(response.url || "")) return true;
        try {
          const doc = new DOMParser().parseFromString(await response.text(), "text/html");
          return !doc.querySelector("[data-quote-form-errors]");
        } catch (error) {
          return false;
        }
      },

      _resetForm(formEl) {
        formEl.querySelectorAll("input, textarea").forEach((field) => {
          if (field.type === "hidden") return;
          field.value = field.defaultValue;
        });
        formEl.querySelector("[data-quote-products-fields]")?.replaceChildren();
      },
    });
  };

  if (window.Alpine) {
    _registerQuoteRequest();
  } else {
    document.addEventListener("alpine:init", _registerQuoteRequest);
  }

  // No `[data-quote-request-open]` click delegate lives here on purpose: this script only exists
  // once a shopper has already clicked one. The boot script in `quote-request-modal.liquid` owns
  // that single delegate and calls `openFrom` after the modal is loaded — a second listener here
  // would run every reader twice on each click.
}
