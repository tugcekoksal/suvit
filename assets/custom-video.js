(() => {
  class CustomVideo extends HTMLElement {
    static _globalMessageBound = false;

    constructor() {
      super();
      this._config = null;
      this._observer = null;
      this._loadedOnce = false;
      this._userInitiated = false;
      this._onKeydown = null;
      this._onVisibility = null;
    }

    get config() {
      if (this._config) return this._config;
      let config;
      try {
        config = JSON.parse(this.dataset.config);
        if (typeof config === "string") config = JSON.parse(config);
      } catch {
        config = {};
      }
      config.type ??= "upload";
      config.type ??= "video_select";
      config.id ??= "";
      config.alt ??= "";
      config.threshold ??= 0.35;
      config.rootMargin ??= "200px 0px";
      config.autoplay = this._toBool(config.autoplay);
      config.controls = this._toBool(config.controls);
      config.loop = this._toBool(config.loop);
      this._config = config;

      return this._config;
    }

    get isActive() {
      return this.dataset.isActive === "true";
    }

    set isActive(val) {
      this.dataset.isActive = val ? "true" : "false";
    }

    get videoStatus() {
      return this.dataset.videoStatus || "pause";
    }

    set videoStatus(val) {
      this.dataset.videoStatus = val;
    }

    get pausedByLeave() {
      return this.dataset.pausedByLeave === "true";
    }

    set pausedByLeave(val) {
      this.dataset.pausedByLeave = val ? "true" : "false";
    }

    get videoContainer() {
      return this.querySelector(".video-container");
    }

    get videoEl() {
      return this.querySelector(".video");
    }

    get playBtn() {
      return this.querySelector(".button-play");
    }

    get muteBtn() {
      return this.querySelector(".button-sound-control");
    }

    get coverEl() {
      return this.querySelector(".video-cover");
    }

    get vimeoCoverEl() {
      return this.querySelector(".vimeo-thumbnail-skeleton");
    }

    connectedCallback() {
      if (!this.dataset.videoStatus) this.videoStatus = "pause";
      if (!this.dataset.pausedByLeave) this.pausedByLeave = false;
      if (!this.dataset.isActive) this.isActive = false;

      this.addEventListener("click", this._onClick);
      this._onKeydown = (e) => {
        if (e.code !== "Enter" && e.code !== "Space") return;

        const target = e.target;

        const actionEl = target.closest("[data-action]");
        if (actionEl) {
          e.preventDefault();

          const action = actionEl.dataset.action;
          if (action === "play") this.handlePlay(actionEl);
          if (action === "toggle") this.togglePlay({userInitiated: true});
          if (action === "mute") this.toggleMute();

          return;
        }

        if (target === this) {
          e.preventDefault();
          this.togglePlay({userInitiated: true});
        }
      };

      this.addEventListener("keydown", this._onKeydown);
      this._initMp4Listeners();
      this._initIntersectionObserver();
      this._onVisibility = () => {
        if (document.visibilityState === "hidden") this.pause(true);
      };
      document.addEventListener("visibilitychange", this._onVisibility);
      // this._ensureGlobalMessageHandler();
    }

    disconnectedCallback() {
      this.removeEventListener("click", this._onClick);
      if (this._onKeydown) this.removeEventListener("keydown", this._onKeydown);
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
      if (this._onVisibility) {
        document.removeEventListener("visibilitychange", this._onVisibility);
        this._onVisibility = null;
      }
    }

    _onClick = (e) => {
      const btn = e.target.closest("[data-action]");

      if (!btn) return;
      switch (btn.dataset.action) {
        case "play":
          this.handlePlay(btn);
          break;
        case "toggle":
          this.togglePlay({userInitiated: true});
          break;
        case "mute":
          this.toggleMute();
          break;
      }
    };

    _initIntersectionObserver() {
      this._observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          this.isActive = true;
          if (this.config.autoplay) {
            this._initOrPlayOnEnter();
          } else {
            if (this.vimeoCoverEl && this.config.type === 'vimeo') {
              this.renderVimeoFacadeSource();
            }
          }
        } else {
          this.isActive = false;
          this.pause(true);
        }
      }, {
        threshold: this.config.threshold,
        rootMargin: this.config.rootMargin
      });
      this._observer.observe(this);
    }

    _initOrPlayOnEnter() {
      const {type} = this.config;
      if ((type === "youtube" || type === "vimeo") && !this._loadedOnce) {
        this._loadedOnce = true;
        this.loadExternal();
        this.videoStatus = "play";
        this.pausedByLeave = false;
        return;
      }
      this.play();
    }

    togglePlay({userInitiated = false} = {}) {
      const el = this.videoEl;
      if (!el) {
        if (["youtube", "vimeo"].includes(this.config.type)) {
          this._userInitiated = !!userInitiated;
          if (!this._loadedOnce) {
            this._loadedOnce = true;
            this.loadExternal();
          }

          if (!this.config.autoplay && this.config.controls) {
            const buttonsWrapperEle = this.querySelector(`.buttons-video__wrapper`);
            if (buttonsWrapperEle) {
              buttonsWrapperEle.classList.add('hidden');
            }
          }
        }
        return;
      }
      if (el.tagName === "IFRAME") {
        if (this.classList.contains("function-paused")) this.play();
        else this.pause(false);
      } else if (el.paused) {
        this.play();
      } else {
        this.pause(false);
      }
    }

    play() {
      this.coverEl?.classList.add("hidden");
      this.vimeoCoverEl?.classList.add("hidden");
      this.videoContainer.classList.remove("hidden");
      const el = this.videoEl;
      this.playBtn?.classList.add("started-video", "is-playing");
      this.muteBtn?.setAttribute("tabindex", "0");
      this.videoStatus = "play";
      this.pausedByLeave = false;

      if (!this.config.autoplay && this.config.controls) {
        const buttonsWrapperEle = this.querySelector(`.buttons-video__wrapper`);
        if (buttonsWrapperEle) {
          buttonsWrapperEle.classList.add('hidden');
        }
      }

      if (!el) return;
      if (el.tagName === "VIDEO") {
        el.play().catch(() => {
        });
        return;
      }
      if (el.tagName === "IFRAME") {
        this.externalPostCommand(el, "play");
        this.classList.remove("function-paused");
      }

    }

    pause(isLeave = false) {
      const el = this.videoEl;
      if (isLeave && this.videoStatus === "play") this.pausedByLeave = true;
      this.playBtn?.classList.remove("is-playing");
      this.videoStatus = "pause";
      if (!el) return;
      if (el.tagName === "VIDEO") {
        el.pause();
        return;
      }
      if (el.tagName === "IFRAME") {
        this.externalPostCommand(el, "pause");
        this.classList.add("function-paused");
      }
    }

    toggleMute() {
      const el = this.videoEl;
      if (!el) return;
      if (el.tagName === "VIDEO") {
        el.muted = !el.muted;
        this.muteBtn?.classList.toggle("is-muted", el.muted);
      } else if (el.tagName === "IFRAME") {
        const muted = this.muteBtn?.classList.contains("is-muted");
        this.externalPostCommand(el, muted ? "unmute" : "mute");
        this.muteBtn?.classList.toggle("is-muted", !muted);
      }
    }

    _initMp4Listeners() {
      const el = this.videoEl;
      if (!el || el.tagName !== "VIDEO") return;
      el.addEventListener("play", () => {
        this.playBtn?.classList.add("is-playing");
        this.videoStatus = "play";
        this.pausedByLeave = false;
      });
      el.addEventListener("pause", () => {
        this.playBtn?.classList.remove("is-playing");
        this.videoStatus = "pause";
      });
      el.addEventListener("volumechange", () => {
        this.muteBtn?.classList.toggle("is-muted", el.muted);
      });
    }

    handlePlay(btn) {
      this._userInitiated = true;

      if (btn.classList.contains("started-video")) {
        this.togglePlay({userInitiated: true});
      }
      if (this.vimeoCoverEl) {
        this.vimeoCoverEl.classList.add('hidden');
      }

      if (this.config.source === "upload") {
        btn.classList.add("started-video");
        this.play();
      } else if (!this._loadedOnce) {
        this._loadedOnce = true;
        this.loadExternal();
      }
      btn.classList.add("started-video");
    }

    loadExternal() {
      const {type, id, controls, loop, alt} = this.config;

      const container = this.videoContainer;
      if (!container) return;

      const src =
        type === "youtube"
          ? `https://www.youtube.com/embed/${id}?mute=1&playlist=${id}&autoplay=1&playsinline=1&enablejsapi=1&modestbranding=1&rel=0&controls=${controls ? 1 : 0}`
          : `https://player.vimeo.com/video/${id}?muted=1&autoplay=1&playsinline=1&api=1&controls=${controls}&loop=${loop ? 1 : 0}`;

      container.innerHTML = `
  <iframe
    class="video iframe-video absolute w-full h-full top-0 left-0 rounded-corners"
    host="${type}"
    data-video-loop="${loop ? "true" : "false"}"
    frameborder="0"
    allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
    playsinline
    src="${src}"
    title="${this._escapeHtml(alt)}"
  ></iframe>
  `;

      const iframe = container.querySelector("iframe");
      if (!iframe) return;

      iframe.addEventListener("load", () => {
        setTimeout(() => {
          if (this._userInitiated) {
            this._userInitiated = false;
            this.play();
          } else {
            if (this.config.autoplay && this.isActive) {
              this.play();
            } else {
              this.pause(true);
            }
          }
          if (type === "youtube") {
            iframe.contentWindow?.postMessage(
              JSON.stringify({
                event: "listening",
                id: Date.now(),
                channel: "widget"
              }),
              "*"
            );
          }
          if (type === "vimeo") {
            ["finish", "play", "pause"].forEach((ev) =>
              iframe.contentWindow?.postMessage(
                JSON.stringify({
                  method: "addEventListener",
                  value: ev
                }),
                "*"
              )
            );
          }
        }, 100);
      });

      this._ensureGlobalMessageHandler();
    }

    externalPostCommand(iframe, cmd) {
      const host = iframe.getAttribute("host");
      let payload;
      if (host === "youtube") {
        if (cmd === "mute") payload = {event: "command", func: "mute"};
        else if (cmd === "unmute") payload = {event: "command", func: "unMute"};
        else payload = {event: "command", func: `${cmd}Video`};
      } else {
        if (cmd === "mute") payload = {method: "setVolume", value: 0};
        else if (cmd === "unmute") payload = {method: "setVolume", value: 1};
        else payload = {method: cmd, value: "true"};
      }
      iframe.contentWindow?.postMessage(JSON.stringify(payload), "*");
    }

    _ensureGlobalMessageHandler() {
      if (CustomVideo._globalMessageBound) return;

      window.addEventListener("message", (event) => {
        if (
          event.origin !== "https://www.youtube.com" &&
          event.origin !== "https://player.vimeo.com"
        ) return;

        if (typeof event.data !== "string") return;

        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        const iframes = document.querySelectorAll("custom-video iframe.video");

        for (const iframe of iframes) {
          if (iframe.contentWindow !== event.source) continue;

          const comp = iframe.closest("custom-video");
          if (!comp) continue;

          if (event.origin === "https://www.youtube.com") {
            const state = data.info?.playerState;
            if (state === 1) {
              comp.playBtn?.classList.add("is-playing", "started-video");
              comp.classList.remove("function-paused");
              comp.dataset.videoStatus = "play";
              comp.dataset.pausedByLeave = "false";
            }
            if (state === 2) {
              comp.playBtn?.classList.remove("is-playing");
              comp.playBtn?.classList.add("started-video");
              comp.classList.add("function-paused");
              comp.dataset.videoStatus = "pause";
              if (comp.dataset.isActive === "false") {
                comp.dataset.pausedByLeave = "true";
              }
            }
            if (state === 0) {
              const loop = iframe.getAttribute("data-video-loop") === "true";
              if (loop) {
                comp.externalPostCommand(iframe, "play");
              } else {
                comp.playBtn?.classList.remove("is-playing");
                comp.classList.add("function-paused");
                comp.dataset.videoStatus = "pause";
              }
            }
            if (typeof data.info?.muted !== "undefined") {
              comp.muteBtn?.classList.toggle("is-muted", !!data.info.muted);
            }
          }

          if (event.origin === "https://player.vimeo.com") {
            if (data.event === "play") {
              comp.playBtn?.classList.add("is-playing", "started-video");
              comp.classList.remove("function-paused");
              comp.dataset.videoStatus = "play";
              comp.dataset.pausedByLeave = "false";
            }

            if (data.event === "pause") {
              comp.playBtn?.classList.remove("is-playing");
              comp.playBtn?.classList.add("started-video");
              comp.classList.add("function-paused");
              comp.dataset.videoStatus = "pause";
              if (comp.dataset.isActive === "false") {
                comp.dataset.pausedByLeave = "true";
              }
            }

            if (data.event === "finish") {
              const loop = iframe.getAttribute("data-video-loop") === "true";
              if (loop) comp.externalPostCommand(iframe, "play");
            }

            if (comp.muteBtn && data.method === "setVolume") {
              comp.muteBtn.classList.toggle("is-muted", data.value === 0);
            }
          }
          break;
        }
      });

      CustomVideo._globalMessageBound = true;
    }

    _toBool(v) {
      if (typeof v === "boolean") return v;
      return String(v) === "true";
    }

    _escapeHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&lt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    renderVimeoFacadeSource() {
      if (!this.vimeoCoverEl || !this.config.id) return;

      fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${this.config.id}&width=1980}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!data?.thumbnail_url) return;

          this._injectVimeoCover(data);
        })
        .catch(() => {
        });
    }

    _injectVimeoCover(data) {
      const {thumbnail_url, width, height} = data;

      const source = document.createElement('source');
      source.srcset = thumbnail_url;
      source.media = '(min-width: 768px)';
      source.width = width;
      source.height = height;

      const img = document.createElement('img');
      img.src = thumbnail_url;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = this.config.alt || '';
      img.width = width;
      img.height = height;
      img.className = "object-cover absolute top-0 left-0 w-full h-full z-10 rounded-corners";

      requestAnimationFrame(() => {
        this.vimeoCoverEl.appendChild(source);
        this.vimeoCoverEl.appendChild(img);
      });
    }

  }

  if (!customElements.get("custom-video")) {
    customElements.define("custom-video", CustomVideo);
  }
})();
