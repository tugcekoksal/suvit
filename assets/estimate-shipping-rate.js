if (!window.Maximize.loadedScript.includes('estimate-shipping-rate.js')) {
  window.Maximize.loadedScript.push('estimate-shipping-rate.js');
  
  const _registerEstimateShipping = () => {
    Alpine.data("xEstimateShipping", (el, single, multiple, noRatesText) => ({
        isOpen: false,
        countryEl: el.querySelector(".country-select"),
        provinceEl: el.querySelector(".province-select"),
        provinceContainer: el.querySelector(".province-container"),
        zip: el.querySelector(".zip-input"),
        rates: el.querySelector(".rates"),
        errors: el.querySelector(".errors"),
        loadingShipping: false,
        rates_heading: "",
        rates_text: "",
        errors_message: "",
        cachedData: [],
        cachedResponse: [],
        load() {
          this.setSelectedOption(this.countryEl, this.countryEl.dataset.default);

          if (this.provinceEl.dataset.default && this.provinceEl.options.length > 0) {
            this.setSelectedOption(this.provinceEl, this.provinceEl.dataset.default);
          }

          this.handleCountryChange();
          this.countryEl.addEventListener("change", this.handleCountryChange.bind(this));
        },

        handleCountryChange() {
          const selectedOption = this.countryEl.options[this.countryEl.selectedIndex];
          const provinces = JSON.parse(selectedOption.dataset.provinces);

          Array.from(this.provinceEl.options).forEach((option) => option.remove());

          if (provinces && provinces.length === 0) {
            this.provinceContainer.hidden = true;
          } else {
            provinces.forEach((province) => {
              const option = document.createElement("option");
              [option.value, option.innerHTML] = province;
              this.provinceEl.appendChild(option);
            });

            this.provinceContainer.hidden = false;
          }
        },

        setSelectedOption(selector, value) {
          Array.from(selector.options).forEach((option, index) => {
            if (option.value === value || option.innerHTML === value) {
              selector.selectedIndex = index;
            }
          });
        },

        async submit(e) {
          e?.preventDefault();

          this.errors.classList.add("hidden");
          this.rates.classList.add("hidden");

          const params = `shipping_address[zip]=${this.zip.value}&shipping_address[country]=${this.countryEl.value}&shipping_address[province]=${this.provinceEl.value}`;

          if (this.cachedData[params]) {
            if (this.cachedResponse[params]) {
              this.showRates(this.cachedData[params]);
            } else {
              this.showErrors(this.cachedData[params]);
            }
            return true;
          }

          this.loadingShipping = true;
          try {
            const response = await fetch(`${Shopify.routes.root}cart/shipping_rates.json?${params}`);
            const data = await response.json();

            if (response.ok) {
              this.showRates(data);
            } else {
              this.showErrors(data);
            }
            this.cachedResponse[params] = response.ok;
            this.cachedData[params] = data;
          } catch (error) {
            console.error(error);
          } finally {
            this.loadingShipping = false;
          }
        },

        showRates(data) {
          const headingEl = this.rates.querySelector(".rates-heading");

          if (data.shipping_rates && data.shipping_rates.length) {
            this.rates_heading = data.shipping_rates.length === 1 ? single : multiple;
            let rates = "";

            data.shipping_rates.forEach((rate) => {
              const formattedRate = rate.price + rate.currency;
              rates += `<li class="pt-2">${rate.name}: ${formattedRate}</li>`;
            });

            headingEl.classList.remove("hidden");
            this.rates.classList.add("success-message");
            if (this.rates.classList.contains("flash-message")) {
              this.rates.classList.remove("error-message");
            } else {
              this.rates.classList.remove("color-text-[rgba(var(--error-message-color))]");
            }
            this.rates_text = `<ul class="list-disc`;
            if (window.Maximize.rtl) {
              this.rates_text += ` pr-4">${rates}</ul>`;
            } else {
              this.rates_text += ` pl-4">${rates}</ul>`;
            }
          } else {
            headingEl.classList.add("hidden");
            this.rates.classList.remove("success-message");
            if (this.rates.classList.contains("flash-message")) {
              this.rates.classList.add("error-message");
            } else {
              this.rates.classList.add("color-text-[rgba(var(--error-message-color))]");
            }
            this.rates_text = `<p class="no-rate">${noRatesText}</p>`;
          }

          this.rates.classList.remove("hidden");
        },

        showErrors(data) {
          let errors = "";
          Object.keys(data).forEach((key) => {
            errors += `<li>${data[key]}</li>`;
          });

          this.errors_message = `<ul>${errors}</ul>`;
          this.errors.classList.remove("hidden");
        },
      }));

      Alpine.store("xPopupShipping", {
        open: false,
      });
  };

  if (window.Alpine) {
    _registerEstimateShipping();
  } else {
    document.addEventListener("alpine:init", _registerEstimateShipping);
  }

  class EstimateShippingRateDrawer extends HTMLElement {
    connectedCallback() {
      this._single = this.dataset.single;
      this._multiple = this.dataset.multiple;
      this._noRates = this.dataset.noRates;

      this._countryEl = this.querySelector(".country-select");
      this._provinceEl = this.querySelector(".province-select");
      this._provinceContainer = this.querySelector(".province-container");
      this._zipEl = this.querySelector(".zip-input");
      this._ratesEl = this.querySelector(".rates");
      this._errorsEl = this.querySelector(".errors");

      this._cachedData = {};
      this._cachedResponse = {};

      this._load();
      this._countryEl.addEventListener("change", this._handleCountryChange.bind(this));

      this.addEventListener("click", (e) => {
        if (e.target.closest('[data-action="submit"]')) this.submit(e);
      });
    }

    _load() {
      this._setSelectedOption(this._countryEl, this._countryEl.dataset.default);
      if (this._provinceEl.dataset.default && this._provinceEl.options.length > 0) {
        this._setSelectedOption(this._provinceEl, this._provinceEl.dataset.default);
      }
      this._handleCountryChange();
    }

    _handleCountryChange() {
      const selectedOption = this._countryEl.options[this._countryEl.selectedIndex];
      const provinces = JSON.parse(selectedOption.dataset.provinces);

      Array.from(this._provinceEl.options).forEach((opt) => opt.remove());

      if (!provinces || provinces.length === 0) {
        this._provinceContainer.hidden = true;
      } else {
        provinces.forEach(([value, label]) => {
          const option = document.createElement("option");
          option.value = value;
          option.innerHTML = label;
          this._provinceEl.appendChild(option);
        });
        this._provinceContainer.hidden = false;
      }
    }

    _setSelectedOption(selector, value) {
      Array.from(selector.options).forEach((option, index) => {
        if (option.value === value || option.innerHTML === value) {
          selector.selectedIndex = index;
        }
      });
    }

    _setLoading(val) {
      this.querySelector(".button-label")?.classList.toggle("opacity-0", val);
      this.querySelector(".spinner")?.classList.toggle("hidden", !val);
    }

    async submit(e) {
      e?.preventDefault();

      this._ratesEl.classList.add("hidden");
      this._errorsEl.classList.add("hidden");

      const params = `shipping_address[zip]=${this._zipEl.value}&shipping_address[country]=${this._countryEl.value}&shipping_address[province]=${this._provinceEl.value}`;

      if (this._cachedData[params]) {
        if (this._cachedResponse[params]) {
          this._showRates(this._cachedData[params]);
        } else {
          this._showErrors(this._cachedData[params]);
        }
        return;
      }

      this._setLoading(true);
      try {
        const response = await fetch(`${Shopify.routes.root}cart/shipping_rates.json?${params}`);
        const data = await response.json();

        if (response.ok) {
          this._showRates(data);
        } else {
          this._showErrors(data);
        }
        this._cachedResponse[params] = response.ok;
        this._cachedData[params] = data;
      } catch (error) {
        console.error(error);
      } finally {
        this._setLoading(false);
      }
    }

    _showRates(data) {
      const headingEl = this._ratesEl.querySelector(".rates-heading");
      const textEl = this._ratesEl.querySelector(".rates-text");

      if (data.shipping_rates && data.shipping_rates.length) {
        headingEl.textContent = data.shipping_rates.length === 1 ? this._single : this._multiple;
        headingEl.classList.remove("hidden");
        this._ratesEl.classList.add("success-message");
        this._ratesEl.classList.remove("error-message");

        const dir = window.Maximize.rtl ? "pr-4" : "pl-4";
        const items = data.shipping_rates.map((rate) => `<li class="pt-2">${rate.name}: ${rate.price + rate.currency}</li>`).join("");
        textEl.innerHTML = `<ul class="list-disc ${dir}">${items}</ul>`;
      } else {
        headingEl.classList.add("hidden");
        this._ratesEl.classList.remove("success-message");
        this._ratesEl.classList.add("error-message");
        textEl.innerHTML = `<p class="no-rate">${this._noRates}</p>`;
      }

      this._ratesEl.classList.remove("hidden");
    }

    _showErrors(data) {
      const errors = Object.keys(data)
        .map((key) => `<li>${data[key]}</li>`)
        .join("");
      this._errorsEl.querySelector(".errors-text").innerHTML = `<ul>${errors}</ul>`;
      this._errorsEl.classList.remove("hidden");
    }
  }

  if (!customElements.get("estimate-shipping-rate")) {
    customElements.define("estimate-shipping-rate", EstimateShippingRateDrawer);
  }
}
