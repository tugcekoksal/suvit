if (!window.Maximize.loadedScript.includes("motion-image-banner.js")) {
  window.Maximize.loadedScript.push("motion-image-banner.js");

  requestAnimationFrame(() => {
    const defineXMotionImage = () => {
      Alpine.data("xMotionImage", () => ({
        showAfterImage: false,
        sectionHeight: 0,
        imageWrapperHeight: 0,
        scaledImageWidth: 0,
        scaledImageHeight: 0,
        isScrollFull: false,
        imageNaturalHeightPercent: 0,
        imageNaturalWidthPercent: 0,
        startScroll: 0,
        startOffset: 0,
        triggerOffset: 0,
        hasScrollListener: false,
        maxScroll: 0,
        boundHandleScroll: null,
        currentScrollTop: 0,
        targetScrollTop: 0,
        isAnimating: false,
        isFirstLoad: true,
        MIN_STEP: 2,
        MAX_STEP: 20,
        STEP_SIZE: 0.125,

        init() {
          this.boundHandleScroll = this.handleScroll.bind(this);

          this.initSectionHeight();
          this.setupClickHandler();
          this.handleIntersection();

          installMediaQueryWatcher(`(min-width: ${MIN_DEVICE_WIDTH.tablet}px)`, this.initSectionHeight.bind(this));
        },

        handleIntersection() {
          const element = this.$root;
          const observer = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  this.addScrollEvent();
                } else {
                  this.removeScrollEvent();
                }
              });
            },
            {
              root: null,
              threshold: 0,
              rootMargin: "0%",
            }
          );
          observer.observe(element);
        },

        initSectionHeight() {
          const beforeImage = this.$root.querySelector(".motion-before-image");
          const beforeSection = this.$root.querySelector(".motion-image-banner__wrapper");
          this.sectionHeight = this.$root.offsetHeight;
          if (beforeSection) {
            this.imageWrapperHeight = beforeSection.offsetHeight;
          }
          if (beforeImage) {
            this.imageNaturalWidthPercent = (beforeImage.offsetWidth * 100) / window.innerWidth;
            this.imageNaturalHeightPercent = (beforeImage.offsetHeight * 100) / this.imageWrapperHeight;
            this.updateImageScale(0);
          }
          this.maxScroll = this.sectionHeight - this.imageWrapperHeight - 10;
        },

        setupClickHandler() {
          const imageLink = this.$root.querySelector(".section-image-link");
          this.$root.addEventListener("click", (event) => {
            if (!this.isScrollFull) return;
            if (imageLink && event.target.classList.contains("section-motion-image-banner__container")) {
              imageLink.click();
            }
          });
        },

        addScrollEvent() {
          if (!this.hasScrollListener) {
            window.addEventListener("scroll", this.boundHandleScroll);
            this.startOffset = this.$root.getBoundingClientRect().top;
            this.getTriggerOffset();
            this.startScroll = Math.max(window.scrollY + this.startOffset - this.triggerOffset - 100, 0);
            this.hasScrollListener = true;
            this.boundHandleScroll();
          }
        },
        getTriggerOffset() {
          const rootStyles = getComputedStyle(document.documentElement);
          const heightHeader = parseFloat(rootStyles.getPropertyValue("--height-header")) || 0;
          const announcementHeight = parseFloat(rootStyles.getPropertyValue("--announcement-height")) || 0;
          this.triggerOffset = heightHeader + announcementHeight;
        },
        removeScrollEvent() {
          if (this.hasScrollListener) {
            window.removeEventListener("scroll", this.boundHandleScroll);
            this.hasScrollListener = false;
          }
        },

        handleScroll() {
          const rawScrollTop = window.scrollY - this.startScroll;
          this.targetScrollTop = Math.max(0, Math.min(rawScrollTop, this.maxScroll));

          if (this.isFirstLoad) {
            this.currentScrollTop = this.targetScrollTop;
            this.handleScrollPosition(this.currentScrollTop);
            this.updateImageScale(this.currentScrollTop);
            this.checkIfScrollComplete(this.currentScrollTop);
            this.isFirstLoad = false;
            return;
          }

          if (!this.isAnimating) {
            this.smoothScrollAnimation();
          }
        },

        smoothScrollAnimation() {
          this.isAnimating = true;

          const animate = () => {
            const diff = this.targetScrollTop - this.currentScrollTop;

            if (Math.abs(diff) <= this.MIN_STEP) {
              this.currentScrollTop = this.targetScrollTop;
              this.isAnimating = false;
              let isStartPage = false
              if (window.scrollY === 0) {
                isStartPage = true;
              } 

              this.handleScrollPosition(this.currentScrollTop, isStartPage);
              this.updateImageScale(this.currentScrollTop);
              this.checkIfScrollComplete(this.currentScrollTop);
              return;
            }

            let step = diff * this.STEP_SIZE;

            if (step > 0) {
              step = Math.max(this.MIN_STEP, Math.min(this.MAX_STEP, step));
            } else {
              step = Math.min(-this.MIN_STEP, Math.max(-this.MAX_STEP, step));
            }

            this.currentScrollTop += step;

            this.handleScrollPosition(this.currentScrollTop);
            this.updateImageScale(this.currentScrollTop);
            this.checkIfScrollComplete(this.currentScrollTop);

            requestAnimationFrame(animate);
          };

          requestAnimationFrame(animate);
        },

        handleScrollPosition(scrollTop, isStartPage) {
          if (scrollTop === 0 || isStartPage) {
            this.showAfterImage = false;
            return;
          }
          this.showAfterImage = true;
        },

        updateImageScale(scrollTop) {
          requestAnimationFrame(() => {
            const ratio = scrollTop / this.maxScroll;
            this.scaledImageWidth = this.imageNaturalWidthPercent + ratio * (100 - this.imageNaturalWidthPercent);
            this.scaledImageHeight = this.imageNaturalHeightPercent + ratio * (100 - this.imageNaturalHeightPercent);
          });
        },

        checkIfScrollComplete(scrollTop) {
          const maxScroll = this.maxScroll;
          this.isScrollFull = scrollTop === maxScroll;
        },
      }));
    };
    if (window.Alpine) {
      defineXMotionImage();
    } else {
      document.addEventListener("alpine:init", defineXMotionImage);
    }
  });
}