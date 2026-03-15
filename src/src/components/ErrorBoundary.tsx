import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches unhandled errors in the React component tree and renders a child-friendly fallback.
 * Displays an owl icon and a "Try Again" button that reloads the page.
 *
 * @remarks This is a class component because React requires `getDerivedStateFromError` and
 *          `componentDidCatch` lifecycle methods for error boundaries — there is no hooks equivalent.
 *          This is the only class component in the codebase; all others are functional.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  /** Derives error state when a child component throws.
   * @returns Updated state with hasError set to true.
   */
  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  /**
   * Logs error details when a child component throws.
   * @param error - The error that was thrown.
   * @param errorInfo - React error info with component stack.
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  /**
   * Renders children or a fallback UI when an error has been caught.
   * @returns The rendered React node.
   */
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: '#faf3e8',
            color: '#5a4a3a',
            fontFamily: 'system-ui, sans-serif',
            padding: 32,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 64, marginBottom: 16 }}>&#x1F989;</div>
          <p style={{ fontSize: 20, marginBottom: 24 }}>Oops! Something went wrong.</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 32px',
              fontSize: 18,
              borderRadius: 28,
              border: 'none',
              background: '#e8a54b',
              color: 'white',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
