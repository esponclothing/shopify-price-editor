const fs = require('fs');
const path = require('path');

const themeDir = path.join(__dirname, '../../11fit theme');
const productFile = path.join(themeDir, 'sections/main-product.liquid');
const comboFile = path.join(themeDir, 'sections/main-combo-3.liquid');

const productContent = fs.readFileSync(productFile, 'utf8');
const comboContent = fs.readFileSync(comboFile, 'utf8');

// 1. Extract Combo Logic from main-combo-3.liquid
const comboLogicStart = "{% assign combo_count = 3 %}";
const comboLogicEndMarker = "<!-- END COMBO SECTION -->"; // We don't have this marker.
// Let's find the start of combo assignment
const idx1 = comboContent.indexOf(comboLogicStart);
// The end of combo HTML is right before `</div>` then `<button type="submit"`
const idx2 = comboContent.indexOf('</form>', idx1);
const comboLogicStr = comboContent.substring(idx1, idx2);

// We need to also extract the JS logic
const scriptStartStr = "<script>\n          (function() {\n            let comboSelections = {";
const idxScript = comboContent.indexOf(scriptStartStr);
const scriptEndStr = "})();\n        </script>";
const idxScriptEnd = comboContent.indexOf(scriptEndStr, idxScript) + scriptEndStr.length;
const comboJSLogic = comboContent.substring(idxScript, idxScriptEnd);

// 2. Modify main-product.liquid
let newProductContent = productContent;

// Remove Sticky Bar
const stickyBarStart = "{% comment %} ── STICKY BAR ── {% endcomment %}";
const stickyBarEnd = "</div>\n</div>";
const idxSticky = newProductContent.indexOf(stickyBarStart);
if (idxSticky !== -1) {
    const endSticky = newProductContent.indexOf(stickyBarEnd, idxSticky) + stickyBarEnd.length;
    newProductContent = newProductContent.substring(0, idxSticky) + newProductContent.substring(endSticky);
}

// Identify where to inject Combo logic
// Inside the {% form 'product' ... %}
// We have variant selectors starting at: {% comment %} ── VARIANT SELECTOR (OTHER THAN COLOR) ── {% endcomment %}
// Actually, it's safer to wrap the entire default variant selectors and add-to-cart button.
// In main-product.liquid:
/*
          {% comment %} ── VARIANT SELECTOR (OTHER THAN COLOR) ── {% endcomment %}
          {% unless product.has_only_default_variant %}
...
          {% endunless %}

        </div>

        <button type="submit" ...> ... </button>
*/

const defaultVariantsStart = "{% comment %} ── VARIANT SELECTOR (OTHER THAN COLOR) ── {% endcomment %}";
const formEnd = "</form>";
const idxDefVars = newProductContent.indexOf(defaultVariantsStart);
const idxFormEnd = newProductContent.indexOf(formEnd, idxDefVars);

let formInner = newProductContent.substring(idxDefVars, idxFormEnd);

// Wrap default formInner with {% unless combo_active %}
let modifiedFormInner = `
{% assign combo_active = false %}
{% assign combo_count = 0 %}
{% assign combo_price = 0 %}
{% if product.metafields.price_editor.combo_config.value != blank %}
  {% if product.metafields.price_editor.combo_config.value.count > 0 %}
    {% assign combo_active = true %}
    {% assign combo_count = product.metafields.price_editor.combo_config.value.count %}
    {% assign combo_price = product.metafields.price_editor.combo_config.value.price %}
  {% endif %}
{% endif %}

{% if combo_active %}
  {% assign regular_price_single = product.price | divided_by: 100.0 %}
  {% assign regular_total = regular_price_single | times: combo_count %}
  {% assign discount_amount = regular_total | minus: combo_price %}
  {% assign discount_percent = discount_amount | divided_by: regular_total | times: 100 | round %}

  ${comboLogicStr.substring(comboLogicStr.indexOf('<!-- Dynamic Qikify-Style Combo Banner -->'))}
{% else %}
  ${formInner}
{% endif %}
`;

newProductContent = newProductContent.substring(0, idxDefVars) + modifiedFormInner + "\n" + newProductContent.substring(idxFormEnd);

// Inject JS
const endForm = "</form>";
const idxEndForm = newProductContent.indexOf(endForm);
newProductContent = newProductContent.substring(0, idxEndForm + endForm.length) + "\n\n{% if combo_active %}\n" + comboJSLogic + "\n{% endif %}\n" + newProductContent.substring(idxEndForm + endForm.length);

fs.writeFileSync(productFile, newProductContent);
console.log("Successfully migrated combo logic to main-product.liquid and removed sticky bar.");
