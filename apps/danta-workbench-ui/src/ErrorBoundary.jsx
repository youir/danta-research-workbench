import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('应用错误：', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '20px',
          textAlign: 'center',
          background: 'var(--surface, #fdfdfc)',
          color: 'var(--ink, #172a43)'
        }}>
          <h2 style={{ marginBottom: '12px' }}>出现了一些问题</h2>
          <p style={{ marginBottom: '20px', color: 'var(--ink-muted, #526681)' }}>
            请刷新页面重试,或联系技术支持。
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid var(--line, #dae1e9)',
              background: 'var(--surface-raised, #fff)',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
