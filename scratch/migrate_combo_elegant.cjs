const fs = require('fs');
const path = require('path');

const themeDir = path.join(__dirname, '../../11fit theme');
const productFile = path.join(themeDir, 'sections/main-product.liquid');
const comboFile = path.join(themeDir, 'sections/main-combo-3.liquid');

let productContent = fs.readFileSync(productFile, 'utf8');

// 1. Remove Sticky Bar
const stickyBarStart = "{% comment %} ── STICKY BAR ── {% endcomment %}";
const stickyBarEnd = "</div>\n</div>";
const idxSticky = productContent.indexOf(stickyBarStart);
if (idxSticky !== -1) {
    const endSticky = productContent.indexOf(stickyBarEnd, idxSticky) + stickyBarEnd.length;
    productContent = productContent.substring(0, idxSticky) + productContent.substring(endSticky);
}

// 2. Wrap Default Variant Selectors and Add to Cart Button
const defaultVariantsStart = "{% comment %} ── VARIANT SELECTOR (OTHER THAN COLOR) ── {% endcomment %}";
const formEnd = "</form>";

const idxDefVars = productContent.indexOf(defaultVariantsStart);
const idxFormEnd = productContent.indexOf(formEnd, idxDefVars);
let formInner = productContent.substring(idxDefVars, idxFormEnd);

const comboBannerHTML = `
{% assign combo_active = false %}
{% assign combo_count = 0 %}
{% assign combo_price = 0 %}
{% if product.metafields.price_editor.combo_config != blank %}
  {% assign c_val = product.metafields.price_editor.combo_config.value %}
  {% if c_val == blank %}
    {% assign c_val = product.metafields.price_editor.combo_config %}
  {% endif %}
  
  {% assign c_count = c_val.count | plus: 0 %}
  {% assign c_price = c_val.price | plus: 0 %}
  
  {% if c_count > 0 %}
    {% assign combo_active = true %}
    {% assign combo_count = c_count %}
    {% assign combo_price = c_price %}
  {% endif %}
{% endif %}

{% if combo_active %}
  {% assign regular_price_single = product.price | divided_by: 100.0 %}
  {% assign regular_total = regular_price_single | times: combo_count %}
  {% assign discount_amount = regular_total | minus: combo_price %}
  {% assign discount_percent = discount_amount | divided_by: regular_total | times: 100 | round %}

  <div class="fit11-combo-offer-banner" style="background: var(--lux-surface); border: 1px solid var(--lux-border); border-radius: 8px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.04); flex-wrap: wrap; gap: 12px; position: relative; overflow: hidden; margin-top: 16px;">
    <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--lux-accent);"></div>
    <div style="display: flex; flex-direction: column; gap: 6px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <i class="ti ti-gift" style="color: var(--lux-accent); font-size: 18px;"></i>
        <span style="font-size: 12px; font-weight: 600; color: var(--lux-text-muted); text-transform: uppercase; letter-spacing: 0.1em; font-family: var(--font-body);">Curated Combo</span>
      </div>
      <p style="margin: 0; font-size: 18px; font-weight: 500; color: var(--lux-text); font-family: var(--font-heading);">
        Buy {{ combo_count }} for <span style="color: var(--lux-accent); font-weight: 600;">Rs. {{ combo_price }}</span>
      </p>
    </div>
    <div style="font-size: 13px; font-weight: 600; color: #2f9e44; display: flex; align-items: center; gap: 6px; background: rgba(47, 158, 68, 0.08); padding: 8px 14px; border-radius: 6px; border: 1px solid rgba(47, 158, 68, 0.2);">
      <i class="ti ti-tags" style="font-size: 16px;"></i> Save Rs. {{ discount_amount | round }} ({{ discount_percent }}% OFF)
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 16px;">
    <div class="fit11-combo-title" style="margin-bottom: 0;">Select Sizes & Colors</div>
    <div class="fit11-size-chart-link" onclick="fit11ToggleModal(true)" style="display: flex; align-items: center; gap: 4px; font-size: 12px; text-decoration: underline; color: var(--lux-accent); font-weight: 500; cursor: pointer; text-transform: uppercase; letter-spacing: 0.05em;">
      <i class="ti ti-ruler-2"></i><span>Size Guide</span>
    </div>
  </div>

  <div class="fit11-combo-selectors" style="display: flex; flex-direction: column; gap: 24px; margin-bottom: 24px;">
    {% for i in (1..combo_count) %}
      <div class="combo-item-selector" style="background: var(--lux-surface); border: 1px solid var(--lux-border); border-radius: 8px; padding: 16px; position: relative;">
        <div style="position: absolute; top: -10px; left: 16px; background: var(--lux-surface); padding: 0 8px; font-size: 11px; font-weight: 600; color: var(--lux-text-muted); text-transform: uppercase; letter-spacing: 0.1em; border: 1px solid var(--lux-border); border-radius: 12px;">Item {{ i }}</div>
        
        <div style="display: flex; flex-direction: column; gap: 16px; margin-top: 8px;">
          <!-- Combo Color Selector -->
          {% for option in product.options_with_values %}
            {% assign option_name_lower = option.name | downcase %}
            {% if option_name_lower contains 'color' or option_name_lower contains 'colour' %}
              <div class="fit11-option-fieldset" role="group" style="min-width: 0; width: 100%;">
                <div class="fit11-option-name-row" style="margin-bottom: 8px;">
                  <span class="fit11-option-name-label" style="font-size: 12px; font-weight: 500; color: var(--lux-text); font-family: var(--font-body);">Color</span>
                </div>
                <div class="fit11-variant-pills">
                  {% for value in option.values %}
                    <input type="radio" id="combo-color-{{ i }}-{{ forloop.index0 }}" name="combo_color_{{ i }}" value="{{ value | escape }}" class="fit11-variant-radio combo-radio" data-item="{{ i }}" data-option="color" data-value="{{ value | escape }}" onchange="updateComboSelection({{ i }}, 'color', this.value)" {% if forloop.first %}checked{% endif %}>
                    <label for="combo-color-{{ i }}-{{ forloop.index0 }}" class="fit11-variant-pill is-color" title="{{ value }}">
                      {% assign variant_image = null %}
                      {% for variant in product.variants %}
                        {% if variant.options contains value and variant.featured_image %}
                          {% assign variant_image = variant.featured_image %}
                          {% break %}
                        {% endif %}
                      {% endfor %}
                      <div class="fit11-color-swatch-wrap" style="width: 48px; height: 64px;">
                        {% if variant_image != null %}
                          <span class="fit11-color-swatch" style="background-image: url('{{ variant_image | img_url: '100x130' }}'); background-size: cover; background-position: center;"></span>
                        {% else %}
                          <span class="fit11-color-swatch" style="background-color: {{ value | split: ' ' | last | downcase }};"></span>
                        {% endif %}
                      </div>
                    </label>
                  {% endfor %}
                </div>
              </div>
            {% endif %}
          {% endfor %}

          <!-- Combo Size Selector -->
          {% for option in product.options_with_values %}
            {% assign option_name_lower = option.name | downcase %}
            {% if option_name_lower contains 'size' %}
              <div class="fit11-option-fieldset" role="group" style="min-width: 0; width: 100%;">
                <div class="fit11-option-name-row" style="margin-bottom: 8px;">
                  <span class="fit11-option-name-label" style="font-size: 12px; font-weight: 500; color: var(--lux-text); font-family: var(--font-body);">Size</span>
                </div>
                <div class="fit11-variant-pills">
                  {% for value in option.values %}
                    <input type="radio" id="combo-size-{{ i }}-{{ forloop.index0 }}" name="combo_size_{{ i }}" value="{{ value | escape }}" class="fit11-variant-radio combo-radio" data-item="{{ i }}" data-option="size" data-value="{{ value | escape }}" onchange="updateComboSelection({{ i }}, 'size', this.value)" {% if forloop.first %}checked{% endif %}>
                    <label for="combo-size-{{ i }}-{{ forloop.index0 }}" class="fit11-variant-pill" style="padding: 6px 12px; font-size: 12px;">{{ value }}</label>
                  {% endfor %}
                </div>
              </div>
            {% endif %}
          {% endfor %}
        </div>
      </div>
    {% endfor %}
  </div>

  <div style="display: flex; gap: 12px; margin-top: 24px;">
    <button type="button" class="fit11-btn-cart" id="fit11ComboAddToCartBtn" style="flex: 1; margin: 0 !important;" onclick="addComboToCart(false)">
      <span class="fit11-btn-text">Add to Cart</span> <i class="ti ti-shopping-cart" aria-hidden="true"></i>
    </button>
    <button type="button" class="fit11-btn-cart" id="fit11ComboBuyNowBtn" style="flex: 1; margin: 0 !important; background: var(--lux-accent); color: #fff;" onclick="addComboToCart(true)">
      <span class="fit11-btn-text">Buy it Now</span> <i class="ti ti-bolt" aria-hidden="true"></i>
    </button>
  </div>
  
{% else %}
  ${formInner}
  <div style="display: flex; gap: 12px; margin-top: 24px;">
    <button type="submit" name="add" class="fit11-btn-cart" id="fit11MainAddToCartBtnProd" style="flex: 1; margin: 0 !important;">
      <span class="fit11-btn-text">Add to Cart</span> <i class="ti ti-shopping-cart" aria-hidden="true"></i>
    </button>
    <button type="button" class="fit11-btn-cart" style="flex: 1; margin: 0 !important; background: var(--lux-accent); color: #fff;" onclick="document.getElementById('fit11MainAddToCartBtnProd').click(); setTimeout(() => window.location.href='/checkout', 500);">
      <span class="fit11-btn-text">Buy it Now</span> <i class="ti ti-bolt" aria-hidden="true"></i>
    </button>
  </div>
{% endif %}
`;

productContent = productContent.substring(0, idxDefVars) + comboBannerHTML + "\n" + productContent.substring(idxFormEnd + formEnd.length);

const jsScript = `
<script>
  let comboSelections = {};
  
  function initComboSelections() {
    const radios = document.querySelectorAll('.combo-radio');
    if(radios.length === 0) return;
    
    // Auto-select first options if not set
    radios.forEach(r => {
      if(r.checked) {
        updateComboSelection(r.dataset.item, r.dataset.option, r.value);
      }
    });
  }

  window.updateComboSelection = function(itemIndex, optionType, value) {
    if (!comboSelections[itemIndex]) {
      comboSelections[itemIndex] = {};
    }
    comboSelections[itemIndex][optionType] = value;
    validateCombo();
  };

  function validateCombo() {
    let allValid = true;
    let variantsDataEl = document.getElementById('ProductVariantsData');
    if(!variantsDataEl) return;
    let variants = JSON.parse(variantsDataEl.textContent);
    
    const count = Object.keys(comboSelections).length;
    for (let i = 1; i <= count; i++) {
      const sel = comboSelections[i];
      if(!sel) continue;
      
      let matchedVariant = variants.find(v => {
        let match = true;
        if(sel.color && !v.options.includes(sel.color)) match = false;
        if(sel.size && !v.options.includes(sel.size)) match = false;
        return match;
      });

      if (matchedVariant) {
        comboSelections[i].variantId = matchedVariant.id;
      } else {
        allValid = false;
      }
    }

    const addBtn = document.getElementById('fit11ComboAddToCartBtn');
    const buyBtn = document.getElementById('fit11ComboBuyNowBtn');
    if(addBtn) {
      if (allValid) {
        addBtn.disabled = false;
        addBtn.querySelector('.fit11-btn-text').innerText = 'Add to Cart';
        buyBtn.disabled = false;
        buyBtn.querySelector('.fit11-btn-text').innerText = 'Buy it Now';
      } else {
        addBtn.disabled = true;
        addBtn.querySelector('.fit11-btn-text').innerText = 'Unavailable';
        buyBtn.disabled = true;
        buyBtn.querySelector('.fit11-btn-text').innerText = 'Unavailable';
      }
    }
    return allValid;
  }

  window.addComboToCart = function(isBuyNow) {
    if (!validateCombo()) return;

    const addBtn = document.getElementById('fit11ComboAddToCartBtn');
    const buyBtn = document.getElementById('fit11ComboBuyNowBtn');
    if(addBtn) {
      const origText = isBuyNow ? buyBtn.innerHTML : addBtn.innerHTML;
      if(isBuyNow) buyBtn.innerHTML = '<span class="fit11-btn-text">Processing...</span>';
      else addBtn.innerHTML = '<span class="fit11-btn-text">Adding...</span>';
      addBtn.disabled = true;
      buyBtn.disabled = true;
      
      const comboGroupId = Date.now().toString();
      const count = Object.keys(comboSelections).length;
      const itemsToAdd = [];

      for (let i = 1; i <= count; i++) {
        itemsToAdd.push({
          id: comboSelections[i].variantId,
          quantity: 1,
          properties: {
            '_combo_id': comboGroupId,
            '_combo_required_count': count.toString(),
            '_combo_product_id': '{{ product.id }}'
          }
        });
      }

      fetch(window.Shopify.routes.root + 'cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToAdd })
      })
      .then(response => response.json())
      .then(data => {
        if (isBuyNow) {
          window.location.href = '/checkout';
        } else {
          if (isBuyNow) buyBtn.innerHTML = origText;
          else addBtn.innerHTML = origText;
          addBtn.disabled = false;
          buyBtn.disabled = false;
          if (typeof playBagAnimation === 'function' && !isBuyNow) {
            playBagAnimation(addBtn);
          }
          // Optionally refresh cart or open drawer
          fetch('/cart.js').then(res=>res.json()).then(cart => {
            if(window.fit11UpdateCartCount) window.fit11UpdateCartCount(cart.item_count);
          });
        }
      })
      .catch((error) => {
        console.error('Error:', error);
        addBtn.innerHTML = '<span class="fit11-btn-text">Error</span>';
        setTimeout(() => {
          if (isBuyNow) buyBtn.innerHTML = origText;
          else addBtn.innerHTML = origText;
          addBtn.disabled = false;
          buyBtn.disabled = false;
        }, 2000);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', initComboSelections);
</script>
`;

productContent = productContent + "\n" + jsScript;

fs.writeFileSync(productFile, productContent);
console.log("Successfully integrated elegant combo logic directly to main-product.liquid");
