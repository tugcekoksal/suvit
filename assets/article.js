if (!window.Maximize.loadedScript.includes('article.js')) {
    window.Maximize.loadedScript.push('article.js');

    requestAnimationFrame(() => {
      const defineXArticle = () => {
        Alpine.data('xArticle', () => ({
          show: false,
          showInTab: false,
          isPreRelocation: false,

          initActiveHighlight() {
            this.isPreRelocation = !!this.$el.closest('[data-toc-source]');
            if (this.isPreRelocation) return;

            if (!document.querySelector('.side-bar__toc')) return;

            const observer = new IntersectionObserver((entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  if (document.querySelector('.side-bar__toc .active')) {
                    document.querySelector('.side-bar__toc .active').classList.remove("active");
                  }
                  document.querySelectorAll('.side-bar__toc-label')[entry.target.dataset.index].classList.add("active");
                }
              });
            }, {rootMargin: '0px 0px -60% 0px'});

            if (this.$refs.content.querySelectorAll('h2, h3, h4').length > 1) {
              this.$refs.content.querySelectorAll('h2, h3, h4').forEach((heading, index) => {
                heading.dataset.index = index;
                observer.observe(heading);
              });
            } else {
              document.querySelector('.side-bar__toc').remove();
            }
          },

          initScrollProgress() {
            if (this.isPreRelocation) return;

            const load = document.querySelector('.side-bar__load-bar-fill');
            const loadBar = document.querySelector('.side-bar__load-bar-track');
            const element = this.$refs.content;
            if (!element) return;

            document.addEventListener('scroll', () => {
              const elementTop = element.offsetTop;
              const elementHeight = element.offsetHeight;
              const windowHeight = window.innerHeight;
              const scrollPosition = window.scrollY + windowHeight;

              let scrollPercent;

              if (scrollPosition < elementTop) {
                scrollPercent = 0;
                if (loadBar) loadBar.classList.remove("active-bar")
              } else if (scrollPosition > elementTop + elementHeight) {
                scrollPercent = 100;
              } else {
                if (loadBar) loadBar.classList.add("active-bar")
                scrollPercent = ((scrollPosition - elementTop) / elementHeight) * 100;
              }
              if (load) load.style.width = scrollPercent.toFixed(2) + `%`
            })
          },

          buildToc(list_style) {
            if (this.isPreRelocation) return;

            const heading2 = document.querySelector('.main-article__text .page__body').querySelectorAll('h2, h3, h4');
            if (heading2.length <= 1) return;

            const ulClassForLevel = (level) => {
              if (list_style === 'bullet') return "toc:m-0 toc:pl-5";
              return level === 4 ? "toc:m-0 toc:pl-6" : "toc:m-0 toc:pl-4";
            };
            const liOpenTag = (index, text) =>
              "<li class='toc:m-0 toc:mt-1.5 side-bar__toc-item w-full'><span class='side-bar__toc-label w-full cursor-pointer' tabindex='0' @keydown.enter='scrollTop($el," + index + ")' @click='scrollTop($el," + index + ")'>" + text + "</span>";

            const stack = [];
            let htmlContent = "";
            heading2.forEach((item, index) => {
              const level = parseInt(item.tagName.charAt(1), 10);

              if (!stack.length) {
                htmlContent += liOpenTag(index, item.textContent);
                stack.push(level);
                return;
              }

              if (level > stack[stack.length - 1]) {
                htmlContent += "<ul class='" + ulClassForLevel(level) + "'>" + liOpenTag(index, item.textContent);
                stack.push(level);
                return;
              }

              while (stack.length > 1 && level < stack[stack.length - 1]) {
                htmlContent += "</li></ul>";
                stack.pop();
              }
              htmlContent += "</li>" + liOpenTag(index, item.textContent);
              stack[stack.length - 1] = level;
            });
            while (stack.length > 1) {
              htmlContent += "</li></ul>";
              stack.pop();
            }
            htmlContent += "</li>";

            document.querySelector('.side-bar__toc-list').innerHTML += htmlContent;
          },

          scrollTop(el, index) {
            if (document.querySelector('.main-article__text .page__body').querySelectorAll('h2, h3, h4').length > index) {
              if (document.querySelector('.side-bar__toc .active')) {
                document.querySelector('.side-bar__toc .active').classList.remove("active");
              }
              el.closest('.side-bar__toc-label').classList.add("active");
              document.querySelector('.main-article__text .page__body').querySelectorAll('h2, h3, h4')[index].scrollIntoView({ behavior: "smooth" });
            }
          },

          initLoadBarPosition() {
            if (this.isPreRelocation) return;

            let sideBarElement = document.querySelector('.side-bar__body');
            if (sideBarElement) {
              if (sideBarElement.querySelector('.side-bar__load-bar .side-bar__load-bar-track')) {
                document.querySelector('.main-article__load-bar').appendChild(sideBarElement.querySelector('.side-bar__load-bar .side-bar__load-bar-track'));
              }
            }
            Alpine.store("xHeaderMenu")._cacheStickyTargets();
          },

          initAutoCloseOnDesktop() {
            if (this.isPreRelocation) return;

            installMediaQueryWatcher(`(min-width: ${MIN_DEVICE_WIDTH.tablet}px)`, (matches) => {
              if (matches && this.show) {
                this.show = false;
                Alpine.store('xMaximizeDrawer').handleClose();
              }
            });
          }
        }));
      };
      if (window.Alpine) {
        defineXArticle();
      } else {
        document.addEventListener('alpine:init', defineXArticle);
      }
    });
  }
