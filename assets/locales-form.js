if (!window.Maximize.loadedScript.includes("locales-form.js")) {
  window.Maximize.loadedScript.push("locales-form.js");

  requestAnimationFrame(() => {
    const defineXLocalizationForm = () => {
      Alpine.data("xLocalizationForm", (language) => ({
        localizationForm: "",
        openForm: false,
        openCountry: false,
        openLanguage: false,
        loading: false,
        cachedResults: false,
        currentCountrySelector: '',
        languageSelector: language,
        toggleOpenForm() {
          this.openForm = !this.openForm;
        },
        submit() {
          this.$el.closest("#localization_form").submit();
        },
        loadCountry(el) {
          if (this.cachedResults) {
            this.openCountry = true;
            return true;
          }
          let countrySelectorElement = el.closest(".country-selector");
          let optionEL = countrySelectorElement.querySelector(".country-options");
          this.loading = true;
          this.currentCountrySelector = this.$refs.currentCountry.innerText.toLowerCase();
          const _this = this;
          fetch(window.Shopify.routes.root + "?section_id=country-selector")
            .then((reponse) => {
              return reponse.text();
            })
            .then((response) => {
              const parser = new DOMParser();
              const content = parser
                .parseFromString(response, "text/html")
                .getElementById("list-country");
              
              optionEL.innerHTML = content.innerHTML;
              requestAnimationFrame(() => {
                const countryLists = optionEL.querySelectorAll('li[role="button"]');

                countryLists.forEach(country => {
                  country.addEventListener('click', () => {
                    _this.setSelectCountry(el, country);
                    if (!countrySelectorElement.dataset.showPopup) el.closest("#localization_form").submit();
                  });

                  country.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      _this.setSelectCountry(el, country);
                      if (!countrySelectorElement.dataset.showPopup) el.closest("#localization_form").submit();
                    }
                  });
                });
              })
              this.cachedResults = true;
              this.openCountry = true;
            })
            .finally(() => {
              setTimeout(() => {
                this.loading = false;
                countrySelectorElement.handleOpen();
                countrySelectorElement.optionsList.classList.remove("p-0");
              }, 300)
            });
        },
        handleOptionEvent(currency_selector, rowItem, language, selector) {
          const _this = this;
          this.$el.addEventListener('click', () => {
            _this.setSelectLanguage(rowItem, language, selector);
            if (currency_selector === 'false') _this.submit();
          })
          this.$el.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              _this.setSelectLanguage(rowItem, language, selector);
              if (currency_selector === 'false') _this.submit();
            }
          });
        },
        setSelectLanguage(rowItem, language, selector) {
          this.$el.closest("#localization_form").querySelector("#" + selector).value = language;
          this.languageSelector = rowItem;
          this.openLanguage = false;
        },
        setSelectCountry(el, country) {
          el.closest("#localization_form").querySelector("#currency_selector").value = country.dataset.country;
          this.currentCountrySelector = country.dataset.countryTitle.toLowerCase();
          this.openCountry = false;
        },
        initPosition(position) {
          if (this.$el.closest("#x-utility") && position) {
            this.getScrollPosition(position, true)

            window.addEventListener('resize', () => {
              this.getScrollPosition(position, false)
            });
          }
        },
        initEventScroll() {
          const mobile_menu_scroll_ele = document.querySelector('#menu-navigation .scrollbar-visible.overflow-y-auto');
          if (mobile_menu_scroll_ele && this.$el.closest("#utility-bar-mobile")) {
            mobile_menu_scroll_ele.addEventListener("scroll", () => {
              this.openForm = false;
            });
          }

          window.addEventListener("scroll", () => {
            this.openForm = false;
          });
        },
        getScrollPosition(position, loadPage) {
          var container = this.$el.closest(".link-list");
          // Gets the element's position relative to the container
          var itemRect = this.$el.getBoundingClientRect();
          var containerRect = container.getBoundingClientRect();
          var xUtility = document.getElementById("x-utility")
          if (position == 'right') {
            var elementComputedStyle = getComputedStyle(xUtility);
            var padding = loadPage ? parseFloat(elementComputedStyle.paddingRight) : parseFloat(elementComputedStyle.paddingRight);
            let distance = (containerRect.right - itemRect.right) > 0 ? (containerRect.right - itemRect.right) : (itemRect.right - containerRect.right)
            this.$el.nextElementSibling.style.right = distance + padding + "px"
          } else {
            var elementComputedStyle = getComputedStyle(xUtility)
            var padding = loadPage ? 0 : parseFloat(elementComputedStyle.paddingLeft);
            
            this.$el.nextElementSibling.style.left = itemRect.left - padding +  "px"
          }
        }
      }));
    };
    if (window.Alpine) {
      defineXLocalizationForm();
    } else {
      document.addEventListener("alpine:init", defineXLocalizationForm);
    }
  });
}
