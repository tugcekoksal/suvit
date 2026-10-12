if (!window.Maximize.loadedScript.includes('variant-load-more.js')) {
  window.Maximize.loadedScript.push('variant-load-more.js');

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-variant-load-more]');
    if (!button) return;

    event.preventDefault();
    if (button.dataset.loading === 'true') return;
    button.dataset.loading = 'true';

    var handle = button.dataset.productHandle;
    var productUrl = button.dataset.productUrl;
    var shown = parseInt(button.dataset.shown, 10) || 0;
    var total = parseInt(button.dataset.total, 10) || 0;
    var wrapper = button.closest('.variant-load-more__wrapper');
    var grid = wrapper ? wrapper.parentElement : null;

    fetch('/products/' + handle + '.js')
      .then(function (response) {
        return response.json();
      })
      .then(function (product) {
        var remainingVariants = product.variants.slice(shown, total);
        var fragment = document.createDocumentFragment();

        remainingVariants.forEach(function (variant) {
          fragment.appendChild(buildVariantCard(product, variant, productUrl));
        });

        if (grid && wrapper) {
          grid.insertBefore(fragment, wrapper);
          grid.removeChild(wrapper);
        }
      })
      .catch(function (error) {
        console.error('variant-load-more:', error);
        button.dataset.loading = 'false';
      });
  });

  function buildVariantCard(product, variant, productUrl) {
    var item = document.createElement('div');
    item.className = 'grid-item';

    var image = variant.featured_image ? variant.featured_image.src : (product.featured_image || '');
    var variantUrl = productUrl + '?variant=' + variant.id;
    var priceFormatted = typeof formatMoney === 'function'
      ? formatMoney(variant.price, window.Maximize.currencyFormat)
      : (variant.price / 100).toFixed(2);

    item.innerHTML =
      '<a href="' + variantUrl + '" class="product-card__wrapper block rounded-corners overflow-hidden border border-solid rgba(var(--color-line-and-border))">' +
        '<div class="product-card__image-wrapper aspect-square relative overflow-hidden">' +
          (image ? '<img src="' + image + '&width=500" alt="' + escapeHtml(variant.name) + '" loading="lazy" class="product-card__image w-full h-full object-cover">' : '') +
        '</div>' +
        '<div class="p-2.5">' +
          '<p class="product-card__title h6 p-break-words mb-1">' + escapeHtml(variant.public_title || variant.title) + '</p>' +
          '<p class="price-item h5">' + priceFormatted + '</p>' +
        '</div>' +
      '</a>';

    return item;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}
