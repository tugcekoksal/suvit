if (!window.Maximize.loadedScript.includes("additional-fee.js")) {
  window.Maximize.loadedScript.push("additional-fee.js");

  requestAnimationFrame(() => {
    const defineXAdditionalFee = () => {
      Alpine.data("xAdditionalFee", (blockId, productUrl, optionsSize = 1) => ({
        variants: [],
        blockId: blockId,
        blockEl: null,
        selectedElement: null,
        priceElement: null,
        isChecked: false,
        showDrawer: false,
        cacheResults: {},
        disabledButton: true,
        showErrorMessage: false,
        init() {
          this.blockEl = this.$el;
          this.selectedElement = this.blockEl.querySelector(`.additional-fee-selected.id-selected--${blockId}`);
          this.priceElement = this.$el.querySelector('.additional-fee__price');
          this.checkboxElement = this.$el.querySelector('.additional-fee__checkbox');

          this.currentVariantInfoElement = this.$el.querySelector(`#AdditionalFee__CurrentVariant__${blockId}`);
          if (this.currentVariantInfoElement) {
            this.currentVariant = JSON.parse(this.currentVariantInfoElement.textContent);
          }

          this.$watch("isChecked", (newValue) => {
            this.blockEl.querySelector(`.additional-fee__checkbox`).checked = !!newValue;
          })
        },
        clickItem() {
          if (this.$el.dataset.hasOnlyDefaultVariant === 'true') {
            this.currentVariantInfoElement = this.$el.querySelector(`#AdditionalFee__CurrentVariant__${blockId}`);
            if (this.currentVariantInfoElement) {
              this.currentVariant = JSON.parse(this.currentVariantInfoElement.textContent);
            }
            if (this.isChecked) {
              this.selectedElement = this.blockEl.querySelector(`.additional-fee-selected.id-selected--${blockId}`);
              this.selectedElement.innerHTML = '';
            } else {
              this.selectedElement = this.blockEl.querySelector(`.additional-fee-selected.id-selected--${blockId}`);
              this.selectedElement.innerHTML = this.currentVariant.id;
            }
            this.isChecked = !this.isChecked;
            let checkboxEle = this.$el.querySelector('.additional-fee__checkbox');
            if (checkboxEle) checkboxEle.checked = this.checked;
          } else {
            this.showDrawer = true;
            Alpine.store('xMaximizeDrawer').handleOpen(`#AdditionalFeeDrawer__${blockId}`);
          }
        },
        clickRadioOption() {
          const inputRadioEl = this.$el.querySelector('.input-radio')
          inputRadioEl.checked = true
          this.updateStatusButtonAndError()
        },
        chooseOptionDropdown() {
          const variantOptionWrapper = this.$el.closest('.variant-option__wrapper');
          const listOptionDropdown = variantOptionWrapper.querySelectorAll(`.select-option`);
          listOptionDropdown.forEach(el => {
            el.classList[el === this.$el ? 'add' : 'remove']('selected');
          })
          variantOptionWrapper.querySelector('.select-option-selected').value = this.$el.dataset.selectValue;
          this.updateStatusButtonAndError();
        },
        updateStatusButtonAndError() {
          const updateInfo = (html) => {
            const currentVariantElement = html.querySelector(`#AdditionalFee__CurrentVariant__${blockId}[type="application/json"]`);
            if (currentVariantElement) {
              this.currentVariant = JSON.parse(currentVariantElement.textContent);
              this.currentVariantInfoElement.textContent = currentVariantElement.textContent;
            }

            if (!this.currentVariant || (this.currentVariant && !this.currentVariant.available)) {
              this.disabledButton = true;
              this.showErrorMessage = true;
            } else {
              const responsePriceHTML = html.querySelector('.additional-fee__price');
              if (responsePriceHTML) {
                this.priceElement.innerHTML = responsePriceHTML.innerHTML;
              }

              this.selectedElement = this.blockEl.querySelector(`.additional-fee-selected.id-selected--${blockId}`);
              this.selectedElement.innerHTML = this.currentVariant.id;

              this.disabledButton = false;
              this.showErrorMessage = false;
            }
          }

          const inputCheckedEle = Array.from(this.$el.closest('.additional-fee__drawer__body').querySelectorAll('input[type=radio]:checked, .select-option.selected'));
          const listOptionValuesChecked = inputCheckedEle.map(input => input.dataset.optionValueId);
          if (listOptionValuesChecked.length == optionsSize) {
            const url = `${productUrl}?option_values=${listOptionValuesChecked.join(',')}&section_id=additional-fee-price`
            if (this.cacheResults[url]) {
              updateInfo(this.cacheResults[url]);
            } else {
              fetch(url)
                .then(response => {
                  return response.text();
                })
                .then((response) => {
                  const parser = new DOMParser();
                  const html = parser.parseFromString(response, 'text/html');
                  this.cacheResults[url] = html;
                  updateInfo(html);
                })
            }
          } else {
            this.disabledButton = true;
            this.showErrorMessage = false;
          }
        },
        chooseVariant() {
          this.isChecked = true;

          this.showDrawer = false;
          Alpine.store('xMaximizeDrawer').handleClose();
        },

        clearVariant() {
          this.selectedElement.innerHTML = '';
          this.isChecked = false;
          // this.checkboxElement.checked = false

          const inputCheckedRadios = Array.from(this.$el.closest('.additional-fee__drawer__body').querySelectorAll('input[type=radio]:checked'));
          const inputCheckedDropdown = Array.from(this.$el.closest('.additional-fee__drawer__body').querySelectorAll('.select-option-selected'));
          const inputCheckedDropdownLabel = Array.from(this.$el.closest('.additional-fee__drawer__body').querySelectorAll('.select-button__label'));
          const inputAllDropdown = Array.from(this.$el.closest('.additional-fee__drawer__body').getElementsByClassName('select-option'));  

          inputCheckedDropdown.map(input => { input.value = ""; input.setAttribute("value", ""); });
          inputCheckedRadios.map(input => input.checked = false);
          inputCheckedDropdownLabel.map(el => el.innerHTML = ADDITIONAL_FEE.defaultTextDropDown);
          inputAllDropdown.map(el => el.setAttribute("aria-selected", "false"));

          this.updateStatusButtonAndError();
        }
      }));
    };
    if (window.Alpine) {
      defineXAdditionalFee();
    } else {
      document.addEventListener("alpine:init", defineXAdditionalFee);
    }
  });
}
