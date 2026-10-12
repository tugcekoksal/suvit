if (!window.Maximize.loadedScript.includes("speech-search.js")) {
  window.Maximize.loadedScript.push("speech-search.js");

  requestAnimationFrame(() => {
    const defineXSpeechSearch = () => {
      Alpine.data("xSpeechSearch", (el) => ({
        recognition: null,
        isListening: false,
        searchInput: null,
        searchBtn: null,
        show: false,

        init() {
          const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

          if (SpeechRecognition) {
            this.show = true;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;

            const form = el.closest("form");
            this.searchInput = form.querySelector(".input-search");
            this.searchBtn = form.querySelector(".btn-search");
            this.bindEvents();
          } else {
            this.show = false;
          }
        },

        bindEvents() {
          this.recognition.addEventListener("result", (evt) => {
            if (evt.results) {
              const term = evt.results[0][0].transcript;
              this.searchInput.value = term;
              this.searchInput.dispatchEvent(new Event("input", { bubbles: true }));
              el.blur();
              this.searchBtn.focus();
            }
          });

          this.recognition.addEventListener("audiostart", () => {
            this.isListening = true;
            el.classList.add("search__speech-listening");
          });

          this.recognition.addEventListener("audioend", () => {
            this.isListening = false;
            el.classList.remove("search__speech-listening");
          });

          this.recognition.addEventListener("error", (evt) => {
            console.warn("SpeechRecognition error:", evt.error);
            this.isListening = false;
            el.classList.remove("search__speech-listening");
          });

          el.addEventListener("click", (e) => this.toggleListen(e));
        },

        toggleListen(evt) {
          evt.preventDefault();
          if (this.isListening) {
            this.recognition.stop();
          } else {
            this.recognition.start();
          }
        },
      }));
    };
    if (window.Alpine) {
      defineXSpeechSearch();
    } else {
      document.addEventListener("alpine:init", defineXSpeechSearch);
    }
  });
}