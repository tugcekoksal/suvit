if (!window.Maximize.loadedScript.includes('featured-blog.js')) {
  window.Maximize.loadedScript.push('featured-blog.js');

  requestAnimationFrame(() => {
    const defineXFeaturedBlog = () => {
      Alpine.data('xFeaturedBlog', (sectionId, loadingData) => ({
        sectionId: sectionId,
        loading: loadingData,
        show_more: true,
        loadData() {
          let url = `${window.location.pathname}?section_id=${this.sectionId}`;
          fetch(url, {
            method: 'GET'
          }).then(
            response => response.text()
          ).then(responseText => {
            this.loading = false;
          })
        }
      }));
    };
    if (window.Alpine) {
      defineXFeaturedBlog();
    } else {
      document.addEventListener('alpine:init', defineXFeaturedBlog);
    }
  });
}