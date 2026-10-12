if (!window.Maximize.loadedScript.includes("labels-and-badges.js")) {
  window.Maximize.loadedScript.push("labels-and-badges.js");

  requestAnimationFrame(() => {
    const defineXLabelsAndBadges = () => {
      Alpine.store("xLabelsAndBadges", {
        fixedPositionTemplate: `<div
          class="x-badge-{label-id} x-badge-container pointer-events-none{container-img-class}{css-display-class} ltr"
          {preview-show-condition}
          style="--rounded-corners: 4px;"
        >
          {content}
        </div>`,
        productDetailTemplate: `<div
          class="x-badge-{label-id} x-badge-container max-h-full bottom-0 pointer-events-none{container-css-class}{container-img-class}{css-rtl}"
          style="--rounded-corners: 4px;"
        >
          {content}
        </div>`,
        previewActiveBlock: "",
        init() {
          if (Shopify.designMode) {
            this.previewActiveBlock = localStorage.getItem("xBadgesPreviewActiveBlock")
            document.addEventListener("shopify:block:select", (event) => {
              if (!event.target.classList.contains("x-badges-block-preview")) return;

              let blockId = event.detail.blockId;
              this.previewActiveBlock = blockId;
              localStorage.setItem("xBadgesPreviewActiveBlock", blockId);
              document.dispatchEvent(new CustomEvent("maximize:badges:block-select"));
            });
            document.addEventListener("shopify:section:select", function (event) {
              const previewActiveBlock = localStorage.getItem("xBadgesPreviewActiveBlock");
              const badgeElement = document.querySelector(`.x-badge-${previewActiveBlock}`);
              if (badgeElement) {
                badgeElement.style.display = 'block';
              }
            })
          }
        },
        load(el, callback = () => {}, container = null) {
          if (container) el.container = container;

          this.doLoad(el, callback);
        },
        doLoad(el, callback = () => {}) {
          this.initAllLabels(el);

          if (Shopify.designMode) {
            let productData = xParseJSON(el.getAttribute("x-labels-data"));
            document.addEventListener("shopify:section:load", () => {
              if (productData && !productData.isXBadgesPreview) {
                this.initAllLabels(el);
              }
            });
          }

          callback(el);
        },
        initAllLabels(el) {
          let productData = xParseJSON(el.getAttribute("x-labels-data"));

          if (!productData) return;

          if (Shopify.designMode) {
            let currentLabels = el.getElementsByClassName("x-badge-container");
            if (currentLabels.length > 0) {
              const labelsNum = currentLabels.length;
              for (let i = 0; i < labelsNum; i++) {
                currentLabels[0].remove();
              }
            }
          }
          let allLabels = document.getElementsByClassName("x-badges-block-data");
          // Clear content in label
          el.querySelectorAll(".label-container").forEach(el => el.innerHTML = "");

          for (let i = 0; i < allLabels.length; i++) {
            let label = xParseJSON(allLabels[i].getAttribute("x-badges-block-data"));
            if (!label.enable && !productData.isXBadgesPreview) return;
            
            if (label.settings.icon_type == 'custom_icon_image' && label.settings.custom_icon_image) {
              label.settings.icon = `
                <img 
                  loading="lazy"
                  width="100%"
                  height="100%"
                  class="h-full w-full object-cover"
                  alt="${label.settings.image_alt.length > 0 ? label.settings.image_alt : productData.title}"
                  src="${label.settings.custom_icon_image}&width=50"
                />
            `
            } else {
              label.settings.icon = allLabels[i].getAttribute("x-badges-icon");
            }
            label.settings.content = allLabels[i].getAttribute("x-badges-content");
            this.appendLabel(el, label, productData);
          }
        },
        appendLabel(el, label, productData) {
          if (productData.container == "product-info" && productData.label_position == "content_inline") {
              el.innerHTML += this.processTemplate(el, label, productData);
            return;
          }

          let container = el.querySelector(`.${label.settings.position}-container`);
          if (productData.container == "product-info" && productData.label_position !== "content_inline") {
            container = el.querySelector(`.top-right-container`);
            if (productData.desktop_layout == '1_column' && productData.desktop_carousel_option == 'thumbnail' && productData.desktop_carousel_position == 'right') {
              container = el.querySelector(`.top-left-container`);
            }
          }

          if (!container) {
            container = this.createFixedPositionContainer(label, productData);
            el.appendChild(container);
          }
          container.innerHTML += this.processTemplate(el, label, productData);
        },
        createFixedPositionContainer(label, productData) {
          let position = label.settings.position;
          let checkOnMediaGallery = false;
          if (productData.container == "product-info" && productData.label_position !== "content_inline") {
            position = "top-right";
            if (productData.desktop_layout == '1_column' && productData.desktop_carousel_option == 'thumbnail' && productData.desktop_carousel_position == 'right') {
              position = "top-left";
            }
            checkOnMediaGallery = true;
          }

          let HTMLClass = ``;
          if (label.settings.type.includes("scrolling") && !checkOnMediaGallery) {
            HTMLClass += label.settings.type.includes("top") ? ` ${label.settings.type}-container top-left-container label-container pointer-events-none overflow-hidden absolute top-1.5 flex flex-col left-1.5 right-1.5 gap-1` : ` ${label.settings.type}-container bottom-left-container label-container pointer-events-none overflow-hidden absolute bottom-1.5 flex flex-col-reverse left-1.5 right-1.5 gap-1`;
          } else {
            HTMLClass = `${position}-container label-container absolute flex gap-1 pointer-events-none`;
            if (checkOnMediaGallery) {
              HTMLClass += position.includes("left") ? " product-labels__product-info-media text-left items-end md:items-start rtl:items-end rtl:md:items-end" : " product-labels__product-info-media text-right rtl:items-end rtl:md:items-start";
            } else {
              HTMLClass += position.includes("top") ? " top-1.5 flex-col" : " bottom-1.5 flex-col-reverse";
              HTMLClass += position.includes("left") ? " left-1.5 right-1.5 text-left" : " right-1.5 left-1.5 text-right";
            }
          }
          const container = document.createElement("div");
          container.setAttribute("class", HTMLClass);

          return container;
        },
        processContent(el, label, productData) {
          let content = false;
          const canShow = this.canShow(label, productData);

          if (label.settings.image && canShow) {
            /** image label */
            const UNIT_PER_PERCENT = 0.6;
            let imageHeight, imageWidth, imageDirection, styleImage;
            let imageSize = Math.round(label.settings.size * UNIT_PER_PERCENT);
            if (productData.container == "product-info") {
              imageHeight = 126;
              imageWidth = Math.round(imageHeight * label.settings.image_aspect_ratio);
            } else {
              imageWidth = label.settings.size * 15;
              imageHeight = imageWidth / label.settings.image_aspect_ratio;
            }
            let image = label.settings.image;
            if (label.settings.image.includes("burst.shopifycdn.com") || productData.container === "product-info") {
              imageSize = imageSize * 3;
            }
            if (productData.container == "card") {
              const position = label.settings.position;
              imageDirection = position.includes("left") ? 'justify-start': 'justify-end'
              styleImage = "width: var(--width-image-label); height: var(--height-image-label)";
            } else {
              if (productData.label_position == "content_inline") {
                imageDirection = productData.make_content_center ? "justify-center" : "justify-start";
              } else {
                imageDirection = 'justify-end rtl:justify-start'
              }
            }
            content = `
              <div x-ref="content" class="x-badge-content flex ${imageDirection}{css-opacity} rounded-corners overflow-hidden">
                <img 
                  loading="lazy"
                  width="${imageWidth}"
                  height="${imageHeight}"
                  alt="${label.settings.image_alt.length > 0 ? label.settings.image_alt : productData.title}"
                  src="${image}?width=${imageSize}"
                  style="${styleImage}"
                  class="rounded-corners"
                />
              </div>
            `;
          } else if (label.settings.content && canShow) {
            /** text label */
            let qty = productData.inventory_management.length < 1 || productData.qty < 0 ? "" : productData.qty;
            let saleAmount = productData.sale_amount.includes("-") ? "" : productData.sale_amount;
            let countDown = label.settings.schedule_enabled ? '<span class="x-badge-countdown-' + label.id + ' label-countdown empty:hidden"></span>' : "";
            let sale = Math.round(((productData.compare_at_price - productData.price) * 100) / productData.compare_at_price);
            sale = sale == 100 ? 99 : sale;
            sale = sale > 0 ? sale + "%" : "";
            // Login to view price: {price} resolves to nothing while the price is hidden, the same
            // way {qty}/{sale} blank out when they do not apply. A label made only of {price} then
            // has empty content and is dropped by the length checks below.
            let priceText = productData.hide_price ? "" : productData.price_with_currency;

            
            if (label?.settings?.list_label) {
              let contentLabel = Array.from(JSON.parse(label.settings.content));
              // label scrolling
              if (contentLabel.length > 0) {
                content = "";
                let num_loop = productData.container == "product-info" ? 20 : 10;
                if (contentLabel.length > 3) {
                  num_loop = 5;
                }
                const sizeClass = productData.container == "product-info" ? " pt-2 pb-2 pl-4 pr-4" : "";
                const inlineStyle = productData.container == "product-info" ? "" : `style="font-size: var(--h7-font-size);"`;
                const inlineStyleIcon = productData.container == "product-info" ? "" : `style="height: var(--h7-font-size); width: var(--h7-font-size); min-width: var(--h7-font-size); min-height: var(--h7-font-size);"`;
               
                if (productData.container == "product-info") {
                  // label on product page
                  let contentItem = "";
  
                  for (let j = 0; j < contentLabel.length; j++) {
                    contentItem = contentLabel[j]
                    .replace(/{sale}/gi, sale)
                    .replace(/{sale_amount}/gi, saleAmount)
                    .replace(/{qty}/gi, qty)
                    .replace(/{price}/gi, priceText)
                    .replace(/{count_down}/gi, countDown);

                    if (contentItem.length > 0) {
                      content += `<div class="x-badge-text-item h7${productData.container == "product-info" ? "" : ' px-2 py-1'} flex gap-2 items-center rounded-corners ${sizeClass} {css-opacity}{css-type}"><div class="flex whitespace-nowrap"><span class="inline-block relative icon-label empty:hidden">${label.settings.icon}</span></div><div class="min-w-max pe-2.5 whitespace-nowrap"><span class="leading-normal w-fit p-break-words">${contentItem}</span></div></div>`;
                    }
                  }
  
                  content = content.length > 0
                  ? `<div
                        x-ref="content"
                        class='x-badge-content ltr select-none gap-2'
                        ${inlineStyle}
                      >
                      <div class="w-full overflow-hidden">
                        <div class="flex flex-wrap ${productData.label_position !== "content_inline" && ' flex-row-reverse rtl:flex-row'} whitespace-nowrap min-w-full gap-1">
                          ${content}
                        </div>
                      </div>
                    </div>`
                  : false;
                } else {
                  // label on product card
                  for (let i = 0; i < num_loop; i++) {
                    let scrollingContent = "";
                    let contentItem = "";
                    for (let j = 0; j < contentLabel.length; j++) {
                      contentItem = contentLabel[j]
                      .replace(/{sale}/gi, sale)
                      .replace(/{sale_amount}/gi, saleAmount)
                      .replace(/{qty}/gi, qty)
                      .replace(/{price}/gi, priceText)
                      .replace(/{count_down}/gi, countDown);
                      if (contentItem.length > 0) {
                        scrollingContent += `<div class="pe-2.5 flex whitespace-nowrap"><span class="inline-block relative icon-label empty:hidden" ${inlineStyleIcon}>${label.settings.icon}</span></div><div class="min-w-max pe-2.5 whitespace-nowrap"><span class="leading-normal w-fit p-break-words">${contentItem}</span></div>`;
                      }
                    }
                    if (scrollingContent.length > 0) {
                      content += `<div class="flex whitespace-nowrap items-center animate-scroll-banner el_animate">${scrollingContent}</div>`
                    }
                  }
                  content =
                    content.length > 0
                    ? `<div
                          x-ref="content"
                          class='x-badge-content x-badge-text h7${productData.container == "product-info" ? "" : ' px-2 py-1'} ltr select-none rounded-corners ${sizeClass} {css-opacity}{css-type} gap-2'
                          ${inlineStyle}
                        >
                        <div class="w-full overflow-hidden">
                          <div class="flex flex-nowrap whitespace-nowrap min-w-full">
                            ${content}
                          </div>
                        </div>
                      </div>`
                    : false;
                }
              }
            } else {
              content = label.settings.content
                .replace(/{sale}/gi, sale)
                .replace(/{sale_amount}/gi, saleAmount)
                .replace(/{qty}/gi, qty)
                .replace(/{price}/gi, priceText)
                .replace(/{count_down}/gi, countDown)
                if (productData.metafield_label) {
                  productData.metafield_label.forEach(obj => {
                    Object.entries(obj).forEach(([key, value]) => {
                      content = content.replace(new RegExp(`\\{${key}\\}`, "gi"), value);
                    })
                  })
                }
                const sizeClass = productData.container == "product-info" ? " pt-2 pb-2 pl-4 pr-4" : "";
                const inlineStyle = productData.container == "product-info" ? "" : `style="font-size: var(--h7-font-size);"`;
                const inlineStyleIcon = productData.container == "product-info" ? "" : `style="height: var(--h7-font-size); width: var(--h7-font-size); min-width: var(--h7-font-size); min-height: var(--h7-font-size);"`;
                
                content =
                  content.length > 0
                    ? `<div
                      x-ref="content"
                      class='x-badge-content x-badge-text h7${productData.container == "product-info" ? "" : ' px-2 py-1'} text-left ltr select-none inline-flex justify-center${sizeClass} items-center{css-opacity}{css-type} gap-2'
                      ${inlineStyle}
                    ><span class="icon-label empty:hidden" ${inlineStyleIcon}>${label.settings.icon.trim()}</span><span class="leading-normal w-fit p-break-words">${content}</span></div>`
                    : false;
            }

            if (countDown.length > 0 && label.settings.schedule_enabled) {
              const now = new Date();
              let startDate, endDate;
              if (label.settings.repeat === 'weekdays') {
                startDate = new Date(
                  now.getFullYear(),
                  now.getMonth(),
                  now.getDate(),
                  label.settings.start_hour,
                  label.settings.start_minute
                );

                const isOvernight = label.settings.end_hour <= label.settings.start_hour;
                const isYesterDay = isOvernight && (now.getTime() < new Date(
                  now.getFullYear(),
                  now.getMonth(),
                  now.getDate(),
                  label.settings.start_hour,
                  label.settings.start_minute
                ).getTime());

                endDate = new Date(
                  now.getFullYear(),
                  now.getMonth(),
                  now.getDate() + (isOvernight ? 1 : 0),
                  label.settings.end_hour,
                  label.settings.end_minute
                );

                if (isYesterDay) {
                  startDate.setDate(startDate.getDate() - 1);
                  endDate.setDate(endDate.getDate() - 1);
                }
                 if (isOvernight) {
                  const totalOffsetHours = label.settings.timezone + (new Date().getTimezoneOffset() / MINUTES_PER_HOUR);
                  const storeTime = new Date(Date.now() + totalOffsetHours * MS_PER_HOUR);
                  
                  const nextDayInStore = new Date(storeTime);
                  nextDayInStore.setDate(storeTime.getDate() + 1);
                  const nextDayWeekday = WEEKDAYS_COUNT_DOWN[nextDayInStore.getDay()];

                  const customDays = this.parseCustomDays(label.settings.custom_days || "");

                  if (customDays.length > 0 && !customDays.includes(nextDayWeekday)) {
                    if (!isYesterDay) {
                      endDate = new Date(
                        storeTime.getFullYear(),
                        storeTime.getMonth(),
                        storeTime.getDate(),
                        END_OF_DAY.HOURS,
                        END_OF_DAY.MINUTES,
                        END_OF_DAY.SECONDS
                      );
                    }
                    endDate = new Date(endDate.getTime() - totalOffsetHours * MS_PER_HOUR);
                  }
                }
              } else {
                startDate = new Date(label.settings.start_year, label.settings.start_month - 1, label.settings.start_day, label.settings.start_hour, label.settings.start_minute);
                endDate = new Date(label.settings.end_year, label.settings.end_month - 1, label.settings.end_day, label.settings.end_hour, label.settings.end_minute);
              }
              const startTime = this.adjustTimezone(startDate, label.settings.timezone);
              const endTime = this.adjustTimezone(endDate, label.settings.timezone);

              Alpine.store("xHelper").countdownByTime(startTime, endTime, function (canShow, seconds, minutes, hours, days) {
                let container = el.container ? el.container : el;
                const countdownElements = container.getElementsByClassName("x-badge-countdown-" + label.id);
                
                if (!canShow) {
                  for (let i = 0; i < countdownElements.length; i++) {
                    countdownElements[i].innerHTML = "";
                  }
                  return;
                }

                days = days > 0 ? days + "D&nbsp;&nbsp;&nbsp;" : "";
                hours = hours == 0 && days.length == 0 ? "" : hours + " : ";
                const timeLeft = days + hours + minutes + " : " + seconds;

                for (let i = 0; i < countdownElements.length; i++) {
                  countdownElements[i].innerHTML = timeLeft;
                }
              });
            }
          }

          return content;
        },
        processTemplate(el, label, productData) {
          let template = "";
          if ((content = this.processContent(el, label, productData))) {
            const cssOpacity = " opacity-" + label.settings.opacity;
            let cssType = "";
            if (label.settings.type == "default") cssType = " rounded-corners";
            if (label.settings.type == "rounded_corner") cssType = " rounded-slip";

            let containerCssClass = productData.container == "card" ? " absolute w-max" : "";
            let classRTL = (productData.container == "product-info" && productData.label_position != "content_inline") ? " ltr" : "";
            const previewShowCondition = productData.isXBadgesPreview ? `x-show="$store.xLabelsAndBadges.previewActiveBlock == '{label-id}'"` : "";
            const imgClass = label.settings.image ? " label-img" : "";
            const hiddenClass = label.settings.show_on_product_card ? '' : ' hidden';

            template = this.getLabelTemplate(productData.container, label.settings.position);
            template = template
              .replaceAll("{preview-show-condition}", previewShowCondition)
              .replaceAll("{content}", content)
              .replaceAll("{css-opacity}", cssOpacity)
              .replaceAll("{css-type}", cssType)
              .replaceAll("{css-rtl}", classRTL)
              .replaceAll("{container-css-class}", containerCssClass)
              .replaceAll("{container-img-class}", imgClass)
              .replaceAll("{css-display-class}", hiddenClass)
              .replaceAll(/{label-id}/gi, label.id);
          }

          return template;
        },
        getLabelTemplate(container) {
          if (container == "product-info") {
            return this.productDetailTemplate;
          }

          return this.fixedPositionTemplate;
        },
        canShow(label, productData) {
          if (productData.isXBadgesPreview) {
            return true;
          }

          if (productData.container == "card" && !label.settings.show_on_product_card) {
            return false;
          }

          if (productData.container == "product-info" && !label.settings.show_on_product_page) {
            return false;
          }

          if (label.type == "sale-label" && productData.compare_at_price > productData.price) {
            return true;
          }

          if (label.type == "sold-out-label" && !productData.available) {
            return true;
          }
          if (label.type == "preorder-label") {
            if (productData.is_show_preorder) {
              return true;
            } else {
              return false;
            }
          }
          if (label.type == "new-label" ) {
            if (label.settings.day_start == 'creation_date' && label.settings.day_end < productData.diff_day_create) {
              return false;
            } else if (label.settings.day_start == 'activation_date' && label.settings.day_end < productData.diff_day_publish) {
              return false;
            }
          }
          
          if (label.settings.schedule_enabled) {
            if (!this.canShowCountDown(label)) {
              return false;
            }
          }

          if (label.settings.applied_products.includes(productData.id)) {
            return true;
          }

          for (let i = 0; i < label.settings.applied_collections.length; i++) {
            if (productData.collections.includes(label.settings.applied_collections[i])) {
              return true;
            }
          }
          
          if (label.type != "sale-label" && label.type != "sold-out-label" && label.settings.applied_products.length == 0 && label.settings.applied_collections.length == 0) {
            return true;
          }

          return false;
        },
        canShowCountDown(label) {
          const now = Date.now();
          const nowDate = new Date();

          const startDate = new Date(label.settings.start_year, label.settings.start_month - 1, label.settings.start_day, label.settings.start_hour, label.settings.start_minute);
          const endDate = new Date(label.settings.end_year, label.settings.end_month - 1, label.settings.end_day, label.settings.end_hour, label.settings.end_minute);
          label.startTime = this.adjustTimezone(startDate, label.settings.timezone);
          label.endTime = this.adjustTimezone(endDate, label.settings.timezone);

          if (label.settings.repeat !== 'weekdays') {
            if (now < label.startTime || now > label.endTime) { 
              return false;
            }
          }

          const isOvernight = label.settings.end_hour <= label.settings.start_hour;

          const isYesterDay = isOvernight && (nowDate.getTime() < new Date(
                  nowDate.getFullYear(),
                  nowDate.getMonth(),
                  nowDate.getDate(),
                  label.settings.start_hour,
                  label.settings.start_minute
                ).getTime());

          const startTimeRecurring = new Date(
            nowDate.getFullYear(),
            nowDate.getMonth(),
            nowDate.getDate(),
            label.settings.start_hour,
            label.settings.start_minute
          );

          const endTimeRecurring = new Date(
            nowDate.getFullYear(),
            nowDate.getMonth(),
            nowDate.getDate() + (isOvernight ? 1 : 0),
            label.settings.end_hour,
            label.settings.end_minute
          );

          if (isYesterDay) {
            startTimeRecurring.setDate(startTimeRecurring.getDate() - 1);
            endTimeRecurring.setDate(endTimeRecurring.getDate() - 1);
          }

          label.startTimeRecurring = this.adjustTimezone(startTimeRecurring, label.settings.timezone);
          label.endTimeRecurring = this.adjustTimezone(endTimeRecurring, label.settings.timezone);

          const dateTime = new Date(Date.now() + (label.settings.timezone + new Date().getTimezoneOffset() / SECONDS_PER_MINUTE) * MS_PER_HOUR);
          const weekday = WEEKDAYS_COUNT_DOWN[dateTime.getDay()];
          const customDays = this.parseCustomDays(label.settings.custom_days || "");

          if (label.settings.repeat == 'weekdays') {
            if (label.startTimeRecurring > now || label.endTimeRecurring < now) {
              return false;
            }
            if (customDays.length > 0 && !customDays.includes(weekday)) {
              return false;
            }
          }
          if (label.endTime < now || label.startTime > now) {
            return false;
          }
          return true;
        },
        adjustTimezone(date, timezone) {
          const offsetMinutes = -timezone * MINUTES_PER_HOUR - date.getTimezoneOffset();
          return date.getTime() + offsetMinutes * MS_PER_MINUTE;
        },
        parseCustomDays(daysString) {
          if (!daysString || typeof daysString !== 'string') {
            return [];
          }
          return daysString
            .toLowerCase()
            .split(',')
            .map(day => day.trim())
            .filter(day => day !== '');
        }
      });
    };
    if (window.Alpine) {
      defineXLabelsAndBadges();
    } else {
      document.addEventListener("alpine:init", defineXLabelsAndBadges);
    }
  });
}