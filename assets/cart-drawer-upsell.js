class CartDrawerUpsell extends HTMLElement {
  connectedCallback() {
    this._sectionId = this.dataset.sectionId;
    this._productId = this.dataset.productUpsellId;
    this._maxItems = parseInt(this.dataset.maxItems);
    this._limit = parseInt(this.dataset.limit) || 10;
    this._intent = this.dataset.intent;

    if (this._loaded) return;

    this._observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        this._observer.disconnect();
        this._loaded = true;
        this.load();
      }
    }, {rootMargin: '200px'});

    this._observer.observe(this);
  }

  disconnectedCallback() {
    if (this._observer) this._observer.disconnect();
  }

  get isOpen() {
    return this._isOpen ?? false;
  }

  set isOpen(val) {
    this._isOpen = !!val;
    const cartDrawer = document.getElementById('CartDrawer');
    if (cartDrawer) cartDrawer._isOpenUpsell = !!val;
    const upsellWrapper = document.getElementById('CartDrawer__Upsell');
    if (!upsellWrapper) return;
    if (val) {
      upsellWrapper.classList.add('is-visible');
      upsellWrapper.getBoundingClientRect(); // force reflow before transition
      cartDrawer?.setAttribute('upsell-open', '');
    } else {
      cartDrawer?.removeAttribute('upsell-open');
      upsellWrapper.classList.remove("is-visible");
    }
  }

  load() {
    fetch(`${window.Maximize.routes.productRecommendations}?section_id=${this._sectionId}&product_id=${this._productId}&limit=${this._limit}&intent=${this._intent}`)
      .then((response) => response.text())
      .then((text) => {
        const html = document.createElement("div");
        html.innerHTML = text;

        const recommendations = html.querySelector(".product-recommendations");
        if (recommendations && recommendations.innerHTML.trim().length && recommendations.classList.contains("cart-upsell__product-recommendations")) {
          const container = this.querySelector(".slider-container");
          const currentItems = this.querySelectorAll('.cart-upsell__item');
          const itemsToAdd = Math.max(0, this._maxItems - currentItems.length);
          let listRecommendationsItems = recommendations.querySelectorAll('.cart-upsell__item');

          const currentItemsProductIds = Array.from(currentItems)
            .map(item => item.dataset?.productId)
            .filter(id => id !== undefined);
          listRecommendationsItems = Array.from(listRecommendationsItems).filter(
            item => !currentItemsProductIds.includes(item.dataset?.productId)
          );

          if (itemsToAdd > 0) {
            listRecommendationsItems.forEach((item, index) => {
              if (index < itemsToAdd) {
                const clone = item.cloneNode(true);
                container.appendChild(clone);
              }
            });
            const currentSlideIndicator = this.querySelector(".swiffy-slide-indicator");
            const newSlideIndicator = html.querySelector(".swiffy-slide-indicator");
            if (currentSlideIndicator && newSlideIndicator) {
              currentSlideIndicator.replaceWith(newSlideIndicator);
            }
          }

          requestAnimationFrame(() => {
            this.isOpen = !!document.querySelectorAll('.cart-drawer-upsell__item').length;
          })

        }
      })
  }
}

if (!customElements.get(`cart-drawer-upsell`)) {
  customElements.define(`cart-drawer-upsell`, CartDrawerUpsell)
}