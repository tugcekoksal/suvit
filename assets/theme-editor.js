// In the theme editor visual preview (section/block preset previews), editor events can be
// dispatched with a non-Element target (e.g. document), which has no .id/.classList.
// Guard every listener so a preview render never throws.
function isEditorEventTargetElement(event) {
  return event.target instanceof Element;
}

document.addEventListener("shopify:block:select", function (event) {
  if (!isEditorEventTargetElement(event)) return;
  const blockSelected = event.target.classList;
  /* start slideshow.liquid */
  if (event.target.classList.contains("slide-item")) {
    const swiffyElement = event.target.closest(".swiffy-slider");
    let swiffy = null;
    let count = 0;
    if (swiffyElement) {
      swiffy = new SwiffySlider(swiffyElement, {});
    }

    let interval = setInterval(() => {
      count++;
      if (swiffy) {
        const index = event.target.dataset.swiffyIndex;
        if (index) {
          swiffy.slideTo(parseInt(index) - 1);
        }
        clearInterval(interval);
      }
      if (count > 10) clearInterval(interval);
    }, 200);
  }
  /* end slideshow.liquid */
  /* start shop the look */
  if (event.target.classList.contains("x-hotspot")) {
    let splideEl = document.getElementById("x-product-shop-look-" + event.detail.sectionId);
    const index = parseInt(event.target.attributes.index.value);
    setTimeout(() => {
      splideEl.splide.go(index - 1);
    }, 300);
  }
  /* end shop the look */
  /* start mobile-navigation.liquid */
  if (blockSelected.contains("block-mobile-navigation")) {
    if (window.Alpine) {
      Alpine.store("xMobileNav").resetMenu();
      Alpine.store("xMobileNav").open();
    } else {
      document.addEventListener("alpine:initialized", () => {
        Alpine.store("xMobileNav").resetMenu();
        Alpine.store("xMobileNav").open();
      });
    }
  }
  /* end mobile-navigation.liquid */

  
  if (blockSelected.contains("utility-block")) {
    if (window.Alpine) {
      Alpine.store("xMobileNav").moveElement();
    } else {
      document.addEventListener("alpine:initialized", () => {
        Alpine.store("xMobileNav").moveElement();
      });
    }
  }

  /* start quick-view.liquid */
  if (event.detail.sectionId?.includes("quick-view")) {
    if (window.Alpine && Alpine.store("xQuickView")) {
      Alpine.store("xQuickView").show = true;
      Alpine.store("xQuickView").selected = true;
      Alpine.store('xMaximizeDrawer').handleOpen("#QuickViewContainer__wapper");
    } else {
      document.addEventListener("alpine:initialized", () => {
        if (Alpine.store("xQuickView")) {
          Alpine.store("xQuickView").show = true;
          Alpine.store("xQuickView").selected = true;
          Alpine.store('xMaximizeDrawer').handleOpen("#QuickViewContainer__wapper");
        }
      });
    }
  }
  /* end quick-view.liquid */

  /* start featured-collections.liquid */
  if (blockSelected.contains("collection-title")) {
    event.target.click();
  }
  /* end featured-collections.liquid */
  if (event.target.id.includes("__header") || event.target.id.includes("announcement-bar")) {
    Alpine.store("xHeaderMenu")._syncHeaderHeightVar();
    Alpine.store("xHeaderMenu")._updateAnnouncementHeight();
  }
  if (blockSelected.contains("segmented-banner__image")) {
    const blockId = event.target.dataset.blockId;
    const blockItem = document.querySelector(`.paginate-item-${blockId}`)
    if (blockItem) {
      blockItem.click();
    }
  }
});

document.addEventListener("shopify:section:reorder", function (event) {
  if (!isEditorEventTargetElement(event)) return;
  if (event.target.id.includes("__header") || event.target.id.includes("announcement-bar")) {
    Alpine.store("xHeaderMenu")._syncHeaderHeightVar();
    Alpine.store("xHeaderMenu")._updateAnnouncementHeight();
  }
});

document.addEventListener("shopify:section:unload", function (event) {
  if (!isEditorEventTargetElement(event)) return;
  if (event.target.id.includes("__header") || event.target.id.includes("announcement-bar")) {
    const sectionId = event.detail.sectionId;
    const sectionElement = document.getElementById(`shopify-section-${sectionId}`);

    if (sectionElement) {
      const observer = new MutationObserver((mutations, obs) => {
        if (!document.body.contains(sectionElement)) {
          Alpine.store("xHeaderMenu")._syncHeaderHeightVar();
          Alpine.store("xHeaderMenu")._updateAnnouncementHeight();
          obs.disconnect();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
  if (event.target?.classList?.contains("x-drawer-menu")) {
    document.getElementById("DrawerMenuDesktopPosition").innerHTML = "";
    document.getElementById("DrawerMenuMobilePosition").innerHTML = ""
  }

  if (event.target?.classList?.contains("section-utility-bar")) {
    const element = document.getElementById("main-nav-mobile-toolbar");
    if (element) {
      element.innerHTML = "";
    }
  }
});

document.addEventListener("shopify:block:deselect", function (event) {
  if (!isEditorEventTargetElement(event)) return;
  const blockSelected = event.target.classList;
  /* start slideshow.liquid */
  if (event.target.classList.contains("x-splide-slide")) {
    const slideshow = event.target.closest(".x-splide");
    if (slideshow.splide.theme_editor_paused) {
      slideshow.splide.Components.Autoplay.play();
    }
  }
  /* end slideshow.liquid */

  if (blockSelected.contains("utility-block")) {
    if (window.Alpine) {
      Alpine.store("xMobileNav").moveElement();
    } else {
      document.addEventListener("alpine:initialized", () => {
        Alpine.store("xMobileNav").moveElement();
      });
    }
  }
});

document.addEventListener("shopify:section:select", function (event) {
  if (!isEditorEventTargetElement(event)) return;
  const sectionSelected = event.target.classList;
  /* start quick-view.liquid */
  if (event.target.id.includes("quick-view")) {
    if (window.Alpine && Alpine.store("xQuickView")) {
      Alpine.store("xQuickView").show = true;
      Alpine.store("xQuickView").selected = true;
      Alpine.store('xMaximizeDrawer').handleOpen("#QuickViewContainer__wapper");
    } else {
      document.addEventListener("alpine:initialized", () => {
        if (Alpine.store("xQuickView")) {
          Alpine.store("xQuickView").show = true;
          Alpine.store("xQuickView").selected = true;
          Alpine.store('xMaximizeDrawer').handleOpen("#QuickViewContainer__wapper");
        }
      });
    }
  } else {
    if (window.Alpine && Alpine.store("xQuickView")) {
      if (Alpine.store("xQuickView").show) {
        Alpine.store("xQuickView").show = false;
      }

      Alpine.store("xQuickView").selected = false;
      Alpine.store('xMaximizeDrawer').handleClose();
    } else {
      document.addEventListener("alpine:initialized", () => {
        if (Alpine.store("xQuickView")) {
          if (Alpine.store("xQuickView").show) {
            Alpine.store("xQuickView").show = false;
          }

          Alpine.store("xQuickView").selected = false;
          Alpine.store('xMaximizeDrawer').handleClose();
        }
      });
    }
  }
  /* end quick-view.liquid */

  /* start cookie-banner.liquid */
  if (event.target.id.includes("cookie-banner")) {
    if (window.Alpine) {
      Alpine.store("xShowCookieBanner").show = true;
    } else {
      document.addEventListener("alpine:initialized", () => {
        Alpine.store("xShowCookieBanner").show = true;
      });
    }
  }
  /* end cookie-banner.liquid */

  /* start mobile-navigation.liquid */
  if (sectionSelected.contains("section-mobile-navigation")) {
    if (window.Alpine) {
      Alpine.store("xMobileNav").resetMenu();
      Alpine.store("xMobileNav").open();
    } else {
      document.addEventListener("alpine:initialized", () => {
        Alpine.store("xMobileNav").resetMenu();
        Alpine.store("xMobileNav").open();
      });
    }
  } else {
    if (window.Alpine) {
      Alpine.store("xMobileNav").close();
    } else {
      document.addEventListener("alpine:initialized", () => {
        Alpine.store("xMobileNav").close();
      });
    }
  }
  /* end mobile-navigation.liquid */
});

document.addEventListener("shopify:section:select", function (event) {
  if (!isEditorEventTargetElement(event)) return;
  /* start cookie-banner.liquid */
  if (event.target.id == "shopify-section-cookie-banner") {
    if (window.Alpine) {
      Alpine.store("xShowCookieBanner").show = true;
    } else {
      document.addEventListener("alpine:initialized", () => {
        Alpine.store("xShowCookieBanner").show = true;
      });
    }
  }
  /* end cookie-banner.liquid */
  if (event.target.id.includes("__header") || event.target.id.includes("announcement-bar")) {
    Alpine.store("xHeaderMenu")._syncHeaderHeightVar();
    Alpine.store("xHeaderMenu")._updateAnnouncementHeight();
  }
});

document.addEventListener("shopify:section:deselect", function (event) {
  if (!isEditorEventTargetElement(event)) return;
  /* start cookie-banner.liquid */
  if (event.target.id.includes("cookie-banner")) {
    if (window.Alpine) {
      Alpine.store("xShowCookieBanner").show = false;
    } else {
      document.addEventListener("alpine:initialized", () => {
        Alpine.store("xShowCookieBanner").show = false;
      });
    }
  }
  /* end cookie-banner.liquid */
  if (event.target.id.includes("__header") || event.target.id.includes("announcement-bar")) {
    Alpine.store("xHeaderMenu")._syncHeaderHeightVar();
    Alpine.store("xHeaderMenu")._updateAnnouncementHeight();
  }
});

document.addEventListener("shopify:section:load", function (event) {
  if (!isEditorEventTargetElement(event)) return;
  const sectionSelected = event.target.classList;
  if (event.target?.id?.includes("__header") || event.target?.id?.includes("announcement-bar")) {
    Alpine.store("xHeaderMenu")._syncHeaderHeightVar();
    Alpine.store("xHeaderMenu")._updateAnnouncementHeight();
    const headerDesktop = document.querySelector("#x-header-container .x-header-store-selector-desktop");
    const headerMobile = document.querySelector(".x-header-store-selector-mobile");

    const desktopTemplate = document.getElementById("HeaderDesktopLocator");
    const mobileTemplate = document.getElementById("HeaderMobileLocator");

    headerDesktop.innerHTML = '';
    headerMobile.innerHTML = '';
    if (headerDesktop && desktopTemplate) {
      headerDesktop.appendChild(desktopTemplate.cloneNode(true));
    }
    if (headerMobile && mobileTemplate) {
      headerMobile.appendChild(mobileTemplate.cloneNode(true));
    }
    if (window.Alpine) {
      Alpine.store("xMobileNav").moveElement();
    } else {
      document.addEventListener("alpine:initialized", () => {
        Alpine.store("xMobileNav").moveElement();
      });
    }
  }
  if (sectionSelected?.contains("x-drawer-menu")) {
    setTimeout(() => {
      Alpine.store("xHeaderMenu")._drawerMenuEl = document.getElementById("DrawerMenu");
      Alpine.store("xHeaderMenu").updateHeaderBottom();
    }, 500)
  }
  if (sectionSelected?.contains("x-drawer-menu") || sectionSelected?.contains("x-header")) {
    Alpine.store("xDrawerMenu").menuOpen = null;
  }

  if (sectionSelected?.contains("section-utility-bar")) {
    if (window.Alpine) {
      Alpine.store("xMobileNav").moveElement();
    } else {
      document.addEventListener("alpine:initialized", () => {
        Alpine.store("xMobileNav").moveElement();
      });
    }
  }
  if (event.target?.classList?.contains("section-footer") && Alpine.store("stickyATC")) {
    const wrapperElement = event.target;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === wrapperElement) {
            if (entry.isIntersecting) {
              Alpine.store("stickyATC").isFooterShow = true;
            } else {
              if (entry.target.offsetParent) {
                Alpine.store("stickyATC").isFooterShow = false;
              } else if (Shopify.designMode) {
                observer.unobserve(entry.target)
              }
            }
          }
        });
        Alpine.store("stickyATC").isOpen = !Alpine.store("stickyATC").isFooterShow && Alpine.store("stickyATC").isProductInfoOutOfView;
      },
      { root: null, threshold: 0, rootMargin: "0px 0px -10px 0px" }
    );

    if (wrapperElement) {
      observer.observe(wrapperElement);
    }
  }
});

document.addEventListener("DOMContentLoaded", (event) => {
  localStorage.setItem("section-age-verification-popup", JSON.stringify(false));
  localStorage.setItem("section-promotion-popup", JSON.stringify(false));
});