if (!window.Maximize.loadedScript.includes("product-picker.js")) {
  window.Maximize.loadedScript.push("product-picker.js");

  requestAnimationFrame(() => {
    const defineXProductPicker = () => {
      Alpine.data("xProductPicker", (priceFilterStyle, sectionId) => ({
        collectionUrl: "",
        filterOption: [],
        listRenderedFilter: [],
        isLoading: false,
        showResultText: false,
        numberFilter: 3,
        handleCollectionSelectChange(event) {
          const selectElement = event.target;
          const filtersData = JSON.parse(selectElement.dataset.filters);
          this.collectionUrl = event?.detail?.value;
          this.filterOption = filtersData;
          this.fetchFilter();
          this.showResultText = false;
          this.listRenderedFilter = [];
        },
        fetchFilter(isChangeResult, url) {
          let urlParam = `${this.collectionUrl}?section_id=product-picker-filter`;
          if (url) {
            urlParam = url;
          }
          this.isLoading = true;
          fetch(urlParam)
            .then((response) => response.text())
            .then((responseText) => {
              const html = new DOMParser().parseFromString(responseText, "text/html");
              for (let i = 0; i < this.numberFilter; i++) {
                const currentFilter = this.filterOption[i];
                if (isChangeResult) {
                  this.renderResultCount(html);
                  this.renderOptionListFilter(html, currentFilter.fitler, currentFilter.dropdownFormat, i);
                } else {
                  this.renderListFilter(html, currentFilter.filter, currentFilter.title, currentFilter.dropdownFormat, i);
                }
              }
            })
            .finally(() => (this.isLoading = false));
        },
        renderListFilter(html, filterName, filterTitle, dropdownFormat, index) {
          const oldElement = this.$root.querySelector(`.filter-${index + 1}__wrapper`);
          if (this.listRenderedFilter.includes(filterName)) {
            oldElement.innerHTML = this.renderTemplateFilter(filterName);
            return;
          }
          let listResult = this.getListResult(html, filterName);
          if (listResult && filterName) {
            const selectElementLabels = listResult.querySelectorAll(".parent-text-label");
            if (selectElementLabels && filterTitle) {
              selectElementLabels.forEach(ele => ele.textContent = filterTitle)
            }
            const swatchLabels = listResult.querySelectorAll(".swatch-option__label");
            swatchLabels.forEach((element) => (element.dataset.typeDisplay = dropdownFormat));
            if (listResult.dataset.type === "price") {
              oldElement.innerHTML = listResult.querySelector(`[data-price-filter-type="${priceFilterStyle}"]`)?.innerHTML;
            } else {
              oldElement.innerHTML = listResult.innerHTML;
            }
            this.listRenderedFilter.push(filterName);
          } else {
            const filterName = oldElement.dataset.filterPlaceholder
            oldElement.innerHTML = this.renderTemplateFilter(filterName);
          }
        },
        renderTemplateFilter(filterName) {
          return `
            <div class="h-full">
              <div class="relative h-full">
                <div
                  class="select-button h-full disabled-cursor color-bg-[rgba(var(--element-background))] flex justify-center items-center w-full pt-3.5 pb-3.5 pl-4 pr-4 lg:pt-[15px] lg:pb-[15px] lg:pl-5 lg:pr-5 rounded-md"
                  aria-expanded="false"
                  role="button"
                >
                  <span class="select-button__label flex items-start flex-auto whitespace-nowrap pr-[22px] rtl:pl-[22px] overflow-hidden">
                    ${filterName}
                  </span>
                  <span class="w-3 h-3 shrink-0">
                    <svg
                      width="100%"
                      height="100%"
                      viewBox="0 0 9 7"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style="fill: none;"
                    >
                      <path d="M0.75 1.625L4.5 5.375L8.25 1.625" stroke="currentColor" stroke-width="0.5" stroke-linecap="round"
                            stroke-linejoin="round"/>
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          `;
        },
        getFormParams(formElement) {
          const formData = new FormData(formElement);
          for (const pair of formData.entries()) {
            if (!pair[1]) {
              formData.delete(pair[0]);
            }
          }
          const formParams = new URLSearchParams(formData).toString();
          return formParams;
        },
        handleClick(event) {
          event.preventDefault();
          if (!this.collectionUrl) {
            return;
          }
          const formParams = this.getFormParams(this.$refs[`form_${sectionId}`]);
          window.location.href = `${this.collectionUrl}?${formParams}`;
        },
        handleOptionChange() {

          if (!this.collectionUrl) {
            return;
          }
          const formParams = this.getFormParams(this.$refs[`form_${sectionId}`]);
          this.fetchFilter(true, `${this.collectionUrl}?${formParams}&section_id=product-picker-filter`);
        },
        renderResultCount(html) {
          const totalResult = html.querySelector(".total-result");
          if (totalResult) {
            this.showResultText = totalResult.textContent;
          }
        },
        renderOptionListFilter(html, filterName, dropdownFormat, index) {
          if (!filterName) return;
          let listResult = this.getListResult(html, filterName);
          const oldElement = this.$root.querySelector(`.filter-${index + 1}__wrapper`);
          if (listResult && filterName) {
            const swatchLabels = listResult.querySelectorAll(".swatch-option__label");
            swatchLabels.forEach((element) => (element.dataset.typeDisplay = dropdownFormat));
            if (listResult.dataset.type !== "price") {
              let listSelectOptionEl = oldElement.querySelector(".select-options-wrapper");
              if (listSelectOptionEl) {
                listSelectOptionEl.innerHTML = listResult?.querySelector(".select-options-wrapper")?.innerHTML;
              }
            }
          }
        },
        getListResult(html, filterName) {
          let listResult = null;
          const listFilterName = filterName.trim().split(";");
          for (i = 0; i < listFilterName.length; i++) {
            if (html.querySelector(`div[data-label="${listFilterName[i]}"]`)) {
              listResult = html.querySelector(`div[data-label="${listFilterName[i]}"]`);
              break;
            }
          }
          return listResult;
        },
      }));
    };
    if (window.Alpine) {
      defineXProductPicker();
    } else {
      document.addEventListener("alpine:init", defineXProductPicker);
    }
  });
}
