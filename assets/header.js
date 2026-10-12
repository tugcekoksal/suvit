if (!window.Maximize.loadedScript.includes("header.js")) {
  window.Maximize.loadedScript.push("header.js");

  requestAnimationFrame(() => {
    document.addEventListener("alpine:init", () => {

      /* ──────────────────────────────────────────────────────────────
       * UTILITY: shared debounce (single definition, reused by all)
       * ────────────────────────────────────────────────────────────── */
      function debounce(fn, delay) {
        let timer;
        return function (...args) {
          clearTimeout(timer);
          timer = setTimeout(() => fn.apply(this, args), delay);
        };
      }

      /* ──────────────────────────────────────────────────────────────
       * UTILITY: detect touch capability once
       * ────────────────────────────────────────────────────────────── */
      const isTouchDevice = Boolean(
        "ontouchstart" in window
        || window.DocumentTouch && document instanceof DocumentTouch
        || navigator.maxTouchPoints
        || navigator.msMaxTouchPoints
      );

      /* ──────────────────────────────────────────────────────────────
       * UTILITY: calculate vertical offset for account popups
       * ────────────────────────────────────────────────────────────── */
      function calculateAccountIconOffset(iconSelector) {
        const rect = document.querySelector(iconSelector).getBoundingClientRect();
        return Math.round(rect.top + rect.height / 2);
      }

      let _currentAccountObserver = null;
      function accountPopupListener(isMobile = false) {
        const selector = isMobile ? '.mobile-header-account-menu' : '.header-account-menu';
        const accountEl = document.querySelector(`${selector} shopify-account`);
        if (!accountEl) return;

        const handleStateChange = (isOpen, isMobile) => {
          if (isOpen) {
            document.body.style.setProperty('overflow', 'visible');
            if (isMobile) {
              const offsetMobile = calculateAccountIconOffset('.mobile-header-account-menu');
              document.body.style.setProperty('--account-offset-top-mobile', `${offsetMobile + ICON_POPUP_SPACING.MOBILE}px`);
            } else {
              const offsetDesktop = calculateAccountIconOffset('.header-account-menu');
              document.body.style.setProperty('--account-offset-top', `${offsetDesktop + ICON_POPUP_SPACING.DESKTOP}px`);
              Alpine.store("xHeaderMenu").hideMenu();
            }
          } else {
            ['--account-offset-top-mobile', '--account-offset-top', 'overflow'].forEach(prop => {
              document.body.style.removeProperty(prop);
            });
          }
        };

        if (_currentAccountObserver) {
          _currentAccountObserver.disconnect();
          _currentAccountObserver = null;
        }

        const observeShadowRoot = (shadowRoot) => {
          if (!shadowRoot) return;

          const dialog = shadowRoot.querySelector('dialog');
          if (!dialog) return;
          const dialogObserver = new MutationObserver(() => {
            handleStateChange(dialog.hasAttribute('open'), isMobile);
          });

          dialogObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
          _currentAccountObserver = dialogObserver;
          handleStateChange(dialog.hasAttribute('open'), isMobile);
        };

        if (accountEl.shadowRoot) {
          observeShadowRoot(accountEl.shadowRoot);
        } 
      }

      /* ──────────────────────────────────────────────────────────────
       * STORE: xScreenMode
       *
       * Determines whether to render the desktop or mobile menu.
       * Uses matchMedia at the 1024px breakpoint (same as Tailwind lg:)
       * to completely avoid rendering the unused menu via x-if.
       *
       * In Shopify design mode, both menus render for editor compat.
       * ────────────────────────────────────────────────────────────── */
      Alpine.store("xScreenMode", {
        isDesktop: window.innerWidth >= 1024,
        showBoth: false,
        initialized: false,

        init() {
          // In design mode, render both menus so the editor can interact with them
          if (Shopify.designMode) {
            this.showBoth = true;
            this.isDesktop = window.innerWidth >= 1024;
            this.initialized = true;
            return;
          }

          const scheduleInit = window.requestIdleCallback || ((cb) => requestAnimationFrame(cb));
          scheduleInit(() => {
            const mq = window.matchMedia("(min-width: 1024px)");
            this.isDesktop = mq.matches;
            this.initialized = true;

            // Listen for breakpoint changes (e.g. orientation change)
            mq.addEventListener("change", (e) => {
              this.isDesktop = e.matches;
            });
          });
        },
      });

      /* ────────────────────────────────────────────────────────────────
       * STORE: xHeaderMenu
       *
       * Responsibilities:
       *   - Sticky header state management
       *   - Scroll-driven header show/hide
       *   - Transparent header behavior
       *   - Menu open/close toggling
       *   - CSS custom-property synchronization
       * ──────────────────────────────────────────────────────────────── */
      Alpine.store("xHeaderMenu", {

        // ── Public reactive state ──────────────────────────────────
        isSticky: false,
        isTouch: isTouchDevice,
        isTransparent: false,
        clickedHeader: false,
        showLogoTransparent: false,
        headerHeight: 0,
        collapseMenuHeight: 0,
        isCollapseMenu: false,

        // ── Config (set once during init) ──────────────────────────
        sectionId: "",
        stickyType: "none",
        logoPosition: null,

        // ── Private / internal state ───────────────────────────────
        _lastScrollTop: false,
        _previousScrollTop: 0,
        _themeModeChanged: false,
        _scrollTicking: false,

        // ── Cached DOM references ──────────────────────────────────
        _headerSectionEl: null,
        _drawerMenuEl: null,
        _headerTopEl: null,
        _stickyTargets: null,

        _headerBounds: { top: 0, bottom: 0 },

        /* ════════════════════════════════════════════════════════════
         * INITIALIZATION
         * ════════════════════════════════════════════════════════════ */

        handleInitHeader(sectionId, stickyType, isTransparent, logoPosition, isCollapseMenu) {
          // Store config
          this.sectionId = sectionId;
          this.stickyType = stickyType;
          this.isTransparent = isTransparent;
          this.logoPosition = logoPosition;
          this.showLogoTransparent = isTransparent;
          this.isCollapseMenu = isCollapseMenu

          // Cache primary DOM elements
          this._headerSectionEl = document.getElementById(sectionId);
          this._drawerMenuEl = document.getElementById("DrawerMenu");
          this._headerTopEl = this._headerSectionEl.querySelector(".header-top");
          this._cacheStickyTargets();

          // Initial measurements
          this._updateViewportHeight();
          this.updateHeaderBottom();
          accountPopupListener(false);

          if (stickyType !== "none") {
            this._applyStickyState(window.scrollY);
            this._updateAnnouncementHeight();
            this._headerSectionEl.classList.add("sticky-header");
            Alpine.nextTick(() => {
              requestIdleCallback(() => this._measureCollapseMenuHeight())
              this._measureHeaderHeight();
              this._syncHeaderHeightVar();
            });
          }

          // Respond to viewport changes
          const onResize = debounce((event) => {
            if (event.detail?.isChangeLayoutMode) return;

            if (stickyType !== "none") {
              this._measureCollapseMenuHeight()
              this._measureHeaderHeight();
              this._updateAnnouncementHeight();
              this._syncHeaderHeightVar();
              this._syncTopStickyVar();
            }
            this._updateViewportHeight();
            this.updateHeaderBottom();
            accountPopupListener(window.innerWidth < MIN_DEVICE_WIDTH.desktop);
          }, 100);

          window.addEventListener("resize", onResize);

          // Capture initial bounds via IntersectionObserver (non-blocking)
          this._observeInitialBounds(this._headerSectionEl);
        },

        /* ════════════════════════════════════════════════════════════
         * SCROLL HANDLING (unified, rAF-throttled)
         * ════════════════════════════════════════════════════════════ */

        /**
         * Single entry-point for all scroll work.
         * Called from the Alpine `@scroll.window.passive` directive.
         * Ensures only one rAF callback runs per frame.
         */
        onScroll() {
          if (this._scrollTicking) return;
          this._scrollTicking = true;

          requestAnimationFrame(() => {
            this._scrollTicking = false;

            if (!this._headerSectionEl) return;

            // Close any open fixed mega menu instantly on scroll (no transition).
            const openOnScroll = document.querySelectorAll(".mega-menu-wrapper.toggle-menu.is-open");
            if (openOnScroll.length) {
              for (let i = 0; i < openOnScroll.length; i++) {
                openOnScroll[i].style.transition = "none";
                openOnScroll[i].classList.remove("is-open");
                openOnScroll[i].setAttribute("inert", "");
              }
              requestAnimationFrame(() => {
                for (let i = 0; i < openOnScroll.length; i++) {
                  openOnScroll[i].style.transition = "";
                }
              });
            }

            const scrollTop = window.scrollY;

            this._applyStickyState(scrollTop);
            this._applyScrollDirection(scrollTop);
            this._syncTopStickyVar();

            this._themeModeChanged = false;
          });
        },

        /** Determine sticky / transparent state based on scroll position. */
        _applyStickyState(scrollTop) {
          const { top, bottom } = this._headerBounds;
          if (scrollTop > bottom) {
            this.isSticky = true;
            if (this.isTransparent) this.showLogoTransparent = false;

            if (scrollTop <= this._previousScrollTop) {
              this.clickedHeader = false;
            }

            const isAlwaysType = this.stickyType === "always" || this.stickyType === "reduce-logo-size";
            if (scrollTop > this._previousScrollTop && isAlwaysType) {
              this._headerSectionEl.classList.add("always-animation", this.stickyType);
            }
          } else if (scrollTop <= top) {
            this._headerSectionEl?.classList.remove(this.stickyType, "always-animation");
            this.clickedHeader = false;
            this.isSticky = false;
            if (this.isTransparent) this.showLogoTransparent = true;
          }

          // Recalculate height for transparent headers (layout may shift)
          if (this.isTransparent && this.stickyType !== "on-scroll-up") {
            this._measureHeaderHeight();
            this._syncHeaderHeightVar();
          }

          this._previousScrollTop = Math.max(scrollTop, 0);
        },

        /** Show/hide header based on scroll direction (scroll-up reveal). */
        _applyScrollDirection(scrollTop) {
          if (this._lastScrollTop === false) {
            this._lastScrollTop = scrollTop;
            return;
          }

          const delta = Math.abs(scrollTop - this._lastScrollTop);
          if (delta <= 15) return; // ignore micro-scrolls

          const isUp = scrollTop < this._lastScrollTop;
          const hideClass = this.stickyType === "on-scroll-up" ? "header-up" : (this.isCollapseMenu ? "header-up-always" : "not-scroll-up");

          if (isUp) {
            this._headerSectionEl.classList.remove(hideClass);
            if (this.isTransparent) this._measureHeaderHeight();
            this._syncHeaderHeightVar(false);
          } else if (!this._themeModeChanged) {
            if (this.isTransparent) this._measureHeaderHeight();
            this._headerSectionEl.classList.add(hideClass);
            this.stickyType === "on-scroll-up" ? this._syncHeaderHeightVar(true) : this._syncHeaderHeightVar(this.isCollapseMenu);
          }

          this._lastScrollTop = scrollTop;
        },

        /* ════════════════════════════════════════════════════════════
         * DOM MEASUREMENT (reads)
         * ════════════════════════════════════════════════════════════ */

        _measureHeaderHeight() {
          if (this._headerSectionEl && this.stickyType !== "none") {
            if (this.isTransparent) {
              this.headerHeight = this._headerSectionEl.querySelector("#x-header-content").getBoundingClientRect().height;
            } else {
              this.headerHeight = this._headerSectionEl.getBoundingClientRect().height;
            }
          }
        },
        _measureCollapseMenuHeight() {
          if (this.stickyType != "on-scroll-up" && this.isCollapseMenu) {
            const collapseMenuEl = this._headerSectionEl?.querySelector(".header-collapse-menu > div");
            this.collapseMenuHeight = collapseMenuEl.getBoundingClientRect().height
          } 
        },

        _observeInitialBounds(element) {
          const observer = new IntersectionObserver((entries) => {
            this._headerBounds = entries[0].intersectionRect;
            observer.disconnect();
          });
          observer.observe(element);
        },

        /* ════════════════════════════════════════════════════════════
         * CSS CUSTOM-PROPERTY SYNC (writes)
         * ════════════════════════════════════════════════════════════ */

        /** Propagate --height-header to header and all sticky-aware sections. */
        _syncHeaderHeightVar(isHidden = false) {
          let value = (isHidden || this.showLogoTransparent) ? "0px" : `${this.headerHeight}px`;
          if (isHidden && this.isCollapseMenu) {
            value = `${this.headerHeight - this.collapseMenuHeight}px`
          } 

          // Write only if changed
          if (this._headerSectionEl?.dataset.heightHeader === value) return;

          this._headerSectionEl?.style.setProperty("--height-header", value);
          this._headerSectionEl && (this._headerSectionEl.dataset.heightHeader = value);

          if (this._stickyTargets) {
            for (let i = 0; i < this._stickyTargets.length; i++) {
              this._stickyTargets[i].style.setProperty("--height-header", value);
            }
          }
        },

        _syncTopStickyVar() {
          const value = `${this.headerHeight}px`;

          if (this._headerSectionEl?.dataset.topHeader === value) return;

          this._headerSectionEl.style.setProperty("--top-header", value);
          this._headerSectionEl.dataset.topHeader = value;
        },

        _updateAnnouncementHeight() {
          requestAnimationFrame(() => {
            const announcement = document.getElementById("x-announcement");
            if (!announcement) return;
            const isSticky = announcement?.dataset.isSticky === "true";
            const height = isSticky
              ? `${announcement.getBoundingClientRect().height.toFixed(2)}px`
              : "0px";

            document.documentElement.style.setProperty("--announcement-height", height);
          });
        },

        _updateViewportHeight() {
          if (CSS.supports("height", "100dvh")) return;

          const root = document.documentElement;
          const height = `${window.innerHeight}px`;

          if (root.dataset.viewportHeight !== height) {
            root.dataset.viewportHeight = height;
            root.style.setProperty("--viewport-height", height);
          }
        },

        /** Cache elements that need --height-header updates. */
        _cacheStickyTargets() {
          this._stickyTargets = document.querySelectorAll([
            ".section-announcement:has([data-is-sticky='true'])",
            ".sticky-filter-top",
            ".sticky-top",
            ".sticky-filter-above-top",
            ".sticky-filter-aside-content-top",
            ".sticky-main-product-top",
            ".section-product-bundle",
          ].join(","));
        },

        /* ════════════════════════════════════════════════════════════
         * HEADER BOTTOM POSITION
         * ════════════════════════════════════════════════════════════ */

        updateHeaderBottom(delay = 0) {
          if (delay > 0) {
            setTimeout(() => this._writeHeaderBottom(), delay);
          } else {
            this._writeHeaderBottom();
          }
        },

        _writeHeaderBottom() {
          requestAnimationFrame(() => {
            if (!this._headerSectionEl) return;
            const headerEl = this.isTransparent
              ? document.getElementById("x-header-content")
              : this._headerSectionEl;
            if (!headerEl) return;
            const newBottom = `${Math.round(headerEl.getBoundingClientRect().bottom) - 1}px`;

            if (this._headerSectionEl.dataset.headerBottom !== newBottom) {
              this._headerSectionEl.style.setProperty("--header-bottom-position", newBottom);
              this._headerSectionEl.dataset.headerBottom = newBottom;
            }

            if (this._drawerMenuEl && this.logoPosition !== "compact" && this._headerTopEl) {
              const newDrawerBottom = `${Math.round(this._headerTopEl.getBoundingClientRect().bottom) + 12}px`;
              if (this._drawerMenuEl.dataset.headerBottom !== newDrawerBottom) {
                this._drawerMenuEl.style.setProperty("--header-bottom-position", newDrawerBottom);
                this._drawerMenuEl.dataset.headerBottom = newDrawerBottom;
              }
            }
          });
        },

        // Synchronous (no rAF) — call immediately before the mega menu becomes
        // visible so the initial --header-bottom-position is always correct.
        _syncHeaderBottomNow() {
          if (!this._headerSectionEl) return;
          const el = this.isTransparent
            ? document.getElementById("x-header-content")
            : this._headerSectionEl;
          if (!el) return;
          const newBottom = `${Math.round(el.getBoundingClientRect().bottom) - 1}px`;
          if (this._headerSectionEl.dataset.headerBottom !== newBottom) {
            this._headerSectionEl.style.setProperty("--header-bottom-position", newBottom);
            this._headerSectionEl.dataset.headerBottom = newBottom;
          }
        },

        /* ════════════════════════════════════════════════════════════
         * MENU INTERACTION
         * ════════════════════════════════════════════════════════════ */

        selectItem(el, type, isSub, event) {
          if (type === "menu" && Alpine.store("xDrawerMenu").menuOpen) {
            Alpine.store("xDrawerMenu").handleCloseMenu();
          }
          this.updateHeaderBottom();

          const selector = isSub ? ".toggle-menu-sub" : ".toggle-menu";

          // Prevent navigation on first click if dropdown exists
          if (event?.type === "click") {
            const parentItem = el.closest(".menu-item");
            const dropdown = parentItem?.querySelector(selector);
            if (dropdown && !dropdown.classList.contains("is-open")) {
              event.preventDefault();
            }
          }

          // Close all sibling menus
          const toggleMenu = el.querySelector(selector);

          // If the target sub-menu is already open, skip the close/reopen cycle.
          // Closing and immediately reopening the same panel causes a display:none → display:block
          // flash that re-triggers IntersectionObserver callbacks for all child elements (e.g. all
          // product card reveal animations fire simultaneously when hovering within the panel).
          if (toggleMenu?.classList.contains("is-open")) {
            if (el.closest(".product-menu-item__lv0")) {
              this._resizeProductMenu(el);
            }
            return;
          }

          const scope = isSub ? el.closest(".toggle-menu") : document;
          this._closeMenuItems(scope.querySelectorAll(selector));

          // Open the target menu
          if (toggleMenu) {
            // Measure synchronously so --header-bottom-position is correct
            // the instant the menu becomes visible (before the next paint).
            this._syncHeaderBottomNow();
            toggleMenu.classList.add("is-open");
            toggleMenu.removeAttribute("inert");
          }

          if (el.closest(".product-menu-item__lv0")) {
            this._resizeProductMenu(el);
          }
        },

        handleKeyupElement(el) {
          const toggleMenu = el.querySelector(".toggle-menu");
          const openMenus = document.getElementsByClassName("toggle-menu is-open");

          for (let i = 0; i < openMenus.length; i++) {
            if (openMenus[i] !== toggleMenu) {
              openMenus[i].setAttribute("inert", "");
              openMenus[i].classList.remove("is-open");
            }
          }

          this._syncHeaderBottomNow();
          toggleMenu.classList.toggle("is-open");
          toggleMenu.toggleAttribute("inert");

          if (el.closest(".product-menu-item__lv0")) {
            this._resizeProductMenu(el);
          }
        },

        hideMenu(parentClass) {
          const selector = parentClass
            ? `.${parentClass} .toggle-menu.is-open`
            : ".toggle-menu.is-open";
          this._closeMenuItems(document.querySelectorAll(selector));
        },

        /** Bulk-close a NodeList of menu items. */
        _closeMenuItems(items) {
          for (let i = 0; i < items.length; i++) {
            items[i].classList.remove("is-open");
            items[i].setAttribute("inert", "");
          }
        },

        /* ════════════════════════════════════════════════════════════
         * PRODUCT MEGA-MENU HEIGHT
         * ════════════════════════════════════════════════════════════ */

        _resizeProductMenu(el) {
          const container = el.closest(".product-menu-item__lv0");
          if (!container) return;

          const megaMenu = container.querySelector(".product-mega-menu");
          const activeSubmenu = container.querySelector(".product-mega-menu_wrapper.is-open .mega-sub-container");
          const listMenu = container.querySelector(".product-list-item");

          requestAnimationFrame(() => {
            const submenuH = (activeSubmenu?.scrollHeight ?? 0) + 35;
            const listH = (listMenu?.scrollHeight ?? 0) + 68;
            const maxH = Math.min(Math.max(submenuH, listH), window.innerHeight);

            if (megaMenu) {
              megaMenu.style.height = `${maxH}px`;
            }
          });
        },

        /* ════════════════════════════════════════════════════════════
         * FOCUS & ACCESSIBILITY
         * ════════════════════════════════════════════════════════════ */

        focusFirstItem(el) {
          el.closest(".first-menu-item")
            ?.querySelector(".menu-parent-link span:last-of-type")
            ?.focus();
        },

        handleFocusOut(el, event) {
          if (event.relatedTarget && !el.contains(event.relatedTarget)) {
            this.hideMenu("main-menu-nav");
          }
        },

        /* ════════════════════════════════════════════════════════════
         * TOUCH HANDLING
         * ════════════════════════════════════════════════════════════ */

        touchItem(el, type, isSub = false) {
          if (el.dataset.touchEvent) return;

          el.dataset.touchEvent = "true";
          const touchClass = isSub ? "touched-sub" : "touched";

          el.addEventListener("touchend", (e) => {
            if (el.classList.contains(touchClass)) return;

            e.preventDefault();

            // Remove touch class from all items
            const touched = document.querySelectorAll(`.${touchClass}`);
            for (let i = 0; i < touched.length; i++) {
              touched[i].classList.remove(touchClass);
            }
            const menuItem = el.closest("li");

            el.classList.add(touchClass);
            if (Alpine.$data(el).firstLoad) {
              Alpine.$data(el).firstLoad();
            }
            this.selectItem(menuItem, type, isSub);
          }, { passive: false });
        },

        /* ════════════════════════════════════════════════════════════
         * TRANSPARENT HEADER HOVER
         * ════════════════════════════════════════════════════════════ */

        addTransparentHover(el) {
          el.classList.add("sticky-header-active");
        },

        removeTransparentHover(el) {
          el.classList.remove("sticky-header-active");
        },

        /* ════════════════════════════════════════════════════════════
         * THEME MODE
         * ════════════════════════════════════════════════════════════ */

        handleChangeThemeMode() {
          this._themeModeChanged = true;
          setTimeout(() => {
            this._measureHeaderHeight();
            this.updateHeaderBottom();
            this._syncHeaderHeightVar();
          }, 100);
        }
      });


      /* ────────────────────────────────────────────────────────────────
       * STORE: xMobileNav
       *
       * Responsibilities:
       *   - Mobile navigation drawer open/close
       *   - Active menu link stack management
       *   - Utility bar DOM relocation
       * ──────────────────────────────────────────────────────────────── */
      Alpine.store("xMobileNav", {
        show: false,
        loading: false,
        currentMenuLinks: [],

        init() {
          installMediaQueryWatcher("(min-width: 1024px)", () => this.close());
        },

        toggle() {
          this.show = !this.show;

          if (this.show) {
            Alpine.nextTick(() => {
              requestAnimationFrame(() => {
                Alpine.store("xHeaderMenu").updateHeaderBottom();
                accountPopupListener(true);
                setTimeout(() => {
                  Alpine.store("xFocusElement").trapFocus("x-header-mobile", "menu-navigation");
                }, 300);
              });
            });
          }

          document.body.classList.toggle("overflow-hidden", this.show);
        },

        close() {
          this.show = false;
          document.body.classList.remove("overflow-hidden");
        },

        setActiveLink(linkId) {
          this.currentMenuLinks.push(linkId);
        },

        removeActiveLink(linkId) {
          const idx = this.currentMenuLinks.indexOf(linkId);
          if (idx !== -1) this.currentMenuLinks.splice(idx, 1);
        },

        resetMenu() {
          this.currentMenuLinks = [];
        },

        scrollTop() {
          document.getElementById("menu-navigation").scrollTop = 0;
        },

        /**
         * Moves utility-bar children into the mobile toolbar.
         * In design mode, nodes are cloned to avoid breaking the editor.
         */
        moveElement() {
          const source = document.getElementById("utility-bar-mobile");
          const target = document.getElementById("main-nav-mobile-toolbar");

          if (!source || !target || target.children.length > 0) return;

          const count = source.children.length;
          for (let i = 0; i < count; i++) {
            if (Shopify.designMode) {
              target.appendChild(source.children[i].cloneNode(true));
            } else {
              target.appendChild(source.children[0]);
            }
          }
        },
      });


      /* ────────────────────────────────────────────────────────────────
       * DATA: xScrollMenu
       *
       * Two responsibilities:
       *   1. Horizontal scroll navigation for the desktop menu bar.
       *   2. Dropdown positioning for all tree-menu items.
       *
       * Positioning was previously split across N per-<li> xMenuItem
       * instances, each with its own resize + scroll listeners.
       * Now it lives here: one resize listener, one scroll listener,
       * one read pass + one write pass per reposition cycle.
       * ──────────────────────────────────────────────────────────────── */
      Alpine.data("xScrollMenu", () => ({
        // ── Scroll state ───────────────────────────────────────────
        scrollAmount: 200,
        isAtStart: true,
        isAtEnd: false,
        isScrollable: false,
        _directionFlag: 1,
        _debouncedCheck: null,

        // ── Positioning registry ───────────────────────────────────
        // Each entry: { el, level, menuItem, cachedWidth, cachedPaddingRight }
        // Populated by setPosition() x-init calls in tree-menu.liquid.
        _dropdowns: [],

        init() {
          this._directionFlag = window.Maximize.rtl ? -1 : 1;
          this._debouncedCheck = debounce(() => this.checkScroll(), 200);
          this.checkScroll();
          window.addEventListener("resize", this._debouncedCheck);

          // On resize: invalidate width caches (breakpoint may change dropdown width)
          // then reposition. Separate debounce from checkScroll to keep 200ms intact.
          window.addEventListener("resize", debounce(() => {
            this._invalidateDropdownCaches();
            this._positionAll();
          }, 300));

          // Single nav scroll listener — replaces N per-dropdown listeners.
          // Fires once per scroll event regardless of how many dropdowns exist.
          this.$nextTick(() => {
            const nav = this.$el.querySelector(".main-menu-nav");
            if (nav) {
              nav.addEventListener("scroll", () => {
                Alpine.store("xHeaderMenu").hideMenu();
                this._positionAll();
              }, { passive: true });
            }

            // After Alpine finishes all x-init registrations (which push to
            // _dropdowns synchronously), run one batch position pass.
            requestAnimationFrame(() => this._positionAll());
          });
        },

        // ── Scroll navigation ─────────────────────────────────────

        scrollLeft() {
          const menu = this.$refs.menuList;
          const rtl = window.Maximize.rtl;
          // In RTL: left button scrolls toward RTL end (leftward). Available scroll = space to the left.
          // In LTR: left button scrolls toward start. Available scroll = current scrollLeft.
          const canScrollLeft = rtl
            ? menu.scrollWidth - menu.offsetWidth - Math.abs(menu.scrollLeft)
            : menu.scrollLeft;
          const amount = Math.min(this.scrollAmount, canScrollLeft);
          menu.scrollBy({ left: -amount, behavior: "smooth" });
          this._debouncedCheck();
        },

        scrollRight() {
          const menu = this.$refs.menuList;
          const rtl = window.Maximize.rtl;
          // In RTL: right button scrolls toward RTL start (rightward). Available scroll = abs(scrollLeft).
          // In LTR: right button scrolls toward end. Available scroll = remaining content to the right.
          const canScrollRight = rtl
            ? Math.abs(menu.scrollLeft)
            : menu.scrollWidth - (menu.scrollLeft + menu.offsetWidth);
          const amount = Math.min(this.scrollAmount, canScrollRight);
          menu.scrollBy({ left: amount, behavior: "smooth" });
          this._debouncedCheck();
        },

        checkScroll() {
          if (window.innerWidth < 1023) return;

          const menu = this.$refs.menuList;
          this.isScrollable = menu.scrollWidth > menu.offsetWidth;

          if (window.Maximize.rtl) {
            const absScroll = Math.abs(menu.scrollLeft);
            // Left button (prev) disabled when no more content to the left (at RTL end).
            this.isAtStart = absScroll >= menu.scrollWidth - menu.offsetWidth - 1;
            // Right button (next) disabled when no more content to the right (at RTL start).
            this.isAtEnd = absScroll <= 1;
          } else {
            this.isAtStart = menu.scrollLeft === 0;
            this.isAtEnd = menu.scrollLeft + menu.offsetWidth >= menu.scrollWidth;
          }
        },

        // ── Dropdown positioning ──────────────────────────────────
        //
        // Called via x-init on each .toggle-menu in tree-menu.liquid.
        // Alpine resolves this method from the nearest ancestor x-data,
        // which is this xScrollMenu component on .header-container.
        // Only registers — actual positioning happens after all x-init
        // calls complete, in the $nextTick rAF above.
        setPosition(el, level) {
          const menuItem = el.closest(".menu-item");
          if (!menuItem) return;
          this._dropdowns.push({
            el,
            level,
            menuItem,
            cachedWidth: null,        // dropdown.offsetWidth — cached, invalidated on resize
            cachedPaddingRight: null, // getComputedStyle padding — cached permanently
          });
        },

        // No-op: kept for x-init API compatibility with tree-menu.liquid.
        // Resize and scroll are now handled centrally in init().
        resizeWindow() {},

        // Batch all reads then all writes — zero layout thrashing.
        //
        // Before: N dropdowns × (2× getBoundingClientRect + 1× offsetWidth
        //         + 1× getComputedStyle + 1× style write) per cycle.
        // After:  1× getBoundingClientRect (container) + N× getBoundingClientRect
        //         (items) + cached offsetWidth + cached paddingRight,
        //         all writes in a single rAF.
        _positionAll() {
          if (!this._dropdowns.length || window.innerWidth < 1023) return;

          const rtl = window.Maximize.rtl;

          // ── Read phase ─────────────────────────────────────────────────
          // Container: 1 read shared across all N items (was N reads before).
          const containerRect = this.$el.getBoundingClientRect();

          const snapshots = this._dropdowns.map(item => {
            // offsetWidth: forces reflow — cache after first read, skip on subsequent.
            if (item.cachedWidth === null) {
              item.cachedWidth = item.menuItem.getElementsByClassName("toggle-menu")[0].offsetWidth;
            }
            // getComputedStyle: forces style recalc — cache permanently (stylesheet const).
            if (rtl && item.level === 1 && item.cachedPaddingRight === null) {
              item.cachedPaddingRight = parseFloat(getComputedStyle(item.menuItem).paddingRight);
            }
            // Per-item rect: always fresh — position changes on nav-scroll and resize.
            return { item, rect: item.menuItem.getBoundingClientRect() };
          });

          // ── Write phase: deferred to next frame ────────────────────────
          // All reads are done; no DOM write has happened yet.
          // Deferring to rAF prevents reads in this frame from being
          // invalidated by writes and forcing a second layout computation.
          requestAnimationFrame(() => {
            for (const { item, rect } of snapshots) {
              const space = rtl
                ? rect.right - containerRect.left - item.cachedWidth * item.level
                : containerRect.right - rect.left - item.cachedWidth * item.level;

              if (item.level === 1) {
                if (rtl) {
                  item.el.style.right = space < 0
                    ? `${containerRect.right - rect.right + space}px`
                    : `${containerRect.right - rect.right - item.cachedPaddingRight}px`;
                } else {
                  item.el.style.left = space < 0
                    ? `${rect.left - containerRect.left + space}px`
                    : `${rect.left - containerRect.left}px`;
                }
              } else {
                // Direct classList — no Alpine reactive cycle, no re-render tick.
                item.menuItem.classList.toggle("position-left", rtl ? space >= 0 : space < 0);
              }
            }
          });
        },

        _invalidateDropdownCaches() {
          for (const item of this._dropdowns) {
            item.cachedWidth = null;
            // cachedPaddingRight is a stylesheet constant — never invalidated.
          }
        },
      }));



      /* ────────────────────────────────────────────────────────────────
       * DATA: xFirstLoadItem
       *
       * Lazy-initializes menu items on first interaction.
       * ──────────────────────────────────────────────────────────────── */
      Alpine.data("xFirstLoadItem", () => ({
        isLoaded: false,

        firstLoad() {
          if (window.innerWidth >= 1023 && !this.isLoaded) this.isLoaded = true;
        },

        handleTouch(el) {
          if (el.dataset.touchItemEvent) return;

          el.dataset.touchItemEvent = "true";
          el.addEventListener("touchend", () => this.firstLoad());
        },
      }));


      /* ────────────────────────────────────────────────────────────────
       * STORE: xDrawerMenu
       *
       * Controls the desktop drawer-style mega menu panels.
       * ──────────────────────────────────────────────────────────────── */
      Alpine.store("xDrawerMenu", {
        menuOpen: null,

        handleMenuToggle(sectionId) {
          const header = Alpine.store("xHeaderMenu");
          const drawer = Alpine.store("xMaximizeDrawer");

          if (this.menuOpen === sectionId) {
            // Close current
            header.hideMenu(this.menuOpen);
            this.menuOpen = false;
            drawer.handleClose();
          } else {
            // Close previous, open new
            header.hideMenu("first-menu-item");
            if (this.menuOpen) header.hideMenu(this.menuOpen);

            this.menuOpen = sectionId;
            drawer.handleOpen(`#Section-${sectionId}`);
          }
        },

        handleCloseMenu(sectionId) {
          if (!this.menuOpen) return;

          this.menuOpen = null;
          Alpine.store("xMaximizeDrawer").handleClose();
          Alpine.store("xHeaderMenu").hideMenu(sectionId);
        },
      });
      Alpine.data("animationHover", () => ({
        isHovered: false,
        directionTranslate: null,
        getDirection(event) {
          const { top, height } = this.$el.getBoundingClientRect();
          return event.clientY - top > height / 2;
        },

        leave(toBottom) {
          this.directionTranslate = toBottom ? "translateY(101%)" : "translateY(-101%)";
          this.isHovered = false;
        },

        handleEnter() {
          this.isHovered = true;
        },

        handleLeave(event) {
          this.isHovered = false;
          this.leave(this.getDirection(event));
        },
      }));

    }); // alpine:init
  }); // rAF
} // loadedScript guard
