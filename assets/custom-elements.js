// =============================================================================
// Global Custom Elements
// Shared Web Components used across sections/blocks.
// Loaded via theme.liquid (defer, after constants.js).
// Dependencies: constants.js (MIN_DEVICE_WIDTH, BUTTON_HOVER_ANM, SELECT_ELEMENT_EVENT)
//               getValueCssVariable — defined in theme.js global scope
// =============================================================================

// -----------------------------------------------------------------------------
// IntersectionElement — base class for intersection-observer-based elements
// -----------------------------------------------------------------------------
class IntersectionElement extends HTMLElement {
  constructor() {
    super();
    this.isIntersecting = false;
    this.observer = null;
    this.isValidContext = false;
    this.observerElement = this;
  }

  connectedCallback() {
    this.handleInit();

    this.isValidContext = this.checkValidContext();
    if (!this.isValidContext) return;

    this.actionBeforeSetupObserver();
    this.setupObserver();
    this.actionAfterSetupObserver();
  }

  disconnectedCallback() {
    if (!this.isValidContext) return;

    if (this.isIntersecting) {
      this.handleLeave();
      this.isIntersecting = false;
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  handleInit() {}

  checkValidContext() {
    return true;
  }

  setupObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !this.isIntersecting) {
            this.isIntersecting = true;
            this.handleIntersect();
          }

          if (!entry.isIntersecting && this.isIntersecting) {
            this.isIntersecting = false;
            this.handleLeave();
          }
        });
      },
      {
        root: null,
        rootMargin: "0px",
        threshold: 0.01
      }
    );

    this.observer.observe(this.observerElement);
  }

  actionBeforeSetupObserver() {}
  actionAfterSetupObserver() {}
  handleIntersect() {}
  handleLeave() {}
}

// -----------------------------------------------------------------------------
// SelectElement — custom dropdown/select component
// -----------------------------------------------------------------------------
class SelectElement extends HTMLElement {
  constructor() {
    super();

    this.button = this.querySelector(".select-button");
    this.label = this.querySelector(".select-label");
    this.labelButton = this.querySelector(".select-button__label");
    this.optionsListWrapper = this.querySelector(".select-options-wrapper");
    this.selectType = this.dataset.selectType;
    this.noRequire = this.dataset.noRequire;
    this.arrowDropdown = this.querySelector(".select-arrow");

    this.isOpen = false;
    this.optionSelected = this.querySelector('.select-option[aria-selected="true"]');
    this.focusOption = null;
    this.optionsList = this.querySelector(".select-options");
    this.listOptionsEle = this.querySelectorAll(".select-option");
  }

  connectedCallback() {
    this.button.addEventListener("keydown", this.handleKeydown);
    this.button.addEventListener("click", this.handleClickButton);
    window.addEventListener("scroll", this.handleScroll);
    this.optionsListWrapper.classList.add('h-0');

    this.handleAddEventItem();

    this.initObserver();
  }

  disconnectedCallback() {
    this.button.removeEventListener("keydown", this.handleKeydown);
    this.button.removeEventListener("click", this.handleClickButton);
    window.removeEventListener("scroll", this.handleScroll);

    this.optionsList.removeEventListener('click', this.handleOptionClick);
    this.optionsList.removeEventListener('mouseover', this.handleOptionMouseOver);
    this.optionsList.removeEventListener('mouseout', this.handleOptionMouseOut);
  }

  handleAddEventItem() {
    this.optionsList?.addEventListener('click', this.handleOptionClick);
    this.optionsList?.addEventListener('mouseover', this.handleOptionMouseOver);
    this.optionsList?.addEventListener('mouseout', this.handleOptionMouseOut);
  }

  handleKeydown = (evt) => {
    if (!this.isOpen) {
      if (evt.key === "Enter" || evt.key === "Spacebar" || evt.key === " ") {
        evt.preventDefault();
        this.handleOpen();
      }
    }
  }

  handleKeydownWhenOpened = (evt) => {
    if (evt.key === "Enter" || evt.key === "Spacebar" || evt.key === " ") {
      evt.preventDefault();
      this.handleClose();
    } else if (evt.key === "ArrowDown" || evt.key === "Down") {
      evt.preventDefault();
      this.selectedOptionIndex = 0;
      this.setOptionFocus(this.selectedOptionIndex);
    } else if (evt.key === "ArrowUp" || evt.key === "Up") {
      evt.preventDefault();
      this.selectedOptionIndex = this.listOptionsEle.length - 1;
      this.setOptionFocus(this.selectedOptionIndex);
    } else if (evt.key === "Tab") {
      this.handleClose();
    } else if (evt.key === "Escape" || evt.key === "Esc") {
      evt.preventDefault();
      evt.stopPropagation();
      this.handleClose();
    }
  }

  handleClickButton = (evt) => {
    evt.preventDefault();

    if (this.isOpen) {
      this.handleClose();
    } else {
      this.handleOpen();
    }
    evt.stopPropagation();
  }

  handleOpen() {
    this.listOptionsEle = Array.from(this.querySelectorAll(".select-option"));
    if (this.listOptionsEle.length === 0) return;
    this.optionSelected = this.querySelector('.select-option[aria-selected="true"]');
    this.optionSelectedEle = this.querySelector(".select-option-selected");
    if (!this.optionSelected && this.listOptionsEle.length > 0 && this.noRequire !== "true") {
      this.optionSelected = this.listOptionsEle[0];
    }

    this.button.addEventListener("keydown", this.handleKeydownWhenOpened);

    document.addEventListener("mousedown", this.handleClickBody);

    if (this.arrowDropdown) this.arrowDropdown.classList.add("rotate-180");

    requestAnimationFrame(() => {
      this.optionsListWrapper.classList.remove('h-0');
      this.isOpen = true;
      this.button.ariaExpanded = true;

      if (this.selectType !== "product-picker") {
        this.adjustPosition();
      } else {
        this.optionsListWrapper.classList.add("is-open");
      }

      this.optionsListWrapper.addEventListener("keydown", this.handleKeydownOptionList);
    });
  }

  handleClose() {
    this.isOpen = false;
    this.button.ariaExpanded = false;
    this.optionsListWrapper.classList.remove("is-open");
    if (this.arrowDropdown) this.arrowDropdown.classList.remove("rotate-180");

    if (this.optionSelected) this.optionSelected.classList.add("selected");

    this.optionsListWrapper.removeEventListener("keydown", this.handleKeydownOptionList);
    this.button.removeEventListener("keydown", this.handleKeydownWhenOpened);
    this.listOptionsEle = Array.from(this.listOptionsEle);
    this.listOptionsEle.forEach((opt) => {
      opt.tabIndex = -1;
      opt.classList.remove("focused");
    });

    this.button.focus();
    document.removeEventListener("mousedown", this.handleClickBody);

    setTimeout(() => {
      this.optionsListWrapper.classList.add('h-0');
    }, 100);
  }

  handleClickBody = (evt) => {
    if (!this.isOpen || (evt && evt.target && (this.optionsListWrapper.contains(evt.target) || this.button.contains(evt.target)))) return;

    evt.preventDefault();
    evt.stopPropagation();
    this.handleClose();
    if (evt?.target) {
      evt.target.focus();
    }
  }

  handleScroll = () => {
    if (this.isOpen && this.selectType !== "product-picker") {
      this.handleClose();
    }
  }

  handleOptionMouseOver = (evt) => {
    if (this.focusOption) {
      this.focusOption.classList.remove("focused");
    }

    if (!evt.target.closest(".select-option")) return;
    this.focusOption = evt.target.closest(".select-option");
    this.focusOption.classList.add("focused");
  }

  handleOptionMouseOut = () => {
    if (this.focusOption) {
      this.focusOption.classList.remove("focused");
    }
  }

  handleOptionClick = (event) => {
    const newOptionSelected = event.target.closest(".select-option");
    if (newOptionSelected?.classList.contains("disabled") && this.selectType === "product-picker") return;
    this.setSelectedOption(newOptionSelected);
    this.handleClose(null, true);
  }

  handleKeydownOptionList = (evt) => {
    const key = evt.key;
    if (key === "ArrowDown") {
      evt.preventDefault();
      this.moveFocus(1);
    } else if (key === "ArrowUp") {
      evt.preventDefault();
      this.moveFocus(-1);
    } else if (key === "Escape" || key === "Esc" || key === "Tab") {
      evt.preventDefault();
      evt.stopPropagation();
      this.handleClose();
    } else if (evt.key === "Enter" || evt.key === "Spacebar" || evt.key === " ") {
      evt.preventDefault();
      this.setSelectedOption(evt.target.closest(".select-option"));
      this.handleClose();
    }
  }

  moveFocus(step) {
    const options = Array.from(this.listOptionsEle);
    if (!options.length) return;

    if (this.selectedOptionIndex == null) {
      this.selectedOptionIndex = 0;
    } else if (this.selectedOptionIndex < 0 ) {
      this.selectedOptionIndex = options.length;
    } else {
      this.selectedOptionIndex = (this.selectedOptionIndex + step + options.length) % options.length;
    }

    this.setOptionFocus(this.selectedOptionIndex);

    const currentOption = options[this.selectedOptionIndex];
    if (currentOption) currentOption.scrollIntoView({block: "nearest", inline: "nearest"});
  }

  setOptionFocus(index) {
    const options = Array.from(this.listOptionsEle);
    if (!options.length || index < 0 || index >= options.length) return;

    options.forEach((opt, i) => {
      opt.tabIndex = i === index ? 0 : -1;
      opt.classList.toggle("focused", i === index);
    });

    options[index].focus();
  }

  setSelectedOption(selectedOption) {
    if (this.optionSelected !== selectedOption) {
      if (this.optionSelected) {
        this.optionSelected.ariaSelected = false;
        this.optionSelected.classList.remove('selected');
      }

      selectedOption.ariaSelected = true;
      selectedOption.classList.add('selected');
      let optionSelectedValue = selectedOption.dataset.value;
      this.optionSelected = selectedOption;

      if (this.label) this.label.textContent = optionSelectedValue;
      if (this.labelButton) this.labelButton.textContent = selectedOption.dataset.selectValue;
      if (this.optionSelectedEle) this.optionSelectedEle.setAttribute("value", optionSelectedValue);
      this.dispatchEventChange(selectedOption);
    }
  }

  adjustPosition() {
    if (this.optionsListWrapper.dataset.adjustPosition === "false") {
      this.optionsListWrapper.classList.add("is-open");
    } else {
      const optionListPaddingByPx = 16;

      const { bottom: buttonBottom } = this.button.getBoundingClientRect();

      const optionListHeight = this.optionsListWrapper.getBoundingClientRect().height;

      const dropdownBottom = buttonBottom + optionListHeight + optionListPaddingByPx;
      const showAbove = dropdownBottom > window.innerHeight;

      this.optionsListWrapper.classList.toggle("show-above", showAbove);
      this.optionsListWrapper.classList.add("!transition-none");
      requestAnimationFrame(() => {
        this.optionsListWrapper.classList.remove("!transition-none");
        this.optionsListWrapper.classList.add("is-open");
      })
    }
  }

  initObserver() {
    if (!this.optionsList) return;

    this.observer = new MutationObserver((mutationsList) => {
      for (let mutation of mutationsList) {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          const target = mutation.target;
          if (target.classList.contains("select-option") && target.classList.contains("selected")) {
            this.optionSelected = target;
            if (this.label) this.label.textContent = target.dataset.value;
            if (this.labelButton) this.labelButton.textContent = target.dataset.selectValue;
          }
        } else if (mutation.type === "childList") {
          this.listOptionsEle = this.querySelectorAll(".select-option");
        }
      }
    });

    this.observer.observe(this.optionsList, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["class"]
    });
  }

  dispatchEventChange(newOptionSelected) {
    newOptionSelected.dispatchEvent(
      new CustomEvent(SELECT_ELEMENT_EVENT.change, {
        bubbles: true,
        cancelable: true,
        detail: {
          target: newOptionSelected,
          value: this.optionSelected.dataset.value,
        },
      })
    );
  }
}

if (!customElements.get("select-element")) {
  customElements.define("select-element", SelectElement);
}

// -----------------------------------------------------------------------------
// CustomToolTip — viewport-aware single-trigger tooltip
// Trigger: parentElement (the consumer's `relative` wrapper).
// CustomToolTipContainer extends this class and relies on:
//   - this.tooltipEl (set in constructor)
//   - handleCloseTooltip() (public method)
// -----------------------------------------------------------------------------
class CustomToolTip extends HTMLElement {
  constructor() {
    super();
    this.tooltipEl = this.querySelector(".tooltip-popup-wrapper");
    // parentElement is the consumer's relative wrapper and acts as the hover trigger.
    // CustomToolTipContainer does not use this.tooltipTrigger in its own methods,
    // so reassigning it here does not break the subclass.
    this.tooltipTrigger = this.parentElement;
    this._defaultPosition = this.tooltipEl?.dataset.tooltipPosition || "top";
    this._listPosition = this.dataset.listPosition || "bottom";
    // Optional ancestor (referenced by class name) the tooltip must not overflow
    // horizontally. Null disables the clamp, which is the default for most consumers.
    this._clampBoundary = this.dataset.clampBoundary || null;
    // Horizontal alignment relative to the trigger (popover mode): "start" (default,
    // direction-aware: LTR left / RTL right), "end" (the opposite edge), or "center".
    this._align = this.dataset.tooltipAlign || "start";
    // Alignment when an ancestor has class "list-layout". The product card forces
    // start-aligned content in list regardless of the grid Content-alignment setting,
    // so the tooltip can need a different align there. Falls back to _align when the
    // consumer doesn't override, keeping non-list consumers unchanged.
    this._listAlign = this.dataset.listTooltipAlign || this._align;
    // Alignment actually used by _positionPopover; resolved per-open from list/grid context.
    this._activeAlign = this._align;
    // Hover tooltips are desktop-only by default. When enabled, the tooltip also works on
    // touch/mobile via a tap toggle on the trigger (e.g. the EDT info "!" icon).
    this._enableMobile = this.dataset.enableMobile === "true";
    // Render in the browser top layer via the Popover API so the tooltip can never be
    // covered or clipped by an ancestor's overflow/transform/z-index. Auto-enabled wherever
    // the API exists; falls back to the legacy absolute path on browsers without it.
    this._usePopover = !!this.tooltipEl && typeof this.tooltipEl.showPopover === "function";
    if (this._usePopover) {
      // The top layer controls visibility, so drop the `invisible` utility
      // (visibility:hidden); JS positions the wrapper with `fixed` coords on open.
      this.tooltipEl.classList.remove("invisible");
      this.tooltipEl.setAttribute("popover", "manual");
      // Tear down tracking/listeners whenever the popover closes for ANY reason — including
      // paths that bypass handleCloseTooltip, e.g. Alpine `x-show` hiding the host (display:none)
      // on state change. Without this, the window scroll listener leaks and accumulates across
      // opens, and any later scroll fires all of them.
      this._boundPopoverToggle = (e) => {
        // `toggle` is dispatched async, so re-check the live state: if it re-opened before
        // this ran, don't tear down the current open's listeners.
        if (e.newState === "closed" && !this.tooltipEl.matches(":popover-open")) {
          this._stopPositionTracking();
          this._removeOutsideClose();
        }
      };
      this.tooltipEl.addEventListener("toggle", this._boundPopoverToggle);
    }
    // Wrapped, not bound: as a listener it would receive the event as _handleOpen's first
    // argument and silently switch on the ignore-viewport-gate flag.
    this._boundOpen = () => this._handleOpen();
    this._boundClose = () => {
      if (!this._hasHoverPointer()) return;
      this.handleCloseTooltip();
    };
    // Keyboard parity for triggers that are focusable themselves (tabindex / role=button, e.g. the
    // quantity-rule info icon): focus opens, blur closes, Escape closes without moving focus.
    //
    // The target check matters. `focusin`/`focusout` bubble, and plenty of triggers WRAP focusable
    // content instead of being focusable — the product card's title tooltip hangs off the div that
    // contains the title link. Reacting to a bubbled event there would pop a tooltip open on every
    // card a keyboard user tabs through. Only focus landing on the trigger itself counts.
    this._isTriggerFocusEvent = (e) => e && e.target === this.tooltipTrigger;
    this._openedByFocus = false;
    this._boundFocusOpen = (e) => {
      if (!this._isTriggerFocusEvent(e)) return;
      this._openedByFocus = true;
      this._handleOpen(true);
    };
    this._boundFocusClose = (e) => {
      if (!this._isTriggerFocusEvent(e)) return;
      // Ignore focus moving into the tooltip itself.
      const next = e.relatedTarget;
      if (next && this.contains(next)) return;
      this.handleCloseTooltip();
    };
    this._boundEscapeClose = (e) => {
      if (e.key !== "Escape" && e.key !== "Esc") return;
      this.handleCloseTooltip();
    };
  }

  connectedCallback() {
    if (!this.tooltipEl || !this.tooltipTrigger) return;
    this.tooltipTrigger.addEventListener("mouseenter", this._boundOpen);
    this.tooltipTrigger.addEventListener("mouseleave", this._boundClose);
    this.tooltipTrigger.addEventListener("focusin", this._boundFocusOpen);
    this.tooltipTrigger.addEventListener("focusout", this._boundFocusClose);
    this.tooltipTrigger.addEventListener("keydown", this._boundEscapeClose);
    // Touch devices have no hover, so opt-in tooltips toggle on tap instead.
    if (this._enableMobile) {
      this._boundToggle = this._handleToggle.bind(this);
      this.tooltipTrigger.addEventListener("click", this._boundToggle);
    }
  }

  disconnectedCallback() {
    this._stopPositionTracking();
    this._removeOutsideClose();
    if (this._boundPopoverToggle && this.tooltipEl) {
      this.tooltipEl.removeEventListener("toggle", this._boundPopoverToggle);
    }
    if (!this.tooltipTrigger) return;
    this.tooltipTrigger.removeEventListener("mouseenter", this._boundOpen);
    this.tooltipTrigger.removeEventListener("mouseleave", this._boundClose);
    this.tooltipTrigger.removeEventListener("focusin", this._boundFocusOpen);
    this.tooltipTrigger.removeEventListener("focusout", this._boundFocusClose);
    this.tooltipTrigger.removeEventListener("keydown", this._boundEscapeClose);
    if (this._boundToggle) this.tooltipTrigger.removeEventListener("click", this._boundToggle);
  }

  // `ignoreViewportGate` opens regardless of viewport width. Hover opens stay desktop-only
  // (touch has no hover; the tap toggle covers it), but a keyboard open must work at every
  // width — a tooltip only reachable with a mouse is not reachable at all for some users.
  _handleOpen(ignoreViewportGate = false) {
    if (!this.tooltipEl) return;
    if (!ignoreViewportGate && window.innerWidth < MIN_DEVICE_WIDTH.desktop) return;

    if (this._usePopover) {
      this._openPopover(this.tooltipTrigger);
      return;
    }

    // In list-layout context, use _listPosition; otherwise use _defaultPosition.
    // Checked on every open so switching between grid/list at runtime is handled.
    const isListLayout = !!this.closest(".list-layout");
    const preferredPosition = isListLayout ? this._listPosition : this._defaultPosition;

    this._applyPosition(preferredPosition);

    requestAnimationFrame(() => {
      // Always auto-flip top↔bottom based on available viewport room.
      // visibility:hidden elements still participate in layout, so
      // getBoundingClientRect() returns real coordinates while the tooltip
      // remains invisible to the user during this calculation.
      const rect = this.tooltipEl.getBoundingClientRect();
      let actualPosition = preferredPosition;

      if (preferredPosition === "top" && rect.top < 0) {
        actualPosition = "bottom";
      } else if (preferredPosition === "bottom" && rect.bottom > window.innerHeight) {
        actualPosition = "top";
      }

      if (actualPosition !== preferredPosition) {
        this._applyPosition(actualPosition);
      }

      this._applyHorizontalClamp();

      // Keep the `invisible` utility and only add `tooltip-visible`. `.tooltip-visible`
      // declares `visibility: visible` only in the lg stylesheet (lg:visible), so below
      // 1024px `invisible` keeps the tooltip hidden — making single-trigger tooltips
      // desktop-only, consistent with CustomToolTipContainer. Removing `invisible` here
      // would fall back to the default `visible` and leak the tooltip onto mobile/tablet.
      this.tooltipEl.classList.add("tooltip-visible");
    });
  }

  // -- Popover (top-layer) path ------------------------------------------------
  // Open the tooltip in the browser top layer and position it with `fixed` coords
  // relative to `triggerEl`. The top layer escapes ancestor overflow/transform/z-index,
  // so the tooltip is never covered or clipped by other elements in the theme.
  _openPopover(triggerEl) {
    if (!this.tooltipEl || !triggerEl) return;
    // Tooltips are a desktop (hover) affordance and don't open below the lg breakpoint,
    // unless the consumer opted into mobile (tap-to-toggle, e.g. the EDT info icon).
    if (!this._enableMobile && window.innerWidth < MIN_DEVICE_WIDTH.desktop) return;
    // Don't open when the host is hidden by Alpine `x-show` (e.g. a comparison tooltip whose
    // added/limit state isn't active yet). Reading the inline `style.display` that x-show sets is
    // cheap (no layout/reflow, unlike getComputedStyle). Otherwise the popover would open while
    // invisible and then auto-appear the moment `x-show` flips true on add — showing the tooltip
    // together with the compare drawer instead of only on a deliberate hover/tap.
    if (this.style.display === "none") return;

    const isListLayout = !!this.closest(".list-layout");
    const preferredPosition = isListLayout ? this._listPosition : this._defaultPosition;
    this._activeAlign = isListLayout ? this._listAlign : this._align;

    this._applyPosition(preferredPosition);

    try {
      if (!this.tooltipEl.matches(":popover-open")) this.tooltipEl.showPopover();
    } catch (e) {
      return;
    }

    // showPopover() + getBoundingClientRect() + style writes all run in this same task,
    // before the next paint, so the tooltip is painted once at the final position.
    this._positionPopover(triggerEl, preferredPosition);
    // Keep the tooltip anchored to the trigger after opening (the popover lives in the
    // top layer with `fixed` coords, so it would otherwise float away on scroll and could
    // anchor to a mid-animation rect when the trigger is still transitioning in).
    this._startPositionTracking(triggerEl, preferredPosition);
  }

  _positionPopover(triggerEl, preferredPosition) {
    const el = this.tooltipEl;
    const GAP = 6; // distance between trigger and tooltip (matches the arrow depth so it touches)
    const MARGIN = 8; // min distance kept from the viewport edges

    // Reset shift + inline geometry so the measurement starts from a clean state.
    el.style.setProperty("--left-tooltip", "0px");
    el.style.setProperty("--top-tooltip", "0px");
    el.style.transform = "none";
    el.style.right = "auto";
    el.style.bottom = "auto";

    const triggerRect = triggerEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const tipW = elRect.width;
    const tipH = elRect.height;
    const isRTL = getComputedStyle(triggerEl).direction === "rtl";

    // For side (left/right) placement, fall back to vertical (top/bottom) when the tooltip
    // can't be vertically centered within the viewport — i.e. the trigger sits near the top
    // or bottom edge. Near the top → drop below; near the bottom → flip above.
    if (preferredPosition === "left" || preferredPosition === "right") {
      const centeredTop = triggerRect.top + triggerRect.height / 2 - tipH / 2;
      if (centeredTop < MARGIN) {
        preferredPosition = "bottom";
      } else if (centeredTop + tipH > window.innerHeight - MARGIN) {
        preferredPosition = "top";
      }
    }

    if (preferredPosition === "left" || preferredPosition === "right") {
      // --- Horizontal placement: beside the trigger, vertically centered on it. ---
      let position = preferredPosition;
      const roomLeft = triggerRect.left;
      const roomRight = window.innerWidth - triggerRect.right;
      if (position === "left" && roomLeft < tipW + GAP && roomRight >= tipW + GAP) {
        position = "right";
      } else if (position === "right" && roomRight < tipW + GAP && roomLeft >= tipW + GAP) {
        position = "left";
      }
      this._applyPosition(position);

      const sideLeft = position === "left" ? triggerRect.left - tipW - GAP : triggerRect.right + GAP;
      const left = Math.max(MARGIN, Math.min(sideLeft, window.innerWidth - MARGIN - tipW));

      // Center vertically on the trigger, then clamp; the arrow is counter-shifted on
      // the Y axis by --top-tooltip (CSS) so it keeps pointing at the trigger.
      const desiredTop = triggerRect.top + triggerRect.height / 2 - tipH / 2;
      const top = Math.max(MARGIN, Math.min(desiredTop, window.innerHeight - MARGIN - tipH));

      el.style.left = left + "px";
      el.style.top = top + "px";
      el.style.setProperty("--top-tooltip", top - desiredTop + "px");
      return;
    }

    // --- Vertical placement: above/below the trigger, always flipping top↔bottom. ---
    let position = preferredPosition === "bottom" ? "bottom" : "top";
    const roomAbove = triggerRect.top;
    const roomBelow = window.innerHeight - triggerRect.bottom;
    if (position === "top" && roomAbove < tipH + GAP && roomBelow >= tipH + GAP) {
      position = "bottom";
    } else if (position === "bottom" && roomBelow < tipH + GAP && roomAbove >= tipH + GAP) {
      position = "top";
    }
    this._applyPosition(position);

    let top = position === "top" ? triggerRect.top - tipH - GAP : triggerRect.bottom + GAP;
    top = Math.max(MARGIN, Math.min(top, window.innerHeight - tipH - MARGIN));

    // Horizontal alignment relative to the trigger, direction-aware:
    //   start  → trigger's start edge (LTR left / RTL right)
    //   end    → trigger's end edge   (LTR right / RTL left)
    //   center → centered on the trigger
    // Then clamp inside the viewport; the arrow is counter-shifted by --left-tooltip (CSS)
    // so it keeps pointing at the trigger after any clamp.
    let desiredLeft;
    if (this._activeAlign === "center") {
      desiredLeft = triggerRect.left + triggerRect.width / 2 - tipW / 2;
    } else {
      const alignToRightEdge = this._activeAlign === "end" ? !isRTL : isRTL;
      desiredLeft = alignToRightEdge ? triggerRect.right - tipW : triggerRect.left;
    }
    const left = Math.max(MARGIN, Math.min(desiredLeft, window.innerWidth - MARGIN - tipW));
    const shift = left - desiredLeft;

    el.style.top = top + "px";
    el.style.left = left + "px";
    el.style.setProperty("--left-tooltip", shift + "px");
  }

  // Track the open popover:
  //   - scroll (capture) dismisses the tooltip immediately — a `fixed` popover that trailed
  //     the scrolling trigger and only vanished on the delayed mouseleave looked laggy/ugly;
  //   - resize re-runs the positioning so the tooltip stays anchored;
  //   - a short rAF loop follows the trigger while its rect is still changing, e.g. the
  //     product card reveal slide-in (transform: translateX(100%) -> 0). It stops once the
  //     rect has been stable for a few frames, with a ~1s frame cap as a safety net.
  _startPositionTracking(triggerEl, preferredPosition) {
    this._stopPositionTracking();

    this._boundReposition = () => {
      if (!this.tooltipEl || !this.tooltipEl.matches(":popover-open")) return;
      this._positionPopover(triggerEl, preferredPosition);
    };
    window.addEventListener("resize", this._boundReposition, { passive: true });

    // Dismiss the tooltip when the page scrolls (a `fixed` popover trailing the scrolled
    // trigger looked laggy, and users expect scrolling away to close it). The listener is on
    // window in the capture phase so it also catches the cart-drawer's own scroll container,
    // but that means it ALSO receives scroll events from unrelated scrollable widgets on the
    // page (sliders, media galleries, autoplaying slideshows) and browser scroll-anchoring —
    // which would close the tooltip while it's still hovered. So only act on a genuine page
    // scroll, or a scroll of an ancestor that actually contains the trigger.
    this._boundScrollClose = (e) => {
      if (!this.tooltipEl || !this.tooltipEl.matches(":popover-open")) return;
      const t = e.target;
      const isPageScroll = t === document || t === document.documentElement || t === window;
      const isAncestorScroll = !!(t && t.contains && triggerEl && t.contains(triggerEl));
      if (!isPageScroll && !isAncestorScroll) return;
      this.handleCloseTooltip();
    };
    window.addEventListener("scroll", this._boundScrollClose, { passive: true, capture: true });

    let prevRectKey = null;
    let stableFrames = 0;
    let frames = 0;
    const follow = () => {
      this._trackingRAF = null;
      if (!this.tooltipEl || !this.tooltipEl.matches(":popover-open")) return;

      const r = triggerEl.getBoundingClientRect();
      const rectKey = `${r.left},${r.top},${r.width},${r.height}`;
      if (rectKey === prevRectKey) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
        this._positionPopover(triggerEl, preferredPosition);
      }
      prevRectKey = rectKey;
      frames += 1;

      // Stop once the trigger has settled (3 identical frames) or after the safety cap.
      if (stableFrames >= 3 || frames > 60) return;
      this._trackingRAF = requestAnimationFrame(follow);
    };
    this._trackingRAF = requestAnimationFrame(follow);
  }

  _stopPositionTracking() {
    if (this._boundScrollClose) {
      window.removeEventListener("scroll", this._boundScrollClose, { capture: true });
      this._boundScrollClose = null;
    }
    if (this._boundReposition) {
      // On mobile the scroll listener is bound to _boundReposition (follow); removing a
      // listener that was never added (desktop) is a harmless no-op.
      window.removeEventListener("scroll", this._boundReposition, { capture: true });
      window.removeEventListener("resize", this._boundReposition);
      this._boundReposition = null;
    }
    if (this._trackingRAF) {
      cancelAnimationFrame(this._trackingRAF);
      this._trackingRAF = null;
    }
  }

  _hasHoverPointer() {
    if (typeof window.matchMedia !== "function") return true;
    return window.matchMedia("(any-hover: hover)").matches;
  }

  _handleToggle(e) {
    if (!this._usePopover || !this.tooltipEl) return;
    if (this._hasHoverPointer()) return;
    e.preventDefault();
    e.stopPropagation();
    if (this.tooltipEl.matches(":popover-open")) {
      if (this._openedByFocus) {
        this._openedByFocus = false;
        this._addOutsideClose();
        return;
      }
      this.handleCloseTooltip();
    } else {
      this._openPopover(this.tooltipTrigger);
      // Only wire tap-outside-to-close if the popover actually opened (the open can bail, e.g.
      // when the tooltip isn't eligible/x-show hidden), so we don't leave a stray listener.
      if (this.tooltipEl.matches(":popover-open")) this._addOutsideClose();
    }
  }

  // While a tap-opened tooltip is showing, close it when the user taps anywhere outside it
  // (the trigger itself is handled by _handleToggle). Deferred one task so the opening tap
  // doesn't immediately close it.
  _addOutsideClose() {
    this._removeOutsideClose();
    this._boundOutsideClose = (ev) => {
      if (this.contains(ev.target)) return;
      if (this.tooltipTrigger && this.tooltipTrigger.contains(ev.target)) return;
      this.handleCloseTooltip();
    };
    this._outsideCloseTimer = setTimeout(() => {
      document.addEventListener("click", this._boundOutsideClose, true);
    }, 0);
  }

  _removeOutsideClose() {
    if (this._outsideCloseTimer) {
      clearTimeout(this._outsideCloseTimer);
      this._outsideCloseTimer = null;
    }
    if (this._boundOutsideClose) {
      document.removeEventListener("click", this._boundOutsideClose, true);
      this._boundOutsideClose = null;
    }
  }

  // Optional: keep the tooltip inside a boundary ancestor (the product card
  // column) so a long label never overflows the card's clipped edges. The
  // boundary is the closest ancestor of the trigger whose class matches
  // data-clamp-boundary. No-op when the attribute is absent.
  //
  // The popup is rendered centered on its trigger via "left: 50% + var(--left-tooltip)".
  // This caps the popup width to the boundary, then nudges it via --left-tooltip
  // only when an edge overflows: push right if it crosses the boundary's left
  // edge, pull left if it crosses the right edge (keeping a 5px gap). The arrow,
  // translated by -var(--left-tooltip), keeps pointing at the trigger.
  // Ported from the original Alpine setPosition().
  _applyHorizontalClamp() {
    if (!this._clampBoundary || !this.tooltipEl || !this.tooltipTrigger) return;

    const boundary = this.tooltipTrigger.closest("." + this._clampBoundary);
    if (!boundary) return;

    const parentRect = boundary.getBoundingClientRect();

    // Cap width to the boundary (minus 20px) so a long label wraps instead of overflowing.
    this.tooltipEl.style.maxWidth = parentRect.width - 20 + "px";

    const elRect = this.tooltipEl.getBoundingClientRect();
    const currentLeft = parseFloat(this.tooltipEl.style.getPropertyValue("--left-tooltip")) || 0;

    // Push right when the (un-shifted) left edge overflows the boundary's left edge.
    const spacingLeft = elRect.left - currentLeft - parentRect.left - 5;
    if (spacingLeft < 0) {
      this.tooltipEl.style.setProperty("--left-tooltip", Math.abs(spacingLeft) + "px");
    }

    // Pull left when the right edge overflows the boundary's right edge.
    const spacingRight = parentRect.right - elRect.right - 5;
    if (spacingRight < 0) {
      this.tooltipEl.style.setProperty("--left-tooltip", spacingRight + currentLeft + "px");
    }
  }

  _applyPosition(position) {
    if (!this.tooltipEl) return;
    this.tooltipEl.dataset.tooltipPosition = position;

    const arrowUp = this.tooltipEl.querySelector(".tooltip-arrow-up");
    const arrowDown = this.tooltipEl.querySelector(".tooltip-arrow-down");

    // "bottom" shows the up-arrow (points up at the trigger above it). "top", "left" and
    // "right" all use the down-arrow — CSS rotates it ±90° to point sideways for left/right.
    if (position === "bottom") {
      arrowUp?.classList.remove("hidden");
      arrowDown?.classList.add("hidden");
    } else {
      arrowUp?.classList.add("hidden");
      arrowDown?.classList.remove("hidden");
    }
  }

  // Public — called directly by CustomToolTipContainer on mouseleave.
  handleCloseTooltip() {
    if (!this.tooltipEl) return;
    this._openedByFocus = false;

    if (this._usePopover) {
      try {
        if (this.tooltipEl.matches(":popover-open")) this.tooltipEl.hidePopover();
      } catch (e) {}
      // Clear inline geometry so the next open re-measures from scratch.
      this.tooltipEl.style.top = "";
      this.tooltipEl.style.left = "";
      this.tooltipEl.style.right = "";
      this.tooltipEl.style.bottom = "";
      this.tooltipEl.style.transform = "";
      this.tooltipEl.style.removeProperty("--left-tooltip");
      this._applyPosition(this._defaultPosition);
      this._stopPositionTracking();
      this._removeOutsideClose();
      return;
    }

    this.tooltipEl.classList.remove("tooltip-visible");
    this.tooltipEl.classList.add("invisible");
    // Reset to default so the next open always measures from a clean state.
    this._applyPosition(this._defaultPosition);
    // Clear any horizontal clamp so the next open re-measures from scratch.
    if (this._clampBoundary) {
      this.tooltipEl.style.removeProperty("--left-tooltip");
      this.tooltipEl.style.maxWidth = "";
    }
  }
}

if (!customElements.get("custom-tooltip")) {
  customElements.define("custom-tooltip", CustomToolTip);
}

// -----------------------------------------------------------------------------
// CustomButton — extends IntersectionElement, handles button hover animation
// -----------------------------------------------------------------------------
class CustomButton extends IntersectionElement {
  constructor() {
    super();
    this.domObserver = null;
    this.disabledObserver = null;
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.dataset.checkDomChange == 'true' && !this.button) {
      this.setupDomObserver();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cleanupDomObserver();
    if (this.disabledObserver) {
      this.disabledObserver.disconnect();
      this.disabledObserver = null;
    }
  }

  setupDomObserver() {
    this.domObserver = new MutationObserver(() => {
      this.handleDomChange();
    });

    this.domObserver.observe(this, {
      childList: true,
      subtree: true
    });
  }

  cleanupDomObserver() {
    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }
  }

  handleDomChange() {
    const newButton = this.querySelector(
      ".button, button, .anm-button-primary, .anm-button-secondary"
    );

    if (!newButton) return;
    this.cleanupDomObserver();
    this.handleInit();

    this.isValidContext = this.checkValidContext();
    if (!this.isValidContext) return;

    this.actionBeforeSetupObserver();
    this.setupObserver();
    this.actionAfterSetupObserver();
  }

  handleInit() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.disabledObserver) {
      this.disabledObserver.disconnect();
      this.disabledObserver = null;
    }
    this.button = this.querySelector(
      ".button, button, .anm-button-primary, .anm-button-secondary"
    );
    this.onMouseEnter = this.handleMouseEnter.bind(this);
    this.onMouseLeave = this.handleMouseLeave.bind(this);
    this.observerElement = this.button;

    // Guard: only needed for thicken mode where `::before` is gated on :not([disabled])
    if (this.button && window.Maximize?.buttonHoverAnm === BUTTON_HOVER_ANM.thicken) {
      this.disabledObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.attributeName === 'disabled' && !this.button.disabled) {
            this.button.classList.remove('is-hover');
          }
        }
      });
      this.disabledObserver.observe(this.button, { attributes: true, attributeFilter: ['disabled'] });
    }
  }

  checkValidContext() {
    if (!this.button || this.button.classList.contains("button-link")) return false;
    if (this.button.classList.contains('anm-btn-from-context') && !this.button.closest('.anm-btn-controller')) return false;

    if (!window.Maximize || (window.Maximize.buttonHoverAnm != BUTTON_HOVER_ANM.thicken)) return false;

    return true;
  }

  handleIntersect() {
    this.button.addEventListener("mouseenter", this.onMouseEnter);
    this.button.addEventListener("mouseleave", this.onMouseLeave);
  }

  handleLeave() {
    this.button.removeEventListener("mouseenter", this.onMouseEnter);
    this.button.removeEventListener("mouseleave", this.onMouseLeave);
  }

  handleMouseEnter(e) {
    if (window.innerWidth < MIN_DEVICE_WIDTH.desktop) return;

    const rect = this.button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.button.classList.remove('is-hover');

    this.button.style.setProperty('--mouse-in-button-x', `${x}px`);
    this.button.style.setProperty('--mouse-in-button-y', `${y}px`);

    this.button.offsetHeight;

    requestAnimationFrame(() => {
      this.button.classList.add('is-hover');
    });
  }

  handleMouseLeave(e) {
    if (window.innerWidth < MIN_DEVICE_WIDTH.desktop) return;

    const rect = this.button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.button.style.setProperty('--mouse-in-button-x', `${x}px`);
    this.button.style.setProperty('--mouse-in-button-y', `${y}px`);

    this.button.classList.remove('is-hover');
  }
}

if (!customElements.get("custom-button")) {
  customElements.define("custom-button", CustomButton);
}

// -----------------------------------------------------------------------------
// CustomToolTipContainer — multi-trigger tooltip (updates content on hover)
// Depends on: getValueCssVariable (defined in theme.js global scope)
// -----------------------------------------------------------------------------
class CustomToolTipContainer extends CustomToolTip {
  constructor() {
    super();
    this.listTooltipTrigger = this.querySelectorAll(".container__tooltip-trigger");
  }
  connectedCallback() {
    if (this.tooltipEl && this.listTooltipTrigger.length > 0) {
      this.sectionAnnouncementEl = document.getElementById("x-announcement");
      this.sectionHeaderEl = document.getElementsByClassName("section-header")[0];
      // Store one bound handler pair per trigger so disconnectedCallback can remove the
      // exact same references. Calling .bind() again at removal time creates brand new
      // functions that removeEventListener cannot match, which would leak the listeners.
      this._triggerHandlers = Array.from(this.listTooltipTrigger).map((el) => {
        const onEnter = this.handleUpdateTooltip.bind(this, el);
        const onLeave = this.handleCloseTooltip.bind(this);
        el.addEventListener("mouseenter", onEnter);
        el.addEventListener("mouseleave", onLeave);
        return { el, onEnter, onLeave };
      });
    }
  }

  disconnectedCallback() {
    this._stopPositionTracking();
    if (this._triggerHandlers) {
      this._triggerHandlers.forEach(({ el, onEnter, onLeave }) => {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mouseleave", onLeave);
      });
      this._triggerHandlers = null;
    }
  }

  handleUpdateTooltip(el) {
    if (this.tooltipEl) {
      const tooltipBoundary = this.tooltipEl.closest(".tooltip-boundary");
      const tooltipContentEl = this.tooltipEl.querySelector(".tooltip-content");

      if (!this.tooltipEl || !tooltipContentEl || el.dataset.isNoText == "true") return;

      this.tooltipEl.dataset.tooltipPosition = "top";

      const temp = document.createElement("div");
      temp.innerHTML = el.innerHTML;
      temp.querySelectorAll('[data-tooltip-exclude]')
        .forEach(el => el.remove());

      tooltipContentEl.innerHTML = temp.innerHTML;

      if (this._usePopover) {
        // Top layer + JS positioning, anchored to the hovered trigger.
        this._openPopover(el);
        return;
      }

      requestAnimationFrame(() => {
        const tooltipRect = this.tooltipEl.getBoundingClientRect();
        const boundaryRect = tooltipBoundary?.getBoundingClientRect();

        if (tooltipRect.top < (boundaryRect?.top || 0)) {
          this.tooltipEl.dataset.tooltipPosition = "bottom";
        } else {
          let heightHeaderAndAnnouncementBar = 0;
          if (this.sectionAnnouncementEl && this.sectionAnnouncementEl.classList.contains('announcement-sticky')) {
            heightHeaderAndAnnouncementBar += this.sectionAnnouncementEl.getBoundingClientRect().height;
          }

          if (this.sectionHeaderEl && this.sectionHeaderEl.classList.contains('sticky-header') && document.getElementById('x-header-content')) {
            heightHeaderAndAnnouncementBar += getValueCssVariable('--height-header', document.getElementById('x-header-content'), true);
          }

          if (tooltipRect.top < heightHeaderAndAnnouncementBar) {
            this.tooltipEl.dataset.tooltipPosition = "bottom";
          } else {
            this.tooltipEl.dataset.tooltipPosition = "top";
          }
        }
        this.tooltipEl.classList.add("tooltip-visible");
      });
    }
  }
}

if (!customElements.get("custom-tooltip-container")) {
  customElements.define("custom-tooltip-container", CustomToolTipContainer);
}

// -----------------------------------------------------------------------------
// BulkOrderErrorTooltip — a state-driven (NOT hover) error tooltip.
// Opens in the browser top layer (Popover API) whenever its `.tooltip-content` has
// text — bound via Alpine x-text to the bulk-order qtyErrors state — so the message
// is never clipped by the bulk-order popup/table overflow. Reuses CustomToolTip's
// popover positioner; only the open/close trigger and scroll behaviour differ.
// -----------------------------------------------------------------------------
class BulkOrderErrorTooltip extends CustomToolTip {
  connectedCallback() {
    if (!this.tooltipEl) return;
    // Re-resolve the trigger here (parentElement is reliably set once connected).
    this.tooltipTrigger = this.parentElement;
    this.contentEl = this.tooltipEl.querySelector(".tooltip-content");
    if (!this.contentEl) return;
    // x-text writes the error message into .tooltip-content; open while it has text.
    this._contentObserver = new MutationObserver(() => this._syncFromContent());
    this._contentObserver.observe(this.contentEl, { childList: true, characterData: true, subtree: true });
    // Open-only on attach. A just-attached popover is always closed (the Popover API force-closes
    // one whose element leaves the document), so the close branch could never do anything here
    // except run on content that hasn't been written yet — Alpine evaluates the x-text INSIDE this
    // row only after inserting it, and a section re-render attaches the element with empty markup.
    this._syncFromContent(false);
  }

  disconnectedCallback() {
    if (this._contentObserver) {
      this._contentObserver.disconnect();
      this._contentObserver = null;
    }
    this.handleCloseTooltip();
  }

  // `allowClose` false skips the close branch, for callers that can be reached before the message
  // has been written (see connectedCallback). The observer always passes it through.
  _syncFromContent(allowClose = true) {
    const hasError = this.contentEl.textContent.trim().length > 0;
    if (!hasError) {
      if (allowClose) this.handleCloseTooltip();
      return;
    }
    if (this._usePopover) {
      this._openPopover(this.tooltipTrigger);
    } else {
      // No Popover API: fall back to the in-flow absolute popup (may clip, but visible).
      this.tooltipEl.classList.remove("invisible");
      this.tooltipEl.classList.add("tooltip-visible");
    }
  }

  // A persistent error must FOLLOW the trigger on scroll/resize, not dismiss like a hover
  // tooltip. Override the base tracker (which closes on scroll) to reposition instead.
  _startPositionTracking(triggerEl, preferredPosition) {
    this._stopPositionTracking();
    this._boundReposition = () => {
      if (!this.tooltipEl || !this.tooltipEl.matches(":popover-open")) return;
      this._positionPopover(triggerEl, preferredPosition);
    };
    window.addEventListener("resize", this._boundReposition, { passive: true });
    window.addEventListener("scroll", this._boundReposition, { passive: true, capture: true });
  }
}

if (!customElements.get("bulk-order-error-tooltip")) {
  customElements.define("bulk-order-error-tooltip", BulkOrderErrorTooltip);
}

class SlideElement extends HTMLElement {
  constructor() {
    super();
    this.listItems = Array.from(this.getElementsByClassName("slide-element__item"));

    // Theme blocks render their children via {% content_for 'blocks' %} and cannot
    // add the slide-element__item class to each child. Fall back to the top-level
    // .block-group children so those blocks rotate too (nested groups are excluded
    // by the direct-child combinator).
    if (this.listItems.length === 0) {
      this.listItems = Array.from(this.querySelectorAll(".slide-element__list-items > .block-group"));
    }

    this.activeIndex = -1;
    this.prevActiveIndex = -1;
    this.animationInterval = null;
    this.classNames = {
      active: "is-active",
      prevActive: "is-prev-active",
      transitionNone: "!transition-none",
    };
    this.isFistTimeVisible = true;
    this.isIntersecting = false;
  }

  connectedCallback() {
    if (this.listItems.length === 0) return;
    this.initSlideElement();
    this.setupObserver();
  }

  disconnectedCallback() {
    this.handleLeave();
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  setupObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.handleIntersect();
          } else {
            this.handleLeave();
          }
        });
      },
      {
        root: null,
        rootMargin: "0px",
        threshold: 0.01,
      }
    );

    this.observer.observe(this);
  }

  initSlideElement() {
    let customConfig;
    try {
      customConfig = JSON.parse(this.dataset.config);
      if (typeof customConfig === "string") customConfig = JSON.parse(customConfig);
    } catch {
      customConfig = {};
    }

    customConfig.gap && this.style.setProperty("--slide-element-gap", `${customConfig.gap}px`);
    customConfig.effectDuration && this.style.setProperty("--slide-effect-duration", customConfig.effectDuration);

    this.config = {
      timeToNext: customConfig.timeToNext ? parseInt(customConfig.timeToNext) * MS_PER_SECOND : 0,
      gap: (customConfig.gap ? customConfig.gap : SLIDE_ELEMENT.SLIDE_ELEMENT_GAP) || 0,
      effectDuration: (customConfig.effectDuration ? customConfig.effectDuration : SLIDE_ELEMENT.SLIDER_ELEMENT_DURATION) || 0,
    };
  }

  handleIntersect() {
    if (this.listItems.length === 0) return;

    if (this.isFistTimeVisible) {
      this.activeIndex = 0;
      this.listItems[this.activeIndex]?.classList.add(this.classNames.active, this.classNames.transitionNone);
      requestAnimationFrame(() => {
        this.listItems[this.activeIndex]?.classList.remove(this.classNames.transitionNone);
        this.isFistTimeVisible = false;
      });
    }

    this.handleAutoPlay();
    this.isIntersecting = true;
  }

  handleLeave() {
    this.isIntersecting = false;
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
  }

  handleAutoPlay() {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }

    if (this.animationTimeOut) {
      clearTimeout(this.animationTimeOut);
      this.animationTimeOut = null;
    }

    if (this.listItems.length > 1 && this.config.timeToNext > 0) {
      if (this.isIntersecting) {
        const duration = this.config.timeToNext;
        this.animationInterval = setInterval(() => {
          this.slide(true);
        }, duration);
      } else {
        const duration = this.config.timeToNext - this.config.effectDuration;
        this.animationTimeOut = setTimeout(() => {
          this.slide(true);
          this.handleAutoPlay();
        }, duration);
      }
    }
  }

  slide(next = true) {
    const currentActiveIndex = this.activeIndex;
    const nextActiveItemIndex = next ? (this.activeIndex + 1) % this.listItems.length : (this.activeIndex - 1 + this.listItems.length) % this.listItems.length;

    if (this.prevActiveIndex !== -1) {
      this.listItems[this.prevActiveIndex].classList.remove(this.classNames.prevActive);
    }
    this.listItems[this.activeIndex].classList.remove(this.classNames.active);

    this.prevActiveIndex = currentActiveIndex;

    this.activeIndex = nextActiveItemIndex;

    this.listItems[this.prevActiveIndex].classList.add(this.classNames.prevActive);
    this.listItems[this.activeIndex].classList.add(this.classNames.active);

    setTimeout(() => {
      this.listItems[this.prevActiveIndex]?.classList.remove(this.classNames.prevActive);
    }, this.config.effectDuration);
  }

  nextItem() {
    this.slide(true);
    this.handleAutoPlay();
  }

  backItem() {
    this.slide(false);
    this.handleAutoPlay();
  }
}

if (!customElements.get("slide-element")) {
  customElements.define("slide-element", SlideElement);
}

class CustomCollections extends HTMLElement {
  constructor() {
    super();
    this.sectionId = this.dataset.sectionId;
    this.currentTab = 1;
    this.isLoading = false;
    this.cachedData = {};
    this.onSelectCollection = this.handleSelectCollection.bind(this);
    this.preventViewAllClick = this.preventViewAllClick.bind(this);
    this.viewAllDisabled = false;
    this._initialized = false;
    this._observer = null;
  }

  connectedCallback() {
    // In design mode init immediately so merchants can interact with all sections
    if (Shopify.designMode) {
      this._init();
      return;
    }

    // Defer heavy init (cloneNode, querySelectorAll, event listeners) until
    // the element is within 200px of the viewport — keeps connectedCallback
    // near-instant and removes its cost from TBT.
    this._observer = new IntersectionObserver(
      (entries, obs) => {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();
        this._observer = null;
        this._init();
      },
      { rootMargin: "200px 0px" }
    );
    this._observer.observe(this);
  }

  _init() {
    if (this._initialized) return;
    this._initialized = true;

    this.collectionButtons = this.querySelectorAll(".collection-title");
    this.collectionsWrapperEl = document.getElementById(`Collections--${this.sectionId}`);
    this.viewAllLinks = this.querySelectorAll(".collection__view-all");

    if (!this.collectionsWrapperEl) return;

    if (this.collectionButtons.length > 1) {
      const cloneCollectionsWrapperEl = this.collectionsWrapperEl.cloneNode(true);
      this.anmRevealItems = cloneCollectionsWrapperEl.querySelectorAll(".anm-reveal-item");
      this.anmRevealItems.forEach((item) => {
        item.classList.remove("anm-reveal-item");
      });
      this.cachedData[`tabIndex-${this.currentTab}`] = cloneCollectionsWrapperEl.innerHTML;

      this.collectionButtons.forEach((button) => {
        button.addEventListener("click", this.onSelectCollection);
      });
    }

    if (this.collectionButtons[0]) {
      this.selectCollection(1);
    }

    if (this.viewAllLinks.length > 0) {
      this.viewAllLinks.forEach((el) => {
        el.addEventListener("click", this.preventViewAllClick);
      });

      this.setViewAllLink(this.dataset.defaultViewAllLink);
    }
  }

  disconnectedCallback() {
    // Clean up observer if element removed before init fired
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }

    if (!this.collectionButtons) return;

    this.collectionButtons.forEach((button) => {
      button.removeEventListener("click", this.onSelectCollection);
    });

    this.viewAllLinks.forEach((el) => {
      el.removeEventListener("click", this.preventViewAllClick);
    });
  }

  async handleSelectCollection(e) {
    if (!this.collectionsWrapperEl) return;

    const tabIndex = parseInt(e.currentTarget.dataset.tabIndex, 10);
    const viewAllLink = e.currentTarget.dataset.viewAllLink;
    if (this.currentTab !== tabIndex && !this.isLoading) {
      await this.loadDataCollection(tabIndex);
      this.selectCollection(tabIndex);
      if (this.viewAllLinks.length > 0) {
        this.setViewAllLink(viewAllLink);
      }
    }
  }

  selectCollection(index) {
    this.collectionButtons.forEach((button) => {
      const tabIndex = parseInt(button.dataset.tabIndex, 10);
      if (tabIndex === index) {
        button.classList.add("is-active");
      } else {
        button.classList.remove("is-active");
      }
    });
  }

  setViewAllLink(link) {
    const isDisabled = !link;

    this.viewAllLinks.forEach((el) => {
      el.href = link || "";
      el.classList.toggle("opacity-70", isDisabled);
      el.classList.toggle("hover:cursor-not-allowed", isDisabled);
    });

    this.viewAllDisabled = isDisabled;
  }

  preventViewAllClick(e) {
    if (this.viewAllDisabled) {
      e.preventDefault();
    }
  }

  selectCollectionButtonsLoading(isLoading, nextTabIndexActive) {
    if (isLoading) {
      this.collectionButtons[nextTabIndexActive - 1].classList.add("next-tab-active");
      this.collectionButtons.forEach((button) => {
        button.setAttribute("aria-disabled", "true");
      });
    } else {
      this.collectionButtons[nextTabIndexActive - 1].classList.remove("next-tab-active");
      this.collectionButtons.forEach((button) => {
        button.removeAttribute("aria-disabled");
      });
    }
    this.isLoading = isLoading;
  }

  async loadDataCollection(index) {
    const tabIndexKey = `tabIndex-${index}`;

    if (this.cachedData[tabIndexKey]) {
      this.collectionsWrapperEl.innerHTML = this.cachedData[tabIndexKey];
      // Elements restored from cache have no anm-reveal-item (stripped before caching)
      // and no is-visible (server HTML never has it), so add is-visible immediately —
      // the user has already seen this tab, no entrance animation needed.
      this.collectionsWrapperEl.querySelectorAll(".anm-fade-element").forEach((el) => {
        el.classList.add("is-visible");
      });
      this.currentTab = index;
    } else {
      this.selectCollectionButtonsLoading(true, index);
      let url = `${window.location.pathname}?section_id=${this.sectionId}&page=${index}`;

      try {
        const response = await fetch(url);
        const responseText = await response.text();
        const html = new DOMParser().parseFromString(responseText, "text/html");
        const newContent = html.getElementById(`Collections--${this.sectionId}`);
        if (newContent) {
          this.collectionsWrapperEl.innerHTML = newContent.innerHTML;
          this.anmRevealItems = newContent.querySelectorAll(".anm-reveal-item");
          this.anmRevealItems.forEach((item) => {
            item.classList.remove("anm-reveal-item");
          });
          this.cachedData[tabIndexKey] = newContent.innerHTML;
          this.currentTab = index;
        }
      } catch (error) {
        console.error(error);
      }

      this.selectCollectionButtonsLoading(false, index);
    }
  }
}

if (!customElements.get("custom-collections")) {
  customElements.define("custom-collections", CustomCollections);
}

class TabAnimation extends HTMLElement {
  constructor() {
    super();
    this.linkList = null;
    this._observer = null;
    this._intersectionObserver = null;
    this._mediaQuery = null;
    this._handleMediaChange = null;
    this._isInViewport = false;
    this._isFirstRender = true; 
  }

  connectedCallback() {
    this.linkList = this.querySelector(".link-list, .tab-list") ;
    this._intersectionObserver = new IntersectionObserver(([entry]) => {
      this._isInViewport = entry.isIntersecting;
      if (this._isInViewport) {
        this._onActiveChange();
      }
    }, {
      threshold: 0,
      rootMargin: '0px' 
    });
    this._intersectionObserver.observe(this);

    this._observer = new MutationObserver(() => {
      this._onActiveChange();
    });

    const tabItems = this.querySelectorAll(".tabs__button-horizontal"); 
    
    tabItems.forEach((item) => {
      this._observer.observe(item, { attributes: true, attributeFilter: ["class"] });
    });

    const tabletWidth = (typeof MIN_DEVICE_WIDTH !== 'undefined' && MIN_DEVICE_WIDTH.tablet) ? MIN_DEVICE_WIDTH.tablet : 768;
    
    this._mediaQuery = window.matchMedia(`(min-width: ${tabletWidth}px)`);
    
    this._handleMediaChange = () => {
      this._onActiveChange(); 
    };

    this._mediaQuery.addEventListener('change', this._handleMediaChange);
  }

  disconnectedCallback() {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    if (this._intersectionObserver) {
      this._intersectionObserver.disconnect();
      this._intersectionObserver = null;
    }
    if (this._mediaQuery && this._handleMediaChange) {
      this._mediaQuery.removeEventListener('change', this._handleMediaChange);
      this._mediaQuery = null;
      this._handleMediaChange = null;
    }
    
    this.linkList = null;
  }

  _onActiveChange() {
    if (!this._isInViewport) return;
    let activeItem = this.querySelector(".tabs__button-horizontal.is-active");
    
    if (!activeItem) {
      activeItem = this.querySelector(".tabs__button-horizontal.is-active-initial");
    }
    
    if (!activeItem) return;

    if (activeItem.classList.contains('is-active')) {
      const initialTab = this.querySelector(".tabs__button-horizontal.is-active-initial");
      if (initialTab && initialTab !== activeItem) {
        initialTab.classList.remove('is-active-initial');
      }
    }

    this.updateActiveBackground(this.linkList, activeItem);
  }

  updateActiveBackground(linkList, activeItem) {
    const list = linkList ?? this.linkList;
    
    if (!list || !activeItem || !list.closest(".tab-animation-pills")) return;

    requestAnimationFrame(() => {
      const childRect = activeItem.getBoundingClientRect();
      const linkListRect = list.getBoundingClientRect();

      const newLeft = childRect.left - linkListRect.left + list.scrollLeft;
      const newWidth = childRect.width;
      const newHeight = childRect.height;
      const newTop = childRect.top - linkListRect.top + list.scrollTop;

      const prevLeft = parseFloat(list.style.getPropertyValue("--offset-active-item-x")) || newLeft;
      const prevWidth = parseFloat(list.style.getPropertyValue("--width-active-item")) || newWidth;

      const isFirst = this._isFirstRender;

      list.style.setProperty("--height-active-item", `${newHeight}px`);
      list.style.setProperty("--offset-active-item-y", `${newTop}px`);

      if (isFirst || prevLeft === newLeft) {
        list.style.setProperty("--width-active-item", `${newWidth}px`);
        list.style.setProperty("--offset-active-item-x", `${newLeft}px`);

        if (isFirst) {
          requestAnimationFrame(() => {
            this.classList.remove('has-initial-active');
            activeItem.classList.remove('is-active-initial');
            this._isFirstRender = false;
          });
        }
        return;
      }

      const movingRight = newLeft > prevLeft;

      const prevLead = movingRight ? (prevLeft + prevWidth) : prevLeft;
      const prevTrail = movingRight ? prevLeft : (prevLeft + prevWidth);
      const newLead = movingRight ? (newLeft + newWidth) : newLeft;
      const newTrail = movingRight ? newLeft : (newLeft + newWidth);

      cancelAnimationFrame(this._liquidRaf);
      const startTime = performance.now();

      const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
      const easeInQuad = (t) => t * t;

      const tick = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / TAB_ANIMATION.DURATION, 1);

        let lead = prevLead + (newLead - prevLead) * easeOutQuad(t);
        let trail = prevTrail + (newTrail - prevTrail) * easeInQuad(t);

        const idealLead = prevLead + (newLead - prevLead) * t;
        const idealTrail = prevTrail + (newTrail - prevTrail) * t;
        const idealWidth = Math.abs(idealLead - idealTrail);

        let width = Math.abs(lead - trail);
        const maxAllowed = idealWidth + TAB_ANIMATION.MAX_STRETCH;
        if (width > maxAllowed) {
          const center = (lead + trail) / 2;
          const half = maxAllowed / 2;
          if (movingRight) {
            lead = center + half;
            trail = center - half;
          } else {
            lead = center - half;
            trail = center + half;
          }
          width = maxAllowed;
        }

        const left = movingRight ? trail : lead;

        list.style.setProperty("--offset-active-item-x", `${left}px`);
        list.style.setProperty("--width-active-item", `${width}px`);

        if (t < 1) {
          this._liquidRaf = requestAnimationFrame(tick);
        } else {
          list.style.setProperty("--offset-active-item-x", `${newLeft}px`);
          list.style.setProperty("--width-active-item", `${newWidth}px`);
        }
      };

      this._liquidRaf = requestAnimationFrame(tick);
    });
  }
}

if (!customElements.get("tab-animation")) {
  customElements.define("tab-animation", TabAnimation);
}

const storageKeyCache = new Map();

function getStorageKey(paramName) {
  let key = storageKeyCache.get(paramName);
  if (!key) {
    key = `filterState_${paramName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    storageKeyCache.set(paramName, key);
  }
  return key;
}

class CollapsibleTab extends HTMLElement {
  constructor() {
    super();

    const paramName = this.dataset.paramName;

    this._sectionRoot = window.Shopify.designMode ? this.closest('[id^="shopify-section-"]') : null;

    this._storageKey = this._sectionRoot && paramName ? getStorageKey(paramName) : null;

    let savedState;
    if (this._storageKey) {
      const stored = this._sectionRoot.dataset[this._storageKey];
      savedState = stored !== undefined ? stored === "true" : undefined;
    }

    this.isOpen = savedState !== undefined ? savedState : this.dataset.expanded === "true" || this.dataset.openByDefault === "true";

    this.useSecondaryBg = this.dataset.useSecondaryBg === "true";
    this.showInTab = this.dataset.showInTab === "true";
    this.trackExpandedState = this.hasAttribute("data-expanded");

    this._boundToggle = this.toggle.bind(this);
    this._boundKeydown = this._handleKeydown.bind(this);
    this._boundMouseEnter = this.handleEnter.bind(this);
    this._boundMouseLeave = this.handleLeave.bind(this);
    this._boundTransitionEnd = this._handleTransitionEnd.bind(this);
    this._boundClickOutside = this._handleClickOutside.bind(this);
  }

  connectedCallback() {
    this.container = this.hasAttribute("data-collapsible-tab-container") ? this : this.querySelector("[data-collapsible-tab-container]");
    this.header = this.querySelector("[data-collapsible-tab-header]");
    this.content = this.querySelector("[data-collapsible-tab-content]");
    this.caret = this.querySelector("[data-collapsible-tab-caret]");
    this.isFaq = this.classList.contains('faq-item');

    if (this.header) {
      this.header.removeEventListener("click", this._boundToggle);
      this.header.removeEventListener("keydown", this._boundKeydown);
      this.header.addEventListener("click", this._boundToggle);
      this.header.addEventListener("keydown", this._boundKeydown);
    }

    if (this.container) {
      this.container.addEventListener("mouseenter", this._boundMouseEnter);
      this.container.addEventListener("mouseleave", this._boundMouseLeave);
    }

    if (this.content) {
      this.content.addEventListener("transitionend", this._boundTransitionEnd);

      if (this._isAboveMode()) {
        this.content.classList.toggle("is-hidden", !this.isOpen);
      } else {
        if (this.isOpen) {
          this.content.classList.remove("hidden");
          this.content.style.height = "auto";
          this.content.style.overflow = "";
        } else {
          this.content.style.height = "0px";
          this.content.style.overflow = "hidden";
        }
      }
    }

    this._applyVisualState();

    if (!this.isOpen && this.container && !this._isAboveMode()) {
      this.container.classList.add("collapsible-hover-anm");
    }

    if (this.showInTab) {
      this.updateState();
    }
    
    if (this.isOpen && this._isAboveMode()) {
      this._attachOutsideListeners();
    }
  }

  disconnectedCallback() {
    if (this.header) {
      this.header.removeEventListener("click", this._boundToggle);
      this.header.removeEventListener("keydown", this._boundKeydown);
    }
    if (this.container) {
      this.container.removeEventListener("mouseenter", this._boundMouseEnter);
      this.container.removeEventListener("mouseleave", this._boundMouseLeave);
    }
    if (this.content) {
      this.content.removeEventListener("transitionend", this._boundTransitionEnd);
    }
    this._detachOutsideListeners();
  }

  toggle() {
    if (this.isFaq && !this.showInTab) return;
    this.isOpen = !this.isOpen;
    this.updateState();

    this.dispatchEvent(
      new CustomEvent("collapsible-tab-toggled", {
        detail: { isOpen: this.isOpen },
        bubbles: true,
      })
    );
  }

  _handleTransitionEnd(event) {
    if (!this.content || event.target !== this.content || this._isAboveMode() || event.propertyName !== "height") return;

    if (this.isOpen) {
      this.content.style.height = "auto";
      this.content.style.overflow = "";
    } else {
      this.content.style.height = "";
      this.content.style.overflow = "";
      this.content.classList.add("hidden");
      if (this.container) {
        this.container.classList.add("collapsible-hover-anm");
      }
    }
  }

  updateState(isOpen = this.isOpen) {
    this.isOpen = isOpen;

    if (this.content) {
      if (this._isAboveMode()) {
        this.content.classList.toggle("is-hidden", !this.isOpen);
      } else {
        if (this.isOpen) {
          if (this.container) {
            this.container.classList.remove("collapsible-hover-anm");
          }
          
          this.content.style.height = "0px";
          this.content.style.overflow = "hidden";
          this.content.classList.remove("hidden");

          requestAnimationFrame(() => {
            this.content.style.height = "auto";
            const fullHeight = this.content.getBoundingClientRect().height;
            this.content.style.height = "0px";

            requestAnimationFrame(() => {
              this.content.style.height = fullHeight + "px";
            });
          });
        } else {
          const currentHeight = this.content.getBoundingClientRect().height;
          this.content.style.height = currentHeight + "px";
          this.content.style.overflow = "hidden";

          void this.content.offsetHeight;
          this.content.style.height = "0px";
        }
      }
    }

    this._applyVisualState();
    
    if (this.isOpen && this._isAboveMode()) {
      this._attachOutsideListeners();
    } else {
      this._detachOutsideListeners();
    }
  }

  _applyVisualState() {
    if (this.caret) {
      if (this.isFaq) {
        this.caret.classList.toggle("rotate-0", this.isOpen);
        this.caret.classList.toggle("rotate-90", !this.isOpen);
      } else {
        this.caret.classList.toggle("rotate-180", this.isOpen);
        this.caret.classList.toggle("rotate-0", !this.isOpen);
      }
    }
    
    if (this.header && !this.header.classList.contains('facets__summary') && !this.header.classList.contains('collapsible-text-title')) {
      this.header.style.setProperty("--heading-font-weight", this.isOpen ? "600" : "400");
    }
    if (this.header && this.header.classList.contains('collapsible-text-title')) {
      this.header.style.setProperty("--body-font-weight", this.isOpen ? "600" : "400");
    }
    if (this.container) {
      if (this.useSecondaryBg) {
        this.container.classList.toggle("bg-secondary", this.isOpen);
      }
    }

    if (this.trackExpandedState) {
      this.dataset.expanded = this.isOpen ? "true" : "false";
    }

    if (this._storageKey) {
      this._sectionRoot.dataset[this._storageKey] = this.isOpen ? "true" : "false";
    }
  }

  getDirection(event) {
    const { top, height } = this.container.getBoundingClientRect();
    return event.clientY - top > height / 2;
  }

  handleEnter() {
    this.currentTransform = "translateY(0)";
    this.container.style.setProperty("--hover-transform", this.currentTransform);
  }

  handleLeave(event) {
    const toBottom = this.getDirection(event);
    this.currentTransform = toBottom ? "translateY(101%)" : "translateY(-101%)";
    this.container.style.setProperty("--hover-transform", this.currentTransform);
  }

  _handleKeydown(e) {
    if (this.isFaq && !this.showInTab) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.toggle();
    }
  }

  _isAboveMode() {
    return this.content && this.content.classList.contains('popup-above');
  }
  
  _attachOutsideListeners() {
    requestAnimationFrame(() => {
      if (this.isOpen) {
        document.addEventListener('click', this._boundClickOutside, true);
      }
    });
  }
  
  _detachOutsideListeners() {
    document.removeEventListener('click', this._boundClickOutside, true);
  }
  
  _handleClickOutside(event) {
    if (!this.contains(event.target)) {
      this.toggle();
    }
  }
}


if (!customElements.get("collapsible-tab")) {
  customElements.define("collapsible-tab", CollapsibleTab);
}
class CollectionList extends HTMLElement {
  constructor() {
    super();
    this.dataSectionIndex = this.dataset.sectionIndex;
    if (this.dataSectionIndex !== "1") {
      this.initializeScrollAnimationTrigger();
    } else {
      this.initializeUpdateTitleAnimation();
    }
  }

  onIntersection(elements, observer) {
    elements.forEach((entry, index) => {
      if (entry.isIntersecting) {
        const elementTarget = entry.target;
        elementTarget.dataset.active = "true";
        elementTarget.setAttribute("style", `--animation-order: ${index + 1};`);

        const textElements = elementTarget.querySelectorAll(".text-animation-item");
        textElements.forEach((textEl) => {
          textEl.classList.add("is-visible");
        });
        observer.unobserve(elementTarget);
      }
    });
  }

  initializeScrollAnimationTrigger(rootEl = document) {
    const animationContainers = Array.from(rootEl.querySelectorAll(".animated-list-wrapper"));

    animationContainers.forEach((container) => {
      const animationTriggerElements = Array.from(container.querySelectorAll(".anm-reveal-item-collection[data-active='false']"));
      if (animationTriggerElements.length === 0) return;

      const observer = new IntersectionObserver(
        (entries, obs) => {
          this.onIntersection(entries, obs);
        },
        {
          rootMargin: "0px 0px -50px 0px",
        }
      );

      animationTriggerElements.forEach((element) => observer.observe(element));
    });
  }

  initializeUpdateTitleAnimation(rootEl = document) {
    const titleElements = Array.from(rootEl.querySelectorAll(".text-animation-item"));
    titleElements.forEach((titleEl) => {
      titleEl.classList.add("is-visible");
    });
  }
}

if (!customElements.get("collection-list")) {
  customElements.define("collection-list", CollectionList);
}

class MediaPointer extends HTMLElement {
  constructor() {
    super();

    this.animateCursor = this.animateCursor.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleScroll = this.handleScroll.bind(this);

    this.mouseX = 0;
    this.mouseY = 0;
    this.cursorX = 0;
    this.cursorY = 0;
    this.isHovering = false;
    this.isClicking = false;
    this.currentScale = 0; 
    this.rafId = null;
    
    this.isCursorActive = false; 
    this.isCircleVisible = false; 
    this.isLoopRunning = false; 
    this.scrollTicking = false;
  }

  connectedCallback() {
    const hasHover = window.matchMedia('(hover: hover)').matches;
    const isDesktop = window.matchMedia(`(min-width: ${MIN_DEVICE_WIDTH.desktop}px)`).matches;
    if (!hasHover || !isDesktop) return;

    this.cursorCircle = this.querySelector('.media-pointer-circle');
    this.cursorText = this.querySelector('.media-pointer-text');
    if (!this.cursorCircle || !this.cursorText) return;

    document.addEventListener('mousemove', this.handleMouseMove, { passive: true });
    document.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('scroll', this.handleScroll, { passive: true });
    
    this.checkHoverStateOnce();
    this.ensureLoopRunning();
  }

  handleMouseMove(e) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    this.checkHoverStateOnce();

    if (this.isHovering || this.currentScale > 0.01) {
      this.ensureLoopRunning();
    }
  }

  handleScroll() {
    if (this.scrollTicking) return;
    
    this.scrollTicking = true;
    requestAnimationFrame(() => {
      this.checkHoverStateOnce();
      
      if (this.isHovering || this.currentScale > 0.01) {
        this.ensureLoopRunning();
      }
      this.scrollTicking = false;
    });
  }

  handleMouseDown() {
    if (this.isHovering) {
      this.isClicking = true;
      this.ensureLoopRunning();
    }
  }

  handleMouseUp() {
    if (this.isClicking) {
      this.isClicking = false;
      this.ensureLoopRunning();
    }
  }

  checkHoverStateOnce() {
    if (this.mouseX === 0 && this.mouseY === 0) return;
    
    const el = document.elementFromPoint(this.mouseX, this.mouseY);
    if (!el) {
      this.isHovering = false;
      return;
    }

    const linkEl = el.closest('a');
    const newHoverState = linkEl ? !!linkEl.classList.contains('media-pointer') : false;

    if (newHoverState && !this.isHovering && this.currentScale <= 0.01) {
      this.cursorX = this.mouseX;
      this.cursorY = this.mouseY;
    }

    this.isHovering = newHoverState;
  }

  cleanup() {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('scroll', this.handleScroll);

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    
    this.isLoopRunning = false;
    this.isHovering = false;
    this.isClicking = false;
    this.currentScale = 0;
    this.isCursorActive = false;
    this.isCircleVisible = false;
    this.scrollTicking = false;

    if (this.cursorCircle) {
      this.cursorCircle.style.opacity = '0';
      this.cursorCircle.style.visibility = 'hidden';
      this.cursorCircle.style.transform = '';
    }
    
    document.body.classList.remove('has-active-custom-cursor');
  }

  disconnectedCallback() {
    this.cleanup();
  }

  ensureLoopRunning() {
    if (!this.isLoopRunning) {
      this.isLoopRunning = true;
      this.rafId = requestAnimationFrame(this.animateCursor);
    }
  }

  animateCursor() {
    if (!this.isHovering && this.currentScale <= 0.01) {
      this.isLoopRunning = false;
      this.isCursorActive = false;
      document.body.classList.remove('has-active-custom-cursor');
      return;
    }

    let nextX = this.cursorX + (this.mouseX - this.cursorX) * 0.22;
    let nextY = this.cursorY + (this.mouseY - this.cursorY) * 0.22;

    if (Math.abs(this.mouseX - nextX) < 0.5) nextX = this.mouseX;
    if (Math.abs(this.mouseY - nextY) < 0.5) nextY = this.mouseY;

    const positionChanged = nextX !== this.cursorX || nextY !== this.cursorY;
    this.cursorX = nextX;
    this.cursorY = nextY;

    const targetScale = this.isHovering ? (this.isClicking ? 0.85 : 1) : 0;
    const scaleChanged = Math.abs(this.currentScale - targetScale) > 0.01;
    
    this.currentScale += (targetScale - this.currentScale) * 0.35;
    
    if (Math.abs(targetScale - this.currentScale) < 0.01) {
      this.currentScale = targetScale;
    }

    if (positionChanged || scaleChanged) {
      if (this.cursorCircle) {
        this.cursorCircle.style.transform =
          `translate3d(${this.cursorX}px, ${this.cursorY}px, 0) translate(-50%, -50%) scale(${this.currentScale})`;
      }

      if (this.isHovering && !this.isCircleVisible) {
        this.cursorCircle.style.opacity = '1';
        this.cursorCircle.style.visibility = 'visible';
        this.isCircleVisible = true;
      } else if (!this.isHovering && this.currentScale <= 0.01 && this.isCircleVisible) {
        this.currentScale = 0;
        this.cursorCircle.style.opacity = '0';
        this.cursorCircle.style.visibility = 'hidden';
        this.isCircleVisible = false;
      }
    }

    const isEffectivelyVisible = this.isHovering || this.currentScale > 0.01;

    if (isEffectivelyVisible !== this.isCursorActive) {
      this.isCursorActive = isEffectivelyVisible;
      
      if (this.isCursorActive) {
        document.body.classList.add('has-active-custom-cursor');
      } else {
        document.body.classList.remove('has-active-custom-cursor');
      }
    }

    if (!positionChanged && !scaleChanged) {
      this.isLoopRunning = false;
      return;
    }

    this.rafId = requestAnimationFrame(this.animateCursor);
  }
}

if (!customElements.get('media-pointer')) {
  customElements.define('media-pointer', MediaPointer);
}