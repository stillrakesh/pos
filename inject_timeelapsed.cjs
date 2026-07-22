const fs = require('fs');
let code = fs.readFileSync('c:/Users/mrrak/Desktop/restaurant-pos/src/App.jsx', 'utf8');
const injectPoint = code.indexOf('const AppTopNavbar');
const timeElapsedComponent = `
const TimeElapsed = ({ createdAt }) => {
  const [elapsed, setElapsed] = React.useState('');
  
  React.useEffect(() => {
    if (!createdAt) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - createdAt) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(m + 'm ' + s + 's');
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);
  
  if (!elapsed) return null;
  return <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#f59e0b', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}><Clock size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }}/> {elapsed}</div>;
};

`;
code = code.substring(0, injectPoint) + timeElapsedComponent + code.substring(injectPoint);
fs.writeFileSync('c:/Users/mrrak/Desktop/restaurant-pos/src/App.jsx', code, 'utf8');
