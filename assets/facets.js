// ── shopify:search:update + shopify:collection:update helpers ────────────────
/**
 * Shared: parse filter.* params from URLSearchParams into a ProductFilter[].
 * @param {URLSearchParams} params
 * @returns {Array}
 */
function _parseProductFilters(params) {
  let productFilters = [];
  let priceFilter = {};

  params.forEach(function (value, key) {
    if (!key.startsWith('filter.')) return;
    if (key === 'filter.v.price.gte')           { priceFilter.min = parseFloat(value); }
    else if (key === 'filter.v.price.lte')       { priceFilter.max = parseFloat(value); }
    else if (key === 'filter.v.availability')    { productFilters.push({ available: value === '1' }); }
    else if (key === 'filter.p.vendor')          { productFilters.push({ productVendor: value }); }
    else if (key === 'filter.p.tag')             { productFilters.push({ tag: value }); }
    else if (key === 'filter.p.product_type')    { productFilters.push({ productType: value }); }
    else if (key.startsWith('filter.p.m.') || key.startsWith('filter.v.m.')) {
      // metafield: filter.p.m.{namespace}.{key} or filter.v.m.{namespace}.{key}
      let parts = key.split('.');
      if (parts.length >= 5) {
        productFilters.push({ productMetafield: { namespace: parts[3], key: parts[4], value: value } });
      }
    }
  });

  if (Object.keys(priceFilter).length > 0) productFilters.push({ price: priceFilter });
  return productFilters;
}

/**
 * Parse a URLSearchParams string into a SearchQuery for shopify:search:update.
 * @param {string} searchParamsStr
 * @returns {{ query: string, productFilters: Array, sortKey: string }}
 */
function _parseSearchQueryParams(searchParamsStr) {
  let params;
  try { params = new URLSearchParams(searchParamsStr); } catch (_) { params = new URLSearchParams(); }

  let query = params.get('q') || '';
  let sortBy = params.get('sort_by') || '';
  // Storefront API search sortKey: only 'PRICE' or 'RELEVANCE'
  let sortKey = (sortBy === 'price-ascending' || sortBy === 'price-descending') ? 'PRICE' : 'RELEVANCE';

  return { query: query, productFilters: _parseProductFilters(params), sortKey: sortKey };
}

/**
 * Map Shopify URL sort_by param to Storefront API CollectionSortKey enum.
 * @param {string} sortBy
 * @returns {string}
 */
function _parseCollectionSort(sortBy) {
  const map = {
    'manual':             'MANUAL',
    'best-selling':       'BEST_SELLING',
    'title-ascending':    'TITLE',
    'title-descending':   'TITLE',
    'price-ascending':    'PRICE',
    'price-descending':   'PRICE',
    'created-ascending':  'CREATED',
    'created-descending': 'CREATED',
    'relevance':          'RELEVANCE',
  };
  return map[sortBy] || 'COLLECTION_DEFAULT';
}

/**
 * Parse a URLSearchParams string into a CollectionQuery for shopify:collection:update.
 * @param {string} searchParamsStr
 * @param {string} collectionHandle       from Liquid: collection.handle
 * @param {number} collectionProductCount from Liquid: collection.products_count
 * @returns {{ collection: Object, filters: Array, sort: string }}
 */
function _parseCollectionQueryParams(searchParamsStr, collectionHandle, collectionProductCount) {
  let params;
  try { params = new URLSearchParams(searchParamsStr); } catch (_) { params = new URLSearchParams(); }

  return {
    collection: {
      id: null,   // GID not available client-side; nullable per spec
      handle: collectionHandle || '',
      productsCount: Number(collectionProductCount) || 0,  // plural: per Shopify spec
    },
    filters: _parseProductFilters(params),
    sort: _parseCollectionSort(params.get('sort_by') || ''),
  };
}

function _extractProductCount(html) {
  try {
    let el = new DOMParser().parseFromString(html, 'text/html').getElementById('FacetsProductCount');
    if (el) return parseInt(el.textContent, 10) || 0;
  } catch (_) {}
  return 0;
}

document.addEventListener('alpine:init', () => {
  Alpine.data('xFiltersAndSortBy', (sectionId, filterType, isSearchPage, isExpanded, defaultListLayout = false, collectionHandle = '', collectionProductCount = 0) => ({
    t: '',
    isShow: false,
    showFilterAside: true,
    isLoading: false,
    isDesktop: false,
    // Grid unless the section says otherwise (the B2B order view can default to Quick order).
    // A stored choice overrides it below — and the inline script in the section has already
    // applied that same choice to the markup, so this never changes what is on screen.
    listLayout: defaultListLayout,
    cachedResults: {},
    additionalSearchParams: "",
    sortOption: "",
    searchParamsPrev: window.location.search.slice(1),
    searchParamsInitial: window.location.search.slice(1),
    init() {
      // Both directions, because the section default can be either one: with only the 'list'
      // branch a stored 'grid' would lose to a Quick order default and flip the layout back.
      const storedLayout = localStorage.getItem(`${FACET.productLayout}`);
      if (storedLayout == 'list') {
        this.listLayout = true;
      } else if (storedLayout == 'grid') {
        this.listLayout = false;
      }
      Alpine.nextTick(() => {
        this._initLayout();
      })
      this._setListeners();

      installMediaQueryWatcher("(min-width: 768px)", (matches) => {
        if (matches) {
          if (filterType != 'drawer') {
            this.isShow = false;
            Alpine.store("xMaximizeDrawer").handleClose();
          }
          this.isDesktop = true;
        } else {
          this.isDesktop = false;
        }
      });

      if (isSearchPage) {
        this.isSearchPage = isSearchPage
        this.additionalSearchParams = "type=product";
      }
    },
    _initLayout() {
      let formAside = document.getElementsByClassName('form-aside')[0] || null;
      let formDrawer = document.getElementsByClassName('form-drawer')[0] || null;
      if (window.innerWidth >= MIN_DEVICE_WIDTH.tablet) {
        this.isDesktop = true;
        if (formAside) {
          formAside.setAttribute('id','FacetFiltersForm');
          if (formDrawer) formDrawer.removeAttribute('id');
        } else {
          if (formDrawer) formDrawer.setAttribute('id','FacetFiltersForm');
        }
      } else {
        this.isDesktop = false;
        if (formAside) formAside.removeAttribute('id');
        if (formDrawer) formDrawer.setAttribute('id','FacetFiltersForm');
      }
    },
    _setListeners() {
      const onHistoryChange = (event) => {
        const searchParams = event.state ? event.state.searchParams : this.searchParamsInitial;
        if (searchParams === this.searchParamsPrev) return;
        this._renderPage(searchParams, false);
      }
      window.addEventListener('popstate', onHistoryChange);

      installMediaQueryWatcher('(min-width: 768px)', this._initLayout);

      document.addEventListener(SELECT_ELEMENT_EVENT.change, (event) => {
        let sortByOption = event.target;
        if (sortByOption.classList.contains('sorting-option'))
          this.onSubmit(0);
      });
    },
    toggleLayout(theBoolean) {
      this.listLayout = theBoolean;
      localStorage.setItem(`${FACET.productLayout}`, theBoolean ? "list" : "grid" );
      // delay resize event run after repaint
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('resize', { detail: { isChangeLayoutMode: true } }));
      }, 300)
    },
    removeFilter(url) {
      let removeUrl = url
      if (this.isSearchPage) {
        removeUrl = `${url}&${this.additionalSearchParams}`
      }
      this._reloadFilter(removeUrl);
    },
    onSubmit(wait = 500) {
      if (this.t) {
        clearTimeout(this.t);
      }

      const func = () => {
        const searchParams = this._createSearchParams(document.getElementById('FacetFiltersForm'));
        this._renderPage(searchParams);
        if (this.isDesktop) {
          document.getElementById('SelectSortByOption').blur();
          const sectionWrapperEle = document.getElementById(sectionId);
          if (sectionWrapperEle) {
            sectionWrapperEle.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }
      
      this.t = setTimeout(() => {
        func();
      }, wait);
    },

    _reloadFilter(url) {
      const searchParams = url.indexOf('?') == -1 ? '' : url.slice(url.indexOf('?') + 1);
      this._renderPage(searchParams);
    },
    _createSearchParams(form) {
      if (form) {
        const formData = new FormData(form);
        return new URLSearchParams(formData).toString();
      }
    },
    _updateURLHash(searchParams) {
      history.pushState({ searchParams }, '', `${window.location.pathname}${searchParams && '?'.concat(searchParams)}`);
    },
    async _renderPage(searchParams, updateURLHash = true) {
      this.searchParamsPrev = searchParams;
      this.isLoading = true;

      // Search pages → shopify:search:update; collection pages → shopify:collection:update.
      const _slSearch = isSearchPage
        ? window.MaximizeStorefrontEvents?.createSearchUpdate(
            _parseSearchQueryParams(searchParams), this.$el
          )
        : window.MaximizeStorefrontEvents?.createCollectionUpdate(
            _parseCollectionQueryParams(searchParams, collectionHandle, collectionProductCount), this.$el
          );

      if (this.cachedResults[searchParams]) {
        this._renderResults(this.cachedResults[searchParams]);
        _slSearch?.resolve(_extractProductCount(this.cachedResults[searchParams]));
        if (updateURLHash) {
          this._updateURLHash(searchParams);
        }
        return;
      }

      const url = `${window.location.pathname}?section_id=${sectionId}&${this.additionalSearchParams}&${searchParams}`;

      try {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        this.cachedResults[searchParams] = html;
        this._renderResults(html);
        _slSearch?.resolve(_extractProductCount(html));
      } catch (error) {
        console.error("Failed to fetch page:", error);
        _slSearch?.reject(error);
      }

      if (updateURLHash) {
        this._updateURLHash(searchParams);
      }
    },
    _renderResults(html) {
      this._renderFilters(html);
      this._renderProductGridContainer(html);
      this._renderProductCount(html);
      if (this.isSearchPage) {
        this.__renderProductTabButton(html)
      }
      this.isLoading = false;
    },
    __renderProductTabButton(html) {
      const productCountEl = new DOMParser().parseFromString(html, 'text/html').querySelector('.button-tab-product');
      if (productCountEl) {
        const containerDrawer = document.querySelector('.button-tab-product');
        if (containerDrawer) containerDrawer.innerHTML = productCountEl.innerHTML;
      }
    },
    _renderFilters(html) {
      const parsedHTML = new DOMParser().parseFromString(html, 'text/html');
      let blockFilterDrawer = '.form-drawer';
      let blockFilterAside = '.form-aside';
      const selectblockFilterDrawer = document.querySelector(blockFilterDrawer);
      const selectblockFilterAside = document.querySelector(blockFilterAside);
      const filterWrapper = document.querySelector(".facet-filter-wrapper");
      const filterWrapperToRender = parsedHTML.querySelector(".facet-filter-wrapper")
      const buttonFilterWrapper = document.getElementById('ButtonFilterWrapper');
      if (parsedHTML.querySelector(".js-filter")) {
        filterWrapper.style.display = "";
        if (buttonFilterWrapper) {
          buttonFilterWrapper.style.display = "";
        }
        if (selectblockFilterDrawer) {
          if (this.$el.id) {
            const blockFilterDrawerElement = parsedHTML.querySelector(blockFilterDrawer);
            if (blockFilterDrawerElement) {
              blockFilterDrawerElement.querySelectorAll('.js-filter').forEach((element, index) => {
                const filterParam = element.dataset.paramName;
                let currentElement = selectblockFilterDrawer.querySelector(`[data-param-name="${filterParam}"]`);
                if (currentElement) {
                  const isExpanded = currentElement.isOpen === true 
                    || currentElement.dataset.expanded === 'true';
                  element.setAttribute('data-expanded', isExpanded ? 'true' : 'false');
                }
              });
            }
          }

          const newblockFilterDrawer = parsedHTML.querySelector(blockFilterDrawer);
          if (newblockFilterDrawer) {
            selectblockFilterDrawer.innerHTML = newblockFilterDrawer.innerHTML;
          } else {
            selectblockFilterDrawer.innerHTML = '';
          }
          this._renderAdditionalElements(parsedHTML);
        };
        if (selectblockFilterAside) {
          if (this.$el.id) {
            const blockFilterAsideElement = parsedHTML.querySelector(blockFilterAside);
            if (blockFilterAsideElement) {
              blockFilterAsideElement.querySelectorAll('.js-filter').forEach((element, index) => {
                let isExpanded = '{open: false}';
                const filterParam = element.dataset.paramName;
                let currentElement = selectblockFilterAside.querySelector(`[data-param-name="${filterParam}"]`);
                if (currentElement) {
                  isExpanded = currentElement.dataset.expanded == 'true' ? '{open: true}' : '{open: false}';
                }
                element.setAttribute('x-data', isExpanded);
              });
            }
          }

          const newblockFilterAside = parsedHTML.querySelector(blockFilterAside);
          if (newblockFilterAside) {
            selectblockFilterAside.innerHTML = newblockFilterAside.innerHTML;
          } else {
            selectblockFilterAside.innerHTML = ""
          }
    
          this._renderAdditionalElements(parsedHTML);
        };
        
        const filterTagEl = document.getElementById('ActiveFilterTag');
        const newFilterTagEl = parsedHTML.getElementById('FacetsContainerBar')?.content?.getElementById('ActiveFilterTag');

        if (filterTagEl) {
          if (newFilterTagEl) {
            filterTagEl.innerHTML = newFilterTagEl.innerHTML;
          } else {
            filterTagEl.innerHTML = "";
          }
        }
        const filterWrapperBar = document.getElementById("FacetsWrapperBar");
        if (filterWrapperBar?.dataset.stickyFilter === "true") {
          this.setFilterHeaderHeight();
        }
      } else {
        if (filterWrapperToRender.dataset.showFilter === "false") {
          filterWrapper.classList.add("md:hidden");
          filterWrapper.innerHTML = filterWrapperToRender.innerHTML;
          this._initLayout();
        }
        if (!parsedHTML.querySelector('.facets-filter__wrapper')?.dataset.enableFilter && buttonFilterWrapper) {
          buttonFilterWrapper.style.display = "none"
        }
        if (filterType == 'drawer') {
          document.body.classList.remove('overflow-y-hidden');
        }
      }
      
      this._renderAdvancedFilters(parsedHTML, "desktop");
      this._renderAdvancedFilters(parsedHTML, "mobile");
      const mobileActiveFilterTag = document.getElementById("mobile-active-filter-tag");
      const renderedMobileFilterTag = parsedHTML.querySelector("#mobile-active-filter-tag");
      if (mobileActiveFilterTag && renderedMobileFilterTag) {
        mobileActiveFilterTag.innerHTML = renderedMobileFilterTag.innerHTML
      }
    },
    _renderAdvancedFilters(html, type) {
      const destination = document.querySelectorAll( `.${type}-advanced-filter`);
      const source = html.querySelectorAll(`.${type}-advanced-filter`);

      if (destination.length > 0) {
        destination.forEach((destination, index) => {
          if (source[index]) {
            destination.innerHTML = source[index].innerHTML;
          } else {
            destination.innerHTML = "";
          }
        })
      }
    },
    _renderProductGridContainer(html) {
      const productGridContainer = document.getElementById('ProductGridContainer');
      const destinationElement = new DOMParser().parseFromString(html, 'text/html').getElementById('ProductGridContainer')
      
      if (productGridContainer && destinationElement) {
        productGridContainer.innerHTML = destinationElement.innerHTML;
        if (typeof initializeScrollAnimationTrigger === 'function') initializeScrollAnimationTrigger();
      }
    },
    _renderProductCount(html) {
      const productCountEl = new DOMParser().parseFromString(html, 'text/html').getElementById('FacetsProductCount');
      if (productCountEl) {
        const count = productCountEl.innerHTML;
        const container = document.getElementById('ProductCount_header');
        const containerDrawer = document.getElementById('ProductCountDrawer');
        if (container) container.innerHTML = count;
        if (containerDrawer) containerDrawer.innerHTML = count;
      }
    },
    _renderAdditionalElements(html) {
      const container = document.getElementById('ProductPerPage');
      const destinationElement = html.getElementById('ProductPerPage')
      if (container && destinationElement) container.innerHTML = destinationElement.innerHTML;
    },
    _filterFocus() {
      Alpine.store('xFocusElement').trapFocus('FacetsFilterDrawer','CloseFilterDrawer');
    },
    _filterRemoveFocus() {
      Alpine.store('xFocusElement').removeTrapFocus();
    },
    setFilterHeaderHeight() {
      const filterWrapperBar = document.getElementById("FacetsWrapperBar")
      document.documentElement.style.setProperty('--height-sticky-filter',filterWrapperBar.getBoundingClientRect().height + "px");
    },
    setPositionOptionFilter(el) {
      let elRect = el.getBoundingClientRect();
      const elPopup = el.getElementsByClassName('popup-above')[0];
      let spacingRight = window.innerWidth - elRect.left;
      let checkSpacing = spacingRight - el.innerWidth;
      if (checkSpacing >= 0) {
        elPopup.style.left = '0px';
      } else {
        elPopup.style.left = checkSpacing+ 'px';
      }
    }
  }));
});