if(window.Maximize.checkFileNotLoaded()) {
  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xProductComponents', (blockId) => ({
        open: false,
        hotspotContentWrapperEl: null,
        hotspotButtonEl: null,
        init() {
          this.hotspotContentWrapperEl = this.$el.querySelector('.hotspot-content-wrapper')
          this.hotspotButtonEl = this.$el.querySelector('.product-components__hotspots__button')
          window.addEventListener('scroll', () => {
            this.__debounce(this.updatePositionPopup(), 300)
          })
          window.addEventListener("resize", () => {
            this.__debounce(this.updatePositionPopup(), 300)
          });
        },
        onClickOutSide() {
          if (this.timeout[blockId]) {
            clearTimeout(this.timeout[blockId])
          }
          if (this.open) {
            this.open = false;
            this.timeout[blockId] = setTimeout(() => {
              this.hasPopupOpened = this.open
            }, 300);
          }
        },
        onClickHotspot() {
          this.open = !this.open;
          if (this.timeout[blockId]) {
            clearTimeout(this.timeout[blockId])
          }
          if (!this.open) {
            this.timeout[blockId] = setTimeout(() => {
              this.hasPopupOpened = this.open
            }, 300);
          } else {
            for (let key in this.timeout) {
              if (this.timeout[key]) {
                clearTimeout(this.timeout[key])
              }
            }
            this.hasPopupOpened = this.open
          }
        },
        isHotspotContentWrapperInViewport() {
          const rectHotspotContentWrapper = this.hotspotContentWrapperEl.getBoundingClientRect();
          const rectHotspotButton = this.hotspotButtonEl.getBoundingClientRect();
          return (
            rectHotspotButton.top + (rectHotspotButton.height / 2) + rectHotspotContentWrapper.height <= (window.innerHeight || document.documentElement.clientHeight)
          );
        },
        updatePositionPopup() {
          if (this.isHotspotContentWrapperInViewport()) {
            this.hotspotContentWrapperEl.style.setProperty('--translateY-hotspot-content', '0%')
          }
          else {
            this.hotspotContentWrapperEl.style.setProperty('--translateY-hotspot-content', '-100%')
          }
        },
        __debounce(func, wait) {
          let timeout;
          return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
          };
        }
      }));
    })
  })
}