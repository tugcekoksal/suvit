if (!window.Maximize.loadedScript.includes("video.js")) {
  window.Maximize.loadedScript.push("video.js");

  requestAnimationFrame(() => {
    const registerXVideoStore = () => {
      Alpine.store("xVideo", {
        ytIframeId: 0,
        vimeoIframeId: 0,
        externalListened: false,
        togglePlay(el) {
          const videoContainer = el.closest('.external-video') || el;
          if (!videoContainer) return;

          let video = videoContainer.getElementsByClassName('video')[0];
          if (!video) return;

          const videoWrapper = el.closest('.video__wrapper');
          const videoText = videoWrapper ? videoWrapper.getElementsByClassName('video__content__text')[0] : null;
          if (videoText) {
            videoText.classList.add('pointer-events-auto');
          }
          if ((video.tagName == 'IFRAME' && videoContainer.classList.contains('function-paused')) || video.paused) {
            this.play(el);
          } else {
            this.pause(el);
          }
        },
        play(el) {
          const videoContainer = el.closest('.external-video') || el;
          if (!videoContainer) return;

          let video = videoContainer?.getElementsByClassName('video')[0];
          if (!video ) return;

          const buttonPlay = videoContainer.getElementsByClassName('button-play')[0];
          const buttonSoundControl = videoContainer.getElementsByClassName('button-sound-control')[0];
          if (buttonPlay) {
            buttonPlay.classList.add('started-video');
          }
          if (buttonSoundControl) {
            buttonSoundControl.setAttribute('tabindex', '0')
          }

          if (video.tagName == 'IFRAME') {
            if (videoContainer.classList.contains('function-paused')) {
              this.externalPostCommand(video, 'play');
              videoContainer.classList.remove('function-paused');
            }
          } else if (video.tagName == 'VIDEO') {
            video.play();
          }
          const videoWrapper = el.closest('.video__wrapper');
          const videoText = videoWrapper ? videoWrapper.getElementsByClassName('video__content__text')[0] : null;
          if (videoText) {
            videoText.classList.add('pointer-events-auto');
          }
        },
        pause(el, isLeave = false) {
          const videoContainer = el.closest('.external-video') || el;
          if (!videoContainer) return;

          let video = videoContainer.getElementsByClassName('video')[0];
          if (!video ) return;

          if (isLeave && videoContainer.dataset.videoStatus == 'play') {
            videoContainer.dataset.pausedByLeave = "true";
          }
          
          if (video.tagName == 'IFRAME') {
            if (!videoContainer.classList.contains('function-paused')) {
              videoContainer.classList.add('function-paused');
              this.externalPostCommand(video, 'pause');
            }
          } else if (video.tagName == 'VIDEO') {
            video.pause();
          }
        },
        mp4Listen(el) {
          let videoContainer = el.closest('.external-video') || el;
          if (!videoContainer) return;

          let video = videoContainer.getElementsByClassName('video')[0];
          if (!video) return;

          let buttonPlay = videoContainer.getElementsByClassName('button-play')[0];
          let buttonSoundControl = videoContainer.getElementsByClassName('button-sound-control')[0];

          video.addEventListener('play', function () {
            if (buttonPlay) {
              buttonPlay.classList.add('is-playing');
            }
            videoContainer.dataset.videoStatus = "play";
            videoContainer.dataset.pausedByLeave = "false";
          });

          video.addEventListener('pause', function () {
            if (buttonPlay) {
              buttonPlay.classList.remove('is-playing');
            }
            videoContainer.dataset.videoStatus = "pause";
          });

          if (buttonSoundControl) {
            video.addEventListener('volumechange', function () {
              if (video.muted) {
                buttonSoundControl.classList.add('is-muted');
              } else {
                buttonSoundControl.classList.remove('is-muted');
              }
            });
          }
        },
        mp4Thumbnail(el, showControls = true) {
          const videoContainer = el.closest(".external-video");
          if (!videoContainer) return;

          const imgThumbnail = videoContainer.getElementsByClassName("img-thumbnail")[0];
          const video = videoContainer.getElementsByClassName("video")[0];
          if (imgThumbnail) {
            imgThumbnail.classList.add("hidden");
          }

          if (video && showControls) {
            video.setAttribute('tabindex', '0');
            video.focus();
            video.setAttribute("controls", "");
          }

          this.togglePlay(el);

          if (video && showControls) {
            video.setAttribute("controls", "");
          }
        },
        externalLoad(el, host, id, loop, title, showControls = true) {
          let src = "";
          let pointerEvent = "";
          const controls = showControls ? 1 : 0;
          if (host == "youtube") {
            src = `https://www.youtube.com/embed/${id}?mute=1&playlist=${id}&autoplay=1&playsinline=1&enablejsapi=1&modestbranding=1&rel=0&controls=${controls}&showinfo=${controls}`;
          } else {
            src = `https://player.vimeo.com/video/${id}?muted=1&autoplay=1&playsinline=1&api=1&controls=${controls}&loop=${loop ? 1 : 0}`;
          }

          requestAnimationFrame(() => {
            const videoContainer = el.closest(".external-video");
            if (videoContainer) {
              const videoContentEl = videoContainer.querySelector('.video-container');
              if (!videoContentEl) return;
              videoContentEl.innerHTML = `<iframe data-video-loop="${loop}" class="iframe-video absolute w-full h-full video top-1/2 -translate-y-1/2 ${pointerEvent}"
              frameborder="0" host="${host}" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen playsinline
              src="${src}" title="${title}"></iframe>`;
              const iframeVideo = videoContainer.querySelector(".iframe-video");
              
              if (showControls) {
                videoContainer.setAttribute('tabindex', '0');
                videoContainer.focus();
              }

              if (iframeVideo) {
                iframeVideo.addEventListener("load", () => {
                  setTimeout(() => {
                    if (videoContainer.dataset.isActive == 'true') {
                      this.play(videoContainer);
                    } else {
                      this.pause(videoContainer, true);
                      videoContainer.dataset.videoStatus = "pause";
                    }

                    if (host == "youtube") {
                      this.ytIframeId++;
                      iframeVideo.contentWindow.postMessage(
                        JSON.stringify({
                          event: "listening",
                          id: this.ytIframeId,
                          channel: "widget"
                        }),
                        "*"
                      );
                    } else {
                      this.vimeoIframeId++;
                      iframeVideo.contentWindow.postMessage(
                        JSON.stringify({
                          method: "addEventListener",
                          value: "finish"
                        }),
                        "*"
                      );
                      iframeVideo.contentWindow.postMessage(
                        JSON.stringify({
                          method: 'addEventListener',
                          value: 'play'
                        }),
                        "*"
                      );
                      iframeVideo.contentWindow.postMessage(
                        JSON.stringify({
                          method: 'addEventListener',
                          value: 'pause'
                        }),
                        "*"
                      );
                    }
                  }, 100);
                });
              }
            }
          });

          this.externalListen();
        },
        renderVimeoFacade(el, id, options) {
          fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${id}&width=${options.width}`)
            .then((reponse) => {
              return reponse.json();
            })
            .then((response) => {
              const html = `
                <picture>
                  <img src="${response.thumbnail_url}" loading="lazy" class="w-full h-full object-cover" alt="${options.alt}" width="${response.width}" height="${response.height}"/>
                </picture>
              `;

              requestAnimationFrame(() => {
                el.innerHTML = html;
              });
            });
        },
        renderVimeoFacadeSource(el, id, options, loading) {
          fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${id}&width=${options.width}`)
            .then((response) => response.json())
            .then((response) => {

              const source2 = document.createElement('source');
              source2.srcset = `${response.thumbnail_url}`;
              source2.media = '(min-width: 768px)';
              source2.width = response.width;
              source2.height = response.height;

              const img = document.createElement('img');
              img.src = response.thumbnail_url;
              img.loading = loading;
              img.className = 'object-cover z-10 absolute top-0 left-0 h-full w-full img-thumbnail image-hover';
              img.alt = options.alt || '';
              img.width = response.width;
              img.height = response.height;

              requestAnimationFrame(() => {
                el.appendChild(source2);
                el.appendChild(img);
                const vimeoThumbnailSkeletonEl = el.querySelector('.vimeo-thumbnail-skeleton');
                if (!vimeoThumbnailSkeletonEl) return;
                vimeoThumbnailSkeletonEl.remove();
              });
            });
        },
        externalListen() {
          if (!this.externalListened) {
            window.addEventListener('message', (event) => {
              var iframes = document.getElementsByTagName('IFRAME');

              for (let i = 0, iframe, win, message; i < iframes.length; i++) {
                iframe = iframes[i];
                let videoContainer = iframe.parentNode.closest('.external-video') || iframe.parentNode;
                let buttonSoundControl = videoContainer?.getElementsByClassName('button-sound-control')[0];
                const buttonPlay = videoContainer?.getElementsByClassName('button-play')[0];

                // Cross-browser way to get iframe's window object
                win = iframe.contentWindow || iframe.contentDocument.defaultView;

                if (win === event.source) {
                  if (event.origin == 'https://www.youtube.com') {
                    message = JSON.parse(event.data);
                    if (message.info && message.info.playerState == 0) {
                      if (iframe.getAttribute('data-video-loop') === 'true') {
                        this.externalPostCommand(iframe, 'play');
                      } else {
                        if (buttonPlay) {
                          buttonPlay.classList.remove('is-playing');
                        }
                        if (videoContainer) {
                          videoContainer.classList.add('function-paused');
                          videoContainer.dataset.videoStatus = "pause";
                        }
                      }
                    }
                    if (message.info && message.info.playerState == 1) {
                      if (buttonPlay) {
                        buttonPlay.classList.add('is-playing');
                      }
                      if (videoContainer) {
                        videoContainer.classList.remove('function-paused');
                        videoContainer.dataset.videoStatus = "play";
                        videoContainer.dataset.pausedByLeave = "false";
                      }
                    }
                    if (message.info && message.info.playerState == 2) {
                      if (buttonPlay) {
                        buttonPlay.classList.remove('is-playing');
                      }
                      if (videoContainer) {
                        videoContainer.classList.add('function-paused');
                        videoContainer.dataset.videoStatus = "pause";
                        if (videoContainer.dataset.isActive == 'false') {
                          videoContainer.dataset.pausedByLeave = 'true';
                        }
                      }
                    }

                    if (buttonSoundControl && message.info && typeof message.info.muted !== 'undefined') {
                      if (message.info.muted) {
                        buttonSoundControl.classList.add('is-muted');
                      } else {
                        buttonSoundControl.classList.remove('is-muted');
                      }
                    }
                  }

                  if (event.origin == 'https://player.vimeo.com') {
                    message = JSON.parse(event.data);
                    if (iframe.getAttribute('data-video-loop') !== 'true') {
                      if (message.event == "finish") {
                        if (iframe.getAttribute('data-video-loop') === 'true') {
                          this.externalPostCommand(iframe, 'play');
                        }
                      }
                    }
                    if (message.event === 'play') {
                      if (buttonPlay) {
                        buttonPlay.classList.add('is-playing');
                      }
                      if (videoContainer) {
                        videoContainer.classList.remove('function-paused');
                        videoContainer.dataset.videoStatus = "play";
                        videoContainer.dataset.pausedByLeave = "false";
                      }
                    }
                    if (message.event === 'pause') {
                      if (buttonPlay) {
                        buttonPlay.classList.remove('is-playing');
                      }
                      if (videoContainer) {
                        videoContainer.classList.add('function-paused');
                        videoContainer.dataset.videoStatus = "pause";
                        if (videoContainer.dataset.isActive == 'false') {
                          videoContainer.dataset.pausedByLeave = 'true';
                        }
                      }
                    }

                    if (buttonSoundControl && message.method === 'setVolume') {
                      if (message.value === 0) {
                        buttonSoundControl.classList.add('is-muted');
                      } else {
                        buttonSoundControl.classList.remove('is-muted');
                      }
                    }
                  }
                }
              }
            });

            this.externalListened = true;
          }
        },
        externalPostCommand(iframe, cmd) {
          const host = iframe.getAttribute("host");
          let command;
          if (host === "youtube") {
            if (cmd === "mute") {
              command = { event: "command", func: "mute" };
            } else if (cmd === "unmute") {
              command = { event: "command", func: "unMute" };
            } else {
              command = { event: "command", func: cmd + "Video" };
            }
          } else {
            if (cmd === "mute") {
              command = { method: "setVolume", value: 0 };
            } else if (cmd === "unmute") {
              command = { method: "setVolume", value: 1 };
            } else {
              command = { method: cmd, value: "true" };
            }
          }
          iframe.contentWindow.postMessage(JSON.stringify(command), "*");
        },
        toggleMute(el) {
          const videoContainer = el.closest('.external-video') || el;
          if (!videoContainer) return;

          let video = videoContainer.getElementsByClassName('video')[0];
          if (!video) return;

          if (video.tagName != "IFRAME") {
            video.muted = !video.muted;
          } else {
            let buttonSoundControl = videoContainer.getElementsByClassName('button-sound-control')[0];
            if (!buttonSoundControl) return;
            if (buttonSoundControl.classList.contains('is-muted')) {
              this.externalPostCommand(video, 'unmute')
            } else {
              this.externalPostCommand(video, 'mute')
            }
          }
        },
        handleClickButtonPlay(el, video_type, video_id, video_alt, show_controls = true) {
          if (el.classList.contains('started-video')) {
            this.togglePlay(el)
          } else if (video_type == 'video_select') {
            this.mp4Thumbnail(el, show_controls)
          } else {
            this.externalLoad(el, video_type, video_id, false, video_alt, show_controls)
          }
        },
        updateStatusVideo(videoContainer, isPlay, isUpdateActive) {
          let videoContainerDataset = videoContainer.dataset;
          if (!videoContainerDataset) return;
          if (isUpdateActive) {
            videoContainerDataset.isActive = isPlay ? 'true' : 'false';
          }
          if (isPlay && videoContainerDataset.videoAutoPlay == 'true') {
            if (videoContainerDataset.videoStatus == 'pause' && videoContainerDataset.pausedByLeave == 'true' && videoContainerDataset.isActive == 'true') {
              this.play(videoContainer);
            }
          } else {
            this.pause(videoContainer, true);
          }
        },
        firtLoadMp4AutoPlay(el) {
          if (el.dataset.isActive == 'true') {
            this.play(el);
          } else {
            this.pause(el, true);
            el.dataset.videoStatus = "pause";
          } 
          this.mp4Listen(el);
        }
      });
    };

    if (typeof Alpine !== 'undefined' && Alpine.store) {
      registerXVideoStore();
    } else {
      document.addEventListener("alpine:init", registerXVideoStore);
    }
  });
}
