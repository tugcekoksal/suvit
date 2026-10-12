if (!window.Maximize.loadedScript.includes("bulk-order.js")) {
  window.Maximize.loadedScript.push("bulk-order.js");

  let _abortCtrl = null;
  let _debounceTimer = null;
  window.Maximize.bulkOrderSearchCache = window.Maximize.bulkOrderSearchCache || {};
  const _searchCache = window.Maximize.bulkOrderSearchCache;

  const BULK_ORDER_STORAGE_KEY = "bulk_order_table_items";
  const BULK_ORDER_RESTORE_CONCURRENCY = 8;

  async function runWithConcurrency(items, concurrency, worker) {
    let nextIndex = 0;
    async function processQueue() {
      while (nextIndex < items.length) {
        const currentItem = items[nextIndex++];
        await worker(currentItem);
      }
    }
    const workerCount = Math.min(concurrency, items.length);
    await Promise.all(Array.from({ length: workerCount }, processQueue));
  }

  requestAnimationFrame(() => {
    const defineXBulkOrder = () => {
      Alpine.data("xBulkOrder", (moneyFormat) => ({
        dropdownOpen: false,
        searchQuery: "",
        isSearching: false,
        hasSearched: false, // avoids flashing an empty panel before the first result arrives
        searchResults: [],
        searchError: "", // replaces the no_results message when fetchResults fails
        rowQtys: {}, // variantId → pending qty for a not-yet-added row
        qtyErrors: {}, // variantId → error for the search-dropdown row
        _qtyErrorTimers: {},
        tableQtyErrors: {}, // separate from qtyErrors so dropdown/table errors never cross
        _tableQtyErrorTimers: {},
        _liveMessage: "", // see _announce
        _liveNonce: 0,
        _lastQuery: null, // ignores stray `input` events with no real query change

        tableItems: [],
        collapsedGroups: {}, // added-items table groups
        dropdownCollapsed: {}, // search-dropdown groups, independent of the table
        isSubmitting: false,
        submitError: "",
        isImporting: false,
        showRemoveAllConfirm: false,
        showRemoveItemConfirm: false,
        pendingRemoveVariantId: null,
        pendingRemoveGroupId: null,

        _cartDrawerId: null,
        _strings: {},
        _priceHiddenLabel: "", // pre-rendered hidden-price message (login / restricted), from server

        get groupedResults() {
          const groups = [];
          const byId = {};
          this.searchResults.forEach((row) => {
            let group = byId[row.productId];
            if (!group) {
              // The product's featured image, not the first variant's — this row represents the product.
              group = byId[row.productId] = { productId: row.productId, productTitle: row.productTitle, handle: row.handle, productImage: row.productImage, variants: [] };
              groups.push(group);
            }
            group.variants.push(row);
          });
          return groups;
        },
        get filteredGroups() {
          return this.groupedResults.reduce((acc, group) => {
            const variants = group.variants;
            if (!variants.length) return acc;
            const prices = variants.map((variant) => (variant.priceCents != null ? variant.priceCents : variant.price));
            acc.push({
              ...group,
              variants,
              isSingleVariant: !!variants[0].isSingleVariant,
              priceHidden: variants.some((variant) => variant.priceHidden),
              minPriceFormatted: formatMoney(Math.min(...prices), moneyFormat),
            });
            return acc;
          }, []);
        },
        // Parked (marketUnavailable) items stay in tableItems/localStorage but are hidden here.
        get visibleTableItems() {
          return this.tableItems.filter((tableItem) => !tableItem.marketUnavailable);
        },
        get hasItems() {
          return this.visibleTableItems.length > 0;
        },
        get hasReadyItems() {
          return this.visibleTableItems.some((tableItem) => !tableItem.isLoading && !tableItem.hasError && tableItem.available && !tableItem.marketUnavailable && !tableItem.priceHidden);
        },
        get selectedCountText() {
          const tmpl = this._strings.items_selected || "";
          return tmpl.replace("[[COUNT]]", this.visibleTableItems.length);
        },
        get grandTotalAmountFormatted() {
          const visible = this.visibleTableItems.filter((tableItem) => this._isPriceable(tableItem));
          if (!visible.length) return "--";
          const totalCents = visible.reduce((sum, tableItem) => sum + this.effectiveUnitPrice(tableItem, tableItem.qty) * tableItem.qty, 0);
          return formatMoney(totalCents, moneyFormat);
        },
        get grandTotalLabelText() {
          return (this._strings.footer_total_label || "").replace("[[AMOUNT]]", "").trim();
        },
        get groupedItems() {
          const groups = [];
          const groupIndexByKey = {};
          this.visibleTableItems.forEach((tableItem) => {
            // Falls back to handle while productId is still loading, so restoring items don't merge under `undefined`.
            const groupKey = tableItem.productId ?? tableItem.handle;
            if (!(groupKey in groupIndexByKey)) {
              groupIndexByKey[groupKey] = groups.length;
              groups.push({ productId: groupKey, isFlat: !!tableItem.isSingleVariant, items: [] });
            }
            groups[groupIndexByKey[groupKey]].items.push(tableItem);
          });
          return groups;
        },
        // A transient _liveMessage (e.g. "Added X") wins over search status; next search replaces it.
        get searchStatusText() {
          if (this._liveMessage) return this._liveMessage;
          if (!this.dropdownOpen) return "";
          if (this.isSearching) return this._strings.searching || "";
          if (!this.searchQuery.trim()) return "";
          if (this.searchError) return this.searchError;
          const count = this.filteredGroups.length;
          if (count > 0) {
            const tmpl = this._strings.results_found || "";
            return tmpl.replace("[[COUNT]]", count);
          }
          const tmpl = this._strings.no_results || "";
          return tmpl.replace("__QUERY__", this.searchQuery);
        },

        // Alternating trailing ZWSP forces a text change so screen readers re-announce repeats.
        _announce(title) {
          const label = this._strings.added || "";
          this._liveNonce++;
          this._liveMessage = (label ? label + " " : "") + title + "​".repeat(this._liveNonce % 2);
        },

        init() {
          const stringsEl = this.$el.querySelector("[data-bulk-order-strings]");
          this._strings = stringsEl ? JSON.parse(stringsEl.textContent) : {};

          const labelEl = this.$el.querySelector("[data-bulk-order-price-hidden-label]");
          this._priceHiddenLabel = labelEl ? labelEl.innerHTML.trim() : "";

          const cartDrawerEl = document.getElementById("CartDrawer");
          this._cartDrawerId = cartDrawerEl ? cartDrawerEl.dataset.sectionId : null;

          this.restoreTableItems();

          document.addEventListener(BULK_ORDER_EVENT.importStarted, () => {
            this.isImporting = true;
          });
          document.addEventListener("bulk-order:import-resolved", (event) => {
            // $nextTick — a plain document listener fired after an async await can otherwise land outside Alpine's own render flush.
            this.$nextTick(() => {
              this.isImporting = false;
              this._replaceImportedItems(event.detail.items);
            });
          });
          document.addEventListener("bulk-order:ambiguous-items-added", (event) => {
            this._addAmbiguousItems(event.detail.items);
          });
        },

        // Replaces the whole table, even with an empty result — bulk-order-import.js confirms with the merchant first if it wasn't empty.
        _replaceImportedItems(items) {
          this.tableItems = items || [];
          this.persistTableItems();
          this._pruneQtyErrors();
        },

        // From the "Select products" popup — adds on top instead of replacing (unlike a fresh CSV import).
        _addAmbiguousItems(items) {
          if (!items || !items.length) return;
          const existingIds = new Set(this.tableItems.map((tableItem) => tableItem.variantId));
          const newItems = items.filter((item) => !existingIds.has(item.variantId));
          if (!newItems.length) return;
          this.tableItems = [...this.tableItems, ...newItems];
          this.persistTableItems();
          this._pruneQtyErrors();
        },

        // Tells xBulkOrderImport (separate component) to reset hasUsedCsvImport once the table empties.
        _maybeResetCsvImportFlag() {
          if (!this.hasItems) document.dispatchEvent(new CustomEvent("bulk-order:table-cleared", { bubbles: true }));
        },

        persistTableItems() {
          try {
            const data = this.tableItems.map((tableItem) => ({
              variantId: tableItem.variantId,
              handle: tableItem.handle,
              qty: tableItem.qty,
            }));
            localStorage.setItem(BULK_ORDER_STORAGE_KEY, JSON.stringify(data));
          } catch (storageError) {}
        },

        restoreTableItems() {
          let savedItems = [];
          try {
            const raw = localStorage.getItem(BULK_ORDER_STORAGE_KEY);
            savedItems = raw ? JSON.parse(raw) : [];
          } catch (storageError) {}
          if (!Array.isArray(savedItems) || !savedItems.length) return;

          this.tableItems = savedItems
            .filter((savedItem) => savedItem && savedItem.variantId && savedItem.handle)
            .map((savedItem) => ({
              variantId: String(savedItem.variantId),
              handle: savedItem.handle,
              qty: savedItem.qty > 0 ? savedItem.qty : 1,
              isLoading: true,
              hasError: false,
              errorMessage: "",
              tooltipHtml: "", // seeded so x-html doesn't print "undefined" before _restoreProduct fills it in
            }));

          const variantIdsByHandle = {};
          this.tableItems.forEach((tableItem) => {
            (variantIdsByHandle[tableItem.handle] = variantIdsByHandle[tableItem.handle] || []).push(tableItem.variantId);
          });

          runWithConcurrency(Object.keys(variantIdsByHandle), BULK_ORDER_RESTORE_CONCURRENCY, (handle) => this._restoreProduct(handle, variantIdsByHandle[handle]));
        },

        async _restoreProduct(handle, variantIds, isRetry) {
          try {
            const url = `${window.Shopify.routes.root}products/${handle}?section_id=bulk-order-restore-results`;
            const res = await fetch(url);

            // Not resolvable in the current market, not necessarily gone — park it instead of dropping it.
            if (res.status === 404) {
              this._parkUnresolvedVariants(variantIds);
              return;
            }
            if (!res.ok) throw new Error("[BulkOrder] restore HTTP " + res.status);

            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, "text/html");
            const scriptEl = doc.getElementById("bulk-order-restore-data");
            if (!scriptEl) {
              this._parkUnresolvedVariants(variantIds);
              return;
            }

            const variantRows = JSON.parse(scriptEl.textContent).map((variantRow) => this._shapeVariantRow(variantRow));

            // Missing from the response = no longer exists, drop it. Sold-out variants are kept (see handleSubmit).
            const missingIds = [];
            variantIds.forEach((variantId) => {
              const variantRow = variantRows.find((row) => row.variantId === variantId);
              if (!variantRow) {
                missingIds.push(variantId);
                return;
              }

              this.tableItems = this.tableItems.map((tableItem) => (tableItem.variantId === variantId ? { ...variantRow, qty: tableItem.qty, isLoading: false, hasError: false, errorMessage: "" } : tableItem));
            });
            if (missingIds.length) this._dropRestoredVariants(missingIds);
          } catch (fetchError) {
            if (fetchError.name !== "AbortError" && !isRetry) return this._restoreProduct(handle, variantIds, true);

            this.tableItems = this.tableItems.map((tableItem) => (variantIds.includes(tableItem.variantId) ? { ...tableItem, isLoading: false, hasError: true, errorMessage: this._strings.restore_failed || "Failed to load" } : tableItem));
          }
        },

        _dropRestoredVariants(variantIds) {
          this.tableItems = this.tableItems.filter((tableItem) => !variantIds.includes(tableItem.variantId));
          this.persistTableItems();
        },

        _parkUnresolvedVariants(variantIds) {
          this.tableItems = this.tableItems.map((tableItem) => (variantIds.includes(tableItem.variantId) ? { ...tableItem, isLoading: false, marketUnavailable: true } : tableItem));
        },

        openDropdown() {
          if (this.isImporting) return;
          this.dropdownOpen = true;
        },

        closeDropdown(returnFocus) {
          // Return focus to the field only if it was inside the panel — click-away already moved it elsewhere.
          const hadFocus = !!this.$refs.dropdownPanel?.contains(document.activeElement);
          this.dropdownOpen = false;
          this._liveMessage = "";
          this._pruneQtyErrors();
          if (_abortCtrl) {
            try {
              _abortCtrl.abort();
            } catch (abortError) {}
            _abortCtrl = null;
          }
          clearTimeout(_debounceTimer);
          this._releaseFocusTrap(returnFocus || hadFocus ? this.$refs.searchInput : null);
        },

        // Must re-arm whenever results change: trapFocus() resolves first/last focusable once, at call time.
        _armFocusTrap() {
          const store = Alpine.store("xFocusElement");
          const region = this.$refs.searchRegion;
          if (!store || !region?.id) return;
          store.activeElement = null;
          store.trapFocus(region.id, "");
        },
        _releaseFocusTrap(elementToFocus) {
          const store = Alpine.store("xFocusElement");
          if (!store) return;
          // Clear the remembered element, or a click-away close would steal focus back to it.
          if (!elementToFocus) store.activeElement = null;
          store.removeTrapFocus(elementToFocus || null);
        },

        // Enter / ArrowDown from the search field jump to the first result's action.
        focusFirstRow() {
          this.$nextTick(() => {
            const first = this.$refs.dropdownPanel?.querySelector("[data-bulk-nav]");
            if (!first) return;
            first.focus();
            first.closest(".bulk-order__dropdown-row")?.scrollIntoView({ block: "nearest" });
          });
        },
        moveRow(event, step) {
          const panel = this.$refs.dropdownPanel;
          if (!panel) return;
          const nav = [...panel.querySelectorAll("[data-bulk-nav]")].filter((el) => el.offsetParent !== null);
          if (!nav.length) return;
          let next = nav.indexOf(event.currentTarget) + step;
          if (next < 0) next = nav.length - 1;
          if (next >= nav.length) next = 0;
          nav[next].focus();
          nav[next].scrollIntoView({ block: "nearest" });
        },
        onSearchEnter() {
          const variants = this.filteredGroups.flatMap((group) => group.variants);
          if (variants.length === 1) {
            this.addVariant(variants[0].variantId);
            return;
          }
          this.focusFirstRow();
        },

        onSearchInput() {
          if (this.isImporting) return;
          this.dropdownOpen = true;
          const query = this.searchQuery.trim();
          // type="search" fires `input` without typing (Escape clear, autofill, IME) — ignore unless the query actually changed.
          if (query === this._lastQuery) return;
          this._lastQuery = query;
          this._liveMessage = "";
          this.searchError = "";
          clearTimeout(_debounceTimer);
          if (!query) {
            if (_abortCtrl) {
              try {
                _abortCtrl.abort();
              } catch (abortError) {}
              _abortCtrl = null;
            }
            this.isSearching = false;
            this.hasSearched = false;
            this.searchResults = [];
            this._pruneQtyErrors();
            return;
          }
          this.isSearching = true;
          // searchResults deliberately not cleared here — swapped in place once the new results arrive.
          this._pruneQtyErrors();
          _debounceTimer = setTimeout(() => this.fetchResults(query), 300);
        },

        async fetchResults(query) {
          if (_abortCtrl) {
            try {
              _abortCtrl.abort();
            } catch (abortError) {}
            _abortCtrl = null;
          }
          if (!query) {
            this.searchResults = [];
            return;
          }
          const cacheKey = query;
          if (_searchCache[cacheKey]) {
            this.searchResults = _searchCache[cacheKey];
            this.isSearching = false;
            this.hasSearched = true;
            this.$nextTick(() => this._armFocusTrap());
            return;
          }

          const ctrl = new AbortController();
          _abortCtrl = ctrl;
          this.isSearching = true;

          try {
            // Predictive Search for matching + section rendering so can-hide-price resolves server-side.
            const url =
              Shopify.routes.root +
              "search/suggest" +
              "?q=" +
              encodeURIComponent(query) +
              "&resources[type]=product" +
              "&resources[limit]=10" +
              "&resources[options][fields]=title,variants.title,variants.sku" +
              "&resources[options][unavailable_products]=show" +
              "&section_id=bulk-order-search-results";

            const res = await fetch(url, { signal: ctrl.signal });
            if (!res.ok) throw new Error("[BulkOrder] HTTP " + res.status);

            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, "text/html");
            const scriptEl = doc.getElementById("bulk-order-results-data");
            if (!scriptEl) {
              this.searchResults = [];
              return;
            }

            const variantRows = JSON.parse(scriptEl.textContent).map((variantRow) => this._shapeVariantRow(variantRow));

            _searchCache[cacheKey] = variantRows;
            const panel = this.$refs.dropdownPanel;
            const focusWasInList = !!panel && panel.contains(document.activeElement);
            this.searchResults = variantRows;
            this.hasSearched = true;
            this.$nextTick(() => {
              this._armFocusTrap();
              // x-for may destroy the focused row; recover focus so it isn't stranded on <body>.
              if (focusWasInList && !panel.contains(document.activeElement)) {
                this.$refs.searchInput?.focus();
              }
            });
          } catch (fetchError) {
            if (fetchError.name === "AbortError") return;
            console.error("[BulkOrder] fetchResults error:", fetchError);
            this._lastQuery = null; // lets the same query be retried, past onSearchInput's unchanged-query guard
            this.searchResults = [];
            this.hasSearched = true;
            this.searchError = this._strings.network_error || "";
          } finally {
            this.isSearching = false;
            _abortCtrl = null;
          }
        },

        // variantId as string (server sends a number); price fields formatted client-side (Liquid sends cents).
        _shapeVariantRow(variantRow) {
          return {
            ...variantRow,
            variantId: String(variantRow.variantId),
            priceFormatted: formatMoney(variantRow.price, moneyFormat),
            compareAtPriceFormatted: variantRow.compareAtPrice && variantRow.compareAtPrice !== variantRow.price ? formatMoney(variantRow.compareAtPrice, moneyFormat) : "",
            priceCents: variantRow.price,
          };
        },

        // Whether a variant is currently in the added-items table (single source of truth).
        isAdded(variantId) {
          return this.tableItems.some((tableItem) => tableItem.variantId === variantId);
        },

        // ---- Row action names / states --------------------------------------------------
        // One source of truth for each row's accessible name AND its disabled state, so the
        // label can never disagree with what activating the row actually does.
        rowFullTitle(row) {
          return row.variantTitle ? row.productTitle + " " + row.variantTitle : row.productTitle;
        },
        rowActionLabel(row) {
          const title = this.rowFullTitle(row);
          if (this.isAdded(row.variantId)) return (this._strings.added || "") + " " + title;
          return (this._strings.add_product || "") + " " + title;
        },
        rowActionDisabled(row) {
          return this.isAdded(row.variantId);
        },
        groupAddable(group) {
          return group.variants.filter((row) => !this.isAdded(row.variantId));
        },
        groupActionDisabled(group) {
          return this.groupAddable(group).length === 0;
        },
        groupActionLabel(group) {
          if (!this.groupActionDisabled(group)) return (this._strings.add_product || "") + " " + group.productTitle;
          return (this._strings.added || "") + " " + group.productTitle;
        },

        // Add-only, no-op if already added — removal is only offered by the added-items table.
        addVariant(variantId) {
          if (this.isAdded(variantId)) return;
          const row = this.searchResults.find((searchRow) => searchRow.variantId === variantId);
          if (!row) return;
          this._addRowToTable(row);
          this._announce(this.rowFullTitle(row));
        },

        addProduct(productId) {
          const group = this.filteredGroups.find((g) => g.productId === productId);
          if (!group) return;
          const rows = this.groupAddable(group);
          if (!rows.length) return;
          rows.forEach((row) => this._addRowToTable(row));
          this._announce(group.productTitle);
        },

        _addRowToTable(row) {
          const rule = this._ruleFor(row);
          const qty = quantityRuleUtils.normalizeQuantity(this.getRowQty(row.variantId), rule);
          const existing = this.tableItems.find((tableItem) => tableItem.variantId === row.variantId);
          if (existing) {
            this.tableItems = this.tableItems.map((tableItem) => (tableItem.variantId === row.variantId ? { ...tableItem, qty } : tableItem));
          } else {
            this.tableItems = [...this.tableItems, { ...row, qty, isLoading: false, hasError: false, errorMessage: "", submitErrorMessage: "" }];
          }
          this._setQtyError(row.variantId, "", null, "table");
          this.persistTableItems();
        },

        _ruleFor(obj) {
          return quantityRuleUtils.normalizeRule(obj && obj.min, obj && obj.max, obj && obj.increment);
        },

        effectiveUnitPrice(obj, qty) {
          let price = obj.priceCents != null ? obj.priceCents : obj.price;
          const breaks = obj.priceBreaks;
          if (Array.isArray(breaks)) {
            for (const b of breaks) {
              if (qty >= b.minimumQuantity) price = b.price;
            }
          }
          return price;
        },

        // Whether a table item's price counts toward a money total (footer / group) — excludes
        // OOS, price-hidden, and not-yet-priced (loading/error) items so totals never overstate.
        _isPriceable(item) {
          return !item.isLoading && !item.hasError && item.available && !item.priceHidden;
        },

        getRowQty(variantId) {
          const item = this.tableItems.find((tableItem) => tableItem.variantId === variantId);
          if (item) return item.qty;
          const row = this.searchResults.find((r) => r.variantId === variantId);
          return this.rowQtys[variantId] ?? this._ruleFor(row).min;
        },

        rowUnitPriceFormatted(row) {
          return formatMoney(this.effectiveUnitPrice(row, this.getRowQty(row.variantId)), moneyFormat);
        },

        // Shared by the markup and changeRowQty so the a11y state and actual behavior can't drift apart.
        atQtyBound(row, delta) {
          const rule = this._ruleFor(row);
          const qty = this.getRowQty(row.variantId);
          return delta < 0 ? qty <= rule.min : rule.max !== null && qty >= rule.max;
        },

        ruleSummary(row) {
          const rule = this._ruleFor(row);
          const parts = [];
          if (rule.increment > 1) parts.push((this._strings.rule_inc || "Inc") + ": " + rule.increment);
          if (rule.min > 1) parts.push((this._strings.rule_min || "Min") + ": " + rule.min);
          if (rule.max !== null) parts.push((this._strings.rule_max || "Max") + ": " + rule.max);
          return parts.join(" . ");
        },

        changeRowQty(variantId, delta, inputEl) {
          const stepRow = this.searchResults.find((r) => r.variantId === variantId);
          // aria-disabled only (stays focusable) — enforce the actual bound here.
          if (stepRow && this.atQtyBound(stepRow, delta)) return;
          const rule = this._ruleFor(stepRow);
          const base = inputEl ? inputEl.value : this.getRowQty(variantId);
          const next = quantityRuleUtils.step(base, rule, delta);
          if (inputEl) inputEl.value = next; // :value won't re-render if unchanged
          this._setQtyError(variantId, "");
          if (this.isAdded(variantId)) {
            this._commitRowQtyToTable(variantId, next);
          } else {
            this.rowQtys = { ...this.rowQtys, [variantId]: next };
          }
        },

        setRowQty(variantId, event) {
          const row = this.searchResults.find((r) => r.variantId === variantId);
          // Dropdown channel: an invalid entry errors here only, without touching the table.
          const qty = this._validateRuleQty(variantId, event.target, this._ruleFor(row), event, "row");
          if (qty === null) return;
          if (this.isAdded(variantId)) {
            this._commitRowQtyToTable(variantId, qty);
          } else {
            this.rowQtys = { ...this.rowQtys, [variantId]: qty };
          }
        },

        _commitRowQtyToTable(variantId, qty) {
          this.tableItems = this.tableItems.map((tableItem) => (tableItem.variantId === variantId ? { ...tableItem, qty, submitErrorMessage: "" } : tableItem));
          this._setQtyError(variantId, "", null, "table");
          this.persistTableItems();
        },

        // On blur/change, an out-of-range value auto-corrects and commits; Enter with a bad value shows
        // a persistent error and commits nothing. Returns the quantity to commit, or null.
        _validateRuleQty(variantId, inputEl, rule, event, target) {
          if (quantityRuleUtils.isValid(inputEl.value, rule)) {
            this._setQtyError(variantId, "", null, target);
            const val = parseInt(inputEl.value, 10);
            inputEl.value = val;
            return val;
          }
          const v = parseInt(inputEl.value, 10);
          const belowMin = !Number.isInteger(v) || v < rule.min;
          const aboveMax = rule.max !== null && v > rule.max;
          // Mobile's input commits on "change", not "blur" (see bulk-order.liquid) — both must count.
          const isCommitEvent = event && (event.type === "blur" || event.type === "change");
          if (isCommitEvent && (belowMin || aboveMax)) {
            const message = quantityRuleUtils.buildError(inputEl.value, rule); // from the typed value
            const corrected = belowMin ? rule.min : rule.max;
            inputEl.value = corrected;
            this._setQtyError(variantId, message, 3000, target);
            return corrected;
          }
          this._setQtyError(variantId, quantityRuleUtils.buildError(inputEl.value, rule), 3000, target);
          return null;
        },

        // Central qtyErrors writer. `target` picks the channel: 'row' = the search-dropdown
        // row tooltip (qtyErrors), 'table' = the added-items table row tooltip (tableQtyErrors).
        // They are separate so a dropdown validation error never lights up the table row for the
        // same variant (and vice versa). Clears any pending auto-hide first so a newer message
        // (or clear) is never wiped by a stale timer. EVERY error auto-closes after a delay (5s by
        // default) — no bulk-order error is left persistent; `autoHideMs` overrides the delay.
        _setQtyError(variantId, message, autoHideMs, target) {
          const isTable = target === "table";
          const mapKey = isTable ? "tableQtyErrors" : "qtyErrors";
          const timers = isTable ? this._tableQtyErrorTimers : this._qtyErrorTimers;
          clearTimeout(timers[variantId]);
          this[mapKey] = { ...this[mapKey], [variantId]: message };
          if (message) {
            timers[variantId] = setTimeout(() => {
              this[mapKey] = { ...this[mapKey], [variantId]: "" };
            }, autoHideMs || 3000);
          }
        },

        // Drops errors for variants no longer in their own context, so a stale one can't reappear later.
        _pruneQtyErrors() {
          const liveRows = new Set([...this.searchResults.map((r) => r.variantId), ...this.tableItems.map((i) => i.variantId)]);
          this.qtyErrors = Object.fromEntries(Object.entries(this.qtyErrors).filter(([k]) => liveRows.has(k)));
          const liveTable = new Set(this.tableItems.map((i) => i.variantId));
          this.tableQtyErrors = Object.fromEntries(Object.entries(this.tableQtyErrors).filter(([k]) => liveTable.has(k)));
        },

        getItemTotal(item) {
          if (!this._isPriceable(item)) return "--";
          return formatMoney(this.effectiveUnitPrice(item, item.qty) * item.qty, moneyFormat);
        },

        // Degrades to "" rather than throw — item.url isn't set yet while a restored row is still loading.
        variantUrl(item) {
          if (!item.url) return "";
          return item.url + (item.url.includes("?") ? "&" : "?") + "variant=" + item.variantId;
        },

        itemUnitPriceFormatted(item) {
          return formatMoney(this.effectiveUnitPrice(item, item.qty), moneyFormat);
        },

        getGroupTotal(group) {
          const priceableItems = group.items.filter((item) => this._isPriceable(item));
          if (!priceableItems.length) return "--";
          const totalCents = priceableItems.reduce((sum, item) => sum + this.effectiveUnitPrice(item, item.qty) * item.qty, 0);
          return formatMoney(totalCents, moneyFormat);
        },

        // "From {price}" only when the group spans more than one price; excludes price-hidden variants.
        getGroupPriceLabel(group) {
          const prices = group.items.filter((item) => !item.priceHidden).map((item) => item.priceCents);
          if (!prices.length) return "";
          const minCents = Math.min(...prices);
          const maxCents = Math.max(...prices);
          const formatted = formatMoney(minCents, moneyFormat);
          if (minCents === maxCents) return formatted;
          return (this._strings.price_from || "").replace("[[PRICE]]", formatted) || formatted;
        },

        toggleGroup(productId) {
          this.collapsedGroups = { ...this.collapsedGroups, [productId]: !this.collapsedGroups[productId] };
        },

        toggleDropdownGroup(productId) {
          const willCollapse = !this.dropdownCollapsed[productId];
          // Collapsing hides these rows (display:none) — move focus out first or it's stranded.
          const groupEl = willCollapse ? document.getElementById("bo-group-" + productId) : null;
          const focusInGroup = !!groupEl?.contains(document.activeElement);
          this.dropdownCollapsed = { ...this.dropdownCollapsed, [productId]: willCollapse };
          this.$nextTick(() => {
            if (focusInGroup) this.$refs.searchInput?.focus();
            this._armFocusTrap();
          });
        },

        removeProductGroup(groupKey) {
          this._removeFromTable((tableItem) => (tableItem.productId ?? tableItem.handle) !== groupKey);
        },

        getImgUrl(url) {
          if (!url) return "";
          const clean = url.replace(/_\d+x\d*(?:_crop_\w+)?(\.\w+)/, "$1");
          return clean.replace(/(\.\w+)(\?|$)/, "_240x240$1$2");
        },

        changeTableQty(variantId, delta, inputEl) {
          this.tableItems = this.tableItems.map((tableItem) => {
            if (tableItem.variantId !== variantId) return tableItem;
            const rule = this._ruleFor(tableItem);
            const base = inputEl ? inputEl.value : tableItem.qty;
            const next = quantityRuleUtils.step(base, rule, delta);
            if (inputEl) inputEl.value = next; // :value won't re-render if unchanged
            return { ...tableItem, qty: next, submitErrorMessage: "" };
          });
          this._setQtyError(variantId, "", null, "table");
          this.persistTableItems();
        },

        setTableQty(variantId, event) {
          const item = this.tableItems.find((tableItem) => tableItem.variantId === variantId);
          const qty = this._validateRuleQty(variantId, event.target, this._ruleFor(item), event, "table");
          if (qty === null) return;
          this.tableItems = this.tableItems.map((tableItem) => (tableItem.variantId === variantId ? { ...tableItem, qty, submitErrorMessage: "" } : tableItem));
          this.persistTableItems();
        },

        _removeFromTable(keepPredicate) {
          this.tableItems = this.tableItems.filter(keepPredicate);
          this.persistTableItems();
          this._pruneQtyErrors();
          this._maybeResetCsvImportFlag();
        },

        removeItem(variantId) {
          this._removeFromTable((tableItem) => tableItem.variantId !== variantId);
        },

        _openConfirmPopup(flagName, dialogRefName, closeBtnRefName) {
          this[flagName] = true;
          document.body.classList.add("overflow-y-hidden");
          this.$nextTick(() => {
            Alpine.store("xFocusElement").trapFocus(this.$refs[dialogRefName].id, this.$refs[closeBtnRefName].id);
          });
        },

        _closeConfirmPopup(flagName) {
          this[flagName] = false;
          document.body.classList.remove("overflow-y-hidden");
          Alpine.store("xFocusElement").removeTrapFocus();
        },

        openRemoveItemConfirm(variantId) {
          this.pendingRemoveVariantId = variantId;
          this._openConfirmPopup("showRemoveItemConfirm", "removeItemDialog", "removeItemCloseBtn");
        },

        // Reuses the single-item remove popup; confirmRemoveItem() checks which target is pending.
        openRemoveGroupConfirm(groupId) {
          this.pendingRemoveGroupId = groupId;
          this._openConfirmPopup("showRemoveItemConfirm", "removeItemDialog", "removeItemCloseBtn");
        },

        closeRemoveItemConfirm() {
          this._closeConfirmPopup("showRemoveItemConfirm");
          this.pendingRemoveVariantId = null;
          this.pendingRemoveGroupId = null;
        },

        confirmRemoveItem() {
          const variantId = this.pendingRemoveVariantId;
          const groupId = this.pendingRemoveGroupId;
          this.closeRemoveItemConfirm();
          if (groupId != null) {
            this.removeProductGroup(groupId);
          } else {
            this.removeItem(variantId);
          }
        },

        openRemoveAllConfirm() {
          this._openConfirmPopup("showRemoveAllConfirm", "removeAllDialog", "removeAllCloseBtn");
        },

        closeRemoveAllConfirm() {
          this._closeConfirmPopup("showRemoveAllConfirm");
        },

        confirmClearAll() {
          this.closeRemoveAllConfirm();
          this.tableItems = [];
          this.persistTableItems();
          this._pruneQtyErrors();
          document.dispatchEvent(new CustomEvent("bulk-order:table-cleared", { bubbles: true }));

          this.$nextTick(() => {
            requestAnimationFrame(() => {
              this.$root.scrollIntoView({ behavior: "smooth", block: "center" });
            });
          });
        },

        // Sums duplicate lines for the same variant (e.g. one with a preorder property, one without).
        _quantitiesByVariant(cartItems) {
          const quantities = {};
          cartItems.forEach((cartItem) => {
            const variantId = String(cartItem.variant_id);
            quantities[variantId] = (quantities[variantId] || 0) + cartItem.quantity;
          });
          return quantities;
        },

        async _fetchCartQuantities() {
          const res = await fetch(`${window.Shopify.routes.root}cart.js`);
          if (!res.ok) throw new Error("[BulkOrder] cart.js HTTP " + res.status);
          const cart = await res.json();
          return this._quantitiesByVariant(cart.items);
        },

        _applyCartSectionUpdates(sectionsToRender, data) {
          sectionsToRender.forEach((cartSection) => {
            const sectionEl = document.querySelector(cartSection.selector);
            if (sectionEl && data.sections?.[cartSection.id]) {
              sectionEl.innerHTML = getSectionInnerHTML(data.sections[cartSection.id], cartSection.selector);
            }
          });

          const cartDrawerEl = document.getElementById("CartDrawer");
          if (cartDrawerEl) cartDrawerEl.isOpen = true;

          window.xCartHelper?.updateCurrentCountItem();
          document.dispatchEvent(
            new CustomEvent(CART_EVENT.cartUpdate, {
              bubbles: true,
              detail: { isItemCountChanged: true },
            })
          );
        },

        // Only runs on a cart/add.js error — diffs cart quantities before/after to find what actually succeeded.
        async _reconcileAfterPartialFailure(readyItems, beforeQuantities, sectionsToRender) {
          let afterCart;
          try {
            const res = await fetch(`${window.Shopify.routes.root}cart/update.js`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ updates: {}, sections: sectionsToRender.map((cartSection) => cartSection.id) }),
            });
            afterCart = await res.json();
          } catch (reconcileError) {
            console.error("[BulkOrder]", reconcileError);
            this.submitError = this._strings.add_to_cart_failed || "Failed to add to cart. Please try again.";
            return;
          }

          const afterQuantities = this._quantitiesByVariant(afterCart.items);

          // cart/add.js stops at the first zero-quantity add — only that item gets the "blocking" message.
          let blockerVariantId = null;
          for (const readyItem of readyItems) {
            const beforeQty = beforeQuantities[readyItem.variantId] || 0;
            const afterQty = afterQuantities[readyItem.variantId] || 0;
            if (afterQty - beforeQty <= 0) {
              blockerVariantId = readyItem.variantId;
              break;
            }
          }

          const succeededIds = [];
          this.tableItems = this.tableItems.map((tableItem) => {
            const readyItem = readyItems.find((ready) => ready.variantId === tableItem.variantId);
            if (!readyItem) return tableItem;

            const beforeQty = beforeQuantities[tableItem.variantId] || 0;
            const afterQty = afterQuantities[tableItem.variantId] || 0;
            const addedQty = afterQty - beforeQty;

            if (addedQty >= readyItem.qty) {
              succeededIds.push(tableItem.variantId);
              return tableItem;
            }
            if (addedQty > 0) {
              return {
                ...tableItem,
                qty: readyItem.qty - addedQty,
                submitErrorMessage: this._strings.max_quantity_in_cart,
              };
            }
            if (tableItem.variantId === blockerVariantId) {
              return { ...tableItem, submitErrorMessage: this._strings.blocking_cart_error };
            }
            return { ...tableItem, submitErrorMessage: undefined };
          });

          if (succeededIds.length) {
            const succeededSet = new Set(succeededIds);
            this.tableItems = this.tableItems.filter((tableItem) => !succeededSet.has(tableItem.variantId));
            this._maybeResetCsvImportFlag();
          }
          this.persistTableItems();

          if (succeededIds.length) {
            this._applyCartSectionUpdates(sectionsToRender, afterCart);
          }
        },

        async handleSubmit() {
          // Sold-out and price-hidden items are silently skipped, left in the table.
          const readyItems = this.tableItems.filter((tableItem) => !tableItem.isLoading && !tableItem.hasError && tableItem.available && !tableItem.marketUnavailable && !tableItem.priceHidden);
          if (!readyItems.length || this.isSubmitting) return;

          this.isSubmitting = true;
          this.submitError = "";
          this.tableItems = this.tableItems.map((tableItem) => ({ ...tableItem, submitErrorMessage: "" }));

          const preorderKey = this._strings.preorder_key;
          const preorderMsg = this._strings.preorder_message;
          const items = readyItems.map((tableItem) => ({
            id: parseInt(tableItem.variantId, 10),
            quantity: tableItem.qty,
            ...(tableItem.isPreorder && preorderKey && preorderMsg ? { properties: { [preorderKey]: preorderMsg } } : {}),
          }));

          const sectionsToRender = window.xCartHelper?.getSectionsToRender(this._cartDrawerId) || [];
          const sections = sectionsToRender.map((cartSection) => cartSection.id);

          let beforeQuantities = null;
          try {
            beforeQuantities = await this._fetchCartQuantities();
          } catch (snapshotError) {
            console.error("[BulkOrder]", snapshotError);
          }

          const _slUpdate = window.MaximizeStorefrontEvents?.createCartLinesUpdate({
            action: 'add',
            context: 'standard-action',
            lines: items,
            element: document,
          });

          try {
            const res = await fetch(`${window.Shopify.routes.root}cart/add.js`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items, sections }),
            });
            const data = await res.json();

            if (data.status === 422) {
              const _422msg = data.description || data.message || '';
              // 422 Declined → resolve with userErrors; do NOT also dispatch cart:error (mutually exclusive)
              _slUpdate?.resolve(null, [{ code: 'MAXIMUM_EXCEEDED', message: _422msg }]);
              if (beforeQuantities) {
                await this._reconcileAfterPartialFailure(readyItems, beforeQuantities, sectionsToRender);
              } else {
                this.submitError = data.description;
              }
              return;
            }

            _slUpdate?.resolve(data);
            this._applyCartSectionUpdates(sectionsToRender, data);

            const submittedIds = new Set(readyItems.map((tableItem) => tableItem.variantId));
            this.tableItems = this.tableItems.filter((tableItem) => !submittedIds.has(tableItem.variantId));
            this.persistTableItems();
            this._pruneQtyErrors();
            this._maybeResetCsvImportFlag();
          } catch (addToCartError) {
            _slUpdate?.reject(addToCartError);
            window.MaximizeStorefrontEvents?.dispatchCartError(
              addToCartError?.message || 'Cart add failed', 'SERVICE_UNAVAILABLE', document
            );
            console.error("[BulkOrder]", addToCartError);
            this.submitError = this._strings.add_to_cart_failed || "Failed to add to cart. Please try again.";
          } finally {
            this.isSubmitting = false;
            // Tells xBulkOrderImport (separate component) its Phase 2 result message is now stale.
            document.dispatchEvent(new CustomEvent(BULK_ORDER_EVENT.cartSubmitResolved, { bubbles: true }));
          }
        },
      }));
    };
    if (window.Alpine) {
      defineXBulkOrder();
    } else {
      document.addEventListener("alpine:init", defineXBulkOrder);
    }
  });
}
