class CartDrawer extends HTMLElement {
  connectedCallback() {
    this._sectionId = this.dataset.sectionId;
    this._t = null;
    this._isLoading = false;
    this._inputTimers = new WeakMap();
    this._blurTimers = new WeakMap(); // B2B: per-input 2s debounce that runs the qty-rule validation
    this._errorTimers = {}; // line → auto-hide timer for blur-corrected quantity errors

    this._isOpeningCartDrawer = false;
    this._isOpenUpsell = false;
    this.returnFocusEl = null;

    this._boundClick = this._onClickHandler.bind(this);
    this._boundInput = this._onInputHandler.bind(this);
    this._boundKeydown = this._onKeydownHandler.bind(this);
    this._boundOpen = () => { this.isOpen = true; };
    this._boundClose = () => { this.handleClose(); };
    this._boundCartUpdate = (e) => {
      if (e.detail?.openMiniCart) { this.isOpen = true; }
    };
    this.addEventListener('click', this._boundClick);
    this.addEventListener('input', this._boundInput);
    this.addEventListener('keydown', this._boundKeydown);
    document.addEventListener('cart:minicart:open', this._boundOpen);
    document.addEventListener('cart:minicart:close', this._boundClose);
    document.addEventListener(CART_EVENT.cartUpdate, this._boundCartUpdate);

    this._initEstimateShipping();
    this._lazyObservers = [];
    this._openCallbacks = [];

    this._openCallbacks.push(() => this._initEstimateShippingBanner());
    this._watchLazyScript('cart-drawer-upsell', this.dataset.upsellScript);
    this._watchLazyScript(
      'estimate-shipping-rate',
      this.dataset.estimateShippingScript,
      () => {
        this.querySelectorAll('.auto-calculate-shipping__wrapper').forEach(el => {
          if (!el._x_dataStack) Alpine.initTree(el);
        });
      },
      'estimate-shipping-rate, .auto-calculate-shipping__wrapper'
    );
    this._watchLazyScript('cart-term', this.dataset.cartTermScript);
    this._watchLazyScript('cart-fields', this.dataset.cartFieldsScript);
    this._watchLazyScript('coupon-code', this.dataset.couponCodeScript);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._boundClick);
    this.removeEventListener('input', this._boundInput);
    this.removeEventListener('keydown', this._boundKeydown);
    document.removeEventListener('cart:minicart:open', this._boundOpen);
    document.removeEventListener('cart:minicart:close', this._boundClose);
    document.removeEventListener(CART_EVENT.cartUpdate, this._boundCartUpdate);
    this._lazyObservers.forEach(obs => obs.disconnect());
  }

  get isOpen() {
    return this.hasAttribute('open');
  }

  set isOpen(val) {
    if (!!val === this.hasAttribute('open') || !window.Maximize.isEnableCartDrawer) return;
    if (val) {
      if (this._isOpeningCartDrawer) return;
      this._isOpeningCartDrawer = true;
      document.getElementById('x-header-container')?.classList.add('mini-cart-open');
      this._openDrawer();
      setTimeout(() => { this._isOpeningCartDrawer = false; }, 300);
      fetch(Shopify.routes.root + 'cart.js', {headers: {'Content-Type': 'application/json'}})
        .then(r => r.json())
        .then(cartData => {
          window.MaximizeStorefrontEvents?.dispatchCartView('dialog', cartData, this);
        })
        .catch(() => {
          window.MaximizeStorefrontEvents?.dispatchCartView('dialog', null, this);
        });
    } else {
      // Force-reset: no animation, immediate cleanup
      this._closeDrawer();
    }
  }

  handleClose() {
    if (!this.isOpen || this._isOpeningCartDrawer) return;
    this._finalizeQtyOnClose();
    this._closeDrawer();
  }

  // On close, discard any half-edited quantity: revert an invalid value to the last
  // committed quantity (the server-rendered defaultValue) instead of committing a
  // corrected value the user never confirmed, then close every error tooltip. The
  // tooltips render in the browser top layer, so they would otherwise linger on screen
  // after the drawer is gone (e.g. when closing via Escape without blurring the input).
  _finalizeQtyOnClose() {
    this.querySelectorAll('[data-action="update-qty"]').forEach(inputEl => {
      const wrapper = this._getItemWrapper(inputEl);
      if (!wrapper) return;
      const line = wrapper.dataset.cartItemLine;
      const qty = parseInt(inputEl.value);
      const rule = this.__getQuantityRule(inputEl);
      if (!(qty > 0) || !quantityRuleUtils.isValid(qty, rule)) {
        inputEl.value = inputEl.defaultValue;
      }
      this._clearQtyError(line);
    });
  }

  get isLoading() {
    return this._isLoading;
  }

  set isLoading(val) {
    this._isLoading = val;
    this.toggleAttribute('loading', val);
  }

  _getItemWrapper(el) {
    return el.closest('.cart-item__wrapper');
  }

  _onClickHandler(e) {
    const minus = e.target.closest('[data-action="minus-qty"]');
    if (minus) {
      e.preventDefault();
      const wrapper = this._getItemWrapper(minus);
      if (wrapper) this.minusItemQty(wrapper.dataset.cartItemLine, wrapper.dataset.additionalFeeProperty || '');
      return;
    }

    const plus = e.target.closest('[data-action="plus-qty"]');
    if (plus) {
      e.preventDefault();
      const wrapper = this._getItemWrapper(plus);
      if (wrapper) this.plusItemQty(wrapper.dataset.cartItemLine, wrapper.dataset.additionalFeeProperty || '');
      return;
    }

    const remove = e.target.closest('[data-action="remove"]');
    if (remove) {
      e.preventDefault();
      const wrapper = this._getItemWrapper(remove);
      if (wrapper) this.removeItem(wrapper.dataset.cartItemLine, wrapper.dataset.additionalFeeProperty || '');
      return;
    }

    if (e.target.closest('[data-close-drawer]')) {
      e.preventDefault();
      this.handleClose();
    }
  }

  _onInputHandler(e) {
    const input = e.target.closest('[data-action="update-qty"]');
    if (!input) return;
    const wrapper = this._getItemWrapper(input);
    if (!wrapper) return;
    const line = wrapper.dataset.cartItemLine;
    const additionalFeePropertyValue = wrapper.dataset.additionalFeeProperty || '';
    let timer = this._inputTimers.get(input);
    clearTimeout(timer);
    timer = setTimeout(() => this.updateItemQty(line, additionalFeePropertyValue), 500);
    this._inputTimers.set(input, timer);

    // B2B-only: run the quantity-rule validation after the user pauses typing (2s),
    // replacing the removed focusout handler. Non-B2B has no rules to validate.
    // A synthetic { type: 'focusout' } reproduces the old blur behaviour: out-of-range
    // auto-corrects + commits, off-grid shows a persistent error and keeps focus.
    if (window.Maximize?.isB2BCustomer) {
      let blurTimer = this._blurTimers.get(input);
      clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        if (!this.isOpen) return; // don't trap focus while the drawer is closing/closed
        this.validateItemQty(input, line, { type: 'focusout' }, additionalFeePropertyValue);
      }, 1500);
      this._blurTimers.set(input, blurTimer);
    }
  }

  _onKeydownHandler(e) {
    if (e.key === 'Escape' && !this._isOpeningCartDrawer) {
      this.handleClose();
      return;
    }
    const input = e.target.closest('[data-action="update-qty"]');
    if (!input) return;
    this.handleKeydown(e, input);
  }


  _openDrawer() {
    if (this._openCallbacks.length > 0) {
      this._openCallbacks.forEach(cb => cb());
      this._openCallbacks = [];
    }
    const wrapper = document.getElementById('CartDrawer__Wrapper');
    const container = document.getElementById('CartDrawer__Container');
    if (wrapper) wrapper.classList.add('is-visible');
    // Force reflow so container starts from closed CSS state before transition
    container?.getBoundingClientRect();
    this.setAttribute('open', '');
    if (this._isOpenUpsell) {
      const upsellEl = this.querySelector('cart-drawer-upsell');
      if (upsellEl) upsellEl.isOpen = true;
    }
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      document.getElementById('CloseCart')?.focus();
      if (typeof Alpine !== 'undefined' && Alpine.store?.('xFocusElement')) {
        Alpine.store('xFocusElement').trapFocus('CartDrawer__Wrapper', 'CloseCart');
      }
    }, 310);
  }

  _closeDrawer() {
    this.removeAttribute('open');
    this.removeAttribute('upsell-open');
    document.body.style.overflow = '';
    const returnTarget = this.returnFocusEl;
    this.returnFocusEl = null;
    setTimeout(() => {
      document.getElementById('CartDrawer__Wrapper')?.classList.remove('is-visible');
      document.getElementById('CartDrawer__Upsell')?.classList.remove('is-visible');
      document.getElementById('x-header-container')?.classList.remove('mini-cart-open');
      window.xCartHelper?.closeField(false);
      if (returnTarget) {
        if (typeof Alpine !== 'undefined' && Alpine.store?.('xFocusElement')) {
          Alpine.store('xFocusElement').removeTrapFocus();
        }
        returnTarget.focus({ preventScroll: true });
      }
    }, 310);
  }

  _watchLazyScript(tagName, src, onload, elementSelector) {
    if (!src) return;
    const selector = elementSelector || tagName;

    this._openCallbacks.push(() => {
      const load = () => {
        if (customElements.get(tagName)) {
          onload?.();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        if (onload) script.onload = onload;
        document.head.appendChild(script);
      };

      if (this.querySelector(selector)) {
        load();
      } else {
        // Element not yet in DOM — watch for post-ATC injection
        const observer = new MutationObserver(() => {
          if (this.querySelector(selector)) {
            load();
            observer.disconnect();
            this._lazyObservers = this._lazyObservers.filter(o => o !== observer);
          }
        });
        observer.observe(this, {childList: true, subtree: true});
        this._lazyObservers.push(observer);
      }
    });
  }

  _initEstimateShipping() {
    this.querySelectorAll('[data-estimate-shipping-line]').forEach(el => {
      this.updateEstimateShippingCartItem(el, el.dataset.estimateShippingLine);
    });
  }

  _initEstimateShippingBanner() {
    this.querySelectorAll('[data-estimate-shipping-key]').forEach(el => {
      this.updateEstimateShippingCart(el, el.dataset.estimateShippingKey);
    });
  }

  // Read the Shopify quantity rule (min/max/increment) from the input's data attrs.
  __getQuantityRule(inputEl) {
    return quantityRuleUtils.normalizeRule(
      inputEl && inputEl.dataset.qtyMin,
      inputEl && inputEl.dataset.qtyMax,
      inputEl && inputEl.dataset.qtyIncrement
    );
  }

  // On blur, an out-of-range value (below min / above max) is auto-corrected to
  // min/max, committed, and the reason shown for 5s. Any other invalid value (off the
  // increment grid) shows a persistent error without committing.
  // qty <= 0 means "remove" and is treated as valid. Returns whether it was valid.
  validateItemQty(inputEl, line, event, additionalFeePropertyValue) {
    if (!inputEl) return false;
    const qty = parseInt(inputEl.value);
    const rule = this.__getQuantityRule(inputEl);
    // A blank / non-numeric entry is not "remove" — only an explicit 0 is. It used to fall
    // through the `!(qty > 0)` shortcut below and be accepted as valid, which left the box
    // empty with no correction and no message.
    if (!Number.isInteger(qty) && inputEl.value.trim() !== '0') {
      const message = quantityRuleUtils.buildError(inputEl.value, rule); // from the typed value
      inputEl.value = rule.min;
      this._addQtyError(line, message, 3000);
      this.__postUpdateItem(line, rule.min, additionalFeePropertyValue || '');
      return true;
    }
    if (!(qty > 0) || quantityRuleUtils.isValid(qty, rule)) {
      this._clearQtyError(line);
      return true;
    }
    const belowMin = qty < rule.min;
    const aboveMax = rule.max !== null && qty > rule.max;
    if (event && event.type === 'focusout' && (belowMin || aboveMax)) {
      const message = quantityRuleUtils.buildError(inputEl.value, rule); // from the typed value
      const corrected = belowMin ? rule.min : rule.max;
      inputEl.value = corrected;
      this._addQtyError(line, message, 3000);
      this.__postUpdateItem(line, corrected, additionalFeePropertyValue || '');
      return true;
    }
    // Off-grid (in range): persistent error, do NOT commit. Never re-focus the
    // input — that stole clicks aimed at the +/- buttons and other cart lines.
    this._addQtyError(line, quantityRuleUtils.buildError(inputEl.value, rule));
    return false;
  }

  // Quantity-rule error → tooltip next to the qty input (content drives it open via
  // MutationObserver). autoHideMs auto-clears after a delay; a newer message/clear
  // cancels the pending hide.
  _addQtyError(line, message, autoHideMs) {
    const el = document.getElementById(`QtyRuleError-${line}`);
    if (!el) return;
    clearTimeout(this._errorTimers[line]);
    const textEl = el.getElementsByClassName('cart-item__qty-error-text')[0];
    if (textEl) textEl.innerHTML = message;
    if (message && autoHideMs) {
      this._errorTimers[line] = setTimeout(() => this._clearQtyError(line), autoHideMs);
    }
  }

  _clearQtyError(line) {
    const el = document.getElementById(`QtyRuleError-${line}`);
    if (!el) return;
    clearTimeout(this._errorTimers[line]);
    const textEl = el.getElementsByClassName('cart-item__qty-error-text')[0];
    if (textEl) textEl.innerHTML = ''; // empty content closes the tooltip (MutationObserver)
  }

  updateItemQty(line, additionalFeePropertyValue) {
    const inputEl = document.getElementById(`CartItemQuantity--${line}`);
    let qty = parseInt(inputEl.value);
    if (!this.__validateQty(qty)) return;
    // 500ms-input path: silently skip posting an invalid (off-rule) quantity so
    // mid-typing values don't flash an error. The B2B 2s-debounce validation
    // (validateItemQty) surfaces the error after the pause.
    if (qty > 0 && !quantityRuleUtils.isValid(qty, this.__getQuantityRule(inputEl))) return;
    this._clearQtyError(line);
    this.__postUpdateItem(line, qty, additionalFeePropertyValue);
  }

  // step() snaps an off-grid value to the nearest valid one IN the pressed direction.
  // normalizeQuantity rounds to the *nearest*, so pressing "-" on an off-grid quantity could
  // jump the value up — and land on a different increment band than the one named in the
  // error message.
  minusItemQty(line, additionalFeePropertyValue) {
    const inputEl = document.getElementById(`CartItemQuantity--${line}`);
    let qty = parseInt(inputEl.value);
    if (this.__validateQty(qty)) {
      if (qty > 0) {
        const rule = this.__getQuantityRule(inputEl);
        const next = quantityRuleUtils.step(qty, rule, -1);
        // step() clamps at the minimum, so it failing to lower the value means we were already at
        // the floor — and nothing between 0 and the minimum is orderable, so remove the line.
        qty = next >= qty ? 0 : next;
        inputEl.value = qty;
      }
      this._clearQtyError(line);
      this.__postUpdateItem(line, qty, additionalFeePropertyValue);
    }
  }

  plusItemQty(line, additionalFeePropertyValue) {
    const inputEl = document.getElementById(`CartItemQuantity--${line}`);
    let qty = parseInt(inputEl.value);
    if (this.__validateQty(qty)) {
      const rule = this.__getQuantityRule(inputEl);
      qty = qty <= 0 ? rule.min : quantityRuleUtils.step(qty, rule, 1);
      inputEl.value = qty;
      this._clearQtyError(line);
      this.__postUpdateItem(line, qty, additionalFeePropertyValue);
    }
  }

  removeItem(line, additionalFeePropertyValue) {
    this.__postUpdateItem(line, 0, additionalFeePropertyValue, 0);
  }

  handleKeydown(evt, el) {
    if (evt.key !== 'Enter') return;
    evt.preventDefault();
    // Enter = explicit commit: validate now instead of waiting for the 2s debounce
    // (B2B-only; the old flow relied on the now-removed focusout handler).
    if (window.Maximize?.isB2BCustomer) {
      const wrapper = this._getItemWrapper(el);
      if (wrapper) {
        clearTimeout(this._blurTimers.get(el));
        this.validateItemQty(el, wrapper.dataset.cartItemLine, { type: 'focusout' }, wrapper.dataset.additionalFeeProperty || '');
      }
    }
  }

  updateCartItem(line, errorMessage) {
    const sectionId = this._sectionId;
    fetch(`${window.Shopify.routes.root}?section_id=${sectionId}`, {
      method: 'GET',
      headers: {Accept: 'application/javascript', 'Content-Type': 'application/json'},
    })
      .then(r => r.text())
      .then(text => {
        const newCartSectionHTML = new DOMParser().parseFromString(text, 'text/html').querySelector('.shopify-section');
        const newCartWrapperHTML = newCartSectionHTML.querySelector(`.cart-wrapper-${sectionId}`);
        if (newCartWrapperHTML) {
          const oldCartItemEle = document.querySelector(`.cart-wrapper-${sectionId} .cart-item__wrapper[data-cart-item-line="${line}"]`);
          const newCartItemEle = newCartWrapperHTML.querySelector(`.cart-item__wrapper[data-cart-item-line="${line}"]`);
          if (oldCartItemEle && newCartItemEle) {
            oldCartItemEle.outerHTML = newCartItemEle.outerHTML;
          }
          this._addErrorMessage(line, errorMessage);
          this._initEstimateShipping();
        }
      });
  }

  updateEstimateShippingCart(el, estimateShippingKey) {
    const estimateContentEle = el.querySelector('.estimate-content');
    if (estimateContentEle) {
      const clone = estimateContentEle.cloneNode(true);
      clone.querySelector('.tooltip-icon-estimate')?.remove();
      const text = clone.textContent.replace(/\s+/g, ' ').trim();
      window.xCartHelper?.updateCart({
        attributes: {[estimateShippingKey]: text}
      });
    }
  }

  updateEstimateShippingCartItem(el, line) {
    const quantityEle = document.querySelector(`#CartItemQuantity--${line}`);
    const qty = quantityEle ? parseInt(quantityEle.value) : 1;
    const properties = window.xParseJSON(el.dataset.properties);
    window.xCartHelper?.changeCart({
      line: `${line}`,
      quantity: `${qty}`,
      properties: properties,
    });
  }

  updateDate(date) {
    fetch(Shopify.routes.root + 'cart/update', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Accept: 'application/json'},
      body: JSON.stringify({attributes: {'datetime-updated': `${date}`}}),
    })
      .then(r => r.json())
      .catch(e => console.error(e));
  }

  // Server/API error → inline flash message at the top of the cart item (a separate
  // element from the quantity-rule tooltip). Cleared by the section re-render on a
  // successful update, or replaced by a newer server error.
  _addErrorMessage(line, message) {
    const lineItemError = document.getElementById(`LineItemError-${line}`);
    if (!lineItemError) return;
    lineItemError.classList.remove('hidden');
    lineItemError.getElementsByClassName('cart-item__error-text')[0].innerHTML = message;
  }

  _clearErrorMessage(line) {
    const lineItemError = document.getElementById(`LineItemError-${line}`);
    if (!lineItemError) return;
    lineItemError.classList.add('hidden');
    const textEl = lineItemError.getElementsByClassName('cart-item__error-text')[0];
    if (textEl) textEl.innerHTML = '';
  }

  async handleUpdateAdditionalFeeData(additionalFeePropertyValue, additionalFeeItemsUpdate, additionalFeeItemsData, sectionsToRender, mainItemKey, qty, isUpdateError) {
    if (additionalFeePropertyValue === '') return;

    if (isUpdateError) {
      await fetch(Shopify.routes.root + 'cart.js', {
        method: 'GET',
        headers: {'Content-Type': 'application/json'},
      })
        .then(r => r.json())
        .then(async responseCart => {
          let newQty = qty;
          for (const item of responseCart.items) {
            if (item.key === mainItemKey) {
              newQty = item.quantity;
              break;
            }
          }
          additionalFeeItemsUpdate.forEach(item => {
            additionalFeeItemsData.updates[item.itemKey] = newQty;
          });
          await fetch(window.Maximize.routes.cartUpdate, {
            method: 'POST',
            headers: {Accept: 'application/javascript', 'Content-Type': 'application/json'},
            body: JSON.stringify(additionalFeeItemsData),
          })
            .then(r => r.json())
            .then(responseAdditionalFee => {
              sectionsToRender.forEach(section => {
                const sectionElement = document.querySelector(section.selector);
                if (sectionElement && responseAdditionalFee.sections[section.id]) {
                  sectionElement.innerHTML = getSectionInnerHTML(responseAdditionalFee.sections[section.id], section.selector);
                }
              });
            });
        });
      return;
    }

    additionalFeeItemsUpdate.forEach(item => {
      additionalFeeItemsData.updates[item.itemKey] = qty;
    });
    return await fetch(window.Maximize.routes.cartUpdate, {
      method: 'POST',
      headers: {Accept: 'application/javascript', 'Content-Type': 'application/json'},
      body: JSON.stringify(additionalFeeItemsData),
    }).then(r => r.json());
  }

  __postUpdateItem(line, qty, additionalFeePropertyValue, wait = 500) {
    console.log('line', line);
    clearTimeout(this._t);
    const sectionId = this._sectionId;

    const func = () => {
      this.isLoading = true;

      const sectionsToRender = window.xCartHelper?.getSectionsToRender(sectionId);
      const sections = sectionsToRender.map(s => s.id);
      const updateData = {line: `${line}`, quantity: `${qty}`, sections};

      const loadingEle = document.getElementById(`CartItem__Loading__${line}`);
      if (loadingEle) loadingEle.classList.remove('hidden');
      const removeEl = document.getElementById(`CartItemRemove-${line}`);
      if (removeEl) removeEl.style.display = 'none';

      const additionalFeeItemsData = {updates: {}, sections};
      const additionalFeeItemsUpdate = [];
      let mainItemKey = '';

      if (additionalFeePropertyValue !== '') {
        document.querySelectorAll(`.cart-item__wrapper[data-additional-fee-property="${additionalFeePropertyValue}"]`).forEach(item => {
          if (additionalFeePropertyValue.split('_')[0] !== item.dataset.variantId) {
            additionalFeeItemsUpdate.push({itemKey: item.dataset.cartItemKey, itemLine: item.dataset.cartItemLine});
          } else {
            mainItemKey = item.dataset.cartItemKey;
          }
        });
      }

      const _slAction = qty <= 0 ? 'remove' : 'update';
      const _itemWrapper = this.querySelector(`.cart-item__wrapper[data-cart-item-line="${line}"]`);
      const _lineKey = _itemWrapper?.dataset.cartItemKey || '';
      const _slUpdate = window.MaximizeStorefrontEvents?.createCartLinesUpdate({
        action: _slAction,
        context: 'cart',
        lines: [{ id: _lineKey, quantity: qty }],
        element: this,
      });

      fetch(window.Maximize.routes.cartChange, {
        method: 'POST',
        headers: {Accept: 'application/javascript', 'Content-Type': 'application/json'},
        body: JSON.stringify(updateData),
      })
        .then(r => {
          if (!r.ok && r.errors) {
            this._addErrorMessage(line, r.message);
            this.updateCartItem(line);
          }
          return r.json();
        })
        .then(async response => {
          if (response.status === 422) {
            // Declined change (422) → resolve with userErrors, do NOT reject or dispatch cart:error.
            _slUpdate?.resolve(null, [{ code: 'MAXIMUM_EXCEEDED', message: response.message || '' }]);
            document.dispatchEvent(new CustomEvent(`${CART_EVENT.cartItemUpdateFail}`, {
              bubbles: true,
              detail: {line: line},
            }));
            await this.handleUpdateAdditionalFeeData(additionalFeePropertyValue, additionalFeeItemsUpdate, additionalFeeItemsData, sectionsToRender, mainItemKey, qty, true);
            this.updateCartItem(line, response.message);
          } else {
            if (response.errors) {
              // Cart declined change (response.errors without network failure) → resolve with userErrors.
              let _errMsg = typeof response.errors === 'string' ? response.errors : 'Cart update error';
              _slUpdate?.resolve(null, [{ code: 'INVALID', message: _errMsg }]);
              document.dispatchEvent(new CustomEvent(`${CART_EVENT.cartItemUpdateFail}`, {
                bubbles: true,
                detail: {line: line},
              }));
              this._addErrorMessage(line, response.errors);
            } else {
              const finalResponse = await this.handleUpdateAdditionalFeeData(additionalFeePropertyValue, additionalFeeItemsUpdate, additionalFeeItemsData, sectionsToRender, mainItemKey, qty, false) || response;
              _slUpdate?.resolve(finalResponse);
              sectionsToRender.forEach(section => {
                const sectionElement = document.querySelector(section.selector);
                if (sectionElement) {
                  if (section.selector === '#MainCart__Items') {
                    sectionElement.classList.add('disable-fade-element');
                  }
                  if (finalResponse.sections[section.id]) {
                    if (section.selector === '#CartDrawer') {
                      const wrapper = sectionElement.querySelector('#CartDrawer__Wrapper');
                      const wrapperVisible = wrapper?.classList.contains('is-visible');
                      sectionElement.innerHTML = getSectionInnerHTML(finalResponse.sections[section.id], section.selector);
                      if (wrapperVisible) {
                        sectionElement.querySelector('#CartDrawer__Wrapper')?.classList.add('is-visible');
                      }
                    } else {
                      sectionElement.innerHTML = getSectionInnerHTML(finalResponse.sections[section.id], section.selector);
                    }
                  }
                }
              });

              this._initEstimateShipping();

              if (!window.Maximize.isCartPage) {
                const upsellEl = this.querySelector('cart-drawer-upsell');
                if (upsellEl) upsellEl.isOpen = !!document.querySelectorAll('.cart-drawer-upsell__item').length;
              }

              const currentItemCount = window.xCartHelper?.currentItemCount;
              if (currentItemCount !== finalResponse.item_count) {
                if (window.xCartHelper) window.xCartHelper.currentItemCount = finalResponse.item_count;
                document.dispatchEvent(new CustomEvent(`${CART_EVENT.cartUpdate}`, {
                  bubbles: true,
                  detail: {isItemCountChanged: true},
                }));
              }
            }
          }
        })
        .catch(e => {
          _slUpdate?.reject(e);
          window.MaximizeStorefrontEvents?.dispatchCartError(
            e?.message || 'Cart update failed', 'SERVICE_UNAVAILABLE', this
          );
          console.error('Error updating cart item:', e);
        })
        .finally(() => {
          this.isLoading = false;
          if (loadingEle) loadingEle.classList.add('hidden');
        });
    };

    this._t = setTimeout(func, wait);
  }

  __validateQty(number) {
    return !(parseFloat(number) !== parseInt(number) && isNaN(number));
  }
}

if (!customElements.get('cart-drawer')) customElements.define('cart-drawer', CartDrawer);

const PANEL_FIELDS = ["discount_field", "estimate_shipping", "share_cart"];

class CartAccordion extends HTMLElement {
  connectedCallback() {
    this._generateUrlDone = false;

    this._boundClick = this._onClick.bind(this);
    this._boundKeyup = this._onKeyup.bind(this);
    this._boundEscape = (e) => {
      if (e.key === "Escape") window.xCartHelper.closeField();
    };
    this._boundFieldChange = (e) => this._update(e.detail.field);
    this._boundCopiedChange = (e) => this._onCopiedChange(e.detail.copied);
    this._boundShareUrlChange = (e) => this._onShareUrlChange(e.detail.url);
    this._boundUpsellOverlayClick = (e) => {
      if (e.target.closest("[data-upsell-overlay]")) {
        e.preventDefault();
        window.xCartHelper.closeField();
      }
    };

    this.addEventListener("click", this._boundClick);
    this.addEventListener("keyup", this._boundKeyup);
    document.addEventListener("keyup", this._boundEscape);
    document.addEventListener("click", this._boundUpsellOverlayClick);
    document.addEventListener("cart:fieldchange", this._boundFieldChange);
    document.addEventListener("cart:copiedchange", this._boundCopiedChange);
    document.addEventListener("cart:shareurlchange", this._boundShareUrlChange);

    const noteTextarea = this.querySelector("[data-note-input]");
    if (noteTextarea) {
      let _noteDebounce;
      let _notePending = false;
      noteTextarea.addEventListener("input", (e) => {
        // Guard: beginUpdate once per cycle, not once per keystroke.
        // Without this, rapid typing would over-increment pendingUpdates
        // and endUpdate() (called once by .finally) would never drain it to 0.
        if (!_notePending) {
          _notePending = true;
          window.xCartHelper.beginUpdate();
        }
        clearTimeout(_noteDebounce);
        _noteDebounce = setTimeout(() => {
          window.xCartHelper.updateCartNote(e.target.value, 'dialog', noteTextarea)
            .finally(() => {
              _notePending = false;
              window.xCartHelper.endUpdate();
            });
        }, 1000);
      });
    }

    this._update(window.xCartHelper?.openField);

    // Block checkout and view-cart navigation while a note/fields update is in flight.
    // Attach directly to the buttons so only those elements are affected.
    // cart-accordion re-connects on every cart re-render, so listeners stay fresh.
    this._boundBlockIfUpdating = (e) => {
      if (window.xCartHelper.isUpdating) e.preventDefault();
    };
    const cartDrawer = this.closest('cart-drawer');
    this._checkoutBtn = cartDrawer?.querySelector('.cart-drawer__checkout');
    this._viewCartBtn = cartDrawer?.querySelector('.cart-drawer__view-cart');
    this._checkoutBtn?.addEventListener('click', this._boundBlockIfUpdating);
    this._viewCartBtn?.addEventListener('click', this._boundBlockIfUpdating);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this._boundClick);
    this.removeEventListener("keyup", this._boundKeyup);
    document.removeEventListener("keyup", this._boundEscape);
    document.removeEventListener("click", this._boundUpsellOverlayClick);
    document.removeEventListener("cart:fieldchange", this._boundFieldChange);
    document.removeEventListener("cart:copiedchange", this._boundCopiedChange);
    document.removeEventListener("cart:shareurlchange", this._boundShareUrlChange);
    this._checkoutBtn?.removeEventListener('click', this._boundBlockIfUpdating);
    this._viewCartBtn?.removeEventListener('click', this._boundBlockIfUpdating);
  }

  _onClick(e) {
    const toggle = e.target.closest("[data-toggle]");
    if (toggle) {
      e.preventDefault();
      const field = toggle.dataset.toggle;
      window.xCartHelper.openField = window.xCartHelper.openField === field ? "" : field;
      return;
    }

    const open = e.target.closest("[data-open]");
    if (open) {
      e.preventDefault();
      window.xCartHelper.isCopiedCart = false;
      window.xCartHelper.openField = open.dataset.open;
      return;
    }

    if (e.target.closest("[data-close]") || e.target.closest("[data-overlay]")) {
      e.preventDefault();
      window.xCartHelper.closeField();
      return;
    }

    if (e.target.closest("[data-copy-btn]")) {
      e.preventDefault();
      window.xCartHelper.copyURL();
    }
  }

  _onKeyup(e) {
    if (e.key !== "Enter") return;

    const toggle = e.target.closest("[data-toggle]");
    if (toggle) {
      window.xCartHelper.openField = window.xCartHelper.openField === toggle.dataset.toggle ? "" : toggle.dataset.toggle;
      return;
    }

    const open = e.target.closest("[data-open]");
    if (open) {
      window.xCartHelper.isCopiedCart = false;
      window.xCartHelper.openField = open.dataset.open;
      return;
    }

    if (e.target.closest("[data-close]")) {
      window.xCartHelper.closeField();
    }
  }

  _update(openField) {
    const isPanelOpen = PANEL_FIELDS.includes(openField);

    // Simple accordion carets
    this.querySelectorAll("[data-caret]").forEach((el) => {
      el.classList.toggle("rotate-180", el.dataset.caret === openField);
      el.classList.toggle("rotate-0", el.dataset.caret !== openField);
    });

    // Simple accordion content
    this.querySelectorAll("[data-content]").forEach((el) => {
      el.hidden = el.dataset.content !== openField;
    });

    // Overlay (inside accordion)
    this.querySelector("[data-overlay]")?.classList.toggle("hidden", !isPanelOpen);

    // Upsell overlay (outside accordion, shown on lg when a panel field is open)
    const upsellOverlay = document.getElementById("CartDrawer__Upsell__Overlay");
    if (upsellOverlay) {
      upsellOverlay.classList.toggle("hidden", !isPanelOpen);
      upsellOverlay.classList.toggle("lg:block", isPanelOpen);
    }

    // Panel wrapper: is-open + inert
    const panelWrapper = this.querySelector("[data-panel-wrapper]");
    if (panelWrapper) {
      panelWrapper.classList.toggle("is-open", isPanelOpen);
      panelWrapper.inert = !isPanelOpen;
    }

    // Tab active state
    this.querySelectorAll("[data-tab]").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.tab === openField);
      el.classList.toggle("font-semibold", el.dataset.tab === openField);
    });

    // Individual panels
    this.querySelectorAll("[data-panel]").forEach((el) => {
      const isActive = el.dataset.panel === openField;
      el.classList.toggle("opacity-100", isActive);
      el.classList.toggle("anm-fade", isActive);
      el.classList.toggle("opacity-0", !isActive);
      el.classList.toggle("invisible", !isActive);
    });

    // Generate share URL on first open
    if (openField === "share_cart" && !this._generateUrlDone) {
      this._generateUrlDone = true;
      window.xCartHelper.generateUrl();
    }

    // Scroll active tab into view (horizontal only, avoid vertical scroll jump)
    if (isPanelOpen) {
      const activeTab = this.querySelector(`[data-tab="${openField}"]`);
      if (activeTab) {
        const scrollContainer = activeTab.closest(".overflow-x-auto");
        if (scrollContainer) {
          const left = activeTab.offsetLeft - scrollContainer.offsetWidth / 2 + activeTab.offsetWidth / 2;
          scrollContainer.scrollTo({ left, behavior: "smooth" });
        }
      }
    }
  }

  _onCopiedChange(copied) {
    const btn = this.querySelector("[data-copy-btn]");
    if (!btn) return;
    btn.textContent = copied ? btn.dataset.textCopied : btn.dataset.textCopy;
  }

  _onShareUrlChange(url) {
    const input = this.querySelector("[data-share-url]");
    if (input) input.value = url;
  }

}

if (!customElements.get("cart-accordion")) customElements.define("cart-accordion", CartAccordion);

