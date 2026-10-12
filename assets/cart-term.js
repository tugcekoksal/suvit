if (!window.Maximize.loadedScript.includes('cart-term.js')) {
  window.Maximize.loadedScript.push('cart-term.js');

  const _registerCartTerm = () => {
    Alpine.data("xCartTerm", (message) => ({
        message: message,
        isChecked: false,
        init() {
          this.isChecked = localStorage.cart_term_checked === "agreed";

          this.$watch("isChecked", () => {
            this.save();
          });

          document.addEventListener(`${CART_EVENT.validate}`, () => {
            this.isChecked = localStorage.cart_term_checked == "agreed" ? true : false;
            if (!this.isChecked) window.xCartHelper.validated = false;
          });
        },
        handleChangeCartTerm(event) {
          this.isChecked = event.target.checked;
        },
        save() {
          clearTimeout(this.t);

          const func = () => {
            let status = this.isChecked ? "agreed" : "not agreed";
            window.xCartHelper.updateCart({
              attributes: {
                "Terms and conditions": status,
              },
            });
            localStorage.cart_term_checked = status;
          };

          this.t = setTimeout(() => {
            func();
          }, 200);
        },
      }));
  };

  if (window.Alpine) {
    _registerCartTerm();
  } else {
    document.addEventListener("alpine:init", _registerCartTerm);
  }

  class CartTerm extends HTMLElement {
    connectedCallback() {
      this._checkbox = this.querySelector('input[type="checkbox"]');
      this._error = this.querySelector(".cart-term__error");
      this._t = null;

      this._isChecked = localStorage.cart_term_checked === "agreed";
      this._updateUI();

      this._checkbox.addEventListener("change", (e) => {
        this._isChecked = e.target.checked;
        this._updateUI();
        this._save();
      });

      this._boundValidate = this._onValidate.bind(this);
      document.addEventListener(CART_EVENT.validate, this._boundValidate);
    }

    disconnectedCallback() {
      document.removeEventListener(CART_EVENT.validate, this._boundValidate);
    }

    _updateUI() {
      this._checkbox.checked = this._isChecked;
      this._error?.classList.toggle("hidden", this._isChecked);
    }

    _onValidate() {
      this._isChecked = localStorage.cart_term_checked === "agreed";
      this._updateUI();
      if (!this._isChecked) window.xCartHelper.validated = false;
    }

    _save() {
      clearTimeout(this._t);
      this._t = setTimeout(() => {
        const status = this._isChecked ? "agreed" : "not agreed";
        window.xCartHelper.updateCart({ attributes: { "Terms and conditions": status } });
        localStorage.cart_term_checked = status;
      }, 200);
    }
  }

  if (!customElements.get('cart-term')) customElements.define('cart-term', CartTerm);
}
