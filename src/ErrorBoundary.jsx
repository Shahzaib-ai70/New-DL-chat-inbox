import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
            padding: '20px', 
            color: 'red', 
            backgroundColor: 'white', 
            height: '100vh', 
            width: '100vw',
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: 9999,
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center' 
        }}>
          <h2>Something went wrong.</h2>
          <pre style={{maxWidth: '800px', overflow: 'auto'}}>{this.state.error && this.state.error.toString()}</pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: '10px', padding: '8px 16px', cursor: 'pointer' }}>Reload Page</button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
