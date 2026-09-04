const fs = require('fs');
const path = require('path');

// Fix App.jsx
const appPath = path.join(__dirname, 'src', 'App.jsx');
let appContent = fs.readFileSync(appPath, 'utf8');

// Remove CallsTab import
appContent = appContent.replace(/import\s+CallsTab\s+from\s+['"].\/components\/CallsTab['"];\r?\n/, '');

// Remove CallsTab render block
appContent = appContent.replace(/\{\s*activeTab\s*===\s*['"]calls['"]\s*&&\s*\(\s*<CallsTab\s*\/>\s*\)\s*\}/, '');
// If it's a tab button for Calls
appContent = appContent.replace(/<button[^>]*onClick=\{[^}]*setActiveTab\(['"]calls['"]\)[^}]*\}[^>]*>[\s\S]*?<\/button>/, '');
// Also if there's any generic 'Calls' text in a tab button that matches activeTab === 'calls'
appContent = appContent.replace(/<button[^>]*onClick=\{[^>]*setActiveTab\('calls'\)[^>]*>[\s\S]*?<\/button>/, '');

fs.writeFileSync(appPath, appContent);
console.log('Cleaned App.jsx');

// Fix WhatsAppAIDashboard.jsx
const dashboardPath = path.join(__dirname, 'src', 'components', 'WhatsAppAIDashboard.jsx');
let dashContent = fs.readFileSync(dashboardPath, 'utf8');

// Remove imports
dashContent = dashContent.replace(/import\s+OutboundCallOverlay\s+from\s+['"].\/OutboundCallOverlay['"];\r?\n/, '');
dashContent = dashContent.replace(/import\s+IncomingCallOverlay\s+from\s+['"].\/IncomingCallOverlay['"];\r?\n/, '');

// Remove render blocks
dashContent = dashContent.replace(/<IncomingCallOverlay\s*\/>/g, '');
dashContent = dashContent.replace(/<OutboundCallOverlay[\s\S]*?\/>/g, '');

fs.writeFileSync(dashboardPath, dashContent);
console.log('Cleaned WhatsAppAIDashboard.jsx');
