const fs = require('fs');
let content = fs.readFileSync('src/App.jsx', 'utf8');

const lines = content.split('\n');
const out = [];
let i = 0;
let removed = false;

while (i < lines.length) {
  const line = lines[i];
  // Detect the orphaned fragment: a line that has only spaces + "}" that appears AFTER "})();" + "};"
  // Look for the pattern: after "  };" closing saveOrderToTable, we have an orphaned block
  // The orphaned block starts with "        }" and contains "Settle Bill background sync failed"
  if (!removed && line.trim() === '}' && i > 0) {
    // look ahead for the "Settle Bill" marker
    const next5 = lines.slice(i, i+6).join('\n');
    if (next5.includes('Settle Bill background sync failed')) {
      // Skip lines until we reach the closing "};" of this orphaned IIFE
      while (i < lines.length) {
        if (lines[i].trim() === '};') {
          i++; // skip the "  };" closing line too
          break;
        }
        i++;
      }
      removed = true;
      console.log('Removed orphaned block!');
      continue;
    }
  }
  out.push(line);
  i++;
}

fs.writeFileSync('src/App.jsx', out.join('\n'), 'utf8');
console.log('Done. Lines before:', lines.length, 'Lines after:', out.length);
