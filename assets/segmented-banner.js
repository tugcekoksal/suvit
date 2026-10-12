if (window.Maximize.checkFileNotLoaded()) {
  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xSegmentedBanner', (totalBlock, sectionId, autoPlaySecond, pauseOnHover) => ({
        activeIndex: 0,
        activeAnimation: false,
        totalBlock: 0,
        heightTitleBlock: 0,
        autoPlayTimeout: 0,
        activeProgessBar: false,
        isHover: false,
        isActiveIndexChanged: false,
        init() {
          this.totalBlock = totalBlock;
          const updateVideoFlowCardsSegmentedBanner = () => {
            const segmentedBannerMedias = this.$el.querySelectorAll('.segmented-banner__image');
            segmentedBannerMedias.forEach(mediaEle => {
              const videoContainer = mediaEle.querySelector('.external-video');
              if (videoContainer) {
                if (mediaEle.classList.contains('is-active')) {
                  Alpine.store('xVideo').updateStatusVideo(videoContainer, true, true);
                } else {
                  Alpine.store('xVideo').updateStatusVideo(videoContainer, false, true);
                }
              }
            })
          }

          this.$watch('activeIndex', (newActiveIndex) => {
            this.isActiveIndexChanged = true;
            // $refs may be gone if the section was removed (theme editor re-render / preview
            // switch) while the autoplay timeout chain was still running.
            if (!this.$refs.segmentedBannerWrapper) return;
            const segmentedBannerContents = this.$refs.segmentedBannerWrapper.querySelectorAll('.segmented-banner__segment');
            segmentedBannerContents.forEach(contentEle => {
              if (parseInt(contentEle.dataset.index) === newActiveIndex) {
                contentEle.classList.add('active');
              } else {
                contentEle.classList.remove('active');
              }
            });

            updateVideoFlowCardsSegmentedBanner();
          });

          installMediaQueryWatcher(`(min-width: ${MIN_DEVICE_WIDTH.tablet}px)`, () => { 
            this.updateHeight()
          });
        },
        updateHeight() {
          const titleBlockEle = this.$refs[`segmented_banner_title_block_${sectionId}`];
          if (titleBlockEle) this.heightTitleBlock = titleBlockEle.offsetHeight;
        },
        handleClick(newActiveIndex) {
          if (this.activeIndex === newActiveIndex) return;
          if (this.activeAnimation) return; 
          if (!this.$refs.segmentedBannerWrapper) return;
          this.activeAnimation = true;
          this.activeProgessBar = true;
          this.activeIndex = newActiveIndex;
          const segmentedBannerContents = this.$refs.segmentedBannerWrapper.querySelectorAll('.segmented-banner__segment');
          const totalItems = segmentedBannerContents.length;
          const baseStep = 100;
          segmentedBannerContents.forEach((content, index) => {
            let translateX;

            if (newActiveIndex === totalItems - 1) {
              translateX = index < newActiveIndex ? (window.Maximize.rtl ? -baseStep : baseStep) : index === newActiveIndex ? (window.Maximize.rtl ? baseStep * (totalItems - 1) : -baseStep * (totalItems - 1)) : 0;
            } else if (newActiveIndex === 0) {
              translateX = index === newActiveIndex ? 0 : 0;
            } else {
              if (newActiveIndex === index) {
                translateX = newActiveIndex * baseStep * (window.Maximize.rtl ? 1 : -1);
              } else if (newActiveIndex < index) {
                translateX = newActiveIndex * baseStep * (window.Maximize.rtl ? 1 : -1);
              } else {
                translateX = (totalItems - newActiveIndex) * baseStep * (window.Maximize.rtl ? -1 : 1);
              }
            }

            content.style.transform = `translate3d(${translateX}%, 0, 0)`;
          });
        },
        handleAutoPlay() {
          if (autoPlaySecond <= 0 || (pauseOnHover && this.isHover)) return;

          if (this.autoPlayTimeout) clearTimeout(this.autoPlayTimeout);

          this.autoPlayTimeout = setTimeout(() => {
            if (this.activeIndex < this.totalBlock - 1) {
              this.handleClick(this.activeIndex + 1);
            } else {
              this.handleClick(0);
            }
            this.handleAutoPlay();
          }, autoPlaySecond * 1000);
        },
        pauseAutoPlay() {
          this.activeProgessBar = false;
          if (this.autoPlayTimeout) {
            clearTimeout(this.autoPlayTimeout);
            this.autoPlayTimeout = null;
          }
        },
        resumeAutoPlay() {
          this.activeProgessBar = true;
          this.handleAutoPlay();
        },
        destroy() {
          // Stop the autoplay chain when the section is removed, otherwise the pending
          // timeout fires against a dead DOM (theme editor re-render / preview switch).
          this.pauseAutoPlay();
        },
        updateFocsingElement() {
          if (!this.$refs.segmentedImageWrapper) return;
          const segmentedBannerImgContents = Array.from(this.$refs.segmentedImageWrapper.getElementsByClassName('segmented-banner__info'));
          const animationDuration = DURATION.SEGMENTED_BANNER_ANIMATION_DESKTOP;
          
          segmentedBannerImgContents.some((content, index) => {
            if (this.activeIndex === index) {
              setTimeout(() => {
                content.focus();
              }, animationDuration);
              return true;
            }
            return false;
          });

        }
      }));
    });
  });
}