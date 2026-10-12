if (!window.Maximize.loadedScript.includes("bulk-order-import.js")) {
  window.Maximize.loadedScript.push("bulk-order-import.js");

  const IMPORT_CONCURRENCY = 6;
  const MAX_ROWS = 100;
  const EXPECTED_COLUMNS = 2; // SKU, Quantity
  const BULK_ORDER_USED_CSV_IMPORT_KEY = "bulk_order_used_csv_import";
  const BULK_ORDER_TABLE_STORAGE_KEY = "bulk_order_table_items"; // must match bulk-order.js's key

  window.Maximize.bulkOrderSearchCache = window.Maximize.bulkOrderSearchCache || {}; // shared with bulk-order.js's _searchCache

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

  // Excel/Sheets "CSV UTF-8" exports commonly prepend a BOM to the first cell.
  function stripBOM(text) {
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  }

  // Hand-rolled RFC-4180-ish parser: quoted fields, embedded commas/newlines, "" escapes.
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (inQuotes) {
        if (char === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"' && field === "") {
        // Only a leading " opens a quoted field (RFC 4180) — elsewhere it's literal.
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }

    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    // Blank rows stay in the array — dropping them here would shift every later row's line number.
    return rows;
  }

  const SAMPLE_CSV_CONTENT = ["SKU (*),Quantity", "00001,70", "00002,60", "00003,30", "00004,30", "00005,50", "00011,50", "00022,60"].join("\r\n"); // static reference, not a live catalog export

  requestAnimationFrame(() => {
    const defineXBulkOrderImport = () => {
      Alpine.data("xBulkOrderImport", (moneyFormat) => ({
        selectedFile: null,
        isDragOver: false, // dropzone highlight while a file is dragged over it
        isValidating: false, // pre-handle: parsing + validating the file, right after it's selected
        isProcessing: false, // actually resolving + importing, after clicking "Import"
        fileError: "", // single file-level blocking message (wrong type, empty, corrupt, too many products)
        rowErrorLines: [], // already-grouped, ready-to-render strings, e.g. "Row 1, 2: Invalid quantity."
        previewMessage: "", // success message: pre-handle preview only (Phase 1)

        importTotal: 0,
        importProcessed: 0,
        importResultMessage: "", // final success message, e.g. "80/160 have been successfully added."
        importResultErrorLines: [], // Phase 2 errors: no_match / search_failed (ambiguous_match is its own line, see ambiguousGroups)
        _importSuccessCount: 0, // items.length behind importResultMessage — kept so the popup can add to it later

        ambiguousGroups: [], // one entry per SKU, see _resolveRows
        selectedCandidates: {}, // variantId → boolean, across all ambiguousGroups
        showAmbiguousPopup: false,
        ambiguousButtonHidden: false, // once true, hides the "Select products" button even with groups still unresolved — the message stays as-is

        _moneyFormat: moneyFormat,
        _strings: {},
        _parsed: null, // { rows } cached after a successful pre-handle validate, reused by submitImport()

        hasUsedCsvImport: false, // gates the compact CSV controls bar / getting-started panel
        showImportConfirm: false, // shown before an import that would replace a non-empty table

        get canImport() {
          return !!this.selectedFile && !this.isValidating && !this.isProcessing && !this.fileError && this.rowErrorLines.length === 0 && !!this._parsed && this._parsed.rows.length > 0;
        },

        get importProgressPercent() {
          return this.importTotal > 0 ? Math.min(100, (this.importProcessed / this.importTotal) * 100) : 0;
        },

        get hasImportProgress() {
          return this.isProcessing || !!this.importResultMessage || this.importResultErrorLines.length > 0 || this.ambiguousGroups.length > 0;
        },

        get hasSelectedCandidates() {
          return Object.values(this.selectedCandidates).some(Boolean);
        },

        get ambiguousSummaryText() {
          const skus = this.ambiguousGroups.map((group) => group.sku).join(", ");
          return (this._strings.errors.ambiguous_match || "").replace("[[SKU]]", skus);
        },

        init() {
          const stringsEl = this.$el.querySelector("[data-bulk-order-import-strings]");
          this._strings = stringsEl ? JSON.parse(stringsEl.textContent) : { errors: {} };

          try {
            this.hasUsedCsvImport = localStorage.getItem(BULK_ORDER_USED_CSV_IMPORT_KEY) === "true";
          } catch (storageError) {}

          document.addEventListener("bulk-order:table-cleared", () => {
            this.hasUsedCsvImport = false;
            this.importResultMessage = "";
            this.importResultErrorLines = [];
            this.ambiguousGroups = [];
            this.selectedCandidates = {};
            this.ambiguousButtonHidden = false;
            this._importSuccessCount = 0;
            try {
              localStorage.removeItem(BULK_ORDER_USED_CSV_IMPORT_KEY);
            } catch (storageError) {}
          });

          // xBulkOrder dispatches this once its cart submit resolves — the Phase 2 message is stale by then.
          document.addEventListener(BULK_ORDER_EVENT.cartSubmitResolved, () => {
            this.importResultMessage = "";
            this.importResultErrorLines = [];
          });
        },

        // ---- File input ----

        onFilePicked(event) {
          const file = event.target.files && event.target.files[0];
          this._handleFile(file);
          event.target.value = "";
        },

        onFileDropped(event) {
          this.isDragOver = false;
          const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
          this._handleFile(file);
        },

        _handleFile(file) {
          this.fileError = "";
          this.rowErrorLines = [];
          this.previewMessage = "";
          this._parsed = null;
          if (!file) return;

          if (!/\.csv$/i.test(file.name || "")) {
            this.fileError = this._strings.errors.invalid_file_type;
            this.selectedFile = null;
            return;
          }

          this.selectedFile = file;
          this._validateSelectedFile();
        },

        // ---- Pre-handle: parse + validate immediately on file select, before Import is enabled ----

        // physicalRow = index+2: 0-based data-row index, plus the header row and 1-based line numbers.
        normalizeRow(rawRow, index) {
          const physicalRow = index + 2;
          const rowRef = String(physicalRow);

          if (rawRow.length !== EXPECTED_COLUMNS) {
            return { rowRef, columnError: true };
          }

          const [skuRaw, qtyRaw] = rawRow;
          const sku = (skuRaw || "").trim();
          const qtyTrim = (qtyRaw || "").trim();

          let qty = null;
          let qtyError = false;
          if (qtyTrim) {
            // Positive integers only — a decimal like "2.5" errors rather than silently truncating.
            if (!/^\d+$/.test(qtyTrim) || parseInt(qtyTrim, 10) <= 0) qtyError = true;
            else qty = parseInt(qtyTrim, 10);
          } // else: blank qty is valid, resolved later from quantity_rule.min

          return { rowRef, sku, qty, qtyError, columnError: false };
        },

        _findDuplicateSkuErrors(rows) {
          const rowRefsBySku = {};
          rows.forEach((row) => {
            const key = row.sku.toLowerCase();
            (rowRefsBySku[key] = rowRefsBySku[key] || { sku: row.sku, rowRefs: [] }).rowRefs.push(row.rowRef);
          });
          return Object.values(rowRefsBySku)
            .filter((entry) => entry.rowRefs.length > 1)
            .map((entry) => {
              const sortedRowRefs = [...entry.rowRefs].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
              const label = (this._strings.row_error_label || "Row [[ROW]]").replace("[[ROW]]", sortedRowRefs.join(", "));
              const message = (this._strings.errors.duplicate_sku || "").replace("[[SKU]]", entry.sku);
              return message + ": " + label;
            });
        },

        // errorsByType: { errorKey: [rowRef, ...] } -> ["<message>: Row 1, 2, 3", ...]
        _formatGroupedErrors(errorsByType) {
          return Object.entries(errorsByType).map(([key, rowRefs]) => {
            // Concurrent resolution in submitImport() can push rowRefs out of order.
            const sortedRowRefs = [...rowRefs].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
            const label = (this._strings.row_error_label || "Row [[ROW]]").replace("[[ROW]]", sortedRowRefs.join(", "));
            return (this._strings.errors[key] || key) + ": " + label;
          });
        },

        async _validateSelectedFile() {
          this.isValidating = true;
          this.fileError = "";
          this.rowErrorLines = [];
          this.previewMessage = "";
          this._parsed = null;

          const file = this.selectedFile;

          try {
            const rawText = await file.text();
            const rawRows = parseCSV(stripBOM(rawText));

            if (rawRows.length <= 1) {
              this.fileError = this._strings.errors.empty_file;
              return;
            }

            const normalizedRows = rawRows.slice(1).map((rawRow, index) => this.normalizeRow(rawRow, index));

            const errorsByType = {};
            const validRows = [];
            const rowsWithSku = []; // every row with a SKU, even ones with other errors — see _findDuplicateSkuErrors

            if (rawRows[0].length !== EXPECTED_COLUMNS) {
              (errorsByType.invalid_row_format = errorsByType.invalid_row_format || []).push("1");
            }

            normalizedRows.forEach((row) => {
              if (row.columnError) {
                (errorsByType.invalid_row_format = errorsByType.invalid_row_format || []).push(row.rowRef);
                return;
              }

              let hasBlockingError = false;

              if (!row.sku) {
                (errorsByType.missing_required_field = errorsByType.missing_required_field || []).push(row.rowRef);
                hasBlockingError = true;
              } else {
                rowsWithSku.push(row);
              }
              if (row.qtyError) {
                (errorsByType.invalid_qty = errorsByType.invalid_qty || []).push(row.rowRef);
                hasBlockingError = true;
              }

              if (!hasBlockingError) validRows.push(row);
            });

            if (Object.keys(errorsByType).length) {
              this.rowErrorLines = this._formatGroupedErrors(errorsByType);
            }

            this.rowErrorLines = this.rowErrorLines.concat(this._findDuplicateSkuErrors(rowsWithSku));

            if (validRows.length > MAX_ROWS) {
              this.fileError = (this._strings.errors.too_many_rows || "").replace("[[COUNT]]", validRows.length);
            }

            if (this.rowErrorLines.length || this.fileError) return;

            this._parsed = { rows: validRows };
            this.previewMessage = (this._strings.preview_message || "").replace("[[ROW_COUNT]]", validRows.length);
          } catch (validateError) {
            console.error("[BulkOrderImport]", validateError);
            this.fileError = this._strings.errors.invalid_file_type;
          } finally {
            this.isValidating = false;
          }
        },

        // ---- Resolve variants via search (SKU only, no handle) ----

        // fields=variants.sku scopes matching to SKU only, so it can't match on title text.
        async fetchCandidatesBySku(sku) {
          const url = Shopify.routes.root + "search/suggest" + "?q=" + encodeURIComponent(sku) + "&resources[type]=product" + "&resources[limit]=10" + "&resources[options][fields]=variants.sku" + "&section_id=bulk-order-search-results";

          const res = await fetch(url);
          if (!res.ok) throw new Error("[BulkOrderImport] search HTTP " + res.status);

          const html = await res.text();
          const doc = new DOMParser().parseFromString(html, "text/html");
          const scriptEl = doc.getElementById("bulk-order-results-data");
          if (!scriptEl) return [];

          return JSON.parse(scriptEl.textContent).map((variantRow) => ({
            ...variantRow,
            variantId: String(variantRow.variantId),
          }));
        },

        async _getCandidatesForSku(sku) {
          const cacheKey = sku.toLowerCase();
          const cached = window.Maximize.bulkOrderSearchCache[cacheKey];
          if (cached) return cached;
          const candidates = await this.fetchCandidatesBySku(sku);
          window.Maximize.bulkOrderSearchCache[cacheKey] = candidates;
          return candidates;
        },

        // Predictive Search can return partial/prefix matches — narrow to the exact SKU here.
        _matchRowInCandidates(row, candidates) {
          const skuNorm = row.sku.toLowerCase();
          const matches = candidates.filter((variantRow) => (variantRow.sku || "").trim().toLowerCase() === skuNorm);

          if (!matches.length) return { ok: false, error: "no_match" };
          if (matches.length > 1) return { ok: false, error: "ambiguous_match", matches };
          return { ok: true, variantRow: matches[0] };
        },

        _qtyObeysRule(row, variantRow) {
          if (!row.qty) return true;
          const rule = quantityRuleUtils.normalizeRule(variantRow.min, variantRow.max, variantRow.increment);
          return quantityRuleUtils.isValid(row.qty, rule);
        },

        buildTableItem(row, variantRow) {
          const qty = row.qty || variantRow.quantityMin || 1;
          return {
            ...variantRow,
            priceFormatted: formatMoney(variantRow.price, this._moneyFormat),
            compareAtPriceFormatted: variantRow.compareAtPrice && variantRow.compareAtPrice !== variantRow.price ? formatMoney(variantRow.compareAtPrice, this._moneyFormat) : "",
            priceCents: variantRow.price,
            qty,
          };
        },

        async _resolveRows(rows) {
          const items = [];
          const errors = []; // [{ key, rowRef, sku, qty, matches }]
          let hasNetworkError = false;

          await runWithConcurrency(rows, IMPORT_CONCURRENCY, async (row) => {
            let candidates;
            try {
              candidates = await this._getCandidatesForSku(row.sku);
            } catch (fetchError) {
              if (!navigator.onLine || fetchError instanceof TypeError) {
                hasNetworkError = true;
              } else {
                errors.push({ key: "search_failed", rowRef: row.rowRef });
              }
              this.importProcessed += 1;
              return;
            }

            const result = this._matchRowInCandidates(row, candidates);
            if (!result.ok) {
              errors.push({ key: result.error, rowRef: row.rowRef, sku: row.sku, qty: row.qty, matches: result.matches });
            } else {
              // Rejected, not auto-adjusted — the table would otherwise show numbers the file didn't have.
              if (!this._qtyObeysRule(row, result.variantRow)) {
                errors.push({ key: "qty_violates_rule", rowRef: row.rowRef });
              } else {
                items.push(this.buildTableItem(row, result.variantRow));
              }
            }
            this.importProcessed += 1;
          });

          if (hasNetworkError) {
            return { items, errorLines: [this._strings.errors.network_error], ambiguousGroups: [], networkError: true };
          }

          const ambiguousErrors = errors.filter((error) => error.key === "ambiguous_match");
          const otherErrors = errors.filter((error) => error.key !== "ambiguous_match");

          const errorsByType = {};
          otherErrors.forEach(({ key, rowRef }) => {
            errorsByType[key] = errorsByType[key] || [];
            errorsByType[key].push(rowRef);
          });

          // A SKU on more than one CSV row must merge into one group (deduped by variantId) —
          // else x-for's :key="group.sku" collides and Alpine mismatches checkbox state.
          const ambiguousGroups = [];
          const groupBySku = {};
          const seenVariantIdsBySku = {};
          ambiguousErrors.forEach((error) => {
            if (!(error.sku in groupBySku)) {
              groupBySku[error.sku] = { sku: error.sku, candidates: [] };
              seenVariantIdsBySku[error.sku] = new Set();
              ambiguousGroups.push(groupBySku[error.sku]);
            }
            const group = groupBySku[error.sku];
            const seenVariantIds = seenVariantIdsBySku[error.sku];
            (error.matches || []).forEach((variantRow) => {
              if (seenVariantIds.has(variantRow.variantId)) return;
              seenVariantIds.add(variantRow.variantId);
              group.candidates.push(this.buildTableItem({ qty: error.qty }, variantRow));
            });
          });

          return { items, errorLines: this._formatGroupedErrors(errorsByType), ambiguousGroups };
        },

        // ---- Import (Phase 2 — only runs on click, reuses the pre-handle result) ----

        // Reads xBulkOrder's persisted localStorage key directly, to avoid cross-component coupling.
        _tableHasItems() {
          try {
            const raw = localStorage.getItem(BULK_ORDER_TABLE_STORAGE_KEY);
            const savedItems = raw ? JSON.parse(raw) : [];
            return Array.isArray(savedItems) && savedItems.length > 0;
          } catch (storageError) {
            return false;
          }
        },

        onImportClick() {
          if (!this.canImport) return;
          if (this._tableHasItems()) {
            this.openImportConfirm();
          } else {
            this.submitImport();
          }
        },

        openImportConfirm() {
          this.showImportConfirm = true;
          document.body.classList.add("overflow-y-hidden");
          this.$nextTick(() => {
            Alpine.store("xFocusElement").trapFocus(this.$refs.importConfirmDialog.id, this.$refs.importConfirmCloseBtn.id);
          });
        },

        closeImportConfirm() {
          this.showImportConfirm = false;
          document.body.classList.remove("overflow-y-hidden");
          Alpine.store("xFocusElement").removeTrapFocus();
        },

        confirmImport() {
          this.closeImportConfirm();
          this.submitImport();
        },

        // ---- Ambiguous SKU resolution popup ----

        // Duplicated from bulk-order.js's getImgUrl — separate Alpine components, no shared module.
        getImgUrl(url) {
          if (!url) return "";
          const clean = url.replace(/_\d+x\d*(?:_crop_\w+)?(\.\w+)/, "$1");
          return clean.replace(/(\.\w+)(\?|$)/, "_240x240$1$2");
        },

        toggleCandidateSelection(variantId) {
          this.selectedCandidates = { ...this.selectedCandidates, [variantId]: !this.selectedCandidates[variantId] };
        },

        // Checked state is computed (see isGroupFullySelected); clicking forces every candidate to match.
        isGroupFullySelected(group) {
          return group.candidates.length > 0 && group.candidates.every((candidate) => !!this.selectedCandidates[candidate.variantId]);
        },

        toggleAmbiguousGroupSelection(group, event) {
          const isSelected = event.target.checked;
          group.candidates.forEach((candidate) => {
            this.selectedCandidates = { ...this.selectedCandidates, [candidate.variantId]: isSelected };
          });
        },

        // Volume pricing at the candidate's fixed (CSV) quantity — same rule bulk-order.js's
        // effectiveUnitPrice applies, duplicated here since the two files share no module.
        _ambiguousUnitPrice(candidate) {
          let price = candidate.priceCents;
          if (Array.isArray(candidate.priceBreaks)) {
            candidate.priceBreaks.forEach((priceBreak) => {
              if (candidate.qty >= priceBreak.minimumQuantity) price = priceBreak.price;
            });
          }
          return price;
        },

        ambiguousCandidateTotal(candidate) {
          return formatMoney(this._ambiguousUnitPrice(candidate) * candidate.qty, this._moneyFormat);
        },

        openAmbiguousPopup() {
          this.showAmbiguousPopup = true;
          document.body.classList.add("overflow-y-hidden");
          this.$nextTick(() => {
            Alpine.store("xFocusElement").trapFocus(this.$refs.ambiguousDialog.id, this.$refs.ambiguousCloseBtn.id);
          });
        },

        closeAmbiguousPopup() {
          this.showAmbiguousPopup = false;
          document.body.classList.remove("overflow-y-hidden");
          Alpine.store("xFocusElement").removeTrapFocus();
        },

        // Ambiguous SKUs never selected here are dropped — the popup opens once per import and never reopens.
        confirmAddAmbiguousSelection() {
          const itemsToAdd = [];
          this.ambiguousGroups.forEach((group) => {
            itemsToAdd.push(...group.candidates.filter((candidate) => this.selectedCandidates[candidate.variantId]));
          });
          if (!itemsToAdd.length) return;

          this.selectedCandidates = {};
          this.ambiguousButtonHidden = true;
          this.closeAmbiguousPopup();

          this.hasUsedCsvImport = true;
          try {
            localStorage.setItem(BULK_ORDER_USED_CSV_IMPORT_KEY, "true");
          } catch (storageError) {}

          document.dispatchEvent(
            new CustomEvent("bulk-order:ambiguous-items-added", {
              bubbles: true,
              detail: { items: itemsToAdd },
            })
          );
        },

        async submitImport() {
          if (!this.canImport) return;

          const rows = this._parsed.rows; // captured now — this._parsed may be reassigned before this run finishes
          const total = rows.length;

          this.isProcessing = true;
          this.importTotal = total;
          this.importProcessed = 0;
          this.importResultMessage = "";
          this.importResultErrorLines = [];
          this.ambiguousGroups = [];
          this.selectedCandidates = {};
          this.ambiguousButtonHidden = false;
          this._importSuccessCount = 0;
          this.rowErrorLines = [];
          this.previewMessage = "";
          this.selectedFile = null;
          this._parsed = null;

          document.dispatchEvent(new CustomEvent(BULK_ORDER_EVENT.importStarted, { bubbles: true }));

          let items = [];
          try {
            const resolved = await this._resolveRows(rows);
            items = resolved.items;
            this.importResultErrorLines = resolved.errorLines;
            this.ambiguousGroups = resolved.ambiguousGroups || [];
            this._importSuccessCount = items.length;
            if (items.length) {
              this.importResultMessage = (this._strings.success_message || "").replace("[[PROCESSED]]", this._importSuccessCount).replace("[[TOTAL]]", total);
              this.hasUsedCsvImport = true;
              try {
                localStorage.setItem(BULK_ORDER_USED_CSV_IMPORT_KEY, "true");
              } catch (storageError) {}
            }
          } catch (submitError) {
            console.error("[BulkOrderImport]", submitError);
          } finally {
            this.isProcessing = false;
            // Table just got replaced with nothing — bring the getting-started dropzone back.
            if (!items.length) {
              this.hasUsedCsvImport = false;
              try {
                localStorage.removeItem(BULK_ORDER_USED_CSV_IMPORT_KEY);
              } catch (storageError) {}
            }
            // Always dispatched, even on failure — xBulkOrder listens for this to re-enable "Add to cart".
            document.dispatchEvent(
              new CustomEvent("bulk-order:import-resolved", {
                bubbles: true,
                detail: { items },
              })
            );
          }
        },

        // ---- Export template ----

        triggerFileDownload(filename, content) {
          const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        },

        downloadExampleFile() {
          this.triggerFileDownload("bulk-order-import-template.csv", SAMPLE_CSV_CONTENT);
        },
      }));
    };
    if (window.Alpine) {
      defineXBulkOrderImport();
    } else {
      document.addEventListener("alpine:init", defineXBulkOrderImport);
    }
  });
}
