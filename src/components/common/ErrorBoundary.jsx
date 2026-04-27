import { Component } from 'react';

// Inline fallback used when no `fallback` prop is given (full-page error screen).
function FullPageFallback({ error, errorInfo, onRetry }) {
  return (
    <div style={{
      padding: 40,
      background: '#0c0e14',
      color: '#eaedf3',
      height: '100vh',
      fontFamily: 'Inter, system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    }}>
      <h2 style={{ color: '#f87171', fontSize: 20 }}>Something went wrong</h2>
      <pre style={{
        background: '#181a24',
        padding: 20,
        borderRadius: 10,
        maxWidth: 600,
        overflow: 'auto',
        fontSize: 13,
        color: '#f87171',
        border: '1px solid rgba(248,113,113,0.2)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {error?.toString()}
        {'\n\n'}
        {errorInfo?.componentStack}
      </pre>
      <button
        onClick={onRetry}
        style={{
          padding: '10px 24px',
          background: '#6e8efb',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        Try again
      </button>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '8px 20px',
          background: 'transparent',
          color: '#8890a0',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        Reload page
      </button>
    </div>
  );
}

/**
 * ErrorBoundary — wraps a subtree and catches render errors.
 *
 * Usage:
 *   // Full-page fallback (default):
 *   <ErrorBoundary><App /></ErrorBoundary>
 *
 *   // Custom inline fallback — keeps the rest of the UI alive:
 *   <ErrorBoundary fallback={<PanelError />}>
 *     <DetailPanel />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    this._retry = () => this.setState({ hasError: false, error: null, errorInfo: null });
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Flux Atlas] Caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (fallback !== undefined) return fallback;
      return (
        <FullPageFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this._retry}
        />
      );
    }
    return this.props.children;
  }
}
