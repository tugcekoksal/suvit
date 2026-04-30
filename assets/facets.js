class FacetFilterForm extends HTMLElement {
  constructor() {
    super();
    this.sectionsToRender = ['#ProductGridContainer', '#active-facets', '#desktop_collection__count'];
    if(this.getAttribute('data-role') != 'drawer'){
      this.addEventListener('change', this.onSubmitHandler());
    } else {
      this.querySelector('#apply-button').addEventListener('click', (e) => {
        this.onSubmitHandler();
        this.closeDrawer();
      });      
      this.parentNode.addEventListener('click',(event) => {
        if(this.parentNode && event.target.id == this.parentNode.id){
          this.closeDrawer();
        }
      });
    }
    document.getElementById('open-drawer').addEventListener('click', (e) => {
      this.openDrawer();
    });
    if(this.querySelector('#Filter-facets__close')){
      this.querySelector('#Filter-facets__close').addEventListener('click', (e) => {
        this.closeDrawer();
      });
    }

    this.querySelectorAll('.input-check_label').forEach((item) => {
      item.addEventListener('click', (e) =>{
        this.toggleActive(e);
      });
    });
    this.querySelectorAll('.facet--topbar_inner').forEach((item) =>{
        item.addEventListener('click', (e) =>{
          this.openTopbarmenu(e);
        });
        item.addEventListener('keydown', (e) =>{
          if (e.key === "Enter") {
            e.preventDefault();
            this.openTopbarmenu(e);
          }
        });
    });
  }
  onSubmitHandler() {
    if(this.getAttribute('data-role') == 'drawer'){
      this.updateURLHash(new URLSearchParams(new FormData(this.querySelector('form'))).toString());
    }
    else{
      if(this.querySelector('select[name="sort_by"]')){
        this.querySelector('select[name="sort_by"]').addEventListener('change',(e) => {
          this.updateURLHash(new URLSearchParams(new FormData(this.querySelector('form'))).toString());
        });
      }
      this.querySelectorAll('input[type="range"]').forEach((price) => {
        price.addEventListener('change',(e) => {
          this.updateURLHash(new URLSearchParams(new FormData(this.querySelector('form'))).toString());
        });
      });

      this.querySelectorAll('input[type="checkbox"]').forEach((item) => {
        item.addEventListener('change', (e) => {
          this.updateURLHash(new URLSearchParams(new FormData(this.querySelector('form'))).toString());
        });
      });
    }
  }
  renderPageSection(url) {
    fetch(`?${url.toString()}`,{ method: "GET", headers: { "Content-Type": "text/html" } })
    .then(response => response.text())
    .then((data) => {
      const sections = this.sectionsToRender;
      sections.forEach((section) => {
        if(document.querySelector(section) && new DOMParser().parseFromString(data, 'text/html').querySelector(section)){
          document.querySelector(section).innerHTML = new DOMParser()
          .parseFromString(data, 'text/html')
          .querySelector(section).innerHTML;
        }
      });
    })
    .catch((e) => {
      console.error("Error:", e);
    });
  }
  updateURLHash(searchParams) {
    const url = `${window.location.pathname}?${searchParams}`;
    this.renderPageSection(searchParams);
    FacetFilterForm.updateURLHash(searchParams);
  }
  onActiveFilterClick(event) {
    event.preventDefault();
    this.sectionsToRender = ['#ProductGridContainer', '#active-facets', '#facet-filters-form', '#desktop_collection__count'];
    const url = event.currentTarget.href.indexOf('?') == -1 ? '' : event.currentTarget.href.slice(event.currentTarget.href.indexOf('?') + 1);
    this.updateURLHash(url);
  }
  openDrawer() {
    this.setAttribute('open','');
    (this.parentNode) ? this.parentNode.classList.add("open-drawer-filter") : '';
    document.body.classList.add("overflow-hidden");
  }
  closeDrawer() {
    this.removeAttribute('open');
    this.parentNode.classList.remove('open-drawer-filter');
    document.body.classList.remove("overflow-hidden");
  }
  toggleActive(e) {
    if(e.target.checked)
      e.target.parentNode.classList.add('active');
    else
      e.target.parentNode.classList.remove('active');
  }
  openTopbarmenu(e) {
    if(e.currentTarget.parentNode.classList.contains('open')){
      e.currentTarget.parentNode.classList.remove("open");
      this.querySelectorAll('.facet--topbar_inner').forEach((item) =>{item.style.opacity = '1';});
    }
    else{
      e.currentTarget.parentNode.classList.add("open");
      this.querySelectorAll('.facet--topbar_inner').forEach((item) =>{
        if(item != e.currentTarget){
          item.parentNode.classList.remove('open');
          item.style.opacity = '0.5';
        }else{
          item.style.opacity = '1';
        }
      });
    }
  }
  static updateURLHash(searchParams) {
    history.pushState({ searchParams }, '', `${window.location.pathname}${searchParams && '?'.concat(searchParams)}`);
  }
}
customElements.define('facet-filters-form', FacetFilterForm);

class PriceRange extends HTMLElement {
  constructor() {
    super();
    this.rangeS = this.querySelectorAll('input[type="range"]');
    this.numberS = this.querySelectorAll('input[type="number"]');
    this.init();
  }
  init() {
    this.rangeS.forEach((el) => {
      el.oninput = () => {
        let slide1 = parseFloat(this.rangeS[0].value),
          slide2 = parseFloat(this.rangeS[1].value);
  
        if (slide1 > slide2) {
          [slide1, slide2] = [slide2, slide1];
        }
  
        this.numberS[0].value = slide1;
        this.numberS[1].value = slide2;
      }
    });
    this.numberS.forEach((el) => {
      el.oninput = () => {
        let number1 = parseFloat(this.numberS[0].value),
          number2 = parseFloat(this.numberS[1].value);
  
        if (number1 > number2) {
          let tmp = number1;
          this.numberS[0].value = number2;
          this.numberS[1].value = tmp;
        }
  
        this.rangeS[0].value = number1;
        this.rangeS[1].value = number2;
      }
    });
  }
}
customElements.define('price-range', PriceRange);

class FacetRemove extends HTMLElement {
  constructor() {
    super();
    const facetLink = this.querySelector('a');
    facetLink.setAttribute('role', 'button');
    facetLink.addEventListener('click', this.closeFilter.bind(this));
    facetLink.addEventListener('keyup', (event) => {
      event.preventDefault();
      if (event.code.toUpperCase() === 'SPACE') this.closeFilter(event);
    });
    document.getElementById('facet-filters-form').classList.remove('open-drawer-filter');
  }

  closeFilter(event) {
    event.preventDefault();
    document.body.classList.remove("overflow-hidden");
    const form = document.querySelector('facet-filters-form');
    form.onActiveFilterClick(event);
  }
}

customElements.define('facet-remove', FacetRemove);

// js/common/facets/facet-sort-by.js
var FacetSortBy = class extends HTMLElement {
  constructor() {
    super();
    this.addEventListener("change", this._onValueChanged);
  }
  _onValueChanged(event) {
    const facetFilter = document.querySelector('facet-filters-form');
    facetFilter.updateURLHash(new URLSearchParams(new FormData(this.querySelector('form'))).toString());
  }
};
if (!window.customElements.get("facet-sort-by")) {
  window.customElements.define("facet-sort-by", FacetSortBy);
}