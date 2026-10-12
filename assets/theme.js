// =============================================================================
// Lazy Alpine Initialization for below-fold sections
// MUST run first — theme.js is defer-loaded before vendors.js (Alpine), so
// x-ignore must be stamped onto below-fold sections before Alpine walks the DOM.
// Moving this to the top of the file maximises the time gap between marking and
// Alpine's startup walk, eliminating any risk of a race condition.
// =============================================================================
(function setupAlpineLazyInit() {
  if (typeof Shopify !== 'undefined' && Shopify.designMode) return;

  let viewportH = window.innerHeight;

  // Mark all Alpine sections that start completely below the initial viewport.
  // Batch pattern: Pass 1 collects all rects (single reflow), Pass 2 writes
  // attributes (single style invalidation) — avoids N reflows before LCP.
  let lazyToMark = [];
  document.querySelectorAll('.shopify-section').forEach(function(section) {
    if (!section.querySelector('[x-data],[x-show],[x-bind],[x-on],[x-intersect],[x-transition],[data-fade-on-intersect],[x-cloak]')) return;
    let rect = section.getBoundingClientRect(); // Pass 1: read only
    if (rect.top >= viewportH) lazyToMark.push(section);
  });
  lazyToMark.forEach(function(section) {        // Pass 2: write only
    section.setAttribute('x-ignore', '');
    section.setAttribute('data-alpine-lazy', '');
  });

  // After Alpine finishes above-fold sections, lazily init the rest on scroll
  document.addEventListener('alpine:initialized', function() {
    let lazyEls = document.querySelectorAll('[data-alpine-lazy]');
    if (!lazyEls.length) return;

    let sectionObserver = new IntersectionObserver(function(entries, obs) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        let el = entry.target;
        obs.unobserve(el);
        el.removeAttribute('x-ignore');
        // CRITICAL: Alpine sets el._x_ignore as a JS *property* (not just the
        // HTML attribute) during its initial startup walk. Removing the attribute
        // alone is not enough — the property must also be deleted, otherwise:
        //   1. initTree's walk skips ALL children  (r._x_ignore && skip())
        //   2. Directive handlers bail out early    (e._x_ignore || return)
        //   → x-data scope never created, x-intersect / $store.* never run.
        delete el._x_ignore;
        // Add a root x-data scope so ALL Alpine magic ($store.*, $el, $refs)
        // works on any descendant directive without individual x-data per element.
        if (!el.hasAttribute('x-data')) el.setAttribute('x-data', '{}');
        Alpine.initTree(el);
        // Register any new data-fade-on-intersect elements revealed by Alpine
        if (window._fadeObserver) window._fadeObserver.observe(el);
      });
    }, { rootMargin: '300px 0px' }); // init 300px before visible to avoid pop-in

    lazyEls.forEach(function(el) { sectionObserver.observe(el); });
  });
})();

const installMediaQueryWatcher = (mediaQuery, changedCallback) => {
  const mq = window.matchMedia(mediaQuery);
  mq.addEventListener("change", (e) => changedCallback(e.matches));
  changedCallback(mq.matches);
};

const deferScriptLoad = (name, src, onload, requestVisualChange = false) => {
  ((events) => {
    const loadScript = () => {
      events.forEach((type) => window.removeEventListener(type, loadScript));
      clearTimeout(autoloadScript);

      const initScript = () => {
        const script = document.createElement("script");
        script.setAttribute("src", src);
        script.setAttribute("defer", "");
        script.onload = () => {
          window.Maximize.loadedScript.push(name);
          document.dispatchEvent(new CustomEvent(name + " loaded"));
          onload();
        };

        document.head.appendChild(script);
      };

      if (requestVisualChange) {
        if (window.requestIdleCallback) {
          requestIdleCallback(initScript);
        } else {
          requestAnimationFrame(initScript);
        }
      } else {
        initScript();
      }
    };

    let autoloadScript;
    if (Shopify.designMode) {
      loadScript();
    } else {
      const wait = window.innerWidth >= MIN_DEVICE_WIDTH.tablet ? 2000 : 5000;
      events.forEach((type) => window.addEventListener(type, loadScript, {once: true, passive: true}));
      autoloadScript = setTimeout(() => {
        loadScript();
      }, wait);
    }
  })(["touchstart", "mouseover", "wheel", "scroll", "keydown"]);
};

const getSectionInnerHTML = (html, selector = ".shopify-section") => {
  return new DOMParser().parseFromString(html, "text/html").querySelector(selector)?.innerHTML;
};

const xParseJSON = (jsonString) => {
  jsonString = String.raw`${jsonString}`;
  jsonString = jsonString.replaceAll("\\", "\\\\").replaceAll('\\"', '"');

  return JSON.parse(jsonString);
};

requestAnimationFrame(() => {
  document.addEventListener("alpine:init", () => {
    Alpine.store("xDarkMode", {
      isToggling: false,
      toggleThemeMode() {
        if (this.isToggling) return;
        this.isToggling = true;

        requestAnimationFrame(() => {
          document.documentElement.classList.add("show-icon-toggle-loading");
          requestAnimationFrame(() => {
            document.documentElement.classList.add("disable-transition-effect");

            const isDark = document.documentElement.classList.contains("dark")
            localStorage.maximize_theme = isDark ? 0 : 1;
            document.documentElement.classList.toggle("dark", !isDark);

            document.documentElement.classList.remove("show-icon-toggle-loading");
            requestAnimationFrame(() => {
              document.documentElement.classList.remove("disable-transition-effect");
              this.isToggling = false;
            })
          })
        })
      },
    });

    Alpine.store("xHelper", {
      countdown(configs, callback) {
        let endDate = new Date(configs.end_year, configs.end_month - 1, configs.end_day, configs.end_hour, configs.end_minute);
        const endTime = endDate.getTime() + (-1 * configs.timezone * 60 - endDate.getTimezoneOffset()) * 60 * 1000;

        let startTime;
        if (configs.start_year) {
          let startDate = new Date(configs.start_year, configs.start_month - 1, configs.start_day, configs.start_hour, configs.start_minute);
          startTime = startDate.getTime() + (-1 * configs.timezone * 60 - startDate.getTimezoneOffset()) * 60 * 1000;
        } else {
          startTime = new Date().getTime();
        }

        let x = setInterval(function () {
          let now = new Date().getTime();
          let distance = endTime - now;

          if (distance < 0 || startTime > now) {
            callback(false, 0, 0, 0, 0);
            clearInterval(x);
          } else {
            let days = Math.floor(distance / (1000 * 60 * 60 * 24));
            let hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            let minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            let seconds = Math.floor((distance % (1000 * 60)) / 1000);
            minutes = minutes < 10 ? "0" + minutes : minutes;
            seconds = seconds < 10 ? "0" + seconds : seconds;

            callback(true, seconds, minutes, hours, days);
          }
        }, 1000);
      },
      countdownByTime(startTime = Date.now(), endTime, callback) {
        const x = setInterval(() => {
        const now = Date.now();
        const distance = endTime - now;

        if (distance < 0 || startTime > now) {
          callback(false, 0, 0, 0, 0);
          clearInterval(x);
          return;
        }

        const days = Math.floor(distance / MS_PER_DAY);
        const hours = Math.floor(
          (distance % MS_PER_DAY) / MS_PER_HOUR
        );
        let minutes = Math.floor(
          (distance % MS_PER_HOUR) / MS_PER_MINUTE
        );
        let seconds = Math.floor(
          (distance % MS_PER_MINUTE) / MS_PER_SECOND
        );

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

          callback(true, seconds, minutes, hours, days);
        }, 1000);
      },
      canShow(configs) {
        let endDate = new Date(configs.end_year, configs.end_month - 1, configs.end_day, configs.end_hour, configs.end_minute);
        const endTime = endDate.getTime() + (-1 * configs.timezone * 60 - endDate.getTimezoneOffset()) * 60 * 1000;

        let startTime;
        if (configs.start_year) {
          let startDate = new Date(configs.start_year, configs.start_month - 1, configs.start_day, configs.start_hour, configs.start_minute);
          startTime = startDate.getTime() + (-1 * configs.timezone * 60 - startDate.getTimezoneOffset()) * 60 * 1000;
        } else {
          startTime = new Date().getTime();
        }
        let now = new Date().getTime();
        let distance = endTime - now;
        if (distance < 0 || startTime > now) {
          return false;
        }
        return true;
      },
      handleTime(configs) {
        let endDate = new Date(configs.end_year, configs.end_month - 1, configs.end_day, configs.end_hour, configs.end_minute);
        const endTime = endDate.getTime() + (-1 * configs.timezone * 60 - endDate.getTimezoneOffset()) * 60 * 1000;

        let startTime;
        if (configs.start_year) {
          let startDate = new Date(configs.start_year, configs.start_month - 1, configs.start_day, configs.start_hour, configs.start_minute);
          startTime = startDate.getTime() + (-1 * configs.timezone * 60 - startDate.getTimezoneOffset()) * 60 * 1000;
        } else {
          startTime = new Date().getTime();
        }
        let now = new Date().getTime();
        let distance = endTime - now;
        return {"startTime": startTime, "endTime": endTime, "now": now, "distance": distance};
      },
      setPosition(destinationId, elementId, needRemove = false) {
        let destinationElem = document.querySelector(destinationId);
        let movedElem = document.querySelector(elementId);
        if (destinationElem && movedElem) {
          destinationElem.innerHTML = movedElem.innerHTML;

          if (needRemove) {
            movedElem.remove();
          }

          // Re-observe fade elements. The source elements in #side-bar-template
          // were observed by MutationObserver while the div was hidden, so they
          // already carry data-fade-observed="1" serialised into their HTML.
          // innerHTML copy preserves that attribute, causing observeAll() to skip
          // them. Strip the stale guard first so the IntersectionObserver can bind.
          if (window._fadeObserver) {
            destinationElem.querySelectorAll('[data-fade-on-intersect]').forEach(function(el) {
              el.removeAttribute('data-fade-observed');
            });
            window._fadeObserver.observe(destinationElem);
          }
          const resizeEvent = new CustomEvent('resize');
          window.dispatchEvent(resizeEvent);
        }
      },
      dragToScroll(el, checkCanDrag = false) {
        const container = el;
        let isDragging = false;
        let startX;
        let scrollLeft;
        let canDrag = true;
        if (container) {
          container.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.pageX - container.offsetLeft;
            scrollLeft = container.scrollLeft;
          });

          container.addEventListener('mousemove', (e) => {
            if (!isDragging || !canDrag) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const walk = x - startX;
            container.scrollLeft = scrollLeft - walk;
            requestAnimationFrame(() => {
              if (Math.abs(walk) > THRESHOLD.startScroll) {
                container.dataset.dragStartedScroll = "true";
              }
            });
          });

          container.addEventListener('mouseup', () => {
            if (!canDrag) return;
            isDragging = false;
            requestAnimationFrame(() => {
              container.removeAttribute("data-drag-started-scroll");
            })
          });

          container.addEventListener('mouseleave', () => {
            if (isDragging) {
              isDragging = false;
            }
          });

          if (checkCanDrag) {
            const updateCursorContainer = () => {
              if (container.scrollWidth > container.clientWidth) {
                container.classList.add('cursor-grab', 'select-none');
                canDrag = true;
              } else {
                container.classList.remove('cursor-grab', 'select-none');
                canDrag = false;
              }
            }

            updateCursorContainer();

            window.addEventListener('resize', debounce(() => {
              updateCursorContainer();
            }, TIMEOUT.resize));
          }
        }
      }
    });

    Alpine.data("xScrollNav", () => ({
      isRtl: window.Maximize.rtl,
      linkList: "",
      show: false,
      isAtStart: true,
      isAtEnd: false,
      navContentEl: null,
      navContentWidth: 0,
      navButtonWidth: 0,
      activeIndex: 0,
      __debounce(func, wait) {
        let timeout;
        return function (...args) {
          clearTimeout(timeout);
          timeout = setTimeout(() => func.apply(this, args), wait);
        };
      },
      init() {
        this.linkList = this.$el.querySelector(".link-list");
        this.linkList.addEventListener("scroll", () => {
          this.__debounce(this.checkScroll(), 20);
        })
        this.navContentEl = this.linkList.closest(".nav-content");
        this.navContentWidth = this.navContentEl.offsetWidth;

        const navButtons = this.$el.getElementsByClassName('scroll-nav');
        Alpine.nextTick(() => {
          const updateNavButtonWidth = () => {
            this.navButtonWidth = 0;
            Array.from(navButtons).forEach((button) => {
              if (this.navButtonWidth == 0) {
                this.navButtonWidth = button.getBoundingClientRect().width;
              }
            })
          }

          installMediaQueryWatcher(`(min-width: ${MIN_DEVICE_WIDTH.tablet}px)`, updateNavButtonWidth);

        })

        this.checkNavIsOverflow();

        // Re-check when element scrolls into view (handles off-screen init where offsetWidth = 0)
        let _self = this;
        let _visObs = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (entry.isIntersecting) {
              _self.checkNavIsOverflow();
              _visObs.unobserve(entry.target);
            }
          });
        });
        _visObs.observe(this.$el);

        window.addEventListener("resize", () => {
          this.__debounce(this.checkNavIsOverflow(), 300);
          this.__debounce(this.checkScroll(), 20);
        });
      },
      checkNavIsOverflow() {
        this.navContentWidth = this.navContentEl.offsetWidth;
        if (this.linkList.scrollWidth > this.navContentWidth) {
          this.show = true;
        } else {
          this.show = false;
        }
      },
      scrollToLeft() {
        const multiplier = (window.innerWidth < MIN_DEVICE_WIDTH.tablet) ? 0.5 : 0.3
        this.linkList.scroll({
          top: 0,
          left: this.linkList.scrollLeft - (this.isRtl ? -(this.navContentWidth * multiplier) : (this.navContentWidth * multiplier)),
          behavior: "smooth",
        });
        this.checkScroll();
      },
      scrollToRight() {
        const multiplier = (window.innerWidth < MIN_DEVICE_WIDTH.tablet) ? 0.5 : 0.3
        this.linkList.scroll({
          top: 0,
          left: this.linkList.scrollLeft + (this.isRtl ? -(this.navContentWidth * multiplier) : (this.navContentWidth * multiplier)),
          behavior: "smooth",
        });
        this.checkScroll();
      },
      checkScroll() {
        //Delay to wait for scroll animation
        setTimeout(() => {
          const {scrollWidth, offsetWidth, scrollLeft} = this.linkList;
          this.isScrollable = scrollWidth > offsetWidth;

          const endOffset = scrollWidth - offsetWidth;

          if (this.isRtl) {
            this.isAtStart = Math.abs(scrollLeft) <= 1;
            this.isAtEnd = Math.abs(scrollLeft) >= endOffset - 2;
          } else {
            this.isAtStart = scrollLeft <= 1;
            this.isAtEnd = scrollLeft + offsetWidth >= scrollWidth - 2;
          }
        }, 300);
      },
      scrollToActiveItem(activeItem, hasEdgeGap) {
        const activeChild = activeItem || this.linkList.querySelector('.block-text-button__wrapper.is-active');
        if (!activeChild) return;

        const childRect = activeChild.getBoundingClientRect();
        const linkListRect = this.linkList.getBoundingClientRect();

        let offsetLeft = this.linkList.scrollLeft;
        if (this.isRtl) {
          offsetLeft += (childRect.right - linkListRect.right);
        } else {
          offsetLeft += (childRect.left - linkListRect.left);
        }

        if (hasEdgeGap && this.navButtonWidth) {
          offsetLeft += (this.navButtonWidth * 2) * (this.isRtl ? 1 : -1);
        }

        this.linkList.scroll({
          left: offsetLeft,
          behavior: 'smooth'
        });
        this.checkScroll();
      },
     
    }));

    Alpine.store("xMaximizePopup", {
      isOpen: false,
      handleOpen: function (activeElement, forceOverflowHidden = false) {
        this.isOpen = true;
        if (forceOverflowHidden || window.Maximize.isShowPopupOverlay) document.body.classList.add("overflow-y-hidden");
        if (activeElement) {
          setTimeout(() => {
            document.querySelector(`${activeElement}`)?.focus();
          }, 500)
        }
      },
      handleClose: function (forceOverflowHidden = false) {
        Alpine.store('xFocusElement').removeTrapFocus();
        setTimeout(() => {
          this.isOpen = false;
          if (forceOverflowHidden || window.Maximize.isShowPopupOverlay) document.body.classList.remove("overflow-y-hidden");
        }, 500);
      }
    })

    Alpine.store("xMaximizeDrawer", {
      isOpen: false,
      activeDrawerElement: false,
      durationTime: 0,
      drawerCloseElement: false,
      handleOpen: function (drawerContainer) {
        const drawerContainerEle = document.querySelector(drawerContainer);
        if (drawerContainerEle) {
          this.activeDrawerElement = drawerContainerEle;
          this.durationTime = DURATION.DRAWER_TRANSITION;
          drawerContainerEle.classList.add("is-open")
          this.isOpen = true;
          document.body.classList.add("overflow-y-hidden");
        }

        if (!this.drawerCloseElement) {
          this.drawerCloseElement = this.activeDrawerElement;
        }
      },
      handleClose: function (isCloseAllDrawer = true) {
        Alpine.store('xFocusElement').removeTrapFocus();
        this.isOpen = false;
        if (this.activeDrawerElement) {
          this.activeDrawerElement.classList.remove("is-open");
        }
        if (isCloseAllDrawer) {
          setTimeout(() => {
            if (this.activeDrawerElement ===  this.drawerCloseElement || !this.activeDrawerElement) {
              document.body.classList.remove("overflow-y-hidden");
              this.drawerCloseElement = false;
            } else {
              this.drawerCloseElement = this.activeDrawerElement;
            }
            this.activeDrawerElement = false;
          }, this.durationTime);
        } else {
          // Closing a nested drawer (e.g. size chart) without closing the parent (e.g. quick view).
          // Reset activeDrawerElement back to drawerCloseElement so the next handleClose(true)
          // correctly identifies it as the root drawer and removes overflow-y-hidden.
          this.activeDrawerElement = this.drawerCloseElement;
        }
      }
    })

    Alpine.store("xFocusElement", {
      focusableElements: ['button, [href], input:not([hidden]), select, textarea, [tabindex]:not([tabindex^="-"]), a:not([aria-disabled="true"])'],
      listeners: {},
      activeElement: null,
      isFocusable(el) {
        if (!el) return false;

        const style = getComputedStyle(el);

        if (!el.offsetParent || style.visibility === 'hidden' || style.display === 'none') {
          return false;
        }

        const tabindex = el.getAttribute('tabindex');
        if (tabindex !== null && parseInt(tabindex, 10) === -1) {
          return false;
        }

        return true;
      },
      trapFocus(containerSelector, elementFocusSelector) {
        const container = document.getElementById(containerSelector);
        const elementFocus = document.getElementById(elementFocusSelector);
        if (document.activeElement !== document.body && !container.contains(document.activeElement)) {
          this.activeElement = document.activeElement;
        }
        this.listeners = this.listeners || {};
        if (container) {
          const elements = Array.from(container.querySelectorAll(this.focusableElements));

          let firstEl = null;
          let lastEl = null;

          for (let i = 0; i <= elements.length - 1; i++) {
            if (this.isFocusable(elements[i])) {
              firstEl = elements[i];
              break;
            }
          }

          for (let i = elements.length - 1; i >= 0; i--) {
            if (this.isFocusable(elements[i])) {
              lastEl = elements[i];
              break;
            }
          }
          this.removeTrapFocus();

          this.listeners.focusin = (event) => {
            if (event.target !== container && event.target !== lastEl && event.target !== firstEl) {
              return;
            }
            document.addEventListener("keydown", this.listeners.keydown);
          };

          this.listeners.focusout = () => {
            document.removeEventListener("keydown", this.listeners.keydown);
          };

          this.listeners.keydown = (e) => {
            if (e.code.toUpperCase() !== "TAB") return;

            if (e.target === lastEl && !e.shiftKey) {
              e.preventDefault();
              firstEl.focus();
            }

            if ((e.target === firstEl || e.target == container) && e.shiftKey) {
              e.preventDefault();
              lastEl.focus();
            }
          };
          document.addEventListener("focusout", this.listeners.focusout);
          document.addEventListener("focusin", this.listeners.focusin);
          elementFocus?.focus();
        }
      },
      removeTrapFocus(elementToFocus = null) {
        document.removeEventListener("focusin", this.listeners.focusin);
        document.removeEventListener("focusout", this.listeners.focusout);
        document.removeEventListener("keydown", this.listeners.keydown);

        if (elementToFocus) {
          elementToFocus.focus();
        } else {
          this.activeElement?.focus();
        }
      }
    });

    Alpine.data('xTruncateText', () => ({
      truncateEl: "",
      truncateInnerEl: "",
      truncated: false,
      truncatable: false,
      label: "",
      expanded: false,
      load(truncateEl) {
        const truncateRect = truncateEl.getBoundingClientRect();
        truncateEl.style.setProperty("--truncate-height", `${truncateRect.height}px`);
      },
      setTruncate(element) {
        if (element.offsetHeight < element.scrollHeight || element.offsetWidth < element.scrollWidth) {
          this.truncated = true;
          this.truncatable = true;
          this.expanded = false;
        } else {
          this.truncated = false;
          this.truncatable = false
          this.expanded = true;
          ;
        }
      },
      open(el, newLabel) {
        const truncateEl = el.closest('.truncate-container').querySelector('.truncate-text');
        this.expanded = true;
        this.label = newLabel;
        if (truncateEl.classList.contains('truncate-expanded')) {
          this.truncated = true;
        } else {
          const truncateInnerEl = truncateEl.querySelector('.truncate-inner');
          window.requestAnimationFrame(() => {
            const truncateInnerRect = truncateInnerEl.getBoundingClientRect();
            truncateEl.style.setProperty("--truncate-height-expanded", `${truncateInnerRect.height}px`);
            truncateEl.classList.add('truncate-expanded');
          });
          this.truncated = false;
        }
      },
      close(el, newLabel, isPopup = false) {
        this.label = newLabel;
        const truncateEl = el.closest('.truncate-container').querySelector('.truncate-text');
        const isInViewport = () => {
          const rect = truncateEl.getBoundingClientRect();
          return (rect.top >= 0 && rect.left >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && rect.right <= (window.innerWidth || document.documentElement.clientWidth))
        }
        this.truncated = true;
        if (!isInViewport()) {
          if (!isPopup) {
            const scrollPosition = truncateEl.getBoundingClientRect().top + window.scrollY - 100;
            window.scrollTo({
              top: scrollPosition,
              behavior: 'smooth'
            });
          } else {
            const drawerContent = el.closest('.drawer__content');
            const scrollPosition = truncateEl.getBoundingClientRect().top + drawerContent.scrollTop - 100;
            drawerContent.scrollTo({
              top: scrollPosition,
              behavior: 'smooth'
            });
          }
          truncateEl.style.transition = 'none'
          setTimeout(() => {
            truncateEl.style.transition = ''
          }, 1000)
        }
        truncateEl.classList.remove('truncate-expanded');
        this.expanded = false;
      }
    }));
  });
});

// Shared quantity-rules helpers (Shopify B2B min/max/increment). Rule values are
// seeded from Liquid (variant.quantity_rule) and passed into the components; JS
// only owns the clamp/snap/validate math and message interpolation.
const quantityRuleUtils = {
  get strings() {
    return (window.Maximize && window.Maximize.quantityRuleStrings) || {};
  },
  // [min, max, increment] to seed a rule from a variant object, spread into setRule().
  // A missing variant means the shopper picked an option combination that does not
  // exist (no rule) → default. A SOLD-OUT variant still exists and carries a real
  // quantity_rule, so honor it (seed its min) rather than collapsing to 1 — only the
  // absence of a rule falls back to the default (increment 1).
  ruleArgsForVariant(variant) {
    const qr = variant && variant.quantity_rule;
    if (!qr) return [1, null, 1];
    return [qr.min, qr.max, qr.increment];
  },
  normalizeRule(min, max, increment) {
    if (!window.Maximize.isB2BCustomer) return {min: 1, max: null, increment: 1};
    let m = parseInt(min);
    let inc = parseInt(increment);
    if (!Number.isInteger(m) || m < 1) m = 1;
    if (!Number.isInteger(inc) || inc < 1) inc = 1;
    // Shopify semantics: the quantity must be a MULTIPLE of increment (not an
    // offset from min), so align min up / max down to the increment grid. All
    // grid math below anchors at min, which is grid-aligned from here on.
    m = Math.ceil(m / inc) * inc;
    let mx = parseInt(max);
    if (max === null || max === undefined || max === '' || max === 'null' || !Number.isInteger(mx)) {
      mx = null;
    }
    if (mx !== null) mx = Math.floor(mx / inc) * inc;
    if (mx !== null && mx < m) mx = m;
    return {min: m, max: mx, increment: inc};
  },
  roundToIncrement(value, rule) {
    const {min, max, increment} = rule;
    if (increment <= 1) {
      let v = value < min ? min : value;
      if (max !== null && v > max) v = max;
      return v;
    }
    let snapped = min + Math.round((value - min) / increment) * increment;
    if (snapped < min) snapped = min;
    if (max !== null && snapped > max) {
      snapped = min + Math.floor((max - min) / increment) * increment;
    }
    return snapped;
  },
  normalizeQuantity(value, rule) {
    let v = parseInt(value);
    if (!Number.isInteger(v)) v = rule.min;
    if (v < rule.min) return rule.min;
    return this.roundToIncrement(v, rule);
  },
  // Step the quantity by one increment in the given direction (+1 / -1). A valid
  // value moves a full increment; an off-grid value snaps to the nearest valid
  // value IN the pressed direction. The result is clamped to [min, max].
  step(value, rule, direction) {
    const v = parseInt(value);
    if (!Number.isInteger(v)) return rule.min;
    let next;
    if (this.isValid(v, rule)) {
      next = v + direction * rule.increment;
    } else {
      const offset = (v - rule.min) / rule.increment;
      next = rule.min + (direction > 0 ? Math.ceil(offset) : Math.floor(offset)) * rule.increment;
    }
    if (next < rule.min) next = rule.min;
    if (rule.max !== null && next > rule.max) next = rule.max;
    return next;
  },
  isValid(value, rule) {
    const v = parseInt(value);
    if (!Number.isInteger(v)) return false;
    if (v < rule.min) return false;
    if (rule.max !== null && v > rule.max) return false;
    return (v - rule.min) % rule.increment === 0;
  },
  buildError(value, rule) {
    const s = this.strings;
    const v = parseInt(value);
    if (!Number.isInteger(v) || v < rule.min) {
      return (s.min || '').replace('[min]', rule.min);
    }
    if (rule.max !== null && v > rule.max) {
      return (s.max || '').replace('[max]', rule.max);
    }
    const lower = rule.min + Math.floor((v - rule.min) / rule.increment) * rule.increment;
    let upper = lower + rule.increment;
    if (rule.max !== null && upper > rule.max) upper = rule.max;
    return (s.step || '').replace('[lower]', lower).replace('[upper]', upper);
  },
  // Leaving the field commits a valid quantity: snap onto the rule's grid, then say WHY the
  // number changed. Only the focus-stealing half of the old blur handler was harmful — it
  // re-focused the input so a click on any other button never landed on its target. The
  // message itself never was, and dropping it left the quantity silently rewritten with no
  // explanation. Same shape as the cart and bulk-order handlers (_addQtyError / _setQtyError):
  // correct the value, show the reason, auto-hide. Nothing here moves focus.
  normalizeOnLeave(component, el) {
    const rule = component.rule;
    if (this.isValid(el.value, rule)) {
      component.__emitQuantityError('');
      return;
    }
    const message = this.buildError(el.value, rule); // build from the typed value, then correct it
    const snapped = this.normalizeQuantity(el.value, rule);
    component.qty = snapped;
    if (el.value !== String(snapped)) el.value = snapped;
    this.__emitErrorTimed(component, message);
  },
  // Correcting qty makes it valid, so the component's own qty watcher emits '' during Alpine's
  // reactive flush — emit after $nextTick so the message survives that, then auto-hide it the
  // way the cart's _addQtyError(…, autoHideMs) does. A newer emit cancels the pending hide via
  // the clearTimeout in __emitQuantityError.
  __emitErrorTimed(component, message, autoHideMs = 3000) {
    component.$nextTick(() => {
      component.__emitQuantityError(message);
      component.__errorHideTimer = setTimeout(() => component.__emitQuantityError(''), autoHideMs);
    });
  },
  // Explicit commit (Enter, or pressing Add to cart): report why the quantity is not
  // orderable and leave the typed value alone so the shopper can see what they entered.
  // Returns whether the value was valid.
  validateNow(component, el) {
    const rule = component.rule;
    if (this.isValid(el.value, rule)) {
      component.__emitQuantityError('');
      return true;
    }
    component.__emitQuantityError(this.buildError(el.value, rule));
    return false;
  },
  // Unit price for a quantity, given Shopify's price breaks: the discounted tier whose minimum the
  // quantity actually reaches, or the variant's own price below the first tier. For prices that are
  // built client-side (the product bundle summary) — everywhere the server can pre-render the
  // readings, showPriceTier below is preferred so Liquid keeps ownership of money formatting.
  // `priceBreaks` is the shape emitted into JSON by the Liquid snippets: [{minimumQuantity, price}].
  priceForQuantity(basePrice, priceBreaks, qty) {
    if (!Array.isArray(priceBreaks) || !priceBreaks.length) return basePrice;
    const quantity = parseInt(qty);
    if (!Number.isInteger(quantity)) return basePrice;

    let price = basePrice;
    let bestMin = -1;
    priceBreaks.forEach((priceBreak) => {
      const min = parseInt(priceBreak && priceBreak.minimumQuantity);
      if (!Number.isInteger(min) || min > quantity) return;
      if (min > bestMin) {
        bestMin = min;
        price = priceBreak.price;
      }
    });
    return price;
  },
  // Volume pricing: price.liquid renders one price reading per tier — every one of them, with
  // the tier's own compare-at price, discount percentage and sale label already resolved by
  // Liquid. All this does is reveal the reading that matches `qty` (the highest tier whose
  // minimum quantity it reaches) and hide the rest, so no money formatting or discount maths
  // is duplicated in JS.
  // One group can hold SEVERAL renderings of the same price — the sticky bar renders three
  // (mobile, desktop, mobile-expanded) and CSS shows whichever fits the viewport. Each one
  // therefore needs its own visible tier: resolving a single winner across the whole group left
  // the other renderings with every tier hidden, and the price vanished at those breakpoints.
  showPriceTier(containers, qty) {
    if (!containers || !containers.length) return;
    const quantity = parseInt(qty);

    containers.forEach((container) => {
      const tiers = container.querySelectorAll('[data-price-tier]');
      if (!tiers.length) return;

      let active = null;
      if (Number.isInteger(quantity)) {
        let activeMin = -1;
        tiers.forEach((tier) => {
          const min = parseInt(tier.dataset.priceTier);
          if (!Number.isInteger(min) || min > quantity) return;
          if (min > activeMin) {
            activeMin = min;
            active = tier;
          }
        });
      }
      // No tier reached (a blank quantity, or a rule minimum sitting below the first tier): the
      // cheapest tier still describes the price better than showing nothing at all.
      if (!active) active = tiers[0];

      tiers.forEach((tier) => {
        tier.hidden = tier !== active;
      });
    });
  },
};

requestAnimationFrame(() => {
  document.addEventListener("alpine:init", () => {
    Alpine.data("xQuantitySelector", (sectionId, currentVariantId, productUrl, isQtyPriceBreak = false, min = 1, max = null, increment = 1, errorScope = "") => {
      const initialRule = quantityRuleUtils.normalizeRule(min, max, increment);
      return {
        qty: initialRule.min,
        min: initialRule.min,
        max: initialRule.max,
        increment: initialRule.increment,
        currentVariantId: currentVariantId,
        get rule() {
          return { min: this.min, max: this.max, increment: this.increment };
        },
        get atMin() {
          const q = parseInt(this.qty, 10);
          return Number.isInteger(q) && q <= this.min;
        },
        get atMax() {
          if (this.max === null) return false;
          const q = parseInt(this.qty, 10);
          return Number.isInteger(q) && q >= this.max;
        },
        setRule(m, mx, inc) {
          const r = quantityRuleUtils.normalizeRule(m, mx, inc);
          this.min = r.min;
          this.max = r.max;
          this.increment = r.increment;
        },
        // Alpine calls this automatically for every consumer, which is the point: the sticky bar
        // wires its own `x-init` expression and never calls handleInit(), so anything parked in
        // there — the qty watcher included — simply never ran for it, and its price sat on the base
        // tier no matter what the quantity was. Keep this to what EVERY quantity selector needs.
        init() {
          this.$watch("qty", (newValue) => {
            if (this.$refs.quantity_input) {
              this.$refs.quantity_input.value = newValue;
            }
            if (window.Maximize.isB2BCustomer && quantityRuleUtils.isValid(newValue, this.rule)) {
              this.__emitQuantityError("");
            }
            this.__syncPriceToQuantity(newValue);
          });

          this.__syncPriceToQuantity(this.qty);
        },
        handleInit() {
          const inputValue = this.$refs.quantity_input && this.$refs.quantity_input.value;
          const parsedInput = parseInt(inputValue);
          this.qty = quantityRuleUtils.isValid(parsedInput, this.rule) ? parsedInput : this.min;

          document.addEventListener(`${PRODUCT_EVENT.updatedVariant}${sectionId}`, (event) => {
            const { currentVariant } = event.detail;

            if (currentVariant && currentVariant.id) {
              this.currentVariantId = currentVariant.id;
            }

            if (window.Maximize.isB2BCustomer) {
              // An unavailable option combination has no purchasable variant, so it has no
              // quantity rule either: fall back to the default rule instead of leaving the
              // previous variant's min/increment in the box.
              this.setRule(...quantityRuleUtils.ruleArgsForVariant(currentVariant));
            }

            if (this.$refs.quantity_input) {
              this.$refs.quantity_input.value = this.min;
            }

            this.qty = this.min;
          });

          document.addEventListener(`${CART_EVENT.cartUpdate}`, () => {
            fetch(`${productUrl}?variant=${this.currentVariantId}&section_id=${sectionId}`)
              .then((response) => response.text())
              .then((responseText) => {
                const html = new DOMParser().parseFromString(responseText, "text/html");
                const oldElement = document.querySelector(`.section--${sectionId} .quantity-selector__quantity-in-cart[data-current-variant-id="${this.currentVariantId}"]`);
                const newElement = html.querySelector(`.section--${sectionId} .quantity-selector__quantity-in-cart[data-current-variant-id="${this.currentVariantId}"]`);

                if (oldElement && newElement) {
                  oldElement.innerHTML = newElement.innerHTML;
                }
              })
              .catch((e) => console.error(e));
          });

          if (isQtyPriceBreak) {
            // Picking a tier only sets the quantity — no scrolling. The shopper clicked a row in
            // the volume-pricing table and is looking at it; yanking the viewport to the quantity
            // box moves the thing they just clicked out from under them.
            document.addEventListener(`QUANTITY_EVENT.volumnPricingChange-${sectionId}`, (event) => {
              this.qty = quantityRuleUtils.normalizeQuantity(event.detail.quantity, this.rule);
            });
          }
        },
        // Reveal the price reading for the current quantity. Runs on every qty change and once
        // on init; a variant change re-renders the price server-side and then resets qty to the
        // new rule's minimum, which comes back through the watcher — so no extra hook is needed.
        //
        // Matched by price group, not by section: the sticky bar renders its own price inside the
        // same section and keeps its own quantity, so a section-wide lookup would have each
        // selector retargeting the other's price. The group key is the selector's error scope.
        //
        // Deliberately NOT gated on isQtyPriceBreak: that flag comes from the product-level
        // `quantity_price_breaks_configured?`, which is false when the breaks arrive from a B2B
        // catalog instead of the product itself. showPriceTier is a no-op when nothing rendered
        // tiers, so presence of the markup is the more reliable gate.
        __syncPriceToQuantity(quantity) {
          const group = errorScope || sectionId;
          quantityRuleUtils.showPriceTier(document.querySelectorAll(`[data-price-group="${group}"]`), quantity);
        },
        minus() {
          // aria-disabled only (the control stays focusable) — enforce the actual bound here so
          // a keyboard Enter can't slip past the pointer-events-none on the dimmed button.
          if (this.atMin) return;
          this.qty = quantityRuleUtils.step(this.qty, this.rule, -1);
        },
        plus() {
          if (this.atMax) return;
          this.qty = quantityRuleUtils.step(this.qty, this.rule, 1);
        },
        // Leaving the field snaps to a valid quantity without reporting anything; Enter (and
        // Add to cart, via product-form) reports. No-op for non-B2B: the default rule is
        // always valid and the error UI isn't rendered.
        normalizeOnLeave(el) {
          if (!window.Maximize.isB2BCustomer) return;
          quantityRuleUtils.normalizeOnLeave(this, el);
        },
        validateNow(el) {
          if (!window.Maximize.isB2BCustomer) return true;
          return quantityRuleUtils.validateNow(this, el);
        },
        __emitQuantityError(message) {
          clearTimeout(this.__errorHideTimer);
          document.dispatchEvent(new CustomEvent(`quantity-rule-error:${errorScope || sectionId}`, { detail: { message } }));
        },
      };
    });

    Alpine.data("xSection", (sectionId, container) => ({
      sectionId: sectionId,
      loading: true,
      show_more: true,
      firstLoadData() {
        let url = `${window.location.pathname}?section_id=${this.sectionId}`;
        fetch(url, {
          method: "GET",
        })
          .then((response) => response.text())
          .then(() => {
            this.loading = false;
          });
      },
    }));
  });
});

requestAnimationFrame(() => {
  document.addEventListener("alpine:init", () => {
    Alpine.data("xQuantitySelectorAtc", (productId, index, min = 1, max = null, increment = 1, cardId = '') => ({
      qty: 1,
      min: 1,
      max: null,
      increment: 1,
      productId: productId,
      index: index,
      // Drives the quantity-rule tooltip: an unavailable variant has no rule and no
      // price to break down, so the info icon is hidden rather than showing stale data.
      hasQuantityRuleInfo: true,

      get quantityKey() {
        return `${this.productId}-${this.index}`;
      },

      get rule() {
        return {min: this.min, max: this.max, increment: this.increment};
      },

      // Same bound state as xQuantitySelector.atMin/atMax — see the comment there.
      get atMin() {
        const q = parseInt(this.qty, 10);
        return Number.isInteger(q) && q <= this.min;
      },
      get atMax() {
        if (this.max === null) return false;
        const q = parseInt(this.qty, 10);
        return Number.isInteger(q) && q >= this.max;
      },

      setRule(m, mx, inc) {
        const r = quantityRuleUtils.normalizeRule(m, mx, inc);
        this.min = r.min;
        this.max = r.max;
        this.increment = r.increment;
      },

      init() {
        if (window.Maximize.isB2BCustomer) this.setRule(min, max, increment);

        const stored = Alpine.store('productQuantity').get(this.quantityKey);
        this.qty = quantityRuleUtils.isValid(stored, this.rule) ? stored : this.min;
        Alpine.store('productQuantity').set(this.quantityKey, this.qty);
        this.__syncPriceToQuantity(this.qty);

        this.$watch(
          () => Alpine.store('productQuantity').get(this.quantityKey),
          (newValue) => {
            if (newValue !== this.qty) {
              this.qty = newValue;
            }
          }
        );

        this.$watch('qty', (newValue) => {
          Alpine.store('productQuantity').set(this.quantityKey, newValue);
          this.updateWrapperDataset(newValue);
          this.__syncPriceToQuantity(newValue);
          if (window.Maximize.isB2BCustomer && quantityRuleUtils.isValid(newValue, this.rule)) {
            this.__emitQuantityError('');
          }
        });

        // B2B-only: re-seed the rule when the card swatch changes variant. Non-B2B
        // keeps the default rule, so skip the listener.
        if (cardId && window.Maximize.isB2BCustomer) {
          document.addEventListener(`${PRODUCT_EVENT.swatchChange}${cardId}`, (event) => {
            const detail = event.detail || {};
            // Reset unconditionally: picking an unavailable option leaves no rule to read,
            // and keeping the previous variant's increment made the box reject valid input.
            const qr = detail.quantity_rule;
            if (qr) {
              this.setRule(qr.min, qr.max, qr.increment);
              this.hasQuantityRuleInfo = true;
            } else {
              const variant = detail.currentVariant;
              this.setRule(...quantityRuleUtils.ruleArgsForVariant(variant));
              this.hasQuantityRuleInfo = !!variant && variant.available !== false;
            }
            this.qty = this.min;
          });
        }
      },

      updateWrapperDataset(newValue) {
        const wrapper = this.$el.closest('.product-card__wrapper');
        if (wrapper) {
          wrapper.dataset.quantity = newValue;
        }
      },

      // Reveal the volume-pricing tier matching the current quantity. The card's price is
      // rendered with data-price-group set to this card's id (e.g. the choose-option popup);
      // a no-op when nothing rendered tiers, so it is safe for cards without volume pricing.
      __syncPriceToQuantity(quantity) {
        if (!cardId) return;
        quantityRuleUtils.showPriceTier(document.querySelectorAll(`[data-price-group="${cardId}"]`), quantity);
      },

      minus() {
        // aria-disabled only (the control stays focusable) — enforce the actual bound here so
        // a keyboard Enter can't slip past the pointer-events-none on the dimmed button.
        if (this.atMin) return;
        this.qty = quantityRuleUtils.step(this.qty, this.rule, -1);
      },

      plus() {
        if (this.atMax) return;
        this.qty = quantityRuleUtils.step(this.qty, this.rule, 1);
      },

      // Leaving the field snaps to a valid quantity without reporting anything; Enter (and
      // Add to cart, via product-form) reports into the card's error_message element.
      // No-op for non-B2B: the default rule is always valid and the error UI isn't rendered.
      normalizeOnLeave(el) {
        if (!window.Maximize.isB2BCustomer) return;
        quantityRuleUtils.normalizeOnLeave(this, el);
      },
      validateNow(el) {
        if (!window.Maximize.isB2BCustomer) return true;
        return quantityRuleUtils.validateNow(this, el);
      },
      __emitQuantityError(message) {
        clearTimeout(this.__errorHideTimer);
        if (!cardId) return;
        document.dispatchEvent(new CustomEvent(`quantity-rule-error:${cardId}`, {detail: {message}}));
      }
    }));

    Alpine.store('productQuantity', {
      quantities: {},

      set(key, value) {
        this.quantities[key] = Math.max(1, parseInt(value) || 1);
      },

      get(key) {
        return this.quantities[key] || 1;
      }
    });
  });
});

requestAnimationFrame(() => {
  document.addEventListener("alpine:init", () => {
    Alpine.store("xSwiffy", {
      swiffySlider: null,
      load(el, configs) {
        this.swiffySlider = el;
        const swiffy = new SwiffySlider(el, configs);

        if (configs.handleArrow) {
          this.handleArrowButton(swiffy, el);
        }

        if (configs.hotspot) {
          this.handleHotspot(swiffy, configs);
        }

        if (configs.paginationBar) {
          this.handlePaginationBar(swiffy, configs);
        }

        if (configs.progressBar) {
          this.handleProgressBar(swiffy, configs);
        }
      },
      handleHotspot(swiffy, configs) {
        const hotspotRoot = document.getElementById(configs.hotspot);
        const hotspots = hotspotRoot.getElementsByClassName("x-hotspot");

        for (let i = 0; i < hotspots.length; i++) {
          hotspots[i].addEventListener("mouseenter", function (e) {
            swiffy.slideTo(i);
          });
        }

        this.swiffySlider.addEventListener("maximize:swiffy-slider:slide", function (e) {
          const {oldActiveSlideIndex, newActiveSlideIndex} = e.detail;

          hotspots[oldActiveSlideIndex].classList.remove("active-hotspot");
          hotspots[newActiveSlideIndex].classList.add("active-hotspot");
        });
      },
      handleProgressBar(swiffy, configs) {
        let bar = swiffy.sliderElement.querySelector(".swiffy-slide-progress-bar");

        swiffy.sliderElement.addEventListener("maximize:swiffy-slider:slide", function (e) {
          const {oldActiveSlideIndex, newActiveSlideIndex} = e.detail;
          let end = configs.progressBar;

          let rate = 100 * (newActiveSlideIndex / end);
          if (bar) {
            let rateBar = rate + Number(bar.style.width.replace("%", ""));
            let maxRate = 100 - Number(bar.style.width.replace("%", ""));
            if (rateBar > 100) {
              rate = maxRate;
            }
            if (document.querySelector("body").classList.contains("rtl")) {
              bar.style.marginRight = rate + "%";
            } else {
              bar.style.marginLeft = rate + "%";
            }
          }
        });
      },
      handleArrowButton(swiffy, el) {
        const nextButton = el.querySelector(".arrow-next");
        const prevButton = el.querySelector(".arrow-prev");

        if (nextButton) {
          nextButton.addEventListener("click", function (e) {
            swiffy.slide();
          });
        }
        if (prevButton) {
          prevButton.addEventListener("click", function (e) {
            swiffy.slide(false);
          });
        }
      },
      handlePaginationBar(swiffy, configs) {
        swiffy.sliderElement.addEventListener("maximize:swiffy-slider:slide", (event) => {
          const newActiveSlideIndex = Number(event.detail.newActiveSlideIndex);
          if (configs.paginationBar == "number_bar") {
            if (event.detail.el.querySelector(".current-active-index")) {
              event.detail.el.querySelector(".current-active-index").textContent = newActiveSlideIndex + 1;
            }
          } else if (configs.paginationBar == "image") {
            try {
              let imagePaginationList = event.detail.el.querySelectorAll(".pagination-active-image");
              let newActivePagination = newActiveSlideIndex < imagePaginationList.length - 1 ? newActiveSlideIndex + 1 : 0;
              imagePaginationList.forEach((imagePagination, index) => {
                imagePagination.classList.toggle("active", index === newActivePagination);
              });
            } catch (e) {
              console.error(e);
            }
          }
          this.handleLoadingProgress(event.detail.el, configs);
        });
      },
      handleLoadingProgress(el, configs){
        if (configs.paginationBar == "image") {
          // let paginationWrapper = el.querySelector(".image-pagination-wrapper");
          // if (!paginationWrapper) return;
          // paginationWrapper.classList.remove("active");
          // setTimeout(() => {
          //   paginationWrapper.classList.add("active");
          // }, 300);

          const overlay = el.querySelector('.pagination-image-ovelay');
          if (!overlay) return;
          overlay.classList.remove("active");
          overlay.restartTimeout = setTimeout(() => {
            overlay.classList.add("active");
          }, 300);
        } else {
          const loadingEl = el.querySelector(".slider-autoplay-loading");
          if (!configs.autoPlay || !loadingEl) return;

          loadingEl.classList.remove("active");
          loadingEl.restartTimeout = setTimeout(() => {
            loadingEl.classList.add("active");
          }, 300);
        }
      }
    });
    Alpine.store("xProductCard", {
      loadedChooseOptions: {},
      async loadChooseOptions(url, el, optionId, index, isShowQuantity = false) {
        const productCardWrapper = el.closest(".product-card__wrapper")
        if (!productCardWrapper) return;
        const showB2BPriceLabel = productCardWrapper.dataset.showB2bPriceLabel
        let listOptionValuesIdSelected = productCardWrapper.dataset.listOptionValuesIdSelected
          ? productCardWrapper.dataset.listOptionValuesIdSelected.split(",").map(v => v.trim()).filter(Boolean)
          : [];
        let urlProduct = `${url}?option_values=${listOptionValuesIdSelected.join(",")}&section_id=choose-option&page=${index}`;

        let destinationElm = productCardWrapper.querySelector(".choose-option");
        let loadingEl = productCardWrapper.querySelector(".icon-loading");

        const renderQuantity = () => {
          const quantityContainer = destinationElm.querySelector('#ChooseOptionQuantity');
          
          if (isShowQuantity) {
            if (quantityContainer) {
              quantityContainer.classList.remove('hidden');
            }
          } else {
            if (quantityContainer) {
              quantityContainer.remove();
            }
          }
        };

        const handleB2BPriceLabel = () => {
          if (showB2BPriceLabel === 'false') {
            const b2bPriceLabels = destinationElm.querySelectorAll('.price-b2b-label');
            if (b2bPriceLabels) {
              b2bPriceLabels.forEach(label => {
                label.classList.add('hidden');
              });
            }
          }
        };
        
        if (this.loadedChooseOptions[urlProduct]) {
          destinationElm.innerHTML = this.loadedChooseOptions[urlProduct];
          renderQuantity();
          handleB2BPriceLabel();
          setTimeout(() => {
            this.focusChooseOption(destinationElm);
          }, 500);
          return true;
        }

        try {
          if (loadingEl) {
            loadingEl.classList.remove("hidden");
          }
          const response = await fetch(urlProduct);
          const content = await response.text();

          const parser = new DOMParser();
          let parsedContent = parser.parseFromString(content, "text/html").getElementById("ChooseOptionContent").innerHTML;
          if (parsedContent) {
            if (destinationElm) {
              destinationElm.innerHTML = parsedContent;
              renderQuantity();
              handleB2BPriceLabel();
            }
            if (!Shopify.designMode) {
              this.loadedChooseOptions[urlProduct] = parsedContent;
            }
          }
          if (loadingEl) {
            loadingEl.classList.add("hidden");
          }
        } catch (error) {
          console.error(error);
        }
        this.focusChooseOption(destinationElm);
      },

      focusChooseOption(el) {
        const closeButton = el.querySelector(".btn-close-choose-option");
        if (closeButton) {
          closeButton.focus({ preventScroll: true });
        }
      },   
      handleCardHover(el) {
        const swiffy = new SwiffySlider(el, {});
        let cardImage = swiffy.sliderElement.querySelector(".slider-container");
        if (window.innerWidth >= MIN_DEVICE_WIDTH.desktop) {
          let mouseMoveRafId;
          const onMouseMove = (e) => {
            if (mouseMoveRafId) cancelAnimationFrame(mouseMoveRafId);
            mouseMoveRafId = requestAnimationFrame(() => {
              let left = e.offsetX;
              let width = cardImage.getBoundingClientRect().width;
              if (window.Maximize.rtl) {
                left = width - left;
              }
              let spacing = left / width;
              let index = Math.floor(spacing * swiffy.slides.length);
              swiffy.dispatchEventSlide(swiffy.activeSlideIndex);
              swiffy.updateActiveSlide(index);
            });
          };

          let mouseLeaveRafId;
          const onMouseLeave = () => {
            if (mouseLeaveRafId) cancelAnimationFrame(mouseLeaveRafId);
            mouseLeaveRafId = requestAnimationFrame(() => {
              swiffy.dispatchEventSlide(swiffy.activeSlideIndex);
              swiffy.updateActiveSlide(0);
            });
          };

          cardImage.addEventListener("mousemove", onMouseMove);
          cardImage.addEventListener("mouseleave", onMouseLeave);
        }
      }
    });
  });
});

// Custom Elements extracted to custom-elements.js

/**
 * Count product items in the innerHTML of #shopify-section-predictive-search.
 * Used to resolve shopify:search:update with a totalCount.
 * Products in predictive-search.liquid have id="predictive-search-option-product-N".
 * @param {string} sectionHtml  innerHTML of #shopify-section-predictive-search
 * @returns {number}
 */
function _predictiveProductCount(sectionHtml) {
  try {
    var parsed = new DOMParser().parseFromString(sectionHtml || '', 'text/html');
    return parsed.querySelectorAll('[id^="predictive-search-option-product-"]').length;
  } catch (_) {
    return 0;
  }
}

requestAnimationFrame(() => {
  document.addEventListener("alpine:init", () => {
    Alpine.data("xModalSearch", (type, desktopMaximumResults, mobileMaximumResults, productTypeSelected) => ({
      _keyDebounce: "",
      searchAbortController: null,
      searchRequestId: 0,
      _psSearchDeferred: null,
      _syncRafId: null,
      result: ``,
      query: "",
      cachedResults: {},
      openResults: false,
      isFocusedSearchForm: false,
      productTypeSelected: productTypeSelected,
      showSuggest: true,
      loading: false,
      loadingProductType: false,
      isFirstLoading: true,
      init() {
        this.$watch("isFocusedSearchForm", (val) => {
          if (val) this.syncSearchLayout();
        });

        const applyWrapperHeight = () => {
          const searchBarEl = this.$refs.search_bar_fixed;
          const searchBoxWrapper = this.$refs.open_search?.querySelector(".search-box-wrapper");
          if (searchBarEl && searchBoxWrapper) {
            searchBoxWrapper.style.height = searchBarEl.offsetHeight + "px";
          }
        };
        if (window.requestIdleCallback) {
          requestIdleCallback(applyWrapperHeight);
          this.isFirstLoading = false;
        } else {
          setTimeout(applyWrapperHeight, 200);
          this.isFirstLoading = false;
        }

        // Re-apply when crossing the tablet ↔ desktop breakpoint (lg = 1024px)
        const desktopMq = window.matchMedia("(min-width: 1024px)");
        desktopMq.addEventListener("change", applyWrapperHeight);
      },
      open() {
        this.isFocusedSearchForm = true;
        setTimeout(() => {
          this.$refs.input_search.focus();
        }, 50);
        if (this.$refs.close_button) {
          this.$refs.close_button.classList.remove("hidden");
        }
        if (this.result.length > 0) this.openResults = true;
        document.body.classList.add("overflow-hidden");
        Alpine.store("xFocusElement").activeElement = this.$el;
      },
      close() {
        if (this.$refs.close_button) {
          this.$refs.close_button.classList.add("hidden");
        }
        document.body.classList.remove("overflow-hidden");
        Alpine.store("xFocusElement").removeTrapFocus();
        this.isFocusedSearchForm = false;
        this.openResults = false;
        if (this.searchAbortController) {
          this.searchAbortController.abort();
        }
      },
      handleChangeInput() {
        this.query = this.$el.value;
        if (this.query === "") {
          this.showSuggest = true;
          this.openResults = false;
          this.result = "";
          this.loading = false;
          if (this.searchAbortController) {
            this.searchAbortController.abort();
          }
          return;
        }

        this.showSuggest = false;
        this.getSearchResult(this.query);
      },
      handleChangeProductType() {
        if (this.query === "") return;
        this.getSearchResult(this.query);
      },
      getSearchResult(query) {
        if (!this.isFocusedSearchForm) this.isFocusedSearchForm = true;
        this.openResults = true;

        const limit = window.innerWidth >= MIN_DEVICE_WIDTH.tablet ? desktopMaximumResults : mobileMaximumResults;
        const searchQuery = this.productTypeSelected !== productTypeSelected ? `${this.productTypeSelected} AND ${query}` : query;
        const queryKey = `${searchQuery.replace(" ", "-").toLowerCase()}_${limit}`;

        const _slSearch = window.MaximizeStorefrontEvents?.createSearchUpdate(
          { query: searchQuery, productFilters: [], sortKey: 'RELEVANCE' },
          this.$el
        );

        // Reject any in-flight deferred superseded by this new search.
        if (this._psSearchDeferred) {
          this._psSearchDeferred.reject(new DOMException('Search superseded', 'AbortError'));
          this._psSearchDeferred = null;
        }
        this._psSearchDeferred = _slSearch;

        if (this.searchAbortController) {
          this.searchAbortController.abort();
        }

        if (this.cachedResults[queryKey]) {
          this.result = this.cachedResults[queryKey];
          this.loading = false;
          _slSearch?.resolve(_predictiveProductCount(this.cachedResults[queryKey]));
          this._psSearchDeferred = null;
          return;
        }

        const searchParams = new URLSearchParams({
          q: searchQuery,
          "resources[type]": type,
          "resources[options][fields]": "author,body,product_type,tag,title,variants.barcode,variants.sku,variants.title,vendor",
          "resources[limit]": limit,
          section_id: "predictive-search",
        });

        const requestId = this.searchRequestId + 1;
        this.searchRequestId = requestId;
        this.searchAbortController = new AbortController();
        this.loading = true;

        fetch(`${Shopify.routes.root}search/suggest?${searchParams.toString()}`, {
          signal: this.searchAbortController.signal,
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error("");
            }
            return response.text();
          })
          .then((response) => {
            if (requestId !== this.searchRequestId) return;

            const parser = new DOMParser();
            const text = parser.parseFromString(response, "text/html");
            this.result = text.querySelector("#shopify-section-predictive-search")?.innerHTML;
            this.cachedResults[queryKey] = this.result;
            _slSearch?.resolve(_predictiveProductCount(this.result));
            this._psSearchDeferred = null;
          })
          .catch((error) => {
            if (error.name === "AbortError") {
              // Deferred already rejected above when the newer search superseded this one.
              return;
            }
            _slSearch?.reject(error);
            this._psSearchDeferred = null;
            throw error;
          })
          .finally(() => {
            if (requestId === this.searchRequestId) {
              this.loading = false;
              this.searchAbortController = null;
            }
          });
      },
      fetchRefinedSearch() {
        if (this.loadingProductType === "loaded") return;
        this.loadingProductType = "loading";
        fetch(`${Shopify.routes.root}?section_id=product-type`)
          .then((response) => {
            if (!response.ok) {
              throw new Error("");
            }
            return response.text();
          })
          .then((responseText) => {
            const parser = new DOMParser();
            const dataHTML = parser.parseFromString(responseText, "text/html");
            const selectOptionWrapper = this.$root.querySelector(".select-options-wrapper");
            const selectElement = this.$root.querySelector("select-element");

            if (selectOptionWrapper) {
              selectOptionWrapper.innerHTML = dataHTML.querySelector(".select-options-wrapper")?.innerHTML;
            }
            if (selectElement) {
              selectElement.optionSelected = selectElement.querySelector('.select-option[aria-selected="true"]');
              selectElement.optionsList = selectElement.querySelector(".select-options");
              selectElement.handleAddEventItem();
            }
          }).finally(() => {
            this.loadingProductType = "loaded";
          });
      },
      syncSearchLayout() {
        Alpine.nextTick(() => {
          if (!this.$refs.search_content) return;

          if (this._syncRafId) {
            cancelAnimationFrame(this._syncRafId);
          }
          this._syncRafId = requestAnimationFrame(() => {
            const top = this.$refs.search_bar_fixed.getBoundingClientRect().bottom;
            if (top > 0) {
              this.$refs.search_content.style.setProperty("--input-search-to-top", `${top}px`);
            }
            this._syncRafId = null;
          });
        });
      },
      setProductType(el, defaultType) {
        this.productTypeSelected = defaultType ? productTypeSelected : el.textContent.trim();
        if (this.query != "") {
          this.getSearchResult(this.query);
        }
      },
      focusForm() {
        if (this.$refs.close_button) {
          document.body.classList.add("overflow-hidden");
          this.$refs.close_button.classList.remove("hidden");
        }
        if (!this.$root.classList.contains("main-search-form")) {
          this.open();
        }
        if (this.$el.value === "") {
          this.showSuggest = true;
          this.isFocusedSearchForm = true;
        } else {
          this.query = this.$el.value;
          this.isFocusedSearchForm = true;
          this.openResults = true;
          this.showSuggest = false;
          this.getSearchResult(this.query);
        }
      },
      handleKeyUpModal(event) {
        if (event.key === "Escape" || event.key === "Esc") {
          event.preventDefault();
          return;
        }
        if (event.key === "Tab" || event.key === "Shift") {
          return;
        }
        this.query = this.$el.value;
        clearTimeout(this._keyDebounce);
        this._keyDebounce = setTimeout(() => {
          this.open();
          if (this.query != "") {
            this.showSuggest = false;
          } else {
            this.showSuggest = true;
            this.result = "";
          }
        }, 300);
      },
    }));
    Alpine.data("xFreeShipping", (sectionId) => ({
      init() {
        document.addEventListener(`${CART_EVENT.cartUpdate}`, (e) => {
          fetch(`${window.location.pathname}?section_id=${sectionId}`)
            .then((response) => response.text())
            .then((response) => {
              const html = new DOMParser().parseFromString(response, "text/html");
              const newContent = html.getElementById("announcement-free-shipping");
              this.$el.innerHTML = newContent.innerHTML;
            });
        });
      },
    }));

    Alpine.data("xCollapsibleTab", (initIsOpen) => ({
      isOpenCollapsible: initIsOpen,
      init() {
        if (!initIsOpen) {
          let collapsibleContentEle = this.$el.querySelector(`.collapsible-tab__content`);
          if (collapsibleContentEle) {
            collapsibleContentEle.classList.remove(`hidden`);
          }
        }
      },
      handleToggleTab: function () {
        this.isOpenCollapsible = !this.isOpenCollapsible;
      }
    }));

    Alpine.data('xMediaModel', () => ({
      MAX_RETRIES_WAIT_SCROLL_END: 50,
      loaded: false,
      handleInit() {
        this.loaded = true;
        window.Shopify.loadFeatures([
          {
            name: 'shopify-xr',
            version: '1.0',
            onLoad: this.__setUpShopifyXR.bind(this),
          },
        ]);
      },
      handleLoadModel() {
        let container = this.$el.parentNode;
        const content = document.createElement('div');
        content.appendChild(container.querySelector('template').content.firstElementChild.cloneNode(true));

        this.$el.classList.add('hidden');
        container.appendChild(content.querySelector('model-viewer'));
        this.__loadViewerUI();
      },
      handlePauseViewer() {
        if (this.$el.modelViewerUI) this.$el.modelViewerUI.pause();
      },
      __setUpShopifyXR() {
        const setup = () => {
          document.querySelectorAll('[id^="ProductJSON-"]').forEach((modelJSON) => {
            window.ShopifyXR.addModels(JSON.parse(modelJSON.textContent));
            modelJSON.remove();
          });
          window.ShopifyXR.setupXRElements();
        }

        if (!window.ShopifyXR) {
          document.addEventListener('shopify_xr_initialized', () => {
            setup();
          });
          return;
        }

        setup();
      },
      __loadViewerUI() {
        window.Shopify.loadFeatures([
          {
            name: 'model-viewer-ui',
            version: '1.0',
            onLoad: this.__setUpViewerUI.bind(this),
          },
        ]);
      },
      __setUpViewerUI(errors) {
        if (errors) return;

        this.$el.parentNode.modelViewerUI
          = new Shopify.ModelViewerUI(this.$el.parentNode.querySelector('model-viewer'));
      },
      waitScrollEndedOnDesktop(callback) {
        let count = 0;
        const isMobile = window.innerWidth < MIN_DEVICE_WIDTH.tablet ? true : false;
        const galleryWrapperDataset = this.$el.closest('.media-gallery__wrapper')?.dataset;

        const intervalId = setInterval(() => {
          if (
            isMobile ||
            galleryWrapperDataset?.isScrollingOnDesktop != 'true' ||
            count >= this.MAX_RETRIES_WAIT_SCROLL_END
          ) {
            if (galleryWrapperDataset) {
              galleryWrapperDataset.isScrollingOnDesktop = 'false';
            }
            clearInterval(intervalId);
            callback();
            return;
          }

          count++;
        }, TIMEOUT.scrollIdle);
      },
      initModelInSlideEffect() {
        this.waitScrollEndedOnDesktop(() => {
          const mediaitem = this.$el.closest('.media-gallery__media-item');
          if (this.loaded || !mediaitem.classList.contains('is-active-in-two-columns')) return;
          this.handleInit();
          this.handleLoadModel();
        });

        document.addEventListener(`${PRODUCT_MEDIA_EVENT.show_model}-${this.$el.dataset.mediaId}`, (event) => { 
          if (this.loaded) return;
          if (window.innerWidth >= MIN_DEVICE_WIDTH.tablet) {
            this.waitScrollEndedOnDesktop(() => {
              if (this.loaded) return;
              this.handleInit();
              this.handleLoadModel();
            })
          } else {
            this.handleInit();
            this.handleLoadModel();
          }
        });
      }
    }))
  });
});

requestAnimationFrame(() => {
  document.addEventListener('alpine:init', () => {
    Alpine.store('xCustomerEvent', {
      fire(eventName, el, data) {
        if (Shopify.designMode) return;

        const formatedData = data ? data : xParseJSON(el.dataset.customEvent);
        Shopify.analytics.publish(eventName, formatedData);
      }
    });

    Alpine.store("xEstimateDelivery", {
      hour: 0,
      minute: 0,
      notification: '',
      countdownCutOffTime(cutOffTime, hrsText, minusText) {
        if (this.notification != '')
          return;
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        const cutOffHour = cutOffTime.length >= 3 ? parseInt(cutOffTime.slice(0, -2), 10) : 0;
        const cutOffMinute = cutOffTime.length >= 3 ? parseInt(cutOffTime.slice(-2), 10) : 0;

        const current = new Date(now.getFullYear(), now.getMonth(), now.getDate(), currentHour, currentMinute);
        const cutOff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cutOffHour, cutOffMinute);

        if (current >= cutOff) {
          cutOff.setDate(cutOff.getDate() + 1);
        }

        const diffMs = cutOff - current;

        this.hour = Math.floor(diffMs / 1000 / 60 / 60);
        this.minute = Math.floor((diffMs / 1000 / 60) % 60);
        return this.hour > 0 ? this.notification = this.hour + ' ' + hrsText + ' ' + this.minute + ' ' + minusText : this.notification = this.minute + ' ' + minusText;
      }
    });

  });
});

requestAnimationFrame(() => {
  document.addEventListener("alpine:init", () => {
    Alpine.store("xScrollPromotion", {
      load(el) {
        let scroll = el.getElementsByClassName("el_animate");
        for (let i = 0; i < scroll.length; i++) {
          scroll[i].classList.add("animate-scroll-banner");
        }
      },
    });
  });
});

requestAnimationFrame(() => {
  document.addEventListener('alpine:init', () => {
    Alpine.store('xResizeHandler', {
      callbacks: [],
      triggerResize: null,
      debounce(func, delay) {
        let timer;
        return function (...args) {
          clearTimeout(timer);
          timer = setTimeout(() => func.apply(this, args), delay);
        };
      },
      register(callback, allowDuplicateFuntc, ...params) {
        if (allowDuplicateFuntc) {
          this.callbacks.push({callback, params});
        } else if (!this.callbacks.find(item => item.callback === callback)) {
          this.callbacks.push({callback, params});
        }
      },
      unregister(callback) {
        this.callbacks = this.callbacks.filter(item => item.callback !== callback);
      },
      init() {
        this.triggerResize = this.debounce(() => {
          this.callbacks.forEach(({callback, params}) => {
            callback(...params);
          });
        }, 50);

        window.addEventListener("resize", this.triggerResize);
      }
    });
  });
});

function maximizeParseJSON(jsonString) {
  jsonString = String.raw`${jsonString}`;
  jsonString = jsonString.replaceAll("\\", "\\\\").replaceAll('\\"', '\"');

  return JSON.parse(jsonString);
}

requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
    Alpine.data('xProductDrawer', () => ({
      isShowDrawer: false,
      openDrawer(idBlockDrawer) {
        this.isShowDrawer = true;
        Alpine.store('xMaximizeDrawer').handleOpen(idBlockDrawer);
      },
      closeDrawer(closeQuickView = false) {
        Alpine.store('xFocusElement').removeTrapFocus();
        this.isShowDrawer = false;
        let closeAllDrawer = true;
        const isShowQuickView = Alpine.store('xQuickView') && Alpine.store('xQuickView').show
        if (isShowQuickView && (!closeQuickView || window.innerWidth < MIN_DEVICE_WIDTH.tablet)) {
          closeAllDrawer = false
        }
        Alpine.store('xMaximizeDrawer').handleClose(closeAllDrawer);
        if (isShowQuickView && closeQuickView && window.innerWidth >= MIN_DEVICE_WIDTH.tablet) {
          Alpine.store('xQuickView').close();
        }
      }
    }));
  })
});
// xProductComparison extracted to product-comparison.js

requestAnimationFrame(() => {
  document.addEventListener("alpine:init", () => {
    Alpine.store("xStoreMap", {
      currentStoreSelected: JSON.parse(localStorage.getItem("currentStoreSelected"))?.selectedStore || "",

      getStore() {
        if (this.currentStoreSelected) {
          return this.currentStoreSelected.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        }
      },
      getStoreText() {
        if (this.currentStoreSelected !== "") {
          return this.currentStoreSelected;
        }
      },
      checkAvailability(storeAvailabilities) {
        let store = this.getStore();
        if (storeAvailabilities) {
          return storeAvailabilities[store];
        }
      },
      dispatchEventOpenPopup() {
        document.dispatchEvent(new CustomEvent(`${STORE_MAP_EVENT.openPopup}`));
      }
    });
  })
})

requestAnimationFrame(() => {
  document.addEventListener("alpine:init", () => {
    Alpine.data('xContactForm', (formId) => ({
      isFormValid: false,
      formId: formId,
      emailTouched: false,
      get form() {
        return this.$el ? this.$el.querySelector(`#${this.formId}`) : null;
      },

      get emailInput() {
        return this.form ? this.form.querySelector('input[name="contact[email]"]') : null;
      },

      get emailValidationMessage() {
        return this.form ? this.form.querySelector(`.contact-form__email-error-${this.formId}`) : null;
      },

      init() {
        if (!this.form) return;
        this.validateForm();
        if (this.emailInput) {
          this.emailInput.addEventListener('input', () => {
            this.emailTouched = true;
            this.validateForm();
          });
        }
        
        this.$el.addEventListener(SELECT_ELEMENT_EVENT.change, () => {
          this.validateForm();
        });

        this.initRequestTypeNote();
      },

      validateForm() {
        const form = this.form;
        if (!form) return;

        let isValid = true;

        const requiredFields = form.querySelectorAll('input[required], textarea[required]');
        requiredFields.forEach(field => {
          if (field.classList.contains('input-checkbox')) return;
          if (field.classList.contains('content') && field.closest('.multi-select')) return;
          if (!field.value || !field.value.trim()) isValid = false;
        });

        if (this.emailInput) {
          const isEmpty = !this.emailInput.value.trim();
          const isRequired = this.emailInput.hasAttribute('required');
          const validation = validateEmail(this.emailInput.value);

          const isRequiredError = isEmpty && isRequired;
          const isFormatError = validation.isInvalid;
          const hasError = isRequiredError || isFormatError || validation.isError;

          const errorMessage = isRequiredError 
            ? window.Maximize?.formTranslations?.emailRequiredMessage 
            : (isFormatError ? window.Maximize?.formTranslations?.emailInvalidMessage  : '');

          if (hasError) isValid = false;
          this.showMessage(this.emailTouched && hasError, this.emailValidationMessage, errorMessage);
        } else {
          this.isFormValid = false;
          return;
        }

        const checkboxGroups = form.querySelectorAll('.multi-select');
        checkboxGroups.forEach(group => {
          const contentInput = group.querySelector('.content');
          const isRequired = contentInput && contentInput.hasAttribute('required');
          if (!isRequired) return;

          const checkedCount = group.querySelectorAll('.input-checkbox:checked').length;
          if (checkedCount === 0) isValid = false;
        });

        this.isFormValid = isValid;
      },

      showMessage(isShow, element, message) {
        if (!element) return;
        if (isShow) {
          element.textContent = message;
          element.classList.remove('hidden');
        }else {
          element.classList.add('hidden');
        }
      },

      initRequestTypeNote() {
        const requestTypeRadios = this.form.querySelectorAll('.request-type-radio');
        const noteSpan = this.form.querySelector('.request-type_note');

        if (!requestTypeRadios.length || !noteSpan) return;

        requestTypeRadios.forEach(radio => {
          radio.addEventListener('change', () => this.updateNoteRequestType());
        });

        this.updateNoteRequestType();
      },
      updateNoteRequestType() {
        const noteSpan = this.form.querySelector('.request-type_note');
        if (!noteSpan) return;

        const selected = this.form.querySelector('.request-type-radio:checked');
        if (!selected) return;

        const text = selected.value === 'Return' 
          ? noteSpan.dataset.returnText 
          : noteSpan.dataset.cancelText;

        noteSpan.textContent = text || '';
      },
    }));
  });
})

requestAnimationFrame(() => {
  document.addEventListener("alpine:init", () => {
    Alpine.data('xDisclosures', () => ({
      isOpen: false,
      isOpenQuickView: false, 
      isOpenCartDrawer: false, 
      openDrawer(drawerId) {
        this.isOpen = true;
        this.$store.xMaximizeDrawer.handleOpen(`#DisclosuresDrawer__${drawerId}`);
        const cartDrawer = document.getElementById('CartDrawer');
        if (Alpine.store('xQuickView') && Alpine.store('xQuickView').show === true) {
          Alpine.store('xQuickView').close(); 
          this.isOpenQuickView = true;
        }
        if (cartDrawer && cartDrawer.isOpen) {
          this.isOpenCartDrawer = true
          cartDrawer.isOpen = false;
        }
        Alpine.nextTick(() => {
          Alpine.store('xFocusElement').trapFocus(`DisclosuresDrawer__${drawerId}`, `DisclosureDrawerClose__${drawerId}`);
        });
      },

      closeDrawer(productId, productUrl) {
        this.isOpen = false;
        this.$store.xMaximizeDrawer.handleClose();
        const cartDrawer = document.getElementById('CartDrawer');
        if (this.isOpenCartDrawer && !this.isOpenQuickView && cartDrawer) {
          cartDrawer.isOpen = true;
          this.isOpenCartDrawer = false
        }
        if (Alpine.store('xQuickView') && this.isOpenQuickView && productId && productUrl) {
          Alpine.store('xQuickView').load(productId, productUrl, this.$el);
          Alpine.store('xQuickView').open();
          this.isOpenQuickView = false;
        }
        Alpine.store('xFocusElement').removeTrapFocus();
      }
    }));
  });
});

function formatWithDelimiters(number, precision, thousands, decimal) {
  precision = defaultOption(precision, 2);
  thousands = defaultOption(thousands, ',');
  decimal = defaultOption(decimal, '.');

  if (isNaN(number) || number == null) {
    return 0;
  }

  number = (number / 100.0).toFixed(precision);

  let parts = number.split('.'),
    dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands),
    cents = parts[1] ? (decimal + parts[1]) : '';

  return dollars + cents;
}

function defaultOption(opt, def) {
  return (typeof opt == 'undefined' ? def : opt);
}

function formatMoney(amount, formatString) {
  let placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
  let value;
  switch (formatString.match(placeholderRegex)[1]) {
    case 'amount':
      value = formatWithDelimiters(amount, 2);
      break;
    case 'amount_no_decimals':
      value = formatWithDelimiters(amount, 0);
      break;
    case 'amount_with_comma_separator':
      value = formatWithDelimiters(amount, 2, '.', ',');
      break;
    case 'amount_no_decimals_with_comma_separator':
      value = formatWithDelimiters(amount, 0, '.', ',');
      break;
  }

  return formatString.replace(placeholderRegex, value);
}
window.formatMoney = formatMoney;

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function validateEmail(email) {
  const VALID_REGEX_EMAIL = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
  if (email === '') {
    return {'isError': true, 'isRequired': true};
  } else if (!email.match(VALID_REGEX_EMAIL)) {
    return {'isError': true, 'isInvalid': true};
  } else {
    return {'isError': false};
  }
}


function getValueCssVariable(varName, element = document.documentElement, shouldConvertToFloat = false) {
  const value = getComputedStyle(element)
    .getPropertyValue(varName)
    .trim();

  if (!shouldConvertToFloat) return value;
    
  if (!value) return 0;
  const rootFontSize = parseFloat(
    getComputedStyle(document.documentElement).fontSize
  );

  const elementFontSize = parseFloat(
    getComputedStyle(element).fontSize
  );

  const numericValue = parseFloat(value);

  if (isNaN(numericValue)) return 0;

  if (value.endsWith('ms')) {
    return numericValue;
  }

  if (value.endsWith('s')) {
    return numericValue * MS_PER_SECOND;
  }

  if (value.endsWith('rem')) {
    return numericValue * rootFontSize;
  }

  if (value.endsWith('em')) {
    return numericValue * elementFontSize;
  }

  return numericValue;
}

// =============================================================================
// Highlight animation & fade-on-intersect observer
// Replaces x-data + x-intersect Alpine directives across all liquid files.
// A single shared IntersectionObserver handles all elements — no Alpine overhead.
//
//   data-highlight-class="heading-highlight-underline--active"
//       → adds that class after optional delay (default: immediate)
//   data-highlight-delay="700"
//       → delay in ms before adding the highlight class
//   data-fade-on-intersect
//       → adds 'is-visible' class (triggers CSS fade-in animation)
// =============================================================================
(function setupHighlightObserver() {
  let SELECTOR = '[data-highlight-class],[data-fade-on-intersect]';

  let observer = new IntersectionObserver(function(entries, obs) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      let el = entry.target;
      obs.unobserve(el);

      // Highlight animation: add the target class after an optional delay
      if (el.dataset.highlightClass) {
        let delay = parseInt(el.dataset.highlightDelay, 10) || 0;
        if (delay) {
          setTimeout(function() { el.classList.add(el.dataset.highlightClass); }, delay);
        } else {
          el.classList.add(el.dataset.highlightClass);
        }
      }

      // Fade animation: equivalent to x-intersect.once="$el.classList.add('is-visible')"
      if ('fadeOnIntersect' in el.dataset) {
        el.classList.add('is-visible');
      }
    });
  }, { rootMargin: '0px 0px -20px 0px' });

  // Elements already in viewport at load time: apply is-visible immediately
  // without transition so Lighthouse screenshots count them as visible content,
  // reducing Speed Index. Elements below fold still use the normal fade-in.
  // Batch pattern: Pass 1 reads all rects (single reflow, zero DOM writes),
  // Pass 2 writes classList + dataset (single style recalculation) — avoids
  // N forced reflows caused by interleaving dataset writes with rect reads.
  function applyInViewport(root) {
    let vh = window.innerHeight;
    let toShow = [], toObserve = [];
    // Pass 1: batch-read all rects — NO dataset writes, zero DOM mutations
    (root || document).querySelectorAll(SELECTOR).forEach(function(el) {
      if (el.dataset.fadeObserved) return;
      let rect = el.getBoundingClientRect();
      if (rect.top < vh && rect.bottom > 0) {
        toShow.push(el);
      } else {
        toObserve.push(el);
      }
    });
    // Pass 2: batch-write all DOM mutations — single style recalculation
    toShow.forEach(function(el) {
      el.dataset.fadeObserved = '1';
      el.classList.add('is-visible', 'transition-none');
      if (el.dataset.highlightClass) {
        el.classList.add(el.dataset.highlightClass);
      }
    });
    toObserve.forEach(function(el) {
      el.dataset.fadeObserved = '1';
      observer.observe(el);
    });
  }

  function observeAll(root) {
    (root || document).querySelectorAll(SELECTOR).forEach(function(el) {
      if (!el.dataset.fadeObserved) {
        el.dataset.fadeObserved = '1';
        observer.observe(el);
      }
    });
  }

  // Observe all static elements (theme.js runs after DOMContentLoaded via defer)
  applyInViewport();

  // Re-scan after Alpine finishes initialising (catches elements inside x-if / x-for)
  // Also remove opacity-main-header here — fires after ALL x-teleport/x-init done,
  // much earlier than @load.window (which waits for images/fonts to finish loading).
  document.addEventListener('alpine:initialized', function() {
    observeAll();
    // handleSharedCart moved here from x-init on #MainContent — avoids Alpine
    // registering the entire MainContent subtree as a managed node, which was
    // causing unnecessary style recalculations before LCP.
    if (window.xCartHelper) window.xCartHelper.handleSharedCart();
    requestAnimationFrame(function() {
      let header = document.querySelector('.opacity-main-header');
      if (header) header.classList.remove('opacity-main-header');
    });
  });

  // Auto-observe elements injected dynamically (section rendering, lazy sections, etc.)
  // childList+subtree only fires on element add/remove — NOT on attribute/text changes,
  // so Alpine reactive bindings (x-bind, x-show…) do NOT trigger this callback.
  // firstElementChild guard skips querySelectorAll on leaf nodes (button, span, img…),
  // keeping per-mutation cost near-zero when no fade elements are present.
  new MutationObserver(function(mutations) {
    for (let i = 0; i < mutations.length; i++) {
      let added = mutations[i].addedNodes;
      for (let j = 0; j < added.length; j++) {
        let node = added[j];
        if (node.nodeType !== 1) continue;
        if (node.matches(SELECTOR) && !node.dataset.fadeObserved) {
          node.dataset.fadeObserved = '1';
          observer.observe(node);
        }
        if (node.firstElementChild) {
          node.querySelectorAll(SELECTOR).forEach(function(el) {
            if (!el.dataset.fadeObserved) {
              el.dataset.fadeObserved = '1';
              observer.observe(el);
            }
          });
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

  // Expose so lazy Alpine.initTree() sections can register newly-revealed elements
  window._fadeObserver = { observe: observeAll };
})();


// === Pickup Message — pure JS replacement for Alpine x-data/x-show ===
// Replaces 1 Alpine component + 3 x-show directives per product card.
// Data is stored as pipe-delimited strings in data-pickup-locs / data-pickup-avail.
// A single event listener handles all cards instead of N reactive Alpine scopes.
(function setupPickupMessage() {
  // Only run on pages that actually render pickup-message.liquid snippets
  if (!document.querySelector('.pickup-message__wrapper')) return;

  // Parse "Name A|||Name B|||" → ['Name A', 'Name B']
  function parsePipeList(str) {
    return (str || '').split('|||').map(function(s) { return s.trim(); }).filter(Boolean);
  }

  // Parse "Name A::true|||Name B::false|||" → { 'Name A': true, 'Name B': false }
  function parseAvailMap(str) {
    let map = {};
    parsePipeList(str).forEach(function(entry) {
      let idx = entry.lastIndexOf('::');
      if (idx === -1) return;
      map[entry.slice(0, idx)] = entry.slice(idx + 2) === 'true';
    });
    return map;
  }

  function applyStore(storeName) {
    document.querySelectorAll('.pickup-message__wrapper[data-pickup-locs]').forEach(function(el) {
      if (!storeName) { el.style.display = 'none'; return; }

      let locs = parsePipeList(el.dataset.pickupLocs);
      if (!locs.includes(storeName)) { el.style.display = 'none'; return; }

      let avail = parseAvailMap(el.dataset.pickupAvail);
      let isAvail = avail[storeName] === true;

      el.style.display = '';
      el.querySelector('.pickup-msg-avail').style.display  = isAvail ? '' : 'none';
      el.querySelector('.pickup-msg-unavail').style.display = isAvail ? 'none' : '';
      el.querySelectorAll('.pickup-store-name').forEach(function(s) { s.textContent = storeName; });
    });
  }

  // Init from localStorage (store may already be selected from previous visit)
  let saved = JSON.parse(localStorage.getItem('currentStoreSelected') || 'null');
  if (saved && saved.selectedStore) applyStore(saved.selectedStore);

  // React to store selection / deselection
  document.addEventListener('maximize:store-changed', function(e) {
    applyStore(e.detail.store || '');
  });
})();

// Global helper: replace innerHTML of elements matching `selector` inside `rootEl`
// with the corresponding elements from a fetched/parsed `dataHTML` document.
// Matches by index; if the new document has a single match it is applied to all.
function updateElements(rootEl, dataHTML, selector) {
  const oldElements = rootEl.querySelectorAll(selector);
  const newElements = dataHTML.querySelectorAll(selector);
  const single = newElements.length === 1;

  oldElements.forEach((oldEl, i) => {
    const newEl = single ? newElements[0] : newElements[i];
    if (oldEl && newEl) oldEl.innerHTML = newEl.innerHTML;
  });
}
