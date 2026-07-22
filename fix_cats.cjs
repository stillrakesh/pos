const fs = require('fs');
let code = fs.readFileSync('c:/Users/mrrak/Desktop/restaurant-pos/src/App.jsx', 'utf8');

// The beer emoji 🍺
code = code.replace(/ðŸ¥\u00A4/g, '🥤'); // Soda
code = code.replace(/ðŸº/g, '🍺');     // Beer
code = code.replace(/ðŸ¥ƒ/g, '🥃');     // Whisky
code = code.replace(/ðŸ ¸/g, '🍸');     // Cocktail
code = code.replace(/â,¹/g, '₹');       // Rupee with ascii comma
code = code.replace(/â‚¹/g, '₹');       // Rupee with fancy comma (U+201A)
code = code.replace(/Ã¢â‚¬Å¡Ã‚Â¹/g, '₹'); // Double corrupted rupee

// Ice Cube
code = code.replace(/ðŸ§Š/g, '🧊');

// Let's replace the whole categories just to be safe:
code = code.replace(/cat: ".*?Premium Beers.*?\"/g, 'cat: "🍺 Premium Beers (500 ml)"');
code = code.replace(/cat: ".*?Mixers & Refreshers.*?\"/g, 'cat: "🥤 Mixers & Refreshers"');
code = code.replace(/cat: ".*?Premium Whisky.*?\"/g, 'cat: "🥃 Premium Whisky"');
code = code.replace(/cat: ".*?Signature Cocktails.*?\"/g, 'cat: "🍸 Signature Cocktails"');
code = code.replace(/cat: ".*?Vodka.*?\"/g, 'cat: "🧊 Vodka"');
code = code.replace(/cat: ".*?Herbal Liqueur.*?\"/g, 'cat: "🌿 Herbal Liqueur"');

fs.writeFileSync('c:/Users/mrrak/Desktop/restaurant-pos/src/App.jsx', code, 'utf8');
console.log('Fixed categories!');
