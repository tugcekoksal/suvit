class EstimateShippingRateDrawer extends HTMLElement {
  connectedCallback() {
    this._single = this.dataset.single;
    this._multiple = this.dataset.multiple;
    this._noRates = this.dataset.noRates;

    this._countryEl = this.querySelector('.country-select');
    this._provinceEl = this.querySelector('.province-select');
    this._provinceContainer = this.querySelector('.province-container');
    this._zipEl = this.querySelector('.zip-input');
    this._ratesEl = this.querySelector('.rates');
    this._errorsEl = this.querySelector('.errors');

    this._cachedData = {};
    this._cachedResponse = {};

    this._load();
    this._countryEl.addEventListener('change', this._handleCountryChange.bind(this));

    this.addEventListener('click', (e) => {
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

    Array.from(this._provinceEl.options).forEach(opt => opt.remove());

    if (!provinces || provinces.length === 0) {
      this._provinceContainer.hidden = true;
    } else {
      provinces.forEach(([value, label]) => {
        const option = document.createElement('option');
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
    this.querySelector('.button-label')?.classList.toggle('opacity-0', val);
    this.querySelector('.spinner')?.classList.toggle('hidden', !val);
  }

  async submit(e) {
    e?.preventDefault();

    this._ratesEl.classList.add('hidden');
    this._errorsEl.classList.add('hidden');

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
    const headingEl = this._ratesEl.querySelector('.rates-heading');
    const textEl = this._ratesEl.querySelector('.rates-text');

    if (data.shipping_rates && data.shipping_rates.length) {
      headingEl.textContent = data.shipping_rates.length === 1 ? this._single : this._multiple;
      headingEl.classList.remove('hidden');
      this._ratesEl.classList.add('success-message');
      this._ratesEl.classList.remove('error-message');

      const dir = window.Maximize.rtl ? 'pr-4' : 'pl-4';
      const items = data.shipping_rates.map(rate => `<li class="pt-2">${rate.name}: ${rate.price + rate.currency}</li>`).join('');
      textEl.innerHTML = `<ul class="list-disc ${dir}">${items}</ul>`;
    } else {
      headingEl.classList.add('hidden');
      this._ratesEl.classList.remove('success-message');
      this._ratesEl.classList.add('error-message');
      textEl.innerHTML = `<p class="no-rate">${this._noRates}</p>`;
    }

    this._ratesEl.classList.remove('hidden');
  }

  _showErrors(data) {
    const errors = Object.keys(data).map(key => `<li>${data[key]}</li>`).join('');
    this._errorsEl.querySelector('.errors-text').innerHTML = `<ul>${errors}</ul>`;
    this._errorsEl.classList.remove('hidden');
  }
}

if (!customElements.get('estimate-shipping-rate')) {
  customElements.define('estimate-shipping-rate', EstimateShippingRateDrawer);
}
