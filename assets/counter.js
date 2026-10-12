if (!customElements.get('counter-stat')) {
  class CounterStat extends HTMLElement {
    constructor() {
      super();
      this._animated = false;
      this._observer = null;
    }

    connectedCallback() {
      this.setupObserver();
    }

    disconnectedCallback() {
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
    }

    static get observedAttributes() {
      return ['data-value', 'data-duration'];
    }

    attributeChangedCallback() {
      this._animated = false;
    }

    setupObserver() {
      if (this._observer) return;

      const margin = Number(this.dataset.margin) || 200;

      this._observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !this._animated) {
              this.render();
              this._animated = true;

              // Animate only once
              this._observer.unobserve(this);
            }
          });
        },
        {
          root: null,
          rootMargin: `${margin}px`,
          threshold: 0
        }
      );

      this._observer.observe(this);
    }

    render() {
      const raw = this.dataset.value;
      if (!raw) return;

      const finalSpan = this.querySelector('.counter-final');
      const liveSpan = this.querySelector('.counter-live');

      finalSpan.textContent = raw;

      const parsed = this.parseValue(raw);
      if (!parsed.isNumber) {
        liveSpan.textContent = raw;
        return;
      }

      this.animate(parsed, liveSpan);
    }


    parseValue(value) {
      const match = value.match(/^([^0-9\-+]*)([\-+]?\d*\.?\d+)([^0-9]*)$/);

      if (!match) return { isNumber: false };

      return {
        isNumber: true,
        prefix: match[1] || '',
        number: Number(match[2]),
        suffix: match[3] || '',
        decimals: (match[2].split('.')[1] || '').length
      };
    }

    animate({ prefix, number, suffix, decimals }, target) {
      const duration = Number(this.dataset.duration) || 3000;
      const startTime = performance.now();

      const tick = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const current = number * progress;

        target.textContent = `${prefix}${current.toFixed(decimals)}${suffix}`;

        if (progress < 1) {
          requestAnimationFrame(tick);
        }
      };

      requestAnimationFrame(tick);
    }
  }

  customElements.define('counter-stat', CounterStat);
}
