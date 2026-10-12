requestAnimationFrame(() => {
  const defineXQuickView = () => {
    Alpine.store('xQuickView', {
      sectionId: window.xQuickView.sectionId,
      enabled: window.xQuickView.enabled,
      buttonLabel: window.xQuickView.buttonLabel,
      show: false,
      loading: false,
      cachedResults: [],
      cachedFetch: [],
      selected: false,
      buttonQuickView: "",
      openQuickViewForm: '',
      _openCallbacks: [],
      _scriptsLoaded: false,
      _scriptsLoadedPromise: null,
      init() {
        if (Shopify.designMode) {
          document.addEventListener("shopify:section:load", (event) => {
            if (!event.target.classList.contains('section-quick-view')) return;
            this.cachedResults = [];
            this.cachedFetch = [];
          });
        }
        document.addEventListener('quickview:load', (e) => {
          this.load(e.detail.productId, e.detail.productUrl, e.detail.el);
        });
        document.addEventListener('quickview:open', (e) => {
          this.open(e.detail?.openFrom || '');
        });
        document.addEventListener('quickview:close', () => this.close());
        document.addEventListener('quickview:hide', () => { this.show = false; });
        this._initScripts();
      },
      _initScripts() {
        const container = document.getElementById('QuickViewContainer');
        if (!container) return;

        const scriptKeys = [
          'variantPickerScript',
          'videoScript',
          'customizableOptionsScript',
          'shippingPolicyScript',
        ];
        const scripts = scriptKeys
          .map(key => container.dataset[key])
          .filter(Boolean);

        if (!scripts.length) {
          this._scriptsLoaded = true;
          return;
        }

        let resolve;
        this._scriptsLoadedPromise = new Promise(r => { resolve = r; });

        this._openCallbacks.push(() => {
          const toLoad = scripts.filter(src => {
            const filename = src.split('/').pop().split('?')[0];
            return !window.Maximize.loadedScript.includes(filename);
          });

          if (!toLoad.length) {
            this._scriptsLoaded = true;
            resolve();
            return;
          }

          Promise.all(
            toLoad.map(src => new Promise(res => {
              const script = document.createElement('script');
              script.src = src;
              script.onload = res;
              script.onerror = res;
              document.head.appendChild(script);
            }))
          ).then(() => {
            // Wait one rAF so scripts that defer Alpine registration via
            // requestAnimationFrame have a chance to run before HTML is injected
            requestAnimationFrame(() => {
              this._scriptsLoaded = true;
              resolve();
            });
          });
        });
      },
      loadScripts() {
        if (this._scriptsLoaded) return Promise.resolve();
        if (this._scriptsLoadedPromise) return this._scriptsLoadedPromise;
        return Promise.resolve();
      },
      addListener() {
        document.addEventListener(`${CART_EVENT.cartUpdate}`, () => {
          this.cachedResults = [];
        });
      },
      load(productId, url, el) {
        if (this.buttonQuickView == '') {
          this.buttonQuickView = el;
        }
        const productCardWrapper = el.closest('.product-card__wrapper');

        const listSelectedInput = Array.from(
          productCardWrapper?.getElementsByClassName('variant-option__input selected') || []
        );
        const currentVariantEl = productCardWrapper?.querySelector('.current-variant');
        let variantId = '';
        if (currentVariantEl) {
          try {
            const currentVariant = JSON.parse(currentVariantEl.textContent);
            variantId = currentVariant && typeof currentVariant === 'object' ? currentVariant.id : currentVariant;
          } catch (e) {
            variantId = '';
          }
        }
        // let optionsSelectedValues = listSelectedInput.map(input => input.dataset.optionValueId);
        // optionsSelectedValues = [];
        const productUrl = variantId ? `${url}?variant=${variantId}&section_id=${this.sectionId}` : `${url}?section_id=${this.sectionId}`;
        // let productUrl = variantId ? `${url}?option_values=${optionsSelectedValues.join(',')}&section_id=${this.sectionId}` : `${url}?section_id=${this.sectionId}`;

        if (this.cachedResults[productUrl]) {
          document.getElementById('QuickViewProductContent').innerHTML = this.cachedResults[productUrl];
          Alpine.nextTick(() => {
            Alpine.store('xFocusElement').trapFocus('QuickViewContainer', 'QuickViewClose');
          });
          return true;
        }

        if (this.cachedFetch[productUrl]) {
          return true;
        }

        this.loading = true;
        this.cachedFetch[productUrl] = true;
        this.loadScripts().then(() => {
          fetch(productUrl)
            .then(response => {
              return response.text();
            })
            .then((response) => {
              const parser = new DOMParser();
              const content = parser.parseFromString(response, 'text/html').getElementById("QuickViewProductContent").innerHTML;
              document.getElementById('QuickViewProductContent').innerHTML = content;
              this.cachedResults[productUrl] = content;
              Alpine.nextTick(() => {
                Alpine.store('xFocusElement').trapFocus('QuickViewContainer', 'QuickViewClose');
              });
            })
            .finally(() => {
              this.loading = false;
              this.cachedFetch[productUrl] = false;
            });
        });

        return true;
      },
      open(openFrom = '') {
        if (this._openCallbacks.length > 0) {
          this._openCallbacks.forEach(cb => cb());
          this._openCallbacks = [];
        }
        this.show = true;
        Alpine.store('xMaximizeDrawer').isOpen = false;
        document.getElementById('CartDrawer').isOpen = false;
        Alpine.store('xMaximizeDrawer').handleOpen("#QuickViewContainer__wapper");
        this.openQuickViewForm = openFrom;
      },
      close() {
        this.show = false;
        this.buttonQuickView = '';

        if (this.openQuickViewForm === 'cart_drawer_upsell') {
          Alpine.store('xMaximizeDrawer').handleClose();
          document.getElementById('CartDrawer').isOpen = true;
          setTimeout(() => {
            this.openQuickViewForm = '';
          }, 1000)
        } else {
          Alpine.store('xMaximizeDrawer').handleClose();
        }
        this.removeFocusQuickView();
      },
      focusQuickView(quickView, btnClose) {
        if (!this.selected) {
          Alpine.store('xFocusElement').trapFocus(quickView, btnClose);
        }
      },
      removeFocusQuickView() {
        if (!this.selected) {
          Alpine.store('xFocusElement').removeTrapFocus();
        }
      }
    });
    
    Alpine.data('xMediaGalleryQuickView', (mediaGalleryWrapperEle, sectionId, isShowMediaWithVariantSelected) => ({
      isFirstLoading: true,
      swiffySlider: null,
      thumbnailItems: [],
      thumbnailItemsShow: [],
      mediaItems: [],
      mediaItemsShow: [],
      indexActiveThumbnail: 0,
      indexActiveMedia: 0,
      activeMediaId: false,
      activeMediaItem: false,
      listMediaApplyShowMediaWithVariantSelected: [],
      productMediasInfo: [],
      currentVariant: false,
      sliderIndicatorWrapperEle: mediaGalleryWrapperEle.querySelector('.slider-indicators'),
      listDotsWrapperEl: mediaGalleryWrapperEle.querySelector('.media-gallery__dot-nav__wrapper'),
      listDotsEl: [],
      listDotsShowEl: [],
      maxNumberDotShow: 0,
      showScrollHintDesktop: false,
      init() {
        this.sectionContainer = document.querySelector(`.section--${sectionId}`);
        if (!this.sectionContainer) {
          this.sectionContainer = document.querySelector(`.main-product__container--${sectionId}`);
        }
        if (this.sectionContainer) {
          this.thumbnailWrapper = this.sectionContainer.querySelector(`.media-gallery__thumbnail-wrapper`);
          this.mediaWrapper = this.sectionContainer.querySelector(`.media-gallery__container`);
          this.thumbnailItems = this.sectionContainer.querySelectorAll('.media-gallery__thumbnail-item');
          this.thumbnailItemsShow = this.sectionContainer.querySelectorAll('.media-gallery__thumbnail-item.is-show-thumbnail-item');
          this.mediaItems = this.sectionContainer.querySelectorAll('.media-gallery__media-item');
          this.mediaItemsShow = this.sectionContainer.querySelectorAll('.media-gallery__media-item.is-show-media-item');
          this.listIndicatorEle = this.sliderIndicatorWrapperEle ? this.sliderIndicatorWrapperEle.querySelectorAll(`.slider-indicator`) : [];
          this.listDotsEl = this.listDotsWrapperEl ? this.listDotsWrapperEl.querySelectorAll(`.media-gallery__dot-nav__dot-item`) : [];

          if (this.thumbnailWrapper) {
            this.thumbnailContainer = this.thumbnailWrapper.querySelector('.media-gallery__thumbnail-container');
          }

          let indexActiveMedia = Array.from(this.mediaItems).findIndex(item => item.classList.contains('is-active'));
          this.indexActiveMedia = indexActiveMedia >= 0 ? indexActiveMedia : 0;
          this.activeMediaItem = this.mediaItems[this.indexActiveMedia];
          this.activeMediaId = this.mediaItems[this.indexActiveMedia].dataset.mediaId;

          requestAnimationFrame(() => {
            this.handleScrollDot();
          })
        }
        const dotNavContainerEl = mediaGalleryWrapperEle.querySelector('.media-gallery__dot-nav__container');
        if (dotNavContainerEl) {
          this.maxNumberDotShow = SLIDER_DOT.MAX_NUMBER_DOTS;
        }
        const productMediaInfoEle = document.querySelector(`#ProductMediaInfo__${sectionId}`);
        if (productMediaInfoEle) {
          this.productMediasInfo = JSON.parse(productMediaInfoEle.textContent);
        }
        this.currentVariantInfoElement = document.querySelector(`#CurrentVariantInfo__${sectionId}`);
        this.currentVariant = JSON.parse(this.currentVariantInfoElement.textContent);

        const updateVideoProductMedia = () =>  {
          this.mediaItems.forEach(mediaItem => {
            const videoContainer = mediaItem.querySelector('.external-video');
            if (videoContainer && window.innerWidth < MIN_DEVICE_WIDTH.tablet) {
              if (mediaItem.dataset.mediaId == this.activeMediaId) {
                  Alpine.store('xVideo').updateStatusVideo(videoContainer, true, true);
              } else {
                  Alpine.store('xVideo').updateStatusVideo(videoContainer, false, true);
              }
            }
          })
        }

        this.$watch('activeMediaId', (newActiveMediaId, oldActiveMediaId) => {
          const oldMediaItem =  Array.from(this.mediaItems).find(item => parseInt(item.dataset.mediaId) === oldActiveMediaId);
          if (oldMediaItem) {
            oldMediaItem.style.backgroundImage = ``;
            const media = oldMediaItem.querySelector('.media-gallery-item__media');
            if (media) {
              media.classList.remove('hidden');
            }
          }
          // this.indexActiveThumbnail = newValue;
          this.__scrollThumbnail();
          // this.__updateHeightWhenRatioNatural();
          this.mediaItems.forEach(mediaItem => {
            if (mediaItem.dataset.mediaId == newActiveMediaId) {
              this.activeMediaItem = mediaItem;
              mediaItem.classList.add('is-active');
            } else {
              mediaItem.classList.remove('is-active');
            }
          })
          updateVideoProductMedia();
          this.thumbnailItemsShow.forEach(thumbnailItem => {
            if (thumbnailItem.dataset.mediaId == newActiveMediaId) {
              thumbnailItem.classList.add('is-active');
            } else {
              thumbnailItem.classList.remove('is-active');
            }
          })
          this.listIndicatorEle = this.sliderIndicatorWrapperEle ? this.sliderIndicatorWrapperEle.querySelectorAll(`.slider-indicator`) : [];
          this.listDotsEl = this.listDotsWrapperEl ? this.listDotsWrapperEl.querySelectorAll(`.media-gallery__dot-nav__dot-item`) : [];
          this.listIndicatorEle.forEach(indicator => {
            if (indicator.dataset.mediaId == newActiveMediaId) {
              indicator.classList.add('active');
            } else {
              indicator.classList.remove('active');
            }
          })
          const newIndexActiveSlide = Array.from(this.swiffySlider.slides).findIndex(item => item.dataset.mediaId === newActiveMediaId);
          this.swiffySlider.slideTo(newIndexActiveSlide);
          this.scrollToActiveMedia();
          requestAnimationFrame(() => {
            this.handleScrollDot();
          })
        })

        requestAnimationFrame(() => {
          if (this.$refs.thumbnail_wrapper) {
            const listThumbnailShow = this.$refs.thumbnail_wrapper.querySelectorAll(`.media-gallery__thumbnail-item.is-show-thumbnail-item`);

            if (listThumbnailShow.length > 1) {
              this.$refs.thumbnail_wrapper.classList.add('is-show');
            } else {
              this.$refs.thumbnail_wrapper.classList.remove('is-show');
            }
            this.__updateShowThumbnailNav();
            this.__scrollThumbnail();
          }
        });

        this.$watch('listMediaApplyShowMediaWithVariantSelected', (newList) => {
          const newListString = newList.map(String);
          if (this.$refs.thumbnail_wrapper) {
            if (newList.length > 1) {
              this.$refs.thumbnail_wrapper.classList.add('is-show');
            } else {
              this.$refs.thumbnail_wrapper.classList.remove('is-show');
            }
          }

          this.mediaItems.forEach(mediaItem => {
            if (newListString.includes(mediaItem.dataset.mediaId)) {
              mediaItem.classList.add('is-show-media-item');
            } else {
              mediaItem.classList.remove('is-show-media-item');
            }
          })
          this.mediaItemsShow = this.sectionContainer.querySelectorAll('.media-gallery__media-item.is-show-media-item');
          this.thumbnailItems.forEach(thumbnailItem => {
            if (newListString.includes(thumbnailItem.dataset.mediaId)) {
              thumbnailItem.classList.add('is-show-thumbnail-item');
            } else {
              thumbnailItem.classList.remove('is-show-thumbnail-item');
            }
          })
          this.thumbnailItemsShow = this.sectionContainer.querySelectorAll('.media-gallery__thumbnail-item.is-show-thumbnail-item');
          this.__scrollThumbnail();
          this.listIndicatorEle = this.sliderIndicatorWrapperEle ? this.sliderIndicatorWrapperEle.querySelectorAll(`.slider-indicator`) : [];
          this.listDotsEl = this.listDotsWrapperEl ? this.listDotsWrapperEl.querySelectorAll(`.media-gallery__dot-nav__dot-item`) : [];
          this.listIndicatorEle.forEach(indicator => {
            if (newListString.includes(indicator.dataset.mediaId)) {
              indicator.classList.add('is-show-indicator');
            } else {
              indicator.classList.remove('is-show-indicator'); 
            }
          })
          this.listDotsShowEl = []
          this.listDotsEl.forEach(dot => {
            if (newListString.includes(dot.dataset.mediaId)) {
              dot.classList.add('is-show-dot');
              this.listDotsShowEl.push(dot)
            } else {
              dot.classList.remove('is-show-dot');
            }
          })

          if (this.swiffySlider) {
            this.swiffySlider.slides = mediaGalleryWrapperEle.querySelectorAll('.slide-item.is-show-media-item');
            this.swiffySlider.sliderIndicators = mediaGalleryWrapperEle.querySelectorAll(`.slider-indicator.is-show-indicator`);
            const indexActive = Array.from(this.swiffySlider.slides).findIndex(item => item.dataset.mediaId === this.activeMediaId);

            if (indexActive > -1) {
              this.swiffySlider.slideTo(indexActive);
              requestAnimationFrame(() => {
                this.checkShowScrollHintDesktop();
                this.scrollToActiveMedia();
              });
            }
            this.swiffySlider.addEventToIndicators();
          }

          requestAnimationFrame(() => {
            this.__updateShowThumbnailNav();
            this.checkShowScrollHintDesktop();
          })
        })
        this.handleChangeVariant();
        const debounce = (callback, delay) => {
          let timer;
          return function() {
            clearTimeout(timer);
            timer = setTimeout(callback, delay);
          };
        };

        window.addEventListener('resize', debounce(() => {
          this.__updateShowThumbnailNav();
        }, 300));
        
        installMediaQueryWatcher(`(min-width: ${MIN_DEVICE_WIDTH.tablet}px)`, (matches) => { 
          if (!matches) {
            updateVideoProductMedia();
          } else {
            requestAnimationFrame(() => {
              this.checkShowScrollHintDesktop();
            });
            this.scrollToActiveMedia();
          }
        });

        Alpine.nextTick(() => {
          this.checkShowScrollHintDesktop();
        });
      },
      handleScrollDot() {
        requestAnimationFrame(() => {
          if (this.listDotsShowEl.length > 0) {
            const listDotsContainerEl = this.listDotsWrapperEl.querySelector('.media-gallery__dot-nav__dot-list');
            if (!listDotsContainerEl) return;

            const listDotsContainerWidth = listDotsContainerEl.getBoundingClientRect().width;
            const dotWidth = SLIDER_DOT.DOT_WIDTH;
            const listDotsContainerGap = SLIDER_DOT.DOT_GAP;
            if (!dotWidth && listDotsContainerGap) return;
            
            let indexActiveMedia = Array.from(this.mediaItemsShow).findIndex(item => item.dataset.mediaId == this.activeMediaId);
            if (indexActiveMedia == -1 ) {
              indexActiveMedia = 0;
            }

            this.listDotsShowEl.forEach(dot => {
              dot.classList.remove('dot-small', 'dot-normal');
              if (dot.dataset.mediaId == this.activeMediaId) {
                dot.classList.add('is-active');
              } else {
                dot.classList.remove('is-active');
                if (this.maxNumberDotShow >= this.listDotsShowEl.length) {
                  dot.classList.add('dot-normal')
                }
              }
            })

            if (this.maxNumberDotShow >= this.listDotsShowEl.length) return;

            this.listDotsShowEl[indexActiveMedia + 1] && this.listDotsShowEl[indexActiveMedia + 1].classList.add('dot-normal');
            this.listDotsShowEl[indexActiveMedia - 1] && this.listDotsShowEl[indexActiveMedia - 1].classList.add('dot-normal');
            this.listDotsShowEl[indexActiveMedia + 2] && this.listDotsShowEl[indexActiveMedia + 2].classList.add('dot-small');
            this.listDotsShowEl[indexActiveMedia - 2] && this.listDotsShowEl[indexActiveMedia - 2].classList.add('dot-small');

            const scrollLeftValue = (indexActiveMedia * (dotWidth + listDotsContainerGap) - ( listDotsContainerWidth / 2 - dotWidth / 2)) * (window.Maximize.rtl ? -1 : 1);
            listDotsContainerEl.scrollTo({
              left: scrollLeftValue,
              behavior: 'smooth'
            });
          }
        })
      },
      handleInitSwiffy(el, configs) {
        this.isFirstLoading = false;

        this.swiffySlider = new SwiffySlider(el, configs);
        this.mediaItems = this.sectionContainer.querySelectorAll('.media-gallery__media-item');
        this.mediaItemsShow = this.sectionContainer.querySelectorAll('.media-gallery__media-item.is-show-media-item');

        const productMediaInfoEle = document.querySelector(`#ProductMediaInfo__${sectionId}`);
        if (productMediaInfoEle) {
          try {
            this.productMediasInfo = JSON.parse(productMediaInfoEle.textContent || '[]');
          } catch (e) {
            console.error('[xMediaGalleryQuickView] failed to parse ProductMediaInfo', e);
          }
        }
        
        if (this._variantListenerController) {
          this._variantListenerController.abort();
        }
        this._variantListenerController = new AbortController();

        document.addEventListener(`${PRODUCT_EVENT.updatedVariant}${sectionId}`, (event) => {
          const {currentVariant} = event.detail;
          this.currentVariant = currentVariant;

          this.handleChangeVariant(event);
        }, { signal: this._variantListenerController.signal });

        el.addEventListener(`${SWIFFY_SLIDER_EVENT.slide}`, (event) => {
          if (this.swiffySlider.slides[this.swiffySlider.activeSlideIndex]) {
            this.activeMediaId = this.swiffySlider.slides[this.swiffySlider.activeSlideIndex].dataset.mediaId;
          }
        })
        if (!this.mediaWrapper) {
          this.sectionContainer = document.querySelector(`.section--${sectionId}`);
          if (!this.sectionContainer) {
            this.sectionContainer = document.querySelector(`.main-product__container--${sectionId}`);
          }
          if (this.sectionContainer) {
            this.mediaWrapper = this.sectionContainer.querySelector(`.media-gallery__container`);
          }
        }
      },
      handleClickNav: function (event, isNext) {
        const totalItemsShow = this.mediaItemsShow.length;
        let indexActiveThumbnail = Array.from(this.mediaItemsShow).findIndex(item => item.dataset.mediaId == this.activeMediaId);

        while (true) {
          indexActiveThumbnail += isNext ? 1 : -1;
          if (indexActiveThumbnail < 0) {
            indexActiveThumbnail = totalItemsShow - 1;
          } else if (indexActiveThumbnail >= totalItemsShow) {
            indexActiveThumbnail = 0;
          }

          this.activeMediaId = this.mediaItemsShow[indexActiveThumbnail].dataset.mediaId;
          break;
        }
      },
      handleFocusThumbnail: function (event) {
        const thumbnailItem = event.currentTarget;
        this.activeMediaId = thumbnailItem.dataset.mediaId;
      },
      handleChangeVariant(event) {
        let listMediaApplyShowMediaWithVariantSelected = [];
        let listMediaNullAlt = [];

        if (isShowMediaWithVariantSelected && this.currentVariant && this.currentVariant.options[0]) {
          let activeMediaId = false;

          let firstOptionHandleCurrentVariant = this.currentVariant.options[0].toLowerCase().replace(/ /g,'-');
          this.mediaItems.forEach(item => {
            if (item.dataset.mediaAlt !== '') {
              let mediaAltHandle = item.dataset.mediaAlt;
              if (firstOptionHandleCurrentVariant === mediaAltHandle) {
                if (!activeMediaId) {
                  activeMediaId = item.dataset.mediaId;
                }

                listMediaApplyShowMediaWithVariantSelected.push(item.dataset.mediaId);
              }
            } else  {
              listMediaNullAlt.push(item.dataset.mediaId);
            }
          })
          if (!activeMediaId) {
            if (this.currentVariant.featured_media && this.currentVariant.featured_media.id) {
              activeMediaId = this.currentVariant.featured_media.id.toString();
            } else {
              activeMediaId = this.productMediasInfo[0].id.toString();
            }
          }
          listMediaApplyShowMediaWithVariantSelected.push(activeMediaId);
          this.activeMediaId = activeMediaId;
          
          listMediaApplyShowMediaWithVariantSelected = listMediaApplyShowMediaWithVariantSelected.concat(listMediaNullAlt);
        } else {
          if (event) {
            let featuredMediaId = `${event.detail.previewMediaId}`;

            if (this.currentVariant && this.currentVariant.featured_media && this.currentVariant.featured_media.id) {
              featuredMediaId = `${this.currentVariant.featured_media.id}`;
            }
            this.activeMediaId = featuredMediaId.toString();
          }

          this.productMediasInfo.forEach(media => {
            listMediaApplyShowMediaWithVariantSelected.push(media.id);
          })
        }

        this.listMediaApplyShowMediaWithVariantSelected = [...new Set(listMediaApplyShowMediaWithVariantSelected)];
        if (this.sliderIndicatorWrapperEle) {
          if (this.listMediaApplyShowMediaWithVariantSelected.length > 1) {
            this.sliderIndicatorWrapperEle.classList.remove('invisible');
          } else {
            this.sliderIndicatorWrapperEle.classList.add('invisible');
          }
        }
      },
      __scrollThumbnail: function () {
        if (this.thumbnailContainer && this.thumbnailWrapper) {
          const gap = parseInt(this.thumbnailContainer.dataset.gap) || 0;
          this.thumbnailItems.forEach((item, index) => {
            if (item.dataset.mediaId === this.activeMediaId) {
              item.classList.add('is-active');
            } else {
              item.classList.remove('is-active');
            }
          })
          requestAnimationFrame(() => {
            const indexActiveThumbnail = Array.from(this.thumbnailItemsShow).findIndex(item => item.dataset.mediaId === this.activeMediaId);
            if (window.innerWidth < MIN_DEVICE_WIDTH.tablet) {
              let scrollLeftValue = 0;
              if (indexActiveThumbnail > 0) {
                for (let i = 0; i < indexActiveThumbnail; i++) {
                  scrollLeftValue += this.thumbnailItemsShow[i].offsetWidth + gap;
                }
              }
              if (window.Maximize.rtl) {
                scrollLeftValue = scrollLeftValue * -1;
              }

              this.thumbnailContainer.scrollTo({
                left: scrollLeftValue,
                behavior: 'smooth'
              });
            }
          });
        }
      },
      __updateShowThumbnailNav() {
        if (this.$refs.thumbnail_wrapper) {
          const thumbnailNavs = this.$refs.thumbnail_wrapper.querySelectorAll('.media-gallery__thumbnail-nav');
          this.thumbnailItemsShow = this.sectionContainer.querySelectorAll('.media-gallery__thumbnail-item.is-show-thumbnail-item');
          requestAnimationFrame(() => {
            if (window.innerWidth < MIN_DEVICE_WIDTH.tablet) {
              const thumbnailNavWrapperWidth = this.$refs.thumbnail_wrapper.getBoundingClientRect().width;
              const thumbnailWrapperWidth = this.thumbnailItemsShow[0]?.getBoundingClientRect().width * this.thumbnailItemsShow.length + parseFloat(this.thumbnailContainer.dataset.gap) * (this.thumbnailItems.length - 1);

              if (thumbnailWrapperWidth <= thumbnailNavWrapperWidth - 16 * 2) {
                thumbnailNavs.forEach(nav => {
                  nav.classList.add('!hidden');
                })
              } else {
                thumbnailNavs.forEach(nav => {
                  nav.classList.remove('!hidden');
                })
              }
            }
          });
        }
      },
      scrollToActiveMedia() {
        Alpine.nextTick(() => {
          const galleryWrapperEl = mediaGalleryWrapperEle.querySelector('.media-gallery__wrapper');

          if (window.innerWidth < MIN_DEVICE_WIDTH.tablet) {
            galleryWrapperEl.dataset.isScrollingOnDesktop = 'false';
            return;
          }

          const activeMediaItem = Array.from(this.mediaItemsShow).find(item => item.dataset.mediaId == this.activeMediaId);
          if (!galleryWrapperEl || !activeMediaItem || activeMediaItem.offsetTop <= 0) {
            galleryWrapperEl.dataset.isScrollingOnDesktop = 'false';
            return;
          }

          galleryWrapperEl.scrollTo({
            top: activeMediaItem.offsetTop,
            behavior: 'smooth'
          });
        }); 
      },
      checkShowScrollHintDesktop() {
        const galleryWrapperEl = mediaGalleryWrapperEle.querySelector('.media-gallery__wrapper');
        if (galleryWrapperEl && galleryWrapperEl.scrollHeight > galleryWrapperEl.clientHeight && galleryWrapperEl.scrollTop == 0) {
          this.showScrollHintDesktop = true;
          galleryWrapperEl.addEventListener('scroll', () => {
            this.showScrollHintDesktop = false;
          }, { once: true });

          if (galleryWrapperEl.getElementsByClassName('media-gallery__item__model').length > 0) {
            const setScrollStopped = debounce(() => {
              galleryWrapperEl.dataset.isScrollingOnDesktop = 'false';
            }, TIMEOUT.scrollIdle);

            galleryWrapperEl.addEventListener('scroll', () => {
              galleryWrapperEl.dataset.isScrollingOnDesktop = 'true';
              setScrollStopped();
            });
          }
        } else {
          this.showScrollHintDesktop = false;
        }
      }
    }))
  };
  if (window.Alpine) {
    defineXQuickView();
  } else {
    document.addEventListener('alpine:init', defineXQuickView);
  }
});