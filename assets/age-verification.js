class AgeVerification extends HTMLElement {
  constructor() {
    super();

    this._show = false;
    this._showCancelMessage = false;

    this._onClick = this._onClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onEditorSelect = this._onEditorSelect.bind(this);
    this._onEditorDeselect = this._onEditorDeselect.bind(this);
    this._onEditorLoad = this._onEditorLoad.bind(this); 
  }

  connectedCallback() {
    this.sectionId = this.dataset.sectionId || "";
    this.delayDays = Number(this.dataset.delayDays || 30);

    this.addEventListener("click", this._onClick);
    if (Shopify.designMode) {
      document.addEventListener("shopify:section:load", this._onEditorLoad);
      document.addEventListener("shopify:section:select", this._onEditorSelect);
      document.addEventListener("shopify:block:select", this._onEditorSelect);
      document.addEventListener("shopify:section:deselect", this._onEditorDeselect);
    }

    this._cacheElements();
    this._syncPopup();
    this._syncCancelMessage();
    this.load();
  }

  disconnectedCallback() {
    this.removeEventListener("click", this._onClick);

    if (Shopify.designMode) {
      document.removeEventListener("shopify:section:load", this._onEditorLoad);
      document.removeEventListener("shopify:section:select", this._onEditorSelect);
      document.removeEventListener("shopify:block:select", this._onEditorSelect);
      document.removeEventListener("shopify:section:deselect", this._onEditorDeselect);
    }

    document.removeEventListener("keydown", this._onKeyDown);
  }

  get isDesignMode() {
    return Boolean(window.Shopify && window.Shopify.designMode);
  }

  get show() {
    return this._show;
  }

  set show(value) {
    value = Boolean(value);

    if (this._show === value) return;

    this._show = value;

    if (value) {
      this.showOverlay();
    } else {
      this.hideOverlay();
    }
  }

  get showCancelMessage() {
    return this._showCancelMessage;
  }

  set showCancelMessage(value) {
    this._showCancelMessage = Boolean(value);
    this._syncCancelMessage();
  }

  load() {
    if (this.isDesignMode) {
      this.hideOverlay();
      return;
    }

    if (this.isVerified()) {
      this.hideOverlay();
      return;
    }

    this.open();
  }

  open() {
    if (!this.isDesignMode && this.isVerified()) {
      this.hideOverlay();
      return;
    }

    this.show = true;
  }

  verify() {
    this.show = false;

    document.dispatchEvent(new Event("close-age-verification"));

    if (!this.isDesignMode) {
      this.setCookie("age_verified", "true", this.delayDays);
    }
  }

  hideOverlay() {
    this._show = false;
    this._syncPopup();

    document.removeEventListener("keydown", this._onKeyDown);
  }

  showOverlay() {
    this._show = true;
    this._syncPopup();

    document.removeEventListener("keydown", this._onKeyDown);
    document.addEventListener("keydown", this._onKeyDown);
  }

  setCookie(name, value, days) {
    let expires = "";

    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + Number(days) * 24 * 60 * 60 * 1000);
      expires = `; expires=${date.toUTCString()}`;
    }

    document.cookie = `${name}=${encodeURIComponent(value || "")}${expires}; path=/; SameSite=Lax`;
  }

  getCookie(name) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = document.cookie.match(
      new RegExp(`(?:^|;)\\s*${escapedName}\\s*=\\s*([^;]+)`)
    );

    return match ? decodeURIComponent(match[1]) : null;
  }

  isVerified() {
    return this.getCookie("age_verified") === "true";
  }

  _cacheElements() {
    this.popup = this.querySelector("[data-age-verification-popup]");
    this.overlay = this.querySelector("[data-age-verification-overlay]");
    this.content = this.querySelector("[data-age-verification-content]");
    this.cancelMessage = this.querySelector("[data-age-verification-cancel-message]");
  }

  _syncPopup() {
    const hidden = !this._show;

    if (this.popup) {
      this.popup.classList.toggle("hidden", hidden);
      this.popup.style.display = hidden ? "none" : "";
      this.popup.toggleAttribute("aria-hidden", hidden);
    }

    if (this.overlay) {
      this.overlay.classList.toggle("hidden", hidden);
      this.overlay.style.display = hidden ? "none" : "";
    }

    if (this.content) {
      this.content.style.pointerEvents = !hidden && this.isDesignMode ? "auto" : "";
    }

    document.body.classList.toggle("overflow-y-hidden", this._show && !this.isDesignMode);
  }

  _syncCancelMessage() {
    if (!this.cancelMessage) return;

    const hidden = !this._showCancelMessage;

    this.cancelMessage.classList.toggle("hidden", hidden);
    this.cancelMessage.style.display = hidden ? "none" : "";
    this.cancelMessage.toggleAttribute("hidden", hidden);
  }

  _onClick(event) {
    const confirmSelector = `[id="ConfirmAgeVerification-${this.sectionId}"]`;
    const cancelSelector = `[id="CancelAgeVerification-${this.sectionId}"]`;

    if (event.target.closest(confirmSelector)) {
      event.preventDefault();

      this.showCancelMessage = false;
      this.verify();

      return;
    }

    if (event.target.closest(cancelSelector)) {
      event.preventDefault();
      this.showCancelMessage = true;
    }
  }

  _focusPopup() {
    if (!this.content) return;

    const confirmButton = this.content.querySelector(
      `[id="ConfirmAgeVerification-${this.sectionId}"]`
    );

    if (confirmButton) {
      confirmButton.focus();
    }
  }

  _onKeyDown(event) {
    if (event.key !== "Tab" || !this._show || !this.content) return;

    const confirmButton = this.content.querySelector(
      `[id="ConfirmAgeVerification-${this.sectionId}"]`
    );

    const cancelButton = this.content.querySelector(
      `[id="CancelAgeVerification-${this.sectionId}"]`
    );

    if (!confirmButton || !cancelButton) return;

    const active = document.activeElement;

    if (active !== confirmButton && active !== cancelButton) {
      event.preventDefault();
      confirmButton.focus();
      return;
    }

    if (active === confirmButton) {
      event.preventDefault();
      cancelButton.focus();
    } else if (active === cancelButton) {
      event.preventDefault();
      confirmButton.focus();
    }
  }

  _onEditorLoad(event) {
    if (!this.isDesignMode) return;

    const loadedSectionId = event.detail && event.detail.sectionId;
    if (!loadedSectionId) return;

    if (loadedSectionId === this.sectionId) {
      this.showCancelMessage = false;
      this.open();
    }
  }

  _onEditorSelect(event) {
    if (!this.isDesignMode) return;

    const selectedSectionId = event.detail && event.detail.sectionId;
    if (!selectedSectionId) return;

    if (selectedSectionId === this.sectionId) {
      this.showCancelMessage = false;
      this.open();
    } else {
      this.hideOverlay();
    }
  }

  _onEditorDeselect(event) {
    if (!this.isDesignMode) return;

    const deselectedSectionId = event.detail && event.detail.sectionId;

    if (deselectedSectionId === this.sectionId) {
      this.hideOverlay();
    }
  }

}

if (!customElements.get("age-verification")) {
  customElements.define("age-verification", AgeVerification);
}