const fs = require('fs');
let code = fs.readFileSync('c:/Users/mrrak/Desktop/restaurant-pos/src/App.jsx', 'utf8');

const matchMixers = code.match(/Mixers & Refreshers"/);
if (matchMixers) {
   const index = matchMixers.index;
   console.log('Mixers substring: ', JSON.stringify(code.substring(index - 10, index)));
}

const matchRupee = code.match(/price: 399/);
if (matchRupee) {
  const index = matchRupee.index;
  console.log('Price line: ', JSON.stringify(code.substring(index - 50, index + 20)));
}
