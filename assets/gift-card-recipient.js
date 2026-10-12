if (!window.Maximize.loadedScript.includes('gift-card-recipient.js')) {
  window.Maximize.loadedScript.push('gift-card-recipient.js');

  requestAnimationFrame(() => {
    const defineXGiftCardRecipient = () => {
      Alpine.data('xGiftCardRecipient', (sectionId) => ({
        sectionWrapperEle: document.querySelector(`.section--${sectionId}`),
        isShowForm: false,
        addToCartButton: false,
        recipientForm: false,
        recipientControl: 'if_present',
        validateEmail: {'show': true, 'message': ''},
        validateDate: {'show': false, 'message': ''},
        disabled: true,
        init() {
          this.$refs.timezone_offset.value = new Date().getTimezoneOffset().toString();
          const productFormWrapper = this.$el.closest('.product-info__form-wrapper');
          if (productFormWrapper) {
            this.addToCartButton = productFormWrapper.querySelector('.product-form__btn-add-to-cart');
          }
          this.recipientForm = this.$el.querySelector('.recipient-form');

          this.$watch('validateEmail', () => {
            this.updateProductFormStatus();
          })

          this.$watch('validateDate', () => {
            this.updateProductFormStatus();
          })

          this.$watch('isShowForm', (value) => {
            if (!value) {
              this.recipientForm.dataset.disabled = "true";
            } else {
              if (this.$refs.recipient_email) {
                if (this.$refs.recipient_email.value === '') {
                  this.validateEmail.show = true;
                }
              }
            }
          })
        },
        handleChangeCheckbox() {
          if (this.$refs.recipient_checkbox.checked) {
            this.isShowForm = true;
            this.recipientControl = 'on';
            if (this.recipientForm) {
              this.recipientForm.dataset.disabled = "false";
            }
          } else {
            this.isShowForm = false;
            this.recipientControl = 'if_present';
            if (this.recipientForm) {
              this.recipientForm.dataset.disabled = "true";
            }
          }
          this.__dispatchGiftCardChange();
        },
        handleChangeRecipientInput() {
          if (this.$el.type === 'email') {
            const emailValidation = validateEmail(this.$el.value);
            if (emailValidation.isError) {
              this.validateEmail = {'show': true, 'message': emailValidation.isRequired ? this.$refs.error_email_field.dataset.requiredErrorMessage : this.$refs.error_email_field.dataset.invalidErrorMessage }; 
            } else {
              this.validateEmail = {'show': false, 'message': ''};
            }
          }

          if (this.$el.type === 'date') {
            if (new Date(new Date().toDateString()) > new Date(this.$el.value) || new Date(this.$el.value) > new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)) {
              this.validateDate = {'show': true, 'message': this.$refs.error_send_on_field.dataset.errorMessage};
            } else {
              this.validateDate = {'show': false, 'message': ''};
            }
          }

          this.__dispatchGiftCardChange();
        },
        setForm() {
          // document.querySelector(`#GiftCardRecipient__${ sectionId }`).querySelectorAll('.recipient-input').forEach((input) => {
          //   input.value = '';
          // })
          // this.$refs.recipient_error_message.classList.add('hidden');

          this.validateDate = {'show': false, 'message': ''};
          this.validateEmail = {'show': true, 'message': ''};
          if (this.recipientForm) {
            this.recipientForm.dataset.disabled = "true";
          }
        },
        __dispatchGiftCardChange() {
          if (this.sectionWrapperEle) {
            let isValidated;
            if (this.isShowForm) {
              isValidated = !(this.validateEmail.show || (this.validateDate.show && this.validateDate.message.length > 0))
            } else {
              isValidated = true
            }
            document.dispatchEvent(new CustomEvent(`${PRODUCT_EVENT.giftCardRecipientChange}${sectionId}`, {
              bubbles: true,
              detail: {
                isValidated: isValidated
              }
            }))
          }
        },
        updateProductFormStatus() {
          if (this.validateDate.show || this.validateEmail.show) {
            this.recipientForm.dataset.disabled = "true";
          } else {
            this.recipientForm.dataset.disabled = "false";
          }
        }
      }))
    };
    if (window.Alpine) {
      defineXGiftCardRecipient();
    } else {
      document.addEventListener('alpine:init', defineXGiftCardRecipient);
    }
  });
}