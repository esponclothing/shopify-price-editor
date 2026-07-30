const axios = require('axios');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const storeUrl = envContent.match(/VITE_SHOPIFY_STORE_URL=(.*)/)?.[1]?.trim();
const accessToken = envContent.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)?.[1]?.trim();

const newLiquidValue = `{%- style -%}
.collection-subcategories {
  margin-bottom: 2rem;
  margin-top: 1rem;
}
.subcategories-list {
  display: flex;
  flex-wrap: nowrap;
  gap: 1rem;
  list-style: none;
  padding: 0 1.5rem;
  margin: 0;
  overflow-x: auto;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none;  /* IE and Edge */
}
.subcategories-list::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}
.subcategory-item {
  flex-shrink: 0;
}
.subcategory-link {
  display: inline-block;
  padding: 8px 16px;
  border: 1px solid rgba(var(--color-foreground), 0.1);
  border-radius: 20px;
  text-decoration: none;
  color: rgb(var(--color-foreground));
  background-color: rgb(var(--color-background));
  font-size: 1.4rem;
  transition: all 0.3s ease;
  font-weight: 500;
}
.subcategory-link:hover,
.subcategory-link.active {
  background-color: rgb(var(--color-foreground));
  color: rgb(var(--color-background));
  border-color: rgb(var(--color-foreground));
}
{%- endstyle -%}

{%- assign current_handle = collection.handle -%}
{%- assign parent_handle = current_handle -%}
{%- assign sub_suffixes = section.settings.subcategories | downcase | replace: " ", "" | split: "," -%}

{%- comment -%}
  Find the parent handle if currently viewing a subcategory page
{%- endcomment -%}
{%- for suffix in sub_suffixes -%}
  {%- assign suffix_with_dash = "-" | append: suffix -%}
  {%- if current_handle contains suffix_with_dash -%}
    {%- assign parent_handle = current_handle | replace: suffix_with_dash, "" -%}
    {%- break -%}
  {%- endif -%}
{%- endfor -%}

{%- assign parent_col = collections[parent_handle] -%}

{%- capture subcategories_html -%}
  {%- for suffix in sub_suffixes -%}
    {%- assign sub_handle = parent_handle | append: "-" | append: suffix -%}
    {%- assign sub_col = collections[sub_handle] -%}
    {%- if sub_col and sub_col.title != blank -%}
      {%- assign display_title = sub_col.title | split: "-" | last | strip -%}
      <li class="subcategory-item">
        <a href="{{ sub_col.url }}" class="subcategory-link {% if current_handle == sub_handle %}active{% endif %}">
          {{ display_title }}
        </a>
      </li>
    {%- endif -%}
  {%- endfor -%}
{%- endcapture -%}

{%- if parent_col -%}
  <div class="collection-subcategories page-width">
    <ul class="subcategories-list">
      <li class="subcategory-item">
        <a href="{{ parent_col.url }}" class="subcategory-link {% if current_handle == parent_handle %}active{% endif %}">
          All
        </a>
      </li>
      {{ subcategories_html }}
    </ul>
  </div>
{%- endif -%}

{% schema %}
{
  "name": "Collection Subcategories",
  "settings": [
    {
      "type": "text",
      "id": "subcategories",
      "label": "Subcategory Suffixes",
      "default": "oversized, cjp, regular-fit, denim, gym, cotton",
      "info": "Comma-separated list of handle suffixes to look for (e.g. if main is 't-shirts', looking for 't-shirts-oversized')."
    }
  ],
  "presets": [
    {
      "name": "Collection Subcategories"
    }
  ]
}
{% endschema %}
`;

async function main() {
  try {
    const themeQuery = `
      query {
        themes(first: 10) {
          edges {
            node {
              id
              role
            }
          }
        }
      }
    `;
    const res = await axios.post(`https://${storeUrl}/admin/api/2024-04/graphql.json`, { query: themeQuery }, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    const mainTheme = res.data.data.themes.edges.find(e => e.node.role === 'MAIN')?.node;
    const themeId = mainTheme.id.split('/').pop();

    const assetKey = 'sections/collection-subcategories.liquid';
    const putRes = await axios.put(`https://${storeUrl}/admin/api/2024-04/themes/${themeId}/assets.json`, {
      asset: {
        key: assetKey,
        value: newLiquidValue
      }
    }, {
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' }
    });

    console.log("Successfully updated the collection-subcategories section asset on Shopify theme!");
    console.log(putRes.data.asset);

  } catch (err) {
    console.error("Error updating asset:", err.message);
    if (err.response) {
      console.error(JSON.stringify(err.response.data));
    }
  }
}

main();
