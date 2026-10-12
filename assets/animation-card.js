/**
 * Dispatch shopify:product:view when a product card scrolls into the viewport.
 * Reads the pre-built payload from `view-event-payload` attribute (set in product-card.liquid
 * via Shopify's `standard_event_data` Liquid filter). Fire-and-forget — no promise needed.
 * @param {Element} element  the .anm-reveal-item card element
 */
function _dispatchProductView(element) {
  const Cls = window.StandardEvents?.ProductViewEvent;
  if (!Cls) return;

  const raw = element.getAttribute('view-event-payload');
  if (!raw) return;

  let payload;
  try { payload = JSON.parse(raw); } catch (_) { return; }

  try { element.dispatchEvent(new Cls(payload)); } catch (_) {}
}

function onIntersection(elements, observer) {
  elements.forEach((entry, index) => {
    if (entry.isIntersecting) {
      const elementTarget = entry.target;
      elementTarget.classList.add("animation-card");
      elementTarget.dataset.active = "true";
      // Remove the guard attribute so AJAX-replaced items (same element re-added
      // after innerHTML swap) can be re-observed in subsequent sections loads.
      elementTarget.removeAttribute('data-observed');
      elementTarget.setAttribute('style', `--animation-order: ${index + 1};`);
      observer.unobserve(elementTarget);

      _dispatchProductView(elementTarget);
    }
  });
}

function initializeScrollAnimationTrigger(rootEl = document) {
  const animationContainers = Array.from(rootEl.querySelectorAll(".anm-reveal-container"));

  animationContainers.forEach((container) => {
    // :not([data-observed]) prevents items from being added to multiple
    // IntersectionObservers when initializeScrollAnimationTrigger() is called
    // repeatedly (e.g. once per x-intersect.once on each product-recommendations
    // item wrapper). Without this guard, each item accumulates N observers and
    // dispatches shopify:product:view N times when it enters the viewport.
    const animationTriggerElements = Array.from(
      container.querySelectorAll(".anm-reveal-item[data-active='false']:not([data-observed])")
    );

    if (animationTriggerElements.length === 0) return;

    const observer = new IntersectionObserver((entries, obs) => {
      onIntersection(entries, obs);
    }, {
      rootMargin: '0px 0px -50px 0px'
    });

    animationTriggerElements.forEach((element) => {
      element.setAttribute('data-observed', 'true');
      observer.observe(element);
    });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initializeScrollAnimationTrigger();
});
document.addEventListener(`${ANIMATION_EVENT.revealItem}`, (event) => {
  initializeScrollAnimationTrigger(event.detail?.rootElement);
})
if (Shopify.designMode) {
  // change by reorder insead
  document.addEventListener('shopify:section:load', () => initializeScrollAnimationTrigger(document));
}
