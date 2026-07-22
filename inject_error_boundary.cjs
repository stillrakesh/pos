const fs = require('fs');
let code = fs.readFileSync('c:/Users/mrrak/Desktop/restaurant-pos/src/App.jsx', 'utf8');

const boundary = `
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('POS ErrorBoundary Caught:', error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '50px', background: '#fee2e2', color: '#991b1b', height: '100vh', fontFamily: 'monospace' }}>
          <h2>Something went wrong in the POS Application.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>Click to view details (PLEASE SCREENSHOT THIS FOR SUPPORT)</summary>
            <br/>
            {this.state.error && this.state.error.toString()}
            <br/><br/>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <br/>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', background: '#991b1b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Reload POS</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
`;

code = code.replace('export default function App() {', boundary);
code += `\n\nexport default function App() { return <ErrorBoundary><MainApp /></ErrorBoundary>; }\n`;

fs.writeFileSync('c:/Users/mrrak/Desktop/restaurant-pos/src/App.jsx', code, 'utf8');
