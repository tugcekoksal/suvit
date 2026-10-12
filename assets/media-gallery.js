if(window.Maximize.checkFileNotLoaded()) {
  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xMediaGallery', (mediaGalleryWrapperEle, sectionId, zoomEffect, isShowMediaWithVariantSelected, desktopLayout) => ({
        isFirstLoading: true,
        swiffySlider: null,
        thumbnailItems: [],
        thumbnailItemsShow: [],
        listZoomThumbnailItems : [],
        listZoomThumbnailItemsShow : [],
        isShowZoomThumbnail: true,
        mediaItems: [],
        mediaItemsShow: [],
        indexActiveMedia: 0,
        activeMediaId: false,
        zoomItemActiveMediaId: false,
        zoomSelectedItem: null,
        isZoomOpen: false,
        listMediaApplyShowMediaWithVariantSelected: [],
        productMediasInfo: [],
        currentVariant: false,
        listZoomItemsEnlarge: [],
        listZoomItemsEnlargeShow: [],
        listDotsWrapperEl: mediaGalleryWrapperEle.querySelector('.media-gallery__dot-nav__wrapper'),
        listDotsEl: [],
        listDotsShowEl: [],
        maxNumberDotShow: 0,
        heightHeaderAndAnnouncementBar: 0,
        boundZoomHandler: null,
        sectionContainer: null,
        swiffySlideZoomLarge: null,
        thumbnailWrapper: null,
        thumbnailContainer: null,
        zoomEnlargeWrapperEle: null,
        zoomEnlargeThumbnailWrapper: null,
        init() {
          this.boundZoomHandler = this.handleZoomWhenHoverImage.bind(this);
          this.sectionContainer = document.querySelector(`.section--${sectionId}`);

          if (this.sectionContainer) {
            this.thumbnailWrapper = this.sectionContainer.querySelector(`.media-gallery__thumbnail-wrapper`);
            this.mediaWrapper = this.sectionContainer.querySelector(`.media-gallery__container`);
            this.thumbnailItems = this.sectionContainer.querySelectorAll('.media-gallery__thumbnail-item');
            this.thumbnailItemsShow = this.sectionContainer.querySelectorAll('.media-gallery__thumbnail-item.is-show-thumbnail-item');
            this.mediaItems = this.sectionContainer.querySelectorAll('.media-gallery__media-item');
            this.mediaItemsShow = this.sectionContainer.querySelectorAll('.media-gallery__media-item.is-show-media-item');
            this.listDotsEl = this.listDotsWrapperEl?.querySelectorAll(`.media-gallery__dot-nav__dot-item`) || [];

            this.thumbnailContainer = this.thumbnailWrapper?.querySelector('.media-gallery__thumbnail-container');

            let indexActiveMedia = Array.from(this.mediaItems).findIndex(item => item.classList.contains('is-active'));
            indexActiveMedia = indexActiveMedia >= 0 ? indexActiveMedia : 0;

            this.activeMediaId = this.mediaItems[indexActiveMedia].dataset.mediaId;
            
            requestAnimationFrame(() => {
              this.handleScrollDot();
              // this.__updateHeightWhenRatioNatural();
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
          const currentVariantInfoElement = document.querySelector(`#CurrentVariantInfo__${sectionId}`);
          this.currentVariant = JSON.parse(currentVariantInfoElement.textContent);

          this.$watch('activeMediaId', (newActiveMediaId) => {
            this.isZoomOpen = false;
            if (zoomEffect === ZOOM_EFFECT.magnifier) {
              this.__handleCloseZoom();
            }
            // this.indexActiveThumbnail = newValue;
            // this.__updateHeightWhenRatioNatural();
            this.mediaItems.forEach(mediaItem => {
              if (mediaItem.dataset.mediaId == newActiveMediaId) {
                mediaItem.classList.add('is-active');
              } else {
                mediaItem.classList.remove('is-active');
              }
            })


            this.thumbnailItemsShow.forEach(thumbnailItem => {
              if (thumbnailItem.dataset.mediaId == newActiveMediaId) {
                thumbnailItem.classList.add('is-active');
              } else {
                thumbnailItem.classList.remove('is-active');
              }
            })
            const newIndexActiveSlide = Array.from(this.swiffySlider.slides).findIndex(item => item.dataset.mediaId === newActiveMediaId);
            if (!this.isFirstLoading && !(mediaGalleryWrapperEle.dataset.isScrollingOnDesktop == 'true' && this.swiffySlider.isDragging)) {
              this.swiffySlider.slideTo(newIndexActiveSlide);
            }
            this.updateActiveMediaInTwoColumns();
            this.__updateInertTwoColumnsLayout();
            
            requestAnimationFrame(() => {
              this.__scrollThumbnail();
              this.__updateVideoProductMedia();
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
            this.listDotsShowEl = []
            this.listDotsEl.forEach(dot => {
              if (newListString.includes(dot.dataset.mediaId)) {
                dot.classList.add('is-show-dot');
                this.listDotsShowEl.push(dot)
              } else {
                dot.classList.remove('is-show-dot');
              }
            })
            
            this.zoomEnlargeWrapperEle = document.querySelector(`#MediaGalleryZoom__Enlarge__${sectionId}`);
            if (this.zoomEnlargeWrapperEle) {
              this.zoomEnlargeThumbnailWrapper = this.zoomEnlargeWrapperEle.querySelector('.zoom-enlarge__thumbnail-wrapper');
              this.zoomEnlargeThumbnailContainer = this.zoomEnlargeWrapperEle.querySelector('.zoom-enlarge__thumbnail-container');
              
              this.listZoomItemsEnlarge = this.zoomEnlargeWrapperEle.querySelectorAll(`.media-gallery__zoom-enlarge__item`);
              this.listZoomThumbnailItems = this.zoomEnlargeWrapperEle.querySelectorAll(`.zoom-enlarge__thumbnail-item`);
            }

            this.listZoomItemsEnlarge.forEach(zoomItem => {
              if (newListString.includes(zoomItem.dataset.mediaId)) {
                zoomItem.classList.add('is-show-media-zoom-item');
              } else {
                zoomItem.classList.remove('is-show-media-zoom-item');
              }
            })

            this.listZoomThumbnailItems.forEach(zoomThumbnailItem => {
              if (newListString.includes(zoomThumbnailItem.dataset.mediaId)) {
                zoomThumbnailItem.classList.add('is-show-media-zoom-item');
              } else {
                zoomThumbnailItem.classList.remove('is-show-media-zoom-item');
              }
            })

            if (this.zoomEnlargeWrapperEle) {
              this.listZoomItemsEnlargeShow = this.zoomEnlargeWrapperEle.querySelectorAll(`.media-gallery__zoom-enlarge__item.is-show-media-zoom-item`);
              this.listZoomThumbnailItemsShow = this.zoomEnlargeWrapperEle.querySelectorAll(`.zoom-enlarge__thumbnail-item.is-show-media-zoom-item`);
            }

            if (this.swiffySlider) {
              this.swiffySlider.slides = mediaGalleryWrapperEle.querySelectorAll('.slide-item.is-show-media-item');
              const indexActive = Array.from(this.swiffySlider.slides).findIndex(item => item.dataset.mediaId === this.activeMediaId);

              if (indexActive > -1 && !this.isFirstLoading) {
                requestAnimationFrame(() => {
                  this.swiffySlider.slideTo(indexActive);
                })
              }
              this.swiffySlider.addEventToIndicators();
            }

            if (this.swiffySlideZoomLarge) {
              this.swiffySlideZoomLarge.slides = this.zoomEnlargeWrapperEle.querySelectorAll(`.media-gallery__zoom-enlarge__item.is-show-media-zoom-item`);
              
              this.swiffySlideZoomLarge.sliderNavs.forEach((nav) => {
                nav.classList[this.swiffySlideZoomLarge.slidesPerView > 0 && this.swiffySlideZoomLarge.slidesPerView < this.swiffySlideZoomLarge.slides.length ? "add" : "remove"]("is-visible");
              });
            }

            if (desktopLayout != PRODUCT_MEDIA_DESKTOP_LAYOUT.slider1Columns && isShowMediaWithVariantSelected) {
              const isTwoColumns = this.mediaItemsShow.length > 1;
              const sizes = isTwoColumns ? this.mediaWrapper.dataset.sizesInTwoColumns : this.mediaWrapper.dataset.sizes;

              this.mediaItems.forEach(mediaItem => {
                if (mediaItem.dataset.mediaType == 'image' || mediaItem.dataset.mediaType == 'video') {
                  const imageEl = mediaItem.querySelector('img');
                  if (imageEl) {
                    const srcset = isTwoColumns ? imageEl.dataset.srcsetInTwoColumns : imageEl.dataset.srcset;
                    if (srcset) imageEl.setAttribute('srcset', srcset);
                    if (sizes) imageEl.setAttribute('sizes', sizes);
                  }
                }
              })
            }
            
            requestAnimationFrame(() => {
              this.__scrollThumbnail();
              this.__updateShowThumbnailNav();
            })
          })
          this.handleChangeVariant();

          window.addEventListener('resize', debounce(() => {
            this.__updateShowThumbnailNav();
            this.__scrollZoomEnlargeThumbnail();
          }, 300));

          this.$watch('zoomItemActiveMediaId', () => {
            this.__scrollZoomEnlargeThumbnail();
          })

          if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.grid2Columns) {
            this.$watch('isZoomOpen', (newIsZoomOpen) => {
              if ((window.innerWidth >= MIN_DEVICE_WIDTH.desktop && zoomEffect === ZOOM_EFFECT.magnifier) || window.innerWidth < MIN_DEVICE_WIDTH.tablet) return;

              this.mediaItems.forEach(mediaItem => {
                const videoContainer = mediaItem.querySelector('.external-video');
                if (videoContainer) {
                  if (newIsZoomOpen) {
                    Alpine.store('xVideo').pause(videoContainer);
                  }
                }
              })
            });
          }
        },
        updateActiveMediaInTwoColumns() {
          requestAnimationFrame(() => {
            if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider2Columns) {
              let indexActiveMedia = Array.from(this.mediaItemsShow).findIndex(item => item.dataset.mediaId == this.activeMediaId);
              if (indexActiveMedia == -1 ) {
                indexActiveMedia = 0;
              }
              this.mediaItemsShow.forEach((item, index) => {
                const videoContainer = item.getElementsByClassName('external-video')[0];
                if (index === indexActiveMedia || (indexActiveMedia != this.mediaItemsShow.length - 1 && index === indexActiveMedia + 1) || (indexActiveMedia == this.mediaItemsShow.length - 1 && index === indexActiveMedia - 1)) {
                  item.classList.add("is-active-in-two-columns");
                  if (item.dataset.mediaType === 'model') {
                    document.dispatchEvent(new CustomEvent(`${PRODUCT_MEDIA_EVENT.show_model}-${item.dataset.mediaId}`));
                  }
                  if (videoContainer) {
                    videoContainer.dataset.isActive = 'true';
                  }
                } else {
                  item.classList.remove("is-active-in-two-columns");
                  if (videoContainer) {
                    videoContainer.dataset.isActive = 'false';
                  }
                }
              });
            }
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
                if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider2Columns) {
                  dot.parentNode.classList.remove('md:hidden');
                }
                if (dot.dataset.mediaId == this.activeMediaId) {
                  dot.classList.add('is-active');
                } else {
                  dot.classList.remove('is-active');
                  if (this.maxNumberDotShow >= this.listDotsShowEl.length) {
                    dot.classList.add('dot-normal')
                  }
                }
              })

              if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider2Columns && this.listDotsShowEl.length > 2) {
                if (this.listDotsShowEl.length - 1 == indexActiveMedia) {
                  this.listDotsShowEl[0].parentNode.classList.add('md:hidden');
                } else {
                  this.listDotsShowEl[this.listDotsShowEl.length - 1].parentNode.classList.add('md:hidden');
                }
              }
  
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
          requestAnimationFrame(() => {
            this.isFirstLoading = false;
          })

          this.swiffySlider = new SwiffySlider(el, configs);
          
          this.mediaItems = this.sectionContainer.querySelectorAll('.media-gallery__media-item');
          this.mediaItemsShow = this.sectionContainer.querySelectorAll('.media-gallery__media-item.is-show-media-item');
          
          this.updateActiveMediaInTwoColumns();
          let timeoutHiddenActiveMedia;

          document.addEventListener(`${PRODUCT_EVENT.updatedVariant}${sectionId}`, (event) => {
            if (!document.contains(mediaGalleryWrapperEle)) return;

            const {currentVariant} = event.detail;
            this.currentVariant = currentVariant;

            this.handleChangeVariant(event);

            // Handle scroll to selected variant media on grid layout desktop
            if ((!Alpine.store('stickyATC') || !Alpine.store('stickyATC').isOpen) && desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.grid2Columns && window.innerWidth >= MIN_DEVICE_WIDTH.tablet) {
              const activeMediaItem = Array.from(this.mediaItems).find(item => item.dataset.mediaId == this.activeMediaId);
              this.mediaItems.forEach(item => {
                item.classList.remove('active-product-in-grid', 'shadow-medium');
              })
              if (timeoutHiddenActiveMedia) {
                clearTimeout(timeoutHiddenActiveMedia);
              }
              requestAnimationFrame(() => {
                if (activeMediaItem && this.mediaItemsShow.length > 1) {
                  activeMediaItem.classList.add('active-product-in-grid', 'shadow-medium');
                  timeoutHiddenActiveMedia = setTimeout(() => {
                    activeMediaItem.classList.remove('active-product-in-grid', 'shadow-medium');
                  }, 2000)
                }
                if (this.heightHeaderAndAnnouncementBar == 0) {
                  const sectionAnnouncementEl = document.getElementsByClassName('section-announcement')[0];
                  const sectionHeaderEl = document.getElementsByClassName('section-header')[0];
                  this.heightHeaderAndAnnouncementBar = (sectionAnnouncementEl?.getBoundingClientRect().height || 0) + (sectionHeaderEl?.getBoundingClientRect().height || 0);
                }
                const scrollPosition = activeMediaItem.getBoundingClientRect().top + window.scrollY - this.heightHeaderAndAnnouncementBar;
                window.scrollTo({
                  top: scrollPosition,
                  behavior: 'smooth'
                });
              })
            };
          });

          el.addEventListener(`${SWIFFY_SLIDER_EVENT.slide}`, (event) => {
            if (this.swiffySlider.slides[this.swiffySlider.activeSlideIndex]) {
              this.activeMediaId = this.swiffySlider.slides[this.swiffySlider.activeSlideIndex].dataset.mediaId;
            }
          })
          if (!this.mediaWrapper) {
            this.sectionContainer = document.querySelector(`.section--${sectionId}`);
            if (this.sectionContainer) {
              this.mediaWrapper = this.sectionContainer.querySelector(`.media-gallery__container`);
            }
          }
          if (this.mediaWrapper) {
            if (
              this.mediaWrapper.dataset?.scrollToChangeImage == 'true'
            ) {
              this.mediaWrapper.addEventListener('wheel', this.handleWheel.bind(this));
            }
          }
          installMediaQueryWatcher(`(min-width: ${MIN_DEVICE_WIDTH.tablet}px)`, (matches) => {
            if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider2Columns) {
              if (matches) {
                this.swiffySlider.effect = SLIDER_EFFECT.slide;
                el.dataset.effect = SLIDER_EFFECT.slide;

                const indexActive = Array.from(this.swiffySlider.slides).findIndex(item => item.dataset.mediaId === this.activeMediaId);
                this.swiffySlider.initTouchEvents();
                if (indexActive > -1) {
                  if (this.isFirstLoading) {
                    this.swiffySlider.slideTo(indexActive, true);
                  } else {
                    setTimeout(() => {
                      this.swiffySlider.slideTo(indexActive);
                    }, TIMEOUT.resize);
                  }
                }
              } else {
                this.swiffySlider.effect = SLIDER_EFFECT.fade;
                el.dataset.effect = SLIDER_EFFECT.fade;
                this.__updateVideoProductMedia();
                this.swiffySlider.initTouchEvents();
              }
              this.__updateInertTwoColumnsLayout();

              setTimeout(() => {
                this.__scrollThumbnail();
                this.handleScrollDot();
              }, TIMEOUT.resize);
            } else if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.grid2Columns) {
              if (!matches) {
                this.__updateVideoProductMedia();
                this.__scrollThumbnail();
              }
            }

            if (!matches && zoomEffect === ZOOM_EFFECT.magnifier) {
              this.__handleCloseZoom(true);
            }
          });
        },
        handleClickNav: function (isNext) {
          const totalItemsShow = this.mediaItemsShow.length;
          let indexActiveThumbnail = Array.from(this.mediaItemsShow).findIndex(item => item.dataset.mediaId == this.activeMediaId);

          while (true) {
            if (window.innerWidth >= MIN_DEVICE_WIDTH.tablet && desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider2Columns) {
              if (isNext && indexActiveThumbnail == totalItemsShow - 2) {
                indexActiveThumbnail = 0;
              } else if (!isNext && indexActiveThumbnail == totalItemsShow - 1) {
                indexActiveThumbnail -= 2;
              } else if (!isNext && indexActiveThumbnail == 0) {
                indexActiveThumbnail = totalItemsShow - 2;
              } else {
                indexActiveThumbnail += isNext ? 1 : -1;
              }
            } else {
              indexActiveThumbnail += isNext ? 1 : -1;
            }

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
        handleFocusZoomEnlargeThumbnail () {
          const newZoomItemActiveMediaId = this.$el.dataset.mediaId
          const indexActiveZoomItem = Array.from(this.swiffySlideZoomLarge.slides).findIndex(item => item.dataset.mediaId === newZoomItemActiveMediaId);
          if (indexActiveZoomItem > -1) {
            this.swiffySlideZoomLarge.slideTo(indexActiveZoomItem);

            if (this.listZoomThumbnailItemsShow.length > 0) {
              this.zoomItemActiveMediaId = newZoomItemActiveMediaId;
              
              const newActiveItem = this.swiffySlideZoomLarge.slides[indexActiveZoomItem];
              if (newActiveItem && (newActiveItem.dataset.mediaType == 'video' || newActiveItem.dataset.mediaType == 'external_video')) {
                const videoContainer = newActiveItem.getElementsByClassName('external-video')[0];
                if (!videoContainer) return;
                const thumbnailVideo = videoContainer.getElementsByClassName('media-gallery-item__img-thumbnail')[0];
                if (thumbnailVideo && !thumbnailVideo.classList.contains('hidden')) {
                  thumbnailVideo.focus();
                } else {
                  const buttonPlay = videoContainer.getElementsByClassName('button-play')[0];
                  if (buttonPlay) {
                    buttonPlay.focus();
                  } else {
                    if (newActiveItem.dataset.mediaType == 'external_video') {
                      videoContainer.focus();
                    } else {
                      const video = videoContainer.getElementsByClassName("video")[0];
                      if (!video) return;
                      video.focus();
                    }
                  }
                }
              }
            }
          }
        },
        handleWheel(event) {
          if (window.innerWidth < MIN_DEVICE_WIDTH.tablet) return;
          const mediaItem = Array.from(this.mediaItems).find(item => item.dataset.mediaId == this.activeMediaId)
          if (mediaItem && mediaItem.dataset.mediaType === 'model') return;

          event.preventDefault();
          event.stopPropagation();

          if (this.isWheelBlocked) return;
          this.isWheelBlocked = true;

          const length = this.mediaItemsShow.length;
          if (length === 0) return;
          const currentIndexMediaItem = Array.from(this.mediaItemsShow).findIndex(mediaItem => mediaItem.dataset.mediaId == this.activeMediaId);
          if (currentIndexMediaItem > -1) {
            const direction = event.deltaY > 0 ? 1 : -1;
            let newIndex = (currentIndexMediaItem + direction + length) % length;
            if (newIndex >= this.mediaItemsShow.length) {
              newIndex = 0;
            } else if (newIndex < 0) {
              newIndex = this.mediaItemsShow.length - 1;
            }            
            this.activeMediaId = this.mediaItemsShow[newIndex].dataset.mediaId;
            const newThumbnailItemsActive = Array.from(this.thumbnailItemsShow).find(item => item.dataset.mediaId === this.activeMediaId);
            if (newThumbnailItemsActive) {
              newThumbnailItemsActive.click()
            }
          }
          setTimeout(() => {
            this.isWheelBlocked = false;
          }, 1000)
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
        },
        __scrollZoomEnlargeThumbnail() {
          if (this.zoomEnlargeThumbnailContainer) {
            requestAnimationFrame(() => {
              const gap = parseInt(window.innerWidth > 768 ? this.zoomEnlargeThumbnailContainer.dataset.desktopGap : this.zoomEnlargeThumbnailContainer.dataset.mobileGap) || 0;
              let indexActiveThumbnail = 0;
              this.listZoomThumbnailItemsShow.forEach((item, index) => {
                if (item.dataset.mediaId === this.zoomItemActiveMediaId) {
                  item.classList.add('is-active');
                  indexActiveThumbnail = index;
                  this.isShowZoomThumbnail = !(item.dataset.mediaType === 'external_video' || item.dataset.mediaType === 'video');
                } else {
                  item.classList.remove('is-active');
                }
              })
  
              let scrollLeftValue = 0;
              if (indexActiveThumbnail > 0) {
                for (let i = 0; i < indexActiveThumbnail; i++) {
                  if (this.listZoomThumbnailItemsShow[i]) {
                    scrollLeftValue += this.listZoomThumbnailItemsShow[i].offsetWidth + gap;
                  }
                }
              }
              if (window.Maximize.rtl) {
                scrollLeftValue = scrollLeftValue * -1;
              }

              if (this.zoomEnlargeThumbnailWrapper) {
                this.zoomEnlargeThumbnailWrapper.scrollTo({
                  left: scrollLeftValue,
                  behavior: "smooth",
                });
              }
            })
          }
        },
        __scrollThumbnail: function () {
          if (this.thumbnailContainer && this.thumbnailWrapper) {
            const gap = parseInt(this.thumbnailContainer.dataset.gap) || 0;
            const desktopThumbnailPosition = this.thumbnailContainer.dataset?.desktopThumbnailPosition
            this.thumbnailItems.forEach((item, index) => {
              if (item.dataset.mediaId === this.activeMediaId) {
                item.classList.add('is-active');
              } else {
                item.classList.remove('is-active');
              }
            })
            requestAnimationFrame(() => {
              const indexActiveThumbnail = Array.from(this.thumbnailItemsShow).findIndex(item => item.dataset.mediaId === this.activeMediaId);
              if (window.innerWidth >= MIN_DEVICE_WIDTH.tablet && desktopThumbnailPosition != 'bottom') {
                let scrollTopValue = 0;
                if (indexActiveThumbnail > 0) {
                  for (let i = 1; i <= indexActiveThumbnail; i++) {
                    scrollTopValue += this.thumbnailItemsShow[i].offsetHeight + gap;
                  }
                }
  
                this.thumbnailWrapper.scrollTo({
                  top: scrollTopValue,
                  behavior: 'smooth'
                });
              } else {
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

                if (this.thumbnailContainer.classList.contains('enable-bg-active-in-two-columns') && window.innerWidth >= MIN_DEVICE_WIDTH.tablet) {
                  let bgActiveScrollLeftValue = scrollLeftValue;
                  const bgActiveWidth = parseFloat(window.getComputedStyle(this.thumbnailContainer, '::before').width) || 0;
                  const thumbnailContainerScrollWidth = this.thumbnailContainer.scrollWidth;
                  const thumbnailContainerWidth = this.thumbnailContainer.getBoundingClientRect().width
                  
                  if (window.Maximize.rtl) {
                    bgActiveScrollLeftValue = scrollLeftValue + thumbnailContainerWidth - bgActiveWidth;
                    if (thumbnailContainerWidth - thumbnailContainerScrollWidth > bgActiveScrollLeftValue) {
                      bgActiveScrollLeftValue = thumbnailContainerWidth - thumbnailContainerScrollWidth;
                    }
                  } else {
                    if (bgActiveScrollLeftValue + bgActiveWidth > thumbnailContainerScrollWidth) {
                      bgActiveScrollLeftValue = thumbnailContainerScrollWidth - bgActiveWidth;
                    }
                  }
                  this.thumbnailContainer.style.setProperty('--active-wrapper-offset-x', `${bgActiveScrollLeftValue}px`);
                }
              }
            })
          }
        },

        handleZoom: function (el) {
          if (zoomEffect == 'none') return;
          const mediaEl = el ? el : this.$el.closest('.media-gallery__media-item');

          if (!mediaEl || !mediaEl.dataset.mediaId) return;

          if (window.innerWidth >= MIN_DEVICE_WIDTH.desktop && zoomEffect === ZOOM_EFFECT.magnifier && 
             (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider2Columns || desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.grid2Columns) &&
             (this.zoomSelectedItem && mediaEl.dataset.mediaId != this.zoomSelectedItem.dataset.mediaId)
          ) {
            this.__handleCloseZoom();
            if (mediaEl.dataset.mediaType !== 'image') return;

            requestAnimationFrame(() => {
              this.__handleOpenZoom(mediaEl);
            });
          } else {
            if (mediaEl.dataset.mediaType !== 'image') return;

            if (this.isZoomOpen) {
              this.__handleCloseZoom();
            } else {
              this.__handleOpenZoom(mediaEl);
            }
          }
        },
        
        __handleOpenZoom: function (el) {
          this.zoomSelectedItem = el;

          const handleOpenZoomEnlargeEffect = () => {
            document.body.classList.add("overflow-hidden");
            this.zoomItemActiveMediaId = this.zoomSelectedItem.dataset.mediaId;
            this.listZoomItemsEnlarge.forEach((item, index) => {
              if (item.dataset.mediaId === this.zoomSelectedItem.dataset.mediaId) {
                item.classList.add('is-active');
              } else {
                item.classList.remove('is-active');
              }
            });
          }
          const handleOpenZoomMagnifierEffect = () =>  {
            this.zoomSelectedItem.classList.add('is-zoom-media');
            const media = this.zoomSelectedItem.querySelector('.media-gallery__item__image');

            if (media) {
              this.zoomSelectedItem.style.backgroundImage = `url('${media.src}')`;

              this.zoomSelectedItem.addEventListener('mousemove', this.boundZoomHandler);
              media.classList.add('opacity-0');
            }
          }

          requestAnimationFrame(() => {
            mediaGalleryWrapperEle.classList.add('is-open-zoom');
            this.isZoomOpen = true;
            if (window.innerWidth >= MIN_DEVICE_WIDTH.desktop) {
              if (zoomEffect === ZOOM_EFFECT.enlarge) {
                handleOpenZoomEnlargeEffect();
              } else if (zoomEffect === ZOOM_EFFECT.magnifier) {
                handleOpenZoomMagnifierEffect();
              }
            } else {
              if (zoomEffect === ZOOM_EFFECT.enlarge || zoomEffect === ZOOM_EFFECT.magnifier) {
                handleOpenZoomEnlargeEffect();
              }
            }
          })
        },

        __handleCloseZoom: function (isCloseZoomMagnifierEffect = false) {
          if (this.zoomSelectedItem) {
            this.isZoomOpen = false;
            mediaGalleryWrapperEle.classList.remove('is-open-zoom');
  
            const handleCloseZoomEnlargeEffect = () => {
              document.body.classList.remove("overflow-hidden");
              Alpine.store('xFocusElement').removeTrapFocus();
              // this.swiffySlideZoomLarge = false;
            }
  
            const handleCloseZoomMagnifierEffect = () => {
              this.zoomSelectedItem.classList.remove('is-zoom-media');
              const media = this.zoomSelectedItem.querySelector('.media-gallery-item__media');

              if (media) {
                this.zoomSelectedItem.style.backgroundImage = ``;

                this.zoomSelectedItem.removeEventListener('mousemove', this.boundZoomHandler);
                media.classList.remove('opacity-0');
              }
            }
            if (window.innerWidth >= MIN_DEVICE_WIDTH.desktop) {
              if (zoomEffect === ZOOM_EFFECT.enlarge) {
                handleCloseZoomEnlargeEffect();
              } else if (zoomEffect === ZOOM_EFFECT.magnifier) {
                handleCloseZoomMagnifierEffect();
              }
            } else {
              if (isCloseZoomMagnifierEffect) {
                handleCloseZoomMagnifierEffect();
              } else if (zoomEffect === ZOOM_EFFECT.enlarge || zoomEffect === ZOOM_EFFECT.magnifier) {
                handleCloseZoomEnlargeEffect();
              }
            }
            
            this.zoomSelectedItem = null;
          }
        },

        handleZoomWhenHoverImage: function (event) {
          if (!this.zoomSelectedItem) return;
          
          const offsetX = event.offsetX ? event.offsetX : (event.touches && event.touches[0] ? event.touches[0].pageX : 0);
          const offsetY = event.offsetY ? event.offsetY : (event.touches && event.touches[0] ? event.touches[0].pageY : 0);

          const x = (offsetX / this.zoomSelectedItem.offsetWidth) * 100;
          const y = (offsetY / this.zoomSelectedItem.offsetHeight) * 100;
          this.zoomSelectedItem.style.backgroundPosition = `${x}% ${y}%`;
        },
        handleInitZoomEffectEnlarge: function (el, configs) {
           if (!this.swiffySlideZoomLarge) {
            let updatedConfig = {...configs}
            this.swiffySlideZoomLarge = new SwiffySlider(el, updatedConfig);
          }

          el.addEventListener(`${SWIFFY_SLIDER_EVENT.slide}`, (event) => {
            if (event.target.classList.contains('zoom-enlarge__wrapper')) {
              const newActiveSlideIndex = event.detail.newActiveSlideIndex;
              this.zoomItemActiveMediaId = this.listZoomItemsEnlargeShow[newActiveSlideIndex].dataset.mediaId;
            }
          })

          requestAnimationFrame(() => {
            const indexActiveZoomItem = Array.from(this.swiffySlideZoomLarge.slides).findIndex(item => item.dataset.mediaId === (this.zoomItemActiveMediaId || this.activeMediaId));
            if (indexActiveZoomItem > -1) {
              this.swiffySlideZoomLarge.slideTo(indexActiveZoomItem);
            }
          });
        },
        __updateShowThumbnailNav() {
          if (this.$refs.thumbnail_wrapper) {
            const thumbnailNavs = this.$refs.thumbnail_wrapper.querySelectorAll('.media-gallery__thumbnail-nav');
            this.thumbnailItemsShow = this.sectionContainer.querySelectorAll('.media-gallery__thumbnail-item.is-show-thumbnail-item');
            requestAnimationFrame(() => {
              if (window.innerWidth < MIN_DEVICE_WIDTH.tablet) {
                const thumbnailNavWrapperWidth = this.$refs.thumbnail_wrapper.getBoundingClientRect().width;
                const thumbnailWrapperWidth = this.thumbnailItemsShow[0]?.getBoundingClientRect().width * this.thumbnailItemsShow.length + parseFloat(this.thumbnailContainer.dataset.gap) * (this.thumbnailItems.length - 1);
  
                const isHidden = thumbnailWrapperWidth <= thumbnailNavWrapperWidth - 32;

                thumbnailNavs.forEach(nav =>
                  nav.classList.toggle('!hidden', isHidden)
                );
              } else {
                const thumbnailNavWrapperHeight = this.$refs.thumbnail_wrapper.getBoundingClientRect().height
                let thumbnailItemsHeight = 0;
                this.thumbnailItemsShow.forEach(item => {
                  thumbnailItemsHeight += item.offsetHeight;
                });
                thumbnailItemsHeight += parseFloat(this.thumbnailContainer.dataset.gap) * (this.thumbnailItemsShow.length - 1);
                
                const isHiddenDesktop = thumbnailItemsHeight <= thumbnailNavWrapperHeight - 32 * 2;

                thumbnailNavs.forEach(nav =>
                  nav.classList.toggle('md:hidden', isHiddenDesktop)
                );
              }
            })
          }
        },
        __updateInertTwoColumnsLayout() {
          if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider2Columns) {
            requestAnimationFrame(() => {
              if (window.innerWidth >= MIN_DEVICE_WIDTH.tablet) {
                this.mediaItems.forEach((item) => {
                  item.toggleAttribute('inert', !item.classList.contains('is-active-in-two-columns'));
                });
              } else {
                this.mediaItems.forEach((item) => {
                  item.toggleAttribute('inert', item.dataset.mediaId !== this.activeMediaId);
                });
              }
            });
          }
        },
        __updateVideoProductMedia()  {
          this.mediaItems.forEach(mediaItem => {
            const videoContainer = mediaItem.querySelector('.external-video');
            if (!videoContainer) return;

            if (window.innerWidth < MIN_DEVICE_WIDTH.tablet) {
              if (mediaItem.dataset.mediaId == this.activeMediaId) {
                Alpine.store('xVideo').updateStatusVideo(videoContainer, true, true);
              } else {
                Alpine.store('xVideo').updateStatusVideo(videoContainer, false, true);
              }
            } else {
              if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider2Columns) {
                if (mediaItem.classList.contains('is-active-in-two-columns')) {
                  if (videoContainer.dataset?.videoAutoPlay == 'true') {
                    Alpine.store('xVideo').updateStatusVideo(videoContainer, true, true);
                  }
                } else {
                  Alpine.store('xVideo').updateStatusVideo(videoContainer, false, true);
                }
              } else if (desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider1Columns) {
                if (mediaItem.dataset.mediaId == this.activeMediaId) {
                  Alpine.store('xVideo').updateStatusVideo(videoContainer, true, true);
                } else {
                  Alpine.store('xVideo').updateStatusVideo(videoContainer, false, true);
                }
              }
            }
          })
        }
      }))
    })
  })
}