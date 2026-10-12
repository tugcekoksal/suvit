if (!window.Maximize.loadedScript.includes("price-range.js")) {
  window.Maximize.loadedScript.push("price-range.js");

  requestAnimationFrame(() => {
    const defineXRangePrice = () => {
      Alpine.data("xRangePrice", () => ({
        rangeInput: [],
        priceInput: [],
        priceLabel: [],
        rangeProgress: null,
        init() {
          const root = this.$root;
          this.rangeInput = root.querySelectorAll(".range-input input");
          this.priceInput = root.querySelectorAll(".price-input");
          this.rangeProgress = root.querySelector(".slider .progress");
          this.priceLabel = root.querySelectorAll(".price-label");
          this.debounceDispatchEvent = this.debounce(this.dispatchEventCustomEvent, 500);
          this.handleRangePrice();
        },
        initRange() {
          let minVal = Number(this.rangeInput[0]?.value).toFixed(2),
          maxVal = Number(this.rangeInput[1]?.value).toFixed(2);
          if (this.rangeProgress) {
            this.rangeProgress.style.setProperty('--left_range', (minVal / this.rangeInput[0].max) * 100 + '%');
            this.rangeProgress.style.setProperty('--right_range',100 - (maxVal / this.rangeInput[1].max) * 100 + '%');
          }
        },
        debounce(func, delay) {
          let timer;
          return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => func.apply(this, args), delay);
          };
        },
        dispatchEventCustomEvent(event, el) {
          const customEvent = new CustomEvent(event, { bubbles: true, cancelable: true });
          el.dispatchEvent(customEvent);
        },
        handleRangePrice() {
          this.rangeInput.forEach((input) => {
            input.addEventListener("input", (e) => {
              e.preventDefault();
              let minVal = Number(this.rangeInput[0]?.value).toFixed(2),
                maxVal = Number(this.rangeInput[1]?.value).toFixed(2);
              if (+maxVal < +minVal) {
                if (e.target.classList.contains("range-min")) {
                  maxVal = minVal;
                  this.rangeInput[1].value = maxVal;
                  this.priceInput[0] && (this.priceInput[0].value = minVal);
                  this.priceInput[1] && (this.priceInput[1].value = maxVal);
                } else {
                  minVal = maxVal;
                  this.rangeInput[0].value = minVal;
                  this.priceInput[1].value && (this.priceInput[1].value = maxVal);
                  this.priceInput[0].value && (this.priceInput[0].value = minVal);
                }
              } else {
                if (this.priceInput.length > 0) {
                  this.priceInput[0].value = minVal;
                  this.priceInput[1].value = maxVal;
                }
              }
              if (this.priceLabel.length > 0) {
                this.priceLabel[0].textContent = minVal;
                this.priceLabel[1].textContent = maxVal;
              }
              if (this.rangeProgress) {
                this.rangeProgress.style.setProperty("--left_range", (minVal / this.rangeInput[0].max) * 100 + "%");
                this.rangeProgress.style.setProperty("--right_range", 100 - (maxVal / this.rangeInput[1].max) * 100 + "%");
              }

              this.debounceDispatchEvent(SELECT_ELEMENT_EVENT.change, e.target);
            });
          });
        },
        handlePriceInput(e) {
          let currentTarget = e.currentTarget;
          let minVal = Number(this.priceInput[0].min);
          let maxVal = Number(this.priceInput[1].max);
          let minValInput = Number(this.priceInput[0].value ? this.priceInput[0].value : 0);
          let maxValInput = Number(this.priceInput[1].value ? this.priceInput[1].value : maxVal);
          let endWithDot = false
          requestAnimationFrame(() => {
            if (currentTarget === this.priceInput[0]) {
              if (minValInput > maxValInput) {
                if (minValInput > maxVal) {
                  minValInput = maxVal;
                  endWithDot = true
                }
                maxValInput = minValInput;
              } else if (minValInput < minVal) {
                minValInput = minVal;
                endWithDot = true
              }
              if (endWithDot) {
                this.priceInput[0].value = minValInput !== minVal ? minValInput : null;
              }
              this.priceInput[1].value = maxValInput !== maxVal ? maxValInput : null;
            }

            if (currentTarget === this.priceInput[1]) {
              if (maxValInput < minValInput) {
                if (maxValInput < minVal) {
                  maxValInput = minVal;
                  endWithDot = true;
                }
                minValInput = maxValInput;
              } else if (maxValInput > maxVal) {
                maxValInput = maxVal;
                endWithDot = true;
              }
              if (endWithDot) {
                this.priceInput[1].value = maxValInput !== maxVal ? maxValInput : null;
              }
              this.priceInput[0].value = minValInput !== minVal ? minValInput : null;
            }

            if (this.rangeInput.length > 0) {
              this.rangeInput[0].value = minValInput;
              this.rangeInput[1].value = maxValInput;
            }
            if (this.rangeProgress) {
              this.rangeProgress.style.setProperty("--left_range", (minValInput / maxVal) * 100 + "%");
              this.rangeProgress.style.setProperty("--right_range", 100 - (maxValInput / maxVal) * 100 + "%");
            }
          });
          this.debounceDispatchEvent(SELECT_ELEMENT_EVENT.change, e.target);
        },
      }));
    };
    if (window.Alpine) {
      defineXRangePrice();
    } else {
      document.addEventListener("alpine:init", defineXRangePrice);
    }
  });
}
