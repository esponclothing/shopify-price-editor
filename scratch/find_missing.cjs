const fs = require('fs');

const file = fs.readFileSync('src/components/WhatsAppAIDashboard.jsx', 'utf8');

// Find the lucide-react import
const importMatch = file.match(/import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/);
if (!importMatch) {
  console.log("No lucide-react import found");
  process.exit(1);
}

const importedStr = importMatch[1];
const importedIcons = importedStr.split(',').map(s => {
  let name = s.trim();
  if (name.includes(' as ')) {
    return name.split(' as ')[1].trim();
  }
  return name;
}).filter(Boolean);

// Find all React components rendered in the file (starting with capital letter)
const componentMatches = file.match(/<([A-Z][a-zA-Z0-9_]*)/g);
const usedComponents = new Set();
if (componentMatches) {
  componentMatches.forEach(match => {
    usedComponents.add(match.substring(1));
  });
}

// Check which used components are not defined in the file
// We'll just assume any used component that is not a standard HTML tag
// and not imported from lucide-react, might be an issue. But we only care about missing Lucide ones.
// Actually, let's just grep all lucide-react exports if we can, or just print all missing capital-letter tags.

const otherImportsMatches = file.match(/import\s+[^{]*{([^}]+)}\s+from/g) || [];
let otherImports = [];
otherImportsMatches.forEach(m => {
  if (m.includes('lucide-react')) return;
  const match = m.match(/{([^}]+)}/);
  if (match) {
    otherImports.push(...match[1].split(',').map(s => s.trim().split(' as ').pop()));
  }
});
const defaultImportsMatches = file.match(/import\s+([A-Z][a-zA-Z0-9_]*)\s+from/g) || [];
defaultImportsMatches.forEach(m => {
  const match = m.match(/import\s+([A-Z][a-zA-Z0-9_]*)/);
  if (match) otherImports.push(match[1]);
});

const declaredComponents = file.match(/(?:function|const|let|var)\s+([A-Z][a-zA-Z0-9_]*)/g) || [];
declaredComponents.forEach(m => {
  const match = m.match(/(?:function|const|let|var)\s+([A-Z][a-zA-Z0-9_]*)/);
  if (match) otherImports.push(match[1]);
});

const missing = [];
for (const comp of usedComponents) {
  if (!importedIcons.includes(comp) && !otherImports.includes(comp) && comp !== 'Fragment') {
    missing.push(comp);
  }
}

console.log("Potentially missing components:");
console.log(missing);
