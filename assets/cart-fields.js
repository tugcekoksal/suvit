if (!window.Maximize.loadedScript.includes('cart-fields.js')) {
  window.Maximize.loadedScript.push('cart-fields.js');

  const _registerCartFields = () => {
    Alpine.data("xCartFields", (el, customFieldLabel, customFieldRequired) => ({
        customField: "",
        customFieldLabel: "",
        customFieldRequired: false,
        customFieldError: false,
        openField: false,
        init() {
          const data = maximizeParseJSON(el.dataset.cartCustomField);
          this.customFieldLabel = data.custom_field_label;
          this.customFieldRequired = data.custom_field_required;
          this.customFieldPattern = new RegExp(data.custom_field_pattern);

          this.customField = localStorage.getItem(`${LOCAL_STORAGE.maximize_cart_custom_field}`) ? localStorage.getItem(`${LOCAL_STORAGE.maximize_cart_custom_field}`) : "";

          // this.__updateCartFields();
          this.__validateEvent();
        },
        __validateEvent: function () {
          document.addEventListener(`${CART_EVENT.validate}`, () => {
            this.customField = localStorage.getItem(`${LOCAL_STORAGE.maximize_cart_custom_field}`) ? localStorage.getItem(`${LOCAL_STORAGE.maximize_cart_custom_field}`) : "";
            let isValid;
            if (this.customFieldRequired) {
              if (this.customField.length > 0) {
                isValid = this.customFieldPattern.test(this.customField);
              } else {
                isValid = false;
              }
            } else {
              if (this.customField.length > 0) {
                isValid = this.customFieldPattern.test(this.customField);
              } else {
                isValid = true;
              }
            }

            this.customFieldError = !isValid;
            if (this.customFieldError) {
              window.xCartHelper.openField = "custom_field";
              document.dispatchEvent(new CustomEvent(`${CART_EVENT.showCustomFiled}`));
              window.xCartHelper.validated = false;
            }
          });
        },
        handleChangeInput(event) {
          this.customField = event.target.value;
          this.__updateCartFields();
        },
        __updateCartFields() {
          let attributes = { attributes: {} };
          attributes.attributes[this.customFieldLabel] = this.customField;
          window.xCartHelper.updateCart(attributes, true);
          localStorage.setItem(`${LOCAL_STORAGE.maximize_cart_custom_field}`, this.customField);
        },
      }));
  };

  if (window.Alpine) {
    _registerCartFields();
  } else {
    document.addEventListener("alpine:init", _registerCartFields);
  }

  class CartFields extends HTMLElement {
    connectedCallback() {
      const data = xParseJSON(this.dataset.cartCustomField);
      this._label = data.custom_field_label;
      this._required = data.custom_field_required;
      this._pattern = new RegExp(data.custom_field_pattern);
      this._t = null;

      this._inputEl = this.querySelector('input[type="text"]');
      this._errorEl = this.querySelector(".cart-fields__error");

      this._inputEl.value = localStorage.getItem(LOCAL_STORAGE.maximize_cart_custom_field) || "";

      this._boundInput = this._onInput.bind(this);
      this._boundValidate = this._onValidate.bind(this);

      this._inputEl.addEventListener("input", this._boundInput);
      document.addEventListener(CART_EVENT.validate, this._boundValidate);
    }

    disconnectedCallback() {
      this._inputEl?.removeEventListener("input", this._boundInput);
      document.removeEventListener(CART_EVENT.validate, this._boundValidate);
    }

    _onInput(e) {
      if (!this._pendingUpdate) {
        this._pendingUpdate = true;
        window.xCartHelper.beginUpdate();
      }
      clearTimeout(this._t);
      this._t = setTimeout(() => this._updateCartFields(e.target.value), 500);
    }

    _onValidate() {
      const value = localStorage.getItem(LOCAL_STORAGE.maximize_cart_custom_field) || "";
      this._inputEl.value = value;
      let isValid;
      if (this._required) {
        isValid = value.length > 0 && this._pattern.test(value);
      } else {
        isValid = value.length === 0 || this._pattern.test(value);
      }
      this._setError(!isValid);
      if (!isValid) {
        window.xCartHelper.openField = "custom_field";
        document.dispatchEvent(new CustomEvent(CART_EVENT.showCustomFiled));
        window.xCartHelper.validated = false;
      }
    }

    _setError(hasError) {
      this._inputEl?.classList.toggle("color-border-[rgba(var(--error-message-color))]", hasError);
      this._errorEl?.classList.toggle("hidden", !hasError);
    }

    _updateCartFields(value) {
      const attributes = { attributes: {} };
      attributes.attributes[this._label] = value;
      window.xCartHelper.updateCart(attributes, true)
        .finally(() => {
          this._pendingUpdate = false;
          window.xCartHelper.endUpdate();
        });
      localStorage.setItem(LOCAL_STORAGE.maximize_cart_custom_field, value);
    }
  }

  if (!customElements.get('cart-fields')) customElements.define('cart-fields', CartFields);
}
