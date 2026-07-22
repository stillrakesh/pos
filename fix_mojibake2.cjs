const fs = require('fs');

function fixFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  let original = code;
  
  // Emojis that were mangled
  const fixes = [
    // 🍺 Beer
    [/\u00C3\u00B0\u00C5\u00B8\u00C2\u008D\u00C2\u00BA/g, '🍺'], 
    // 🥤 Soda
    [/\u00C3\u00B0\u00C5\u00B8\u00C2\u00A5\u00C2\u00A4/g, '🥤'],
    // 🥃 Whisky
    [/\u00C3\u00B0\u00C5\u00B8\u00C2\u00A5\u00C6\u0092/g, '🥃'],
    // 🍸 Cocktail
    [/\u00C3\u00B0\u00C5\u00B8\u00C2\u008D\u00C2\u00B8/g, '🍸'],
    // ₹ Rupee
    [/\u00C3\u00A2\u00E2\u0080\u009A\u00C2\u00B9/g, '₹'],
    [/\u00C3\u00A2\u00E2\u0080\u009A\u00C2\u00B9/g, '₹'],
    // 🖨️ Printer
    [/\u00C3\u00B0\u00C5\u00B8\u00E2\u0080\u0093\u00C2\u00A8\u00C3\u00A2\u00E2\u0080\u017E\u00C2\u00A2\u00C3\u00AF\u00C2\u00B8\u00C2\u008F/g, '🖨️'],
    // 🖨 (without variation protector)
    [/\u00C3\u00B0\u00C5\u00B8\u00E2\u0080\u0093\u00C2\u00A8/g, '🖨'],
    // 🧊 Ice Cube
    [/\u00C3\u00B0\u00C5\u00B8\u00C2\u00A7\u00C2\u008A/g, '🧊']
  ];

  for (const [regex, fixed] of fixes) {
    code = code.replace(regex, fixed);
  }

  // Also replace via literal copy-paste from what powershell dumped:
  code = code.replace(/Ã°Å¸ÂÂº/g, '🍺');
  code = code.replace(/Ã°Å¸Â¥Â¤/g, '🥤');
  code = code.replace(/Ã°Å¸Â¥Æ’/g, '🥃');
  code = code.replace(/Ã°Å¸ÂÂ¸/g, '🍸');
  code = code.replace(/Ã¢â‚¬Å¡Â¹/g, '₹');
  code = code.replace(/â,¹/g, '₹');

  if (code !== original) {
    fs.writeFileSync(filePath, code, 'utf8');
    console.log('Fixed Mojibake in', filePath);
  } else {
    console.log('No Mojibake matches found in', filePath);
  }
}

fixFile('c:/Users/mrrak/Desktop/restaurant-pos/src/App.jsx');
fixFile('c:/Users/mrrak/Desktop/restaurant-pos/src/utils/formatters.js');
