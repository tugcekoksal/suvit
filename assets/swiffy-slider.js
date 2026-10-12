class SwiffySlider {
  constructor(sliderElement, configs) {
    this.sliderElement = sliderElement;
    this.configs = configs;
    this.initSlider();
    this.initEvents();

    sliderElement.dataset.swiffySliderInitialized = "true";
  }

  initSlider() {
    if (this.sliderElement.querySelector(":scope >.slider-container")) {
      this.container = this.sliderElement.querySelector(":scope >.slider-container");
    } else if (this.sliderElement.querySelector(":scope >.search-page\\:slider-container")) {
      this.container = this.sliderElement.querySelector(":scope >.search-page\\:slider-container");
    }
    this.slides = this.container ? this.container.querySelectorAll(":scope >.slide-item") : [];
    if (this.configs.blockSlider) {
      this.slides = this.container ? this.container.querySelectorAll(":scope >.maximize-block") : [];
    }
    if (this.configs.blockStaticSlider) {
      this.slides = this.container ? this.container.querySelectorAll(":scope >.maximize-block > .shopify-block") : [];
    }

    this.defaultGap = window.innerWidth < 768 ? this.container.dataset.mobileGap || "0px" : this.container.dataset.desktopGap || "0px";
    this.gap = this.defaultGap;
 
    this.isTwoColOnDesktopProductMedia = (this.container && this.sliderElement.classList.contains('media-gallery__media-wrapper') && this.container.dataset.desktopLayout == PRODUCT_MEDIA_DESKTOP_LAYOUT.slider2Columns ) ? true : false;

    if (this.sliderElement.classList.contains('zoom-enlarge__wrapper')) {
      this.slides = this.container ? this.container.querySelectorAll(":scope >.slide-item.is-show-media-zoom-item") : [];
      this.listZoomThumbnailItems = this.sliderElement?.nextElementSibling ? this.sliderElement.nextElementSibling.querySelectorAll(".zoom-enlarge__thumbnail-item.is-show-media-zoom-item") : [];
      this.container.addEventListener("scroll", () => {if (this.isDragging) {this.handleScroll()}}, { passive: true });
    } else if (this.isTwoColOnDesktopProductMedia) {
      const mediaGalleryWrapperEle = this.sliderElement.closest('.media-gallery__wrapper');

      const debouncedScrollHandler = debounce(() => {
        mediaGalleryWrapperEle.dataset.isScrollingOnDesktop = 'false';
      }, TIMEOUT.scrollIdle);

      this.container.addEventListener("scroll", () => {
        if (mediaGalleryWrapperEle) {
          mediaGalleryWrapperEle.dataset.isScrollingOnDesktop = 'true';
          debouncedScrollHandler();
        }

        if (this.isDragging && window.innerWidth >= MIN_DEVICE_WIDTH.tablet) {
          requestAnimationFrame(() => {
            const container = this.container;
            const slideWidth = this.slides[0]?.offsetWidth;

            const slideWithGap = slideWidth + parseFloat(this.gap);
            const scrollLeft = Math.abs(container.scrollLeft) + (window.Maximize.rtl ? 1 : 0);

            const currentSlideIndex = Math.round(scrollLeft / slideWithGap);
            const oldActiveSlideIndex = this.activeSlideIndex;

            this.updateActiveSlide(currentSlideIndex);
            if (oldActiveSlideIndex != currentSlideIndex) {
              this.dispatchEventSlide(oldActiveSlideIndex);
            }
          });
        }
      }, { passive: true });
    }

    this.enableDesktopSlider = this.sliderElement.classList.contains('md:!swiffy-slider') ? false : true;
    this.enableMobileSlider = this.sliderElement.classList.contains('!swiffy-slider') ? false : true;

    if (this.sliderElement.classList.contains('media-gallery__media-wrapper')) {
      this.slides = this.container ? this.container.querySelectorAll(":scope >.slide-item.is-show-media-item") : [];
    }

    this.sliderNavs = this.sliderElement.querySelectorAll(":scope >.slider-nav, :scope > custom-button >.slider-nav");
    if (this.sliderNavs.length == 0) {
      this.sliderNavs = this.sliderElement.querySelectorAll(":scope > .slider-nav-wrapper .slider-nav");
    }
    this.sliderIndicatorsWrapper = this.sliderElement.querySelector(":scope >.slider-indicators");

    if (this.configs.customElement) {
      if (this.configs.customElement.sliderNavs) {
        const newSliderNavs = document.querySelectorAll(`${this.configs.customElement.sliderNavs}`);
        if (newSliderNavs && newSliderNavs.length) this.sliderNavs = newSliderNavs;
      }

      if (this.configs.customElement.indicatorsWrapper) {
        const newIndicatorsWrapper = document.querySelector(`${this.configs.customElement.indicatorsWrapper}`);
        if (newIndicatorsWrapper) this.sliderIndicatorsWrapper = newIndicatorsWrapper;
      }
    }

    this.sliderIndicators = this.sliderIndicatorsWrapper ? this.sliderIndicatorsWrapper.querySelectorAll(".slider-indicator") : [];
    if (this.sliderElement.classList.contains('media-gallery__media-wrapper')) {
      this.sliderIndicators = this.sliderIndicatorsWrapper ? this.sliderIndicatorsWrapper.querySelectorAll(".slider-indicator.is-show-indicator") : [];
    }
    this.scrollbar = this.sliderElement.querySelector(":scope > .swiffy-slide-indicator .swiffy-slide-progress-bar");
    // this.debounceScroll = debounce(this.handleScroll, 20);

    this.isFullPage = this.sliderElement.classList.contains("slider-nav-page");
    this.isNoDelay = this.sliderElement.classList.contains("slider-nav-nodelay");
    this.isVerticalMode = this.sliderElement.classList.contains("slide-mode-vertical");

    this.effect = this.configs.effect ? this.configs.effect : "slide";
    this.ratio = this.configs.ratio ? parseFloat(this.configs.ratio) : 1;
    this.speed = this.configs.speed ? this.configs.speed : 2500;
    this.isResize = this.configs.isResize ? this.configs.isResize : false;
    this.autoPlay = this.configs.autoPlay ? this.configs.autoPlay : false;
    this.autoPause = this.configs.autoPause ? this.configs.autoPause : false;
    this.isLoop = this.configs.isLoop === false ? this.configs.isLoop : true;
    this.threshold = this.configs.threshold ? this.configs.threshold : 50;
    this.breakPoints = this.configs.breakPoints;
    this.currentBreakPointConfig = null;
    this.mediaQuery = this.configs.mediaQuery;
    this.firstActiveSlide = this.configs.firstActiveSlide;
    this.isTransform = this.container.classList.contains('slider-transform');
    this.currentTranslate = 0;

    this.startX = 0;
    this.endX = 0;
    this.isDragging = false;

    this.scrollLeft = 0;

    this.slidesPerView = 1;
    this.slidesPerMove = this.slidesPerView;

    this.activeSlideIndex = 0;

    if ((this.effect === "fade" || this.effect === "push") && this.slides.length > 0) {
      let activeIndex = Array.from(this.slides).findIndex((slide) => slide.classList.contains("is-active"));
      if (activeIndex < 0) {
        this.slides[0].classList.add("is-active");
      } else {
        this.activeSlideIndex = activeIndex;
      }
    }
    if (!this.isLoop) {
      this.updateSliderNavStatus(0);
      if (this.sliderElement.querySelector('#MainCartUpsell')) {
        document.addEventListener(`${PRODUCT_EVENT.productRecommendationsChange}`, () => {
          this.updateSliderNavStatus(0);
        })
      }
    }
    if (this.firstActiveSlide && this.firstActiveSlide !== this.activeSlideIndex) {
      this.slideTo(this.firstActiveSlide);
    }
  }

  initEvents() {
    try {
      this.debouncedResize = debounce(this.applyBreakpointOptions.bind(this), 300);
      window.addEventListener("resize", this.debouncedResize);
      this.applyBreakpointOptions();

      this.sliderNavs.forEach((navElement) => {
        if (navElement.dataset?.disableEventClickSlider != 'true') {
          const next = navElement.classList.contains("slider-nav-next");
          navElement.addEventListener(
            "click",
            (event) => {
              if (!navElement.classList.contains("is-visible")) return;
              this.slide(next);
            },
            {passive: true}
          );
        }
      });

      this.addEventToIndicators();

      if (this.autoPlay) {
        this.handleAutoPlay();
      }
      if (["slider-nav-autohide", "slider-nav-animation"].some((className) => this.sliderElement.classList.contains(className))) {
        const threshold = this.sliderElement.getAttribute("data-slider-nav-animation-threshold") ? this.sliderElement.getAttribute("data-slider-nav-animation-threshold") : 0.3;
        this.setVisibleSlides(threshold);
      }

      this.sliderElement.addEventListener(SWIFFY_SLIDER_EVENT.slide, () => {
        this.handleIndicators();
      });

      if (this.scrollbar || this.sliderIndicators.length > 0) {
        // this.updateScrollbarPosition();
        this.container.addEventListener("scroll", () => {this.handleScroll()}, { passive: true });
      }

      if (this.scrollbar) {
        const indicator = this.scrollbar.closest('.swiffy-slide-indicator')
        const arrow_prev = indicator.querySelector('.indicator-arrow-prev')
        const arrow_next = indicator.querySelector('.indicator-arrow-next')

        if (arrow_prev && arrow_next) {
          arrow_prev.addEventListener('click', () => {
            if (arrow_prev.classList.contains('active')) {
              this.isDragging = false;
              this.slide(false)
            }
          })
          arrow_next.addEventListener('click', () => {
            if (arrow_next.classList.contains('active')) {
              this.isDragging = false;
              this.slide(true)
            }
          })

          if (!this.isLoop) {
            this.updateIndicatorArrow();
          }
        }
      }

      this.container.addEventListener("dragstart", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      this.container.addEventListener("pointerdown", this.handlePointerDown.bind(this), { passive: true });
      this.container.addEventListener("pointerup", this.handlePointerUp.bind(this), { passive: true });
      this.container.addEventListener("mouseleave", this.handleMouseLeave.bind(this), { passive: true });

      this.initTouchEvents();
    } catch (e) {
      console.error("SwiffySlider: Error initializing Swiffy Slider events", e);
    }
  }

  initTouchEvents() {
    if (this.effect === "fade" || this.effect === "push") {
      let touchStartX = 0;
      this.container.addEventListener("touchstart", (event) => {
        this.isTouching = true;
        event.stopPropagation();
        touchStartX = event.touches[0].clientX;
      }, { passive: true });

      this.container.addEventListener("touchend", (event) => {
        this.isTouching = false;
        event.stopPropagation();

        if (this.slides[this.activeSlideIndex]?.dataset.mediaType === 'model') return;
        if (this.slides[this.activeSlideIndex]?.dataset.mediaType === 'video') {
          const videoEle = this.slides[this.activeSlideIndex].querySelector('video');
          if (videoEle && videoEle.classList.contains('is-playing')) {
            return;
          }
        }

        const touchEndX = event.changedTouches[0].clientX;
        const threshold = 50;

        if ((touchStartX - touchEndX) * (window.Maximize.rtl ? -1 : 1) > threshold) {
          if (this.activeSlideIndex < this.slides.length - 1) {
            this.activeSlideIndex = this.activeSlideIndex + 1;
            this.slideTo(this.activeSlideIndex);
          } else if (this.activeSlideIndex === this.slides.length - 1 && this.isLoop) {
            this.activeSlideIndex = 0;
            this.slideTo(this.activeSlideIndex);
          }
        } else if ((touchEndX - touchStartX) * (window.Maximize.rtl ? -1 : 1) > threshold) {
          if (this.activeSlideIndex > 0) {
            this.activeSlideIndex = this.activeSlideIndex - 1;
            this.slideTo(this.activeSlideIndex);
          } else if (this.activeSlideIndex === 0 && this.isLoop) {
            this.activeSlideIndex = this.slides.length - 1;
            this.slideTo(this.activeSlideIndex);
          }
        }
      });
    }

    if (this.effect === "slide" && this.isLoop) {
      let startX = 0;
      let oldActiveIndex = 0;
      let isTouch = false;

      this.container.addEventListener("touchstart", (event) => {
        if (this.slides[this.activeSlideIndex]?.dataset.mediaType === 'model' && window.Maximize.hasMousePointer) return;
        isTouch = true;
        startX = event.touches[0].clientX;
        oldActiveIndex = this.activeSlideIndex;
      }, { passive: true });

      this.container.addEventListener("touchend", (event) => {
        if (window.innerWidth < MIN_DEVICE_WIDTH.tablet && this.sliderElement.classList.contains('!swiffy-slider') && this.isTransform) return;
        if (window.innerWidth >= MIN_DEVICE_WIDTH.tablet && window.innerWidth < MIN_DEVICE_WIDTH.desktop && this.sliderElement.classList.contains('md:!swiffy-slider') && this.isTransform) return;
        if (this.slides[this.activeSlideIndex]?.dataset.mediaType === 'model' && window.Maximize.hasMousePointer) return;

        const currentX = event.changedTouches[0].clientX;
        let deltaX = startX - currentX;
        if (window.Maximize.rtl) deltaX *= -1;

        // FIX: Với isTransform, dùng activeSlideIndex thay vì scrollLeft
        if (this.isTransform) {
          if (deltaX > 50) this.slide(true);
          else if (deltaX < -50) this.slide(false);
          return;
        }

        // Logic scroll cũ giữ nguyên
        let atStart = this.container.scrollLeft <= 0;
        let atEnd = this.container.scrollLeft >= this.container.scrollWidth - this.container.clientWidth - 1;
        if (window.Maximize.rtl) {
          deltaX *= -1;
          atStart = this.container.scrollLeft >= 0;
          atEnd = Math.abs(this.container.scrollLeft) >= this.container.scrollWidth - this.container.clientWidth - 1;
        }
        if (atEnd && deltaX > 50) {
          if ((this.listZoomThumbnailItems && this.listZoomThumbnailItems.length > 0) || (this.isTwoColOnDesktopProductMedia && window.innerWidth >= MIN_DEVICE_WIDTH.tablet)) {
            this.slide(true);
          } else {
            this.container.scrollTo({
              left: 0,
              behavior: "smooth",
            });
          }
        } else if (atStart && deltaX < -50) {
          if ((this.listZoomThumbnailItems && this.listZoomThumbnailItems.length > 0) || (this.isTwoColOnDesktopProductMedia && window.innerWidth >= MIN_DEVICE_WIDTH.tablet)) {
            this.slide(false);
          } else {
            this.container.scrollTo({
              left: this.container.scrollWidth * (window.Maximize.rtl ? -1 : 1),
              behavior: "smooth",
            });
          }
        }
      }, { passive: true });

      const scrollHandler = () => {
        if (this.sliderIndicators && isTouch) {
          isTouch = false;
          if (!(this.listZoomThumbnailItems && this.listZoomThumbnailItems.length > 0)) {
            this.dispatchEventSlide(oldActiveIndex);
          }
        }
      };
      const debouncedScrollHandler = debounce(scrollHandler, 20);
      this.container.addEventListener("scroll", debouncedScrollHandler, { passive: true });
    }
  }

  handlePointerDown(event) {
    if (this.enableDesktopSlider == false && window.innerWidth >= MIN_DEVICE_WIDTH.tablet) return;

    this.startX = event.clientX;
    this.isDragging = true;
  }

  handlePointerUp(event) {
    if(this.isTouching || this.enableDesktopSlider == false && window.innerWidth >= MIN_DEVICE_WIDTH.tablet || 
      this.enableMobileSlider == false && window.innerWidth < MIN_DEVICE_WIDTH.tablet
    ) return;

    event.stopPropagation();
    if (!(this.isTwoColOnDesktopProductMedia && window.innerWidth >= MIN_DEVICE_WIDTH.tablet)) {
      if (!this.isDragging || this.slides[this.activeSlideIndex]?.dataset?.mediaType == 'model') return;
    }

    this.endX = event.clientX;
    this.isDragging = false;

    if (Math.abs(this.endX - this.startX) > this.threshold) {
      if (window.Maximize.rtl) {
        if (this.endX > this.startX) {
          this.slide(true);
        }
        if (this.endX < this.startX) {
          this.slide(false);
        }
      } else {
        if (this.endX < this.startX) {
          this.slide(true);
        }
        if (this.endX > this.startX) {
          this.slide(false);
        }
      }
    }
  }

  handleMouseLeave(event) {
    if (this.enableDesktopSlider == false && window.innerWidth >= MIN_DEVICE_WIDTH.tablet) return;

    this.isDragging = false;
  }

  handleScroll() {
    this.updateScrollbarPosition();
  }

  updateIndicatorArrow(activeSlideIndex = this.activeSlideIndex) {
    if (!this.scrollbar) return;

    const indicator = this.scrollbar.closest('.swiffy-slide-indicator');
    if (!indicator) return;

    const arrow_prev = indicator.querySelector('.indicator-arrow-prev');
    const arrow_next = indicator.querySelector('.indicator-arrow-next');
    if (!arrow_prev || !arrow_next) return;

    let isStart = false;
    let isEnd = false;

    if (activeSlideIndex >= this.slides.length - this.slidesPerView) {
      isEnd = true;
    }
    if (activeSlideIndex == 0) {
      isStart = true;
    }

    if (isStart) {
      arrow_prev.classList.remove('active');
      arrow_prev.classList.add('inactive');
    } else {
      arrow_prev.classList.remove('inactive');
      arrow_prev.classList.add('active');
    }
    if (isEnd) {
      arrow_next.classList.remove('active');
      arrow_next.classList.add('inactive');
    } else {
      arrow_next.classList.remove('inactive');
      arrow_next.classList.add('active');
    }
  }

  updateScrollbarPosition() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      const container = this.container;
      const slideWidth = this.slides[0]?.offsetWidth;

      const slideWithGap = slideWidth + parseFloat(this.gap);
      const scrollLeft = Math.abs(container.scrollLeft) + (window.Maximize.rtl ? 1 : 0);

      const currentSlideIndex = Math.round(scrollLeft / slideWithGap);

      if (this.scrollbar && this.isDragging) {
        this.updateProgressBar(currentSlideIndex);
      }

      if (this.sliderIndicators) {
        this.handleIndicators();
      }

      if (!this.isLoop) {
        this.updateIndicatorArrow(currentSlideIndex);
        this.updateSliderNavStatus(scrollLeft);
      }
      if (this.listZoomThumbnailItems && this.listZoomThumbnailItems.length > 0) {
        this.updateActiveSlide(currentSlideIndex);
      } else {
        this.activeSlideIndex = currentSlideIndex;
      }
    });
  }

  // FIX: Method mới để update indicators/scrollbar/nav khi dùng transform
  // (không có scroll event nên phải gọi thủ công)
  afterTransformSlide(slideIndex) {
    if (!this.isTransform) return;

    this.handleIndicators();

    if (this.scrollbar) {
      this.updateProgressBar(slideIndex);
    }

    if (!this.isLoop) {
      this.updateIndicatorArrow(slideIndex);
      this.updateSliderNavStatus(this.currentTranslate);
    }
  }

  applyBreakpointOptions() {
    if (this.breakPoints) {
      for (let breakpoint in this.breakPoints) {
        this.currentBreakpoint = breakpoint;
        const config = this.breakPoints[breakpoint];
        const matchesMediaQuery = window.matchMedia(`(${this.mediaQuery}-width: ${this.currentBreakpoint}px)`).matches;

        if (matchesMediaQuery) {
          this.slidesPerView = Number(config.slidesPerView ? config.slidesPerView : 1);
          this.slidesPerMove = config.slidesPerMove || this.slidesPerView;
          this.gap = config.gap && config.gap !== this.defaultGap ? config.gap : this.defaultGap;
          this.currentBreakPointConfig = config;
          if (this.configs.adaptWidth) {
            let slideItemWidth = this.slides[0].offsetWidth
            if (slideItemWidth > 0) {
              this.slidesPerView = Math.floor(this.container.offsetWidth / slideItemWidth);
              this.slidesPerMove = this.slidesPerView;
            }
          }
          if (this.mediaQuery == 'max') {
            break;
          }
        }
      }
      this.sliderElement.style.setProperty("--swiffy-slider-item-count", this.slidesPerView);
      this.sliderNavs.forEach((nav) => {
        nav.classList[this.slidesPerView > 0 && this.slidesPerView < this.slides.length ? "add" : "remove"]("is-visible");
      });

      if (this.currentBreakPointConfig && this.currentBreakPointConfig.isResize) this.handleResize();
    }

    // FIX: Recalculate transform position sau khi resize vì slideWidth thay đổi
    if (this.isTransform && this.activeSlideIndex > 0) {
      this.slideTo(this.activeSlideIndex);
    }
    this.sliderElement.style.setProperty("--progress-bar-active-width", `${Math.max((this.slidesPerView / this.slides.length * 100), 20)}%` );
  }

  setVisibleSlides(threshold = 0.3) {
    let observer = new IntersectionObserver(
      (slides) => {
        const firstIntersectingEntry = slides.find(entry => entry.isIntersecting);
        slides.forEach((slide) => {
          if (slide.isIntersecting) {
            slide.target.classList.add("slide-visible");
          } else {
            slide.target.classList.remove("slide-visible")
          }
        });
        if (firstIntersectingEntry) {
          const activeSlideIndex = firstIntersectingEntry.target.dataset.swiffyIndex - 1;
          if (typeof activeSlideIndex === "number" && !Number.isNaN(activeSlideIndex) && this.activeSlideIndex != activeSlideIndex) {
            this.activeSlideIndex = activeSlideIndex;
          }
        }
        this.sliderElement.querySelector(".slider-container>*:first-child").classList.contains("slide-visible") ? this.sliderElement.classList.add("slider-item-first-visible") : this.sliderElement.classList.remove("slider-item-first-visible");
        this.sliderElement.querySelector(".slider-container>*:last-child").classList.contains("slide-visible") ? this.sliderElement.classList.add("slider-item-last-visible") : this.sliderElement.classList.remove("slider-item-last-visible");
      },
      {
        root: this.sliderElement.querySelector(".slider-container"),
        threshold: threshold,
      }
    );
    for (let slide of this.slides) {
      observer.observe(slide);
    }
  }

  updateProgressBar(activeSlideIndex) {
    const scrollbar = this.scrollbar;
    let marginRate = (100 - Math.max((this.slidesPerView / this.slides.length * 100), 20)) * (activeSlideIndex / (this.slides.length - this.slidesPerView));
    if (window.Maximize.rtl) {
      scrollbar.style.marginRight = marginRate + "%";
    } else {
      scrollbar.style.marginLeft = marginRate + "%";
    }
  }

  slide(next = true) {
    if (!this.slides || this.slides.length === 0 || this.sliderElement.classList.contains("swiffy-slider-disabled")) {
      return;
    }

    const oldActiveSlideIndex = this.activeSlideIndex;
    const slidesCount = this.slides.length;

    let newActiveSlideIndex;

    if (this.effect === 'slide') {
      // FIX: Tách logic isTransform dùng activeSlideIndex, không dùng scrollLeft
      if (this.isTransform) {
        if (next) {
          if (oldActiveSlideIndex >= slidesCount - this.slidesPerView) {
            if (!this.isLoop) return;
            newActiveSlideIndex = 0;
          } else if (oldActiveSlideIndex + this.slidesPerMove > slidesCount - this.slidesPerView) {
            newActiveSlideIndex = slidesCount - this.slidesPerView;
          } else {
            newActiveSlideIndex = oldActiveSlideIndex + this.slidesPerMove;
          }
        } else {
          if (oldActiveSlideIndex <= 0) {
            if (!this.isLoop) return;
            newActiveSlideIndex = slidesCount - this.slidesPerView;
          } else if (oldActiveSlideIndex - this.slidesPerMove < 0) {
            newActiveSlideIndex = 0;
          } else {
            newActiveSlideIndex = oldActiveSlideIndex - this.slidesPerMove;
          }
        }
      } else {
        // Logic scroll cũ giữ nguyên
        if (next) {
          if ((Math.abs(this.container.scrollLeft) + this.container.offsetWidth + 1 >= this.container.scrollWidth) || oldActiveSlideIndex >= slidesCount - this.slidesPerView) {
            if (!this.isLoop) return;
            newActiveSlideIndex = 0;
          } else if (oldActiveSlideIndex + this.slidesPerMove > slidesCount - this.slidesPerView) {
            newActiveSlideIndex = slidesCount - this.slidesPerView;
          } else {
            newActiveSlideIndex = oldActiveSlideIndex + this.slidesPerMove;
          }
        } else {
          if (Math.abs(this.container.scrollLeft) <= 0) {
            if (!this.isLoop) return;
            newActiveSlideIndex = slidesCount - this.slidesPerView;
          } else if (oldActiveSlideIndex - this.slidesPerMove < 0) {
            newActiveSlideIndex = 0;
          } else {
            newActiveSlideIndex = oldActiveSlideIndex - this.slidesPerMove;
          }
        }
      }
    } else {
      newActiveSlideIndex = next ? oldActiveSlideIndex + 1 : oldActiveSlideIndex - 1;
      // handle for media gallery

      if (newActiveSlideIndex < 0) {
        if (!this.isLoop) return;

        newActiveSlideIndex = slidesCount - 1;
      } else if (newActiveSlideIndex > slidesCount - 1) {
        if (!this.isLoop) return;

        newActiveSlideIndex = 0;
      }

      if (this.sliderElement.classList.contains('media-gallery__media-wrapper')) {
        let attempts = 0;
        const maxAttempts = this.slides.length;

        while (
          this.slides[newActiveSlideIndex] &&
          !this.slides[newActiveSlideIndex].classList.contains('is-show-media-item') &&
          attempts < maxAttempts
          ) {
          newActiveSlideIndex = next ? newActiveSlideIndex + 1 : newActiveSlideIndex - 1;

          if (newActiveSlideIndex >= this.slides.length) {
            newActiveSlideIndex = 0;
          } else if (newActiveSlideIndex < 0) {
            newActiveSlideIndex = this.slides.length - 1;
          }

          attempts++;
        }

        if (attempts === maxAttempts && !this.slides[newActiveSlideIndex].classList.contains('is-show-media-item')) {
          return;
        }
      }
    }
    if (this.scrollbar && !this.isDragging) {
      this.updateProgressBar(newActiveSlideIndex);
    }
    this.slideTo(newActiveSlideIndex);
  }

  // FIX: updateSliderNavStatus tách logic isTransform vs scroll
  updateSliderNavStatus(scrollPosition) {
    let isAtEnd, isAtStart;

    if (this.isTransform) {
      // Dùng activeSlideIndex vì scrollWidth/scrollLeft không đáng tin với transform
      isAtStart = this.activeSlideIndex <= 0;
      isAtEnd = this.activeSlideIndex >= this.slides.length - this.slidesPerView;
    } else {
      if (window.Maximize.rtl) {
        scrollPosition = Math.abs(scrollPosition);
      }
      isAtEnd = scrollPosition + this.container.offsetWidth + 1 >= this.container.scrollWidth - 1;
      isAtStart = scrollPosition <= 1;
    }

    this.sliderNavs.forEach(nav => {
      if (nav.classList.contains("slider-nav-next")) {
        nav.classList.toggle("nav-disabled", isAtEnd);
        nav.toggleAttribute("disabled", isAtEnd);
      } else {
        nav.classList.toggle("nav-disabled", isAtStart);
        nav.toggleAttribute("disabled", isAtStart);
      }
    });
    if (isAtEnd && isAtStart) {
      this.sliderNavs.forEach(nav => {
        nav.classList.add("hidden-nav");
      });
    } else {
      this.sliderNavs.forEach(nav => {
        nav.classList.remove("hidden-nav");
      });
    }
  }

  slideToByIndicator(event) {
    const indicator = event.target;
    const indicatorIndex = Array.from(this.sliderIndicators).indexOf(indicator);
    const indicatorCount = this.sliderIndicators.length;
    const slideCount = this.slides.length;

    const newActiveSlideIndex = Math.floor((slideCount / indicatorCount) * indicatorIndex);
    this.slideTo(newActiveSlideIndex);
  }

  slideTo(slideIndex) {
    const oldActiveIndex = this.activeSlideIndex;
    if (this.effect !== "fade" && this.effect !== "push") {
      this.isDragging = false;

      if (this.isTransform) {
        const gap = parseInt(this.gap)

        const slideWidth = this.slides[0]?.getBoundingClientRect().width || 0;

        const slideStep = slideWidth + gap;

        // FIX: Công thức grid chuẩn — gap chỉ xuất hiện GIỮA các item
        // position = index * slideStep - gap (trừ index 0)
        const scrollPosition = slideIndex > 0 ? slideIndex * slideStep : 0;

        const maxPosition = (this.slides.length - this.slidesPerView) * slideStep;

        this.currentTranslate = Math.max(0, Math.min(scrollPosition, maxPosition));
        this.container.style.transform = `translateX(${window.Maximize.rtl ? '' : '-'}${this.currentTranslate}px)`;

        // FIX: Gọi thủ công vì không có scroll event với transform
        if (!this.isLoop) {
          this.updateSliderNavStatus(this.currentTranslate);
        }
      } else {
        const gap = parseInt(this.gap)
        const scrollStep = (this.isVerticalMode ? this.slides[0]?.offsetHeight : this.slides[0]?.offsetWidth) + gap;
        const scrollPosition = scrollStep * (window.Maximize.rtl ? -1 * slideIndex : slideIndex);
        const currentPosition = this.isVerticalMode ? this.container.scrollTop : this.container.scrollLeft;
        const scrollOptions = {
          behavior: this.isNoDelay ? "auto" : "smooth",
          [this.isVerticalMode ? "top" : "left"]: scrollPosition,
        };
        const needsScroll = Math.abs(currentPosition - scrollPosition) > 1;

        this.container.scrollTo(scrollOptions);
        if (this.sliderElement.classList.contains('zoom-enlarge__wrapper') && this.sliderElement.classList.contains('opacity-0')) {
          if (needsScroll) {
            const targetSlide = this.slides[slideIndex];
            if (!targetSlide) return;

            const observer = new IntersectionObserver(
              (entries) => {
                if (entries[0].isIntersecting) {
                  if (
                    this.sliderElement.classList.contains('zoom-enlarge__wrapper') &&
                    this.sliderElement.classList.contains('opacity-0')
                  ) {
                    this.sliderElement.classList.remove('opacity-0');
                  }
                  if (!this.isLoop) {
                    this.updateSliderNavStatus(scrollPosition);
                  }
                  observer.disconnect();
                }
              },
              { threshold: 0.99 }
            );

            observer.observe(targetSlide);
          } else {
            this.sliderElement.classList.remove('opacity-0');
          }
        }

        if (!this.isLoop) {
          this.updateSliderNavStatus(scrollPosition);
        }
      }
    }

    this.updateActiveSlide(slideIndex);

    // FIX: Gọi afterTransformSlide để update indicators/scrollbar khi dùng transform
    this.afterTransformSlide(slideIndex);

    if (!(this.listZoomThumbnailItems && this.listZoomThumbnailItems.length > 0)) {
      this.dispatchEventSlide(oldActiveIndex);
    }
    this.sliderElement.classList.remove("invisible-slide");
  }

  handleIndicators() {
    if (!this.sliderElement) return;
    this.sliderIndicators.forEach((indicator, index) => {
      indicator.classList.toggle("active", Number(this.activeSlideIndex) === index);
    });
  }

  handleAutoPlay() {
    if (this.autoplayTimer) {
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
    const autoplayTimer = setInterval(() => {
      this.isDragging = false;
      if ((window.innerWidth >= MIN_DEVICE_WIDTH.desktop && this.isTransform && this.sliderElement.classList.contains('md:!swiffy-slider'))
        || (window.innerWidth >= MIN_DEVICE_WIDTH.tablet && this.isTransform && this.sliderElement.classList.contains('md:!swiffy-slider'))
        || (window.innerWidth < MIN_DEVICE_WIDTH.desktop && this.isTransform && this.sliderElement.classList.contains('!swiffy-slider'))
      ) {
        return;
      }

      this.slide(true);
    }, this.speed);

    this.autoplayTimer = autoplayTimer;

    const autoPlayer = () => {
      ["mouseover", "touchstart", "mouseout", "touchend"].forEach((event) => {
        this.sliderElement.removeEventListener(event, autoPlayer);
      });

      this.handleAutoPlay();
    };
    if (this.autoPause) {
      const pauseHandler = () => {
        if (this.autoplayTimer) {
          clearInterval(this.autoplayTimer);
          this.autoplayTimer = null;
        }
      };

      ["mouseover", "touchstart"].forEach((event) => {
        this.sliderElement.addEventListener(event, pauseHandler, { once: true, passive: true });
      });

      ["mouseout", "touchend"].forEach((event) => {
        this.sliderElement.addEventListener(event, autoPlayer, { once: true, passive: true });
      });
    }
    return this.autoplayTimer;
  }

  handleResize() {
    const width = this.sliderElement.offsetWidth;
    const height = width * this.ratio;
    if (this.effect === "push" || this.effect === "fade") {
      this.sliderElement.style.height = height + "px";
    }
  }

  updateActiveSlide(newActiveSlideIndex) {
    this.slides.forEach((slide, index) => {
      slide.classList[index === Number(newActiveSlideIndex) ? "add" : "remove"]("is-active");
    });

    if (this.listZoomThumbnailItems && this.listZoomThumbnailItems.length > 0) {
      this.listZoomThumbnailItems.forEach((item, index) => {
        item.classList[index === Number(newActiveSlideIndex) ? "add" : "remove"]("is-active");
      });
    }

    const oldActiveSlideIndex = this.activeSlideIndex;
    this.activeSlideIndex = newActiveSlideIndex;

    if (this.listZoomThumbnailItems && this.listZoomThumbnailItems.length > 0) {
      if (oldActiveSlideIndex != newActiveSlideIndex) {
        this.dispatchEventSlide(oldActiveSlideIndex);
      }
    }
  }

  dispatchEventSlide(oldActiveSlideIndex) {
    const sliderElement = this.sliderElement;
    this.sliderElement.dispatchEvent(
      new CustomEvent(`${SWIFFY_SLIDER_EVENT.slide}`, {
        detail: {
          el: sliderElement,
          oldActiveSlideIndex: oldActiveSlideIndex,
          newActiveSlideIndex: this.activeSlideIndex,
        },
      })
    );
  }

  addEventToIndicators() {
    this.sliderIndicators.forEach((indicatorElement) => {
      if (!indicatorElement.classList.contains('is-added-click-handle')) {
        indicatorElement.addEventListener("click", this.slideToByIndicator.bind(this));
        indicatorElement.addEventListener("keyup", (e) => {
          if (e.key === 'Enter') {
            this.slideToByIndicator(e);
          }
        });
        indicatorElement.classList.add('is-added-click-handle');
      }
    });
  }
}
