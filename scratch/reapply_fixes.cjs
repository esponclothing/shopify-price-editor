const fs = require('fs');
const path = 'src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix aiProvider to groq
content = content.replace(/aiProvider: parsed.aiProvider \|\| 'gemini'/g, "aiProvider: parsed.aiProvider || 'groq'");
content = content.replace(/const aiProvider = savedSettings.aiProvider \|\| 'gemini'/g, "const aiProvider = savedSettings.aiProvider || 'groq'");

// 2. Reduce products limit
content = content.replace(/products\(first: 50\)/g, 'products(first: 20)');

// 3. Add T-Shirt to dropdown
if (!content.includes('<option value="T-Shirt">T-Shirt</option>')) {
  content = content.replace('<option value="Activewear">Activewear</option>', '<option value="Activewear">Activewear</option>\n                  <option value="T-Shirt">T-Shirt</option>');
}

// 4. Update the AI prompt
const oldPromptStr = `const systemPrompt = \`You are an expert Shopify SEO and conversion copywriter.
        Return ONLY valid JSON.
        Required JSON keys: title, descriptionHtml, seoTitle, seoDescription, tags.
        - descriptionHtml should be beautifully formatted HTML using \`<p>\`, \`<ul>\`, \`<li>\`, \`<strong>\`.
        - Keep the title punchy and conversion-focused.
        - Ensure SEO title is under 60 chars.
        - Ensure SEO description is under 160 chars.
        - Tags should be a comma-separated string of 5-8 relevant tags.
        \`\`;`;

const newPromptStr = `const systemPrompt = \`You are an expert Shopify SEO and conversion copywriter.
        The user will provide you with raw details (print details, fabric, product type, specifics).
        YOUR JOB IS TO AUTOMATICALLY INFER AND WRITE ALL OF THE FOLLOWING:
        - Product Title
        - Product Description (beautifully formatted HTML using <p>, <ul>, <li>, <strong>)
        - SEO Title (under 60 chars)
        - SEO Description (under 160 chars)
        - Tags (comma-separated string of 5-8 relevant tags)
        - Product Type (guess based on user input, e.g. T-Shirt, Shorts, etc.)
        
        DO NOT ASK THE USER TO WRITE ANYTHING. JUST GENERATE THE COMPLETE METADATA BASED ON THEIR RAW NOTES.
        
        Return ONLY valid JSON.
        Required JSON keys: title, descriptionHtml, seoTitle, seoDescription, tags, productType.\`;`;

content = content.replace(oldPromptStr, newPromptStr);

// Also need to handle the new productType field in the JSON parser below:
if (!content.includes('if (parsed.productType) updateData.productType = parsed.productType;')) {
    content = content.replace(`if (parsed.tags) updateData.tags = parsed.tags;`, `if (parsed.tags) updateData.tags = parsed.tags;\n        if (parsed.productType) updateData.productType = parsed.productType;`);
}

// 5. Change parentCollections to collections in the 3 spots
// Dropdown 1: Featured Products
content = content.replace(
  /{parentCollections\.map\(col => \(\s*<option key={col\.id} value={col\.id}>{col\.title} \({col\.handle}\)<\/option>\s*\)\)}/g,
  `{collections.map(col => (\n                    <option key={col.id} value={col.id}>{col.title} ({col.handle})</option>\n                  ))}`
);

// Dropdown 2: AutomatedCampaignsDashboard
content = content.replace(
  /<AutomatedCampaignsDashboard products={products} collections={parentCollections} \/>/g,
  `<AutomatedCampaignsDashboard products={products} collections={collections} />`
);

fs.writeFileSync(path, content, 'utf8');
console.log("App.jsx fixed successfully.");
