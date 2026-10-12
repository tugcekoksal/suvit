const PRODUCT_EVENT = {
  updatedVariant: "maximize:variant-picker:updated:",
  updatedProductSections: "maximize:variant-picker:sections:updated:",
  swatchChange: "maximize:color-swatch:change:",
  giftCardRecipientChange: "maximize:gift-card-recipient:change:",
  productRecommendationsChange: "maximize:product-recommendations:change:",
};

const STICKY_ATC_EVENT = {
  optionChange: "maximize:sticky-atc:option:updated:",
};

const CART_EVENT = {
  cartUpdate: "maximize:cart:updated",
  cartItemUpdateFail: "maximize:cart:item:fail-update",
  validate: "maximize:cart:validate",
  discountCodeChange: "maximize:cart:discount-code:change",
  showCustomFiled: "maximize:cart:show-custom-field",
};

const ORDER_VIEW_EVENT = {
  added: "maximize:order-view:added",
};

const STORE_MAP_EVENT = {
  openPopup: "maximize:store-map:open",
};

const SELECT_ELEMENT_EVENT = {
  updated: "maximize:select-element:updated",
  change: "maximize:select-element:change",
};

const SWIFFY_SLIDER_EVENT = {
  slide: "maximize:swiffy-slider:slide",
};

const ANIMATION_EVENT = {
  revealItem: "maximize:animation:reveal",
};

const FACET = {
  productLayout: "facet-product-layout",
};
const CART_ATTRIBUTES = {
  product_comparison_options: "product_comparison_variant_options",
  product_comparison_metafields: "product_comparison_metafields",
};

const MIN_DEVICE_WIDTH = {
  desktop: 1024,
  tablet: 768,
};

const PREORDER_TYPE_SHOW = {
  yes: "yes",
  onBackOrder: "on_back_ordered",
};

const LOCAL_STORAGE = {
  maximize_cart_custom_field: "maximize_cart_custom_field",
  quick_help_popup_closed_in_version: "quick_help_popup_closed_in_version",
};

const ZOOM_EFFECT = {
  enlarge: "enlarge",
  magnifier: "magnifier",
};

const PRODUCT_FORM_SOURCE_CHANGE = {
  variantPicker: "variant-picker",
  giftCardRecipient: "gift-card-recipient",
};

const PRODUCT_BUNDLE = {
  productChange: "maximize:product-bundle:products-changed:",
  addToBundle: "maximize:product-bundle:add-to-bundle:",
};
const ADDITIONAL_FEE = {
  defaultTextDropDown: "-----",
};
const TIMEOUT = {
  scrollIdle: 100,
  resize: 100,
};

const THRESHOLD = {
  startScroll: 10,
};

const SLIDER_EFFECT = {
  fade: "fade",
  slide: "slide",
  push: "push",
};

const PRODUCT_MEDIA_DESKTOP_LAYOUT = {
  slider1Columns: "1_column",
  slider2Columns: "2_columns",
  grid2Columns: "grid_2_columns",
};

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;
const MS_PER_HOUR = MS_PER_MINUTE * MINUTES_PER_HOUR;
const MS_PER_DAY = MS_PER_HOUR * HOURS_PER_DAY;

const WEEKDAYS_COUNT_DOWN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const PRODUCT_MEDIA_EVENT = {
  show_model: "maximize:product-media:show-model",
};

const END_OF_DAY = { HOURS: 23, MINUTES: 59, SECONDS: 59 };

const BUTTON_HOVER_ANM = {
  thicken: "thicken",
  opacity: "opacity",
  none: "none",
};

const DURATION = {
  ANIMATION: 700,
  DRAWER_TRANSITION: 500,
  REVEAL_TRANSITION: 700,
  SEGMENTED_BANNER_ANIMATION_DESKTOP: 1600,
  SHOW_ICON_ATC_SUCCESS: 2000,
  FLASH_MESSAGE: 3000,
};

const SLIDER_DOT = {
  MAX_NUMBER_DOTS: 7,
  DOT_WIDTH: 10,
  DOT_GAP: 2,
};

const SLIDE_ELEMENT = {
  SLIDE_ELEMENT_GAP: 10,
  SLIDER_ELEMENT_DURATION: 500,
};

const ICON_POPUP_SPACING = {
  DESKTOP: 25,
  MOBILE: 38,
};

const TAB_ANIMATION = {
  DURATION: 300,
  MAX_STRETCH: 60,
};

const QUANTITY_EVENT = {
  volumnPricingChange: "maximize:volume-pricing-changed",
};

const BULK_ORDER_EVENT = {
  importStarted: "maximize:bulk-order:import-started",
  cartSubmitResolved: "maximize:bulk-order:cart-submit-resolved",
};
