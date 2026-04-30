if (!customElements.get('media-gallery')) {
  customElements.define(
    'media-gallery',
    class MediaGallery extends HTMLElement {
      constructor() {
        super();

        this.elements = {
          liveRegion: this.querySelector('[id^="GalleryStatus"]'),
          viewer: this.querySelector('[id^="GalleryViewer"]'),
          thumbnails: this.querySelector('[id^="GalleryThumbnails"]'),
        };

        this.mql = window.matchMedia('(min-width: 750px)');
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;

        this.prevOverlayButton = this.querySelector('.product-gallery-overlay-arrow--prev');
        this.nextOverlayButton = this.querySelector('.product-gallery-overlay-arrow--next');

        if (this.prevOverlayButton) {
          this.prevOverlayButton.addEventListener('click', () => this.goToPreviousMedia());
        }

        if (this.nextOverlayButton) {
          this.nextOverlayButton.addEventListener('click', () => this.goToNextMedia());
        }

        this.bindTouchEvents();

        if (!this.elements.thumbnails) return;

        this.elements.viewer.addEventListener(
          'slideChanged',
          debounce(this.onSlideChanged.bind(this), 500)
        );

        this.elements.thumbnails.querySelectorAll('[data-target]').forEach((mediaToSwitch) => {
          mediaToSwitch
            .querySelector('button')
            .addEventListener('click', this.setActiveMedia.bind(this, mediaToSwitch.dataset.target, false));
        });

        if (this.dataset.desktopLayout.includes('thumbnail') && this.mql.matches) {
          this.removeListSemantic();
        }
      }

      bindTouchEvents() {
        if (!this.elements.viewer) return;

        this.elements.viewer.addEventListener(
          'touchstart',
          (event) => {
            if (this.mql.matches) return;

            const touch = event.changedTouches[0];
            this.touchStartX = touch.screenX;
            this.touchStartY = touch.screenY;
          },
          { passive: true }
        );

        this.elements.viewer.addEventListener(
          'touchend',
          (event) => {
            if (this.mql.matches) return;

            const touch = event.changedTouches[0];
            this.touchEndX = touch.screenX;
            this.touchEndY = touch.screenY;

            this.handleSwipeGesture();
          },
          { passive: true }
        );
      }

      handleSwipeGesture() {
        const diffX = this.touchEndX - this.touchStartX;
        const diffY = this.touchEndY - this.touchStartY;

        if (Math.abs(diffY) > Math.abs(diffX)) return;
        if (Math.abs(diffX) < 40) return;

        if (diffX < 0) {
          this.goToNextMedia();
        } else {
          this.goToPreviousMedia();
        }
      }

      goToPreviousMedia() {
        if (!this.elements.thumbnails) return;

        const buttons = Array.from(this.elements.thumbnails.querySelectorAll('button.thumbnail'));
        if (!buttons.length) return;

        const currentIndex = buttons.findIndex(
          (btn) => btn.getAttribute('aria-current') === 'true'
        );

        const activeIndex = currentIndex >= 0 ? currentIndex : 0;
        const prevIndex = activeIndex > 0 ? activeIndex - 1 : buttons.length - 1;

        buttons[prevIndex].click();
      }

      goToNextMedia() {
        if (!this.elements.thumbnails) return;

        const buttons = Array.from(this.elements.thumbnails.querySelectorAll('button.thumbnail'));
        if (!buttons.length) return;

        const currentIndex = buttons.findIndex(
          (btn) => btn.getAttribute('aria-current') === 'true'
        );

        const activeIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex = activeIndex < buttons.length - 1 ? activeIndex + 1 : 0;

        buttons[nextIndex].click();
      }

      onSlideChanged(event) {
        const thumbnail = this.elements.thumbnails.querySelector(
          `[data-target="${event.detail.currentElement.dataset.mediaId}"]`
        );
        this.setActiveThumbnail(thumbnail);
      }

      setActiveMedia(mediaId, prepend) {
        const activeMedia = this.elements.viewer.querySelector(`[data-media-id="${mediaId}"]`);
        if (!activeMedia) return;

        const ulElement = this.elements.viewer.querySelector('ul');
        if (ulElement) {
          const swiperContainer = ulElement.querySelector('.swiper-container');
          if (swiperContainer) {
            const swiperWrapper = swiperContainer.querySelector('.swiper-wrapper');
            if (swiperWrapper) {
              swiperWrapper.style.setProperty('transform', 'translate3d(0px, 0px, 0px)');
            }
          }
        }

        this.elements.viewer.querySelectorAll('[data-media-id]').forEach((element) => {
          element.classList.remove('swiper-slide-active');
          element.classList.remove('is-active');
        });

        activeMedia.classList.add('swiper-slide-active');
        activeMedia.classList.add('is-active');

        if (prepend) {
          activeMedia.parentElement.prepend(activeMedia);

          if (this.elements.thumbnails) {
            const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${mediaId}"]`);
            if (activeThumbnail) activeThumbnail.parentElement.prepend(activeThumbnail);
          }

          if (this.elements.viewer.slider) this.elements.viewer.resetPages();
        }

        this.preventStickyHeader();

        window.setTimeout(() => {
          if (!this.mql.matches || this.elements.thumbnails) {
            activeMedia.parentElement.scrollTo({ left: activeMedia.offsetLeft });
          }

          const activeMediaRect = activeMedia.getBoundingClientRect();
          if (activeMediaRect.top > -0.5) return;

          const top = activeMediaRect.top + window.scrollY;
          window.scrollTo({ top: top, behavior: 'smooth' });
        });

        this.playActiveMedia(activeMedia);

        if (!this.elements.thumbnails) return;

        const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${mediaId}"]`);
        if (!activeThumbnail) return;

        this.setActiveThumbnail(activeThumbnail);
        this.announceLiveRegion(activeMedia, activeThumbnail.dataset.mediaPosition);
      }

      setActiveThumbnail(thumbnail) {
        if (!this.elements.thumbnails || !thumbnail) return;

        this.elements.thumbnails
          .querySelectorAll('button')
          .forEach((element) => element.removeAttribute('aria-current'));

        thumbnail.querySelector('button').setAttribute('aria-current', true);
      }

      announceLiveRegion(activeItem, position) {
        const image = activeItem.querySelector('.product__modal-opener--image img');
        if (!image) return;

        image.onload = () => {
          this.elements.liveRegion.setAttribute('aria-hidden', false);
          this.elements.liveRegion.innerHTML =
            window.accessibilityStrings.imageAvailable.replace('[index]', position);

          setTimeout(() => {
            this.elements.liveRegion.setAttribute('aria-hidden', true);
          }, 2000);
        };

        image.src = image.src;
      }

      playActiveMedia(activeItem) {
        window.pauseAllMedia();
        const deferredMedia = activeItem.querySelector('.deferred-media');
        if (deferredMedia) deferredMedia.loadContent(false);
      }

      preventStickyHeader() {
        this.stickyHeader = this.stickyHeader || document.querySelector('sticky-header');
        if (!this.stickyHeader) return;
        this.stickyHeader.dispatchEvent(new Event('preventHeaderReveal'));
      }

      removeListSemantic() {
        if (!this.elements.viewer.slider) return;
        this.elements.viewer.slider.setAttribute('role', 'presentation');
        this.elements.viewer.sliderItems.forEach((slide) => slide.setAttribute('role', 'presentation'));
      }
    }
  );
}