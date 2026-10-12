if (!window.Maximize.loadedScript.includes("flow-cards.js")) {
  window.Maximize.loadedScript.push("flow-cards.js");

  requestAnimationFrame(() => {
    const defineXFlowCard = () => {
      Alpine.data("xFlowCard", (openFirstTab, sectionId, blockSize) => ({
        openFirstTab: false,
        activeCardIndex: 1,
        nextActiveIndex1: 2,
        nextActiveIndex2: 3,
        shown: false,
        loading: true,
        sectionId: sectionId,
        previousIndex: null,
        type: "next",
        init() {
          this.openFirstTab = openFirstTab;
          this.debounceSelectFlowCard = this.debounce(this.handleSelectFlowCard, 100);
          
          const updateVideoFlowCards = () => {
            const flowCards = this.$el.querySelectorAll('.flow-card');
            flowCards.forEach(element => {
              const videoContainer = element.querySelector('.external-video');
              if (videoContainer) {
                if (element.classList.contains('flow-card--current')) {
                  Alpine.store('xVideo').updateStatusVideo(videoContainer, true, true);
                } else {
                  Alpine.store('xVideo').updateStatusVideo(videoContainer, false, true);
                }
              }
            })
          }

          this.$watch('activeCardIndex', () => {
            updateVideoFlowCards();
          });
        },
        handleSelectFlowCard(activeIndex) {
          let type = "";
          if (this.activeCardIndex > activeIndex) {
            type = "previous";
          } else if (this.activeCardIndex < activeIndex) {
            type = "next";
          }
          this.previousIndex = this.activeCardIndex;
          this.activeCardIndex = activeIndex;
          this.openFirstTab = true;
          this.calculateNewIndex(type)
        },
        debounce(func, wait) {
          let timeout;
          return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
          };
        },
        calculateNewIndex(type) {
          this.nextActiveIndex1 = (this.activeCardIndex % blockSize) + 1;
          this.nextActiveIndex2 = (this.nextActiveIndex1 % blockSize) + 1;
          this.type = type;
        },
        handleNavigationCard(type) {
          this.previousIndex = this.activeCardIndex;
          if (type === "previous") {
            this.activeCardIndex = ((this.activeCardIndex - 2 + blockSize) % blockSize) + 1;
          } else if (type === "next") {
            this.activeCardIndex = this.nextActiveIndex1;
          }
          this.calculateNewIndex(type)
        },
        firstLoadData() {
          if (window.Shopify && Shopify.designMode) {
            this.loading = false;
            return;
          }
          let url = `${window.location.pathname}?section_id=${this.sectionId}`;
          fetch(url, {
            method: "GET",
          })
            .then((response) => (response.ok ? response.text() : null))
            .then(() => {
              this.loading = false;
            })
            .catch(() => {
              this.loading = false;
            });
        },
        getCardClasses(index) {
          return {
            'flow-card--current-1': index === this.nextActiveIndex1 && blockSize > 1,
            'flow-card--current-2': index === this.nextActiveIndex2 && blockSize > 2,
            'flow-card--out': index !== this.activeCardIndex,
            'flow-card--current': index === this.activeCardIndex,
            'flow-card--next': this.type === 'next' && index === this.previousIndex,
            'flow-card--prev': this.type === 'previous' && index === this.previousIndex
          };
        }
      }));
    };
    if (window.Alpine) {
      defineXFlowCard();
    } else {
      document.addEventListener("alpine:init", defineXFlowCard);
    }
  });
}
