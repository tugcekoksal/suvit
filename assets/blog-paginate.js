if (!window.Maximize.loadedScript.includes("blog-paginate.js")) {
  window.Maximize.loadedScript.push("blog-paginate.js");

  requestAnimationFrame(() => {
    const defineXBlogPaginate = () => {
      Alpine.data('xBlogPaginate', (section_id, blogArticleSize) => ({
        init() {
          document.addEventListener(SELECT_ELEMENT_EVENT.change, (event) => {
            let blogOption = event.target;
            if (blogOption.classList.contains('blog-option'))
              this.fillTag(blogOption);
          });
        },
        fillTag(blogOption) {
          let href = blogOption.dataset.value;
          if (href && href != '') location.href = href;
        }
      }));
    };
    if (window.Alpine) {
      defineXBlogPaginate();
    } else {
      document.addEventListener("alpine:init", defineXBlogPaginate);
    }
  });
}
