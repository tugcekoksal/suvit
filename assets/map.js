if (!window.Maximize.loadedScript.includes('map.js')) {
  window.Maximize.loadedScript.push('map.js');

  requestAnimationFrame(() => {
    const defineXMap = () => {
      Alpine.data("xMap", (data) => ({
        load() {
          const mapIframe = this.$el.querySelector("iframe");
          if (mapIframe) {
            mapIframe.addEventListener("load", () => {
              mapIframe.classList.remove("hidden");
              this.$refs.iframe_placeholder?.classList.add("hidden");
            });
            mapIframe.src = `https://maps.google.com/maps?q=${data}&t=m&z=17&ie=UTF8&output=embed&iwloc=near`;
          }
        },
        loadMap(location) {
          this.$el.querySelector(
            "iframe"
          ).src = `https://maps.google.com/maps?q=${location}&t=m&z=17&ie=UTF8&output=embed&iwloc=near`;
        },
        removeMap() {
          this.$el.querySelector(
            "iframe"
          ).src = ``;
        } 
      }));
    };
    if (window.Alpine) {
      defineXMap();
    } else {
      document.addEventListener("alpine:init", defineXMap);
    }
  });
}
