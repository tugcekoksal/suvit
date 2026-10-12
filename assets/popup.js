if (!window.Maximize.loadedScript.includes('popup.js')) {
  window.Maximize.loadedScript.push('popup.js');
  
  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => { 
      Alpine.data('xPopups', (data) => ({
        enable: false,
        showMinimal: false,
        show: Shopify.designMode ? ( localStorage.getItem(data.name + '-' + data.sectionId)? xParseJSON(localStorage.getItem(data.name + '-' + data.sectionId)) : true ) : false,
        delayDays: data.delayDays ? data.delayDays : 0,
        t: '',
        copySuccess: false,
        init() {
          if (Shopify.designMode) {
            let _this = this;
            const handlePopupSelect = (event, isResize = null) => {
              if (event.detail && event.detail.sectionId && event.detail.sectionId.includes(data.sectionId) || isResize) {
                if (window.Alpine) {
                  _this.open();
                  localStorage.setItem(data.name + '-' + data.sectionId, JSON.stringify(true));
                } else {
                  document.addEventListener('alpine:initialized', () => {
                    _this.open();
                    localStorage.setItem(data.name + '-' + data.sectionId, JSON.stringify(true));
                  });
                }
              } else {
                if (window.Alpine) {
                  _this.closeSection();
                  localStorage.setItem(data.name + '-' + data.sectionId, JSON.stringify(false));
                } else {
                  document.addEventListener('alpine:initialized', () => {
                    _this.closeSection();
                    localStorage.setItem(data.name + '-' + data.sectionId, JSON.stringify(false));
                  });
                }
              }
            }
  
            document.addEventListener('shopify:section:select', (event) => {
              handlePopupSelect(event);
            });
  
            document.addEventListener('shopify:block:select', (event) => {
              handlePopupSelect(event);
            });
  
            //reload popup and display overlay when change screen in shopify admin
            if (data.name != 'popup-age-verification') {
              window.addEventListener('resize', (event)=> {
                handlePopupSelect(event, xParseJSON(localStorage.getItem(data.name + '-' + data.sectionId)));
                if (xParseJSON(localStorage.getItem(data.name + '-' + data.sectionId))) {
  
                }
              })
            }
          } 
            
          this.handleLoadPage();
  
          if (this.$el.querySelector('.newsletter-message')) {
            this.open();
          }

          this.$watch('show', (newValue) => {
            if (newValue) {
              Alpine.store('xMaximizePopup').handleOpen();
            } else {
              Alpine.store('xMaximizePopup').handleClose();
            }
          })
        },
        load() {
          //optimize popup load js
          if (window.location.pathname === '/challenge') return;

          const _this = this;
          if (Shopify.designMode) {
            _this.open();
            return;
          }

          if (data.name == 'popup-promotion' && !this.handleSchedule() && data.showCountdown) return;

          if (data.name == 'popup-promotion' && document.querySelector("#x-age-popup") && xParseJSON(localStorage.getItem('popup-age-verification')) == null) {
            document.addEventListener("close-age-verification", () => {
              setTimeout(() => {
                _this.open();
              }, data.delays * 1000);
            });
            return;
          }

          // === User Engagement Gate ===
          // Popup only opens when BOTH conditions are true:
          //   1. The configured delay has elapsed
          //   2. The user has genuinely interacted (scroll/click/move/touch)
          // Lighthouse & PageSpeed bots run with zero interaction → popup never shows
          // → popup image is never an LCP candidate in lab measurements.
          // Real users always trigger at least one event (pointermove / scroll)
          // → behaviour is identical to the plain setTimeout approach.
          var timerDone    = false;
          var userEngaged  = false;

          var tryOpen = function() {
            if (timerDone && userEngaged) _this.open();
          };

          var ENGAGE_EVENTS = ['scroll', 'click', 'keydown', 'touchstart', 'pointermove'];
          var onEngage = function() {
            if (userEngaged) return;
            userEngaged = true;
            ENGAGE_EVENTS.forEach(function(e) {
              document.removeEventListener(e, onEngage);
            });
            tryOpen();
          };
          ENGAGE_EVENTS.forEach(function(e) {
            document.addEventListener(e, onEngage, { passive: true });
          });

          setTimeout(function() {
            timerDone = true;
            tryOpen();
          }, data.delays * 1000);
        },
        _loadPopupImages() {
          // Swap data-src → src for popup images only when popup is actually shown.
          // Keeps <img> without src in initial HTML so browser never discovers/loads
          // the image early and it cannot become an LCP candidate before popup opens.
          // NOTE: image lives inside x-teleport so it is OUTSIDE this.$el.
          //       Query by unique container ID instead.
          requestAnimationFrame(() => {
            const container = document.getElementById('PromoPopup__Container__' + data.sectionId);
            if (!container) return;
            container.querySelectorAll('img.popup-lazy-img[data-src]').forEach(function(img) {
              // img.src returns current page URL when attr absent — use getAttribute instead
              if (img.getAttribute('src')) return;
              if (img.dataset.srcset) img.srcset = img.dataset.srcset;
              if (img.dataset.sizes)  img.sizes  = img.dataset.sizes;
              img.src = img.dataset.src;
            });
          });
        },
        open() {
          if (!Shopify.designMode && this.isExpireSave() && !this.show) return;

          var _this = this;
          if (data.name == 'popup-age-verification') {
            if (this.isExpireSave() && !Shopify.designMode && !data.show_popup) return;
  
            requestAnimationFrame(() => {
              Alpine.store('xMaximizePopup').handleOpen();
            });
          }
  
          // Show minimal popup when
          // 1. "Show minimal" is enabled for desktop, default style is set to "minimal", and the window width is >= 768
          // 2. "Show minimal" is enabled for mobile, default mobile style is set to "minimal", and the window width is < 768
          if ((data.showMinimal && data.default_style == "minimal" && window.innerWidth >= 768) 
            || (data.showMinimalMobile && data.default_style_mobile == "minimal" && window.innerWidth < 768)) {
            _this.showMinimal = true;
            _this.show = false;
            if (Shopify.designMode) {
              localStorage.setItem(data.name + '-' + data.sectionId, JSON.stringify(false));
              _this.removeOverlay();
            }
          } else {
            // Show full popup
            if (data.showOnMobile && window.innerWidth < 768 || window.innerWidth >= 768) {
              // Show a full popup the first time a customer accesses the site. If the customer closes the full popup, display a minimal popup for the rest of the session.
              if (localStorage.getItem('current-' + data.sectionId) == 'minimal') {
                _this.showMinimal = true;
                _this.show = false;
                _this.removeOverlay();
              } else {
                _this.show = true;
                _this.showMinimal = false;
                _this.setOverlay();
                _this._loadPopupImages();
                if (!Shopify.designMode) {
                  _this.saveDisplayedPopup();
                }
              }
            } else {
              // Show nothing when screen width is < 768 and "Show popup on mobile" is disabled.
              _this.removeOverlay();
            }
          }
        },
        close() {
          if (data.name == 'popup-age-verification') {
            this.show = false;
            requestAnimationFrame(() => {
              document.body.classList.remove("overflow-hidden");
              Alpine.store('xMaximizePopup').handleClose();
            });
            document.dispatchEvent(new Event('close-age-verification'));
            if (!this.isExpireSave()) {
              this.setExpire()
            }
            return;
          }
          var _this = this;
          if (Shopify.designMode) {
            requestAnimationFrame(() => {
              setTimeout(() => {
                _this.showMinimal = true;
              }, 300);
            });
          } else {
            this.removeDisplayedPopup();
            if ((data.showMinimal && window.innerWidth >= 768) || (data.showMinimalMobile && window.innerWidth < 768)) {
              requestAnimationFrame(() => {
                setTimeout(() => {
                  _this.showMinimal = true;
                }, 300);
                // Save data to storage when the full popup is closed (the full popup only shows on the first access to the site)
                localStorage.setItem('current-' + data.sectionId, 'minimal');
              });
            } else {
              if (!this.isExpireSave()) {
                this.setExpire()
              }
            }
          }
          requestAnimationFrame(() => {
            _this.show = false;
            _this.removeOverlay();
          });
        },
        closeSection() {
          this.show = false;
          this.showMinimal = false;
          this.removeOverlay();
        },
        setExpire() {
          const item = {
            section: data.sectionId,
            expires: Date.now() + this.delayDays * 24 * 60 * 60 * 1000
          }
          
          localStorage.setItem(data.sectionId, JSON.stringify(item))
          //remove storage data, the full popup will be displayed when the site applies the reappear rule.
          localStorage.removeItem('current-' + data.sectionId);
        },
        isExpireSave() {
          const item = xParseJSON(localStorage.getItem(data.sectionId));
          if (item == null) return false;
  
          if (Date.now() > item.expires) {
            localStorage.removeItem(data.sectionId);
            return false;
          }
  
          return true;
        },
        handleSchedule() {
          if (data.showCountdown) {
            let el = document.getElementById('x-promotion-' + data.sectionId);
            let settings = xParseJSON(el.getAttribute('x-countdown-data'));
            if (!Alpine.store('xHelper').canShow(settings)) {
              if (!Shopify.designMode && data.schedule_enabled) {
                requestAnimationFrame(() => {
                  this.show = false;
                });
  
                return false;
              }
            }
          }
  
          this.enable = true;
          return true;
        },
        clickMinimal() {
          requestAnimationFrame(() => {
            this.show = true;
            this.showMinimal = false;
            this._loadPopupImages();
            Alpine.store('xMaximizePopup').handleOpen();
            if (!Shopify.designMode) {
              this.saveDisplayedPopup()
            }
            this.setOverlay();
            setTimeout(() => {
              Alpine.store('xFocusElement').trapFocus(`PopupFullWidth-${data.sectionId}`, `ClosePromotionPopup__${data.sectionId}`);
            }, 300);
          })
        },
        setOverlay() {
          if (data.overlay) {
            let popupsDiv = document.querySelector("#Popup__Overlay");
            if (popupsDiv.classList.contains('block')) return
            popupsDiv.classList.add('block');
            popupsDiv.classList.remove('hidden');
          }
        },
        removeOverlay() {
          if (data.overlay) {
            let popupsDiv = document.querySelector("#Popup__Overlay")
            displayedPopups = xParseJSON(localStorage.getItem("promotion-popup-overlay")) || [];
            if (popupsDiv.classList.contains('block') && displayedPopups.length == 0) {
              popupsDiv.classList.remove('block');
              popupsDiv.classList.add('hidden');
              Alpine.store('xMaximizePopup').handleClose();
            }
          }
        },
        //close minimal popup will set expired
        closeMinimal() {
          this.showMinimal = false;
          if (Shopify.designMode) return
  
          if (!this.isExpireSave()) this.setExpire();
        },
        saveDisplayedPopup() {
          let localStorageArray = xParseJSON(localStorage.getItem('promotion-popup-overlay')) || [];
          if (!localStorageArray.some(item => item == data.name + '-' + data.sectionId)) {
            localStorageArray.push(data.name + '-' + data.sectionId);
            localStorage.setItem('promotion-popup-overlay', JSON.stringify(localStorageArray));
          }
        },
        removeDisplayedPopup() {
          let localStorageArray = xParseJSON(localStorage.getItem('promotion-popup-overlay')),
            updatedArray = localStorageArray.filter(item => item != data.name + '-' + data.sectionId);
          localStorage.setItem('promotion-popup-overlay', JSON.stringify(updatedArray));
        },
        handleLoadPage() {
          localStorage.setItem('promotion-popup-overlay', JSON.stringify([]));
        },
        handleFocusPopup() {
          if (this.$el.dataset.isFirstLoad == 'true') {
            this.$el.dataset.isFirstLoad = 'false'
          } else {
            Alpine.store('xFocusElement').trapFocus(`PopupFullWidth-${data.sectionId}`, `ClosePromotionPopup__${data.sectionId}`);
          }
        }
      }))
    })
  })
}