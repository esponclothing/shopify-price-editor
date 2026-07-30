const fs = require('fs');

let content = fs.readFileSync('src/components/AutomatedCampaignsDashboard.jsx', 'utf-8');

content = content.replace(
  "setSelectedProductIds(data.customerGets.items.products.edges.map(e => e.node.id.split('/').pop()));",
  "setSelectedProductIds(data.customerGets.items.products.edges.map(e => e.node.id));"
);

fs.writeFileSync('src/components/AutomatedCampaignsDashboard.jsx', content);
console.log("Updated handleEditCampaign successfully!");
