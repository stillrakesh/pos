const fs = require('fs');

function fixMojibake(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let buffer = Buffer.alloc(content.length);
    let failed = false;

    // ISO-8859-1 to CP1252 map for undefined characters
    const cp1252 = {
      0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
      0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
      0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
      0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f
    };

    for (let i = 0; i < content.length; i++) {
      const code = content.charCodeAt(i);
      if (code > 255) {
        if (cp1252[code] !== undefined) {
          buffer[i] = cp1252[code];
        } else {
          failed = true;
          console.log(`Failed on character: ${content.charAt(i)} (Code: ${code}) in ${filePath}`);
          break;
        }
      } else {
        buffer[i] = code;
      }
    }

    if (!failed) {
      const decoded = buffer.toString('utf8');
      fs.writeFileSync(filePath, decoded, 'utf8');
      console.log(`Successfully fixed mojibake in ${filePath}`);
    }
  } catch (err) {
    console.log(`Error processing ${filePath}:`, err.message);
  }
}

fixMojibake('c:/Users/mrrak/Desktop/restaurant-pos/src/App.jsx');
fixMojibake('c:/Users/mrrak/Desktop/restaurant-pos/src/utils/formatters.js');
