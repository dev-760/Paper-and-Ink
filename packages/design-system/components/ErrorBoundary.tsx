import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; appName?: string },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; appName?: string }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected rendering error occurred.',
    };
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          backgroundColor: 'var(--pi-bg, #F6EFE4)',
          color: 'var(--pi-text, #1F2A3A)',
          fontFamily: 'var(--pi-font-sans, system-ui, sans-serif)',
        }}
      >
        <div
          className="max-w-md w-full p-7 text-center space-y-4"
          style={{
            backgroundColor: 'var(--pi-surface, #FBF7F0)',
            border: '1px solid var(--pi-border, rgba(31,42,58,0.12))',
            borderRadius: 'var(--pi-radius-sheet, 24px)',
            boxShadow: 'var(--pi-shadow-card)',
          }}
        >
          <p className="text-xs uppercase tracking-widest opacity-60">
            {this.props.appName || 'Paper & Ink'}
          </p>
          <h1
            className="text-2xl font-medium"
            style={{ fontFamily: 'var(--pi-font-display, Georgia, serif)' }}
          >
            Something paused unexpectedly
          </h1>
          <p className="text-sm opacity-75 leading-relaxed">{this.state.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center h-10 px-5 rounded-full text-sm font-medium text-white cursor-pointer"
            style={{ backgroundColor: 'var(--pi-accent, #C4572F)' }}
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
