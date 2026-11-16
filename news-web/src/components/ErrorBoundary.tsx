import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected rendering error occurred.',
    };
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center px-4 py-12">
          <div
            role="alert"
            className="pi-surface-paper w-full max-w-[520px] rounded-[24px] border p-7 sm:p-9"
            style={{
              backgroundColor: 'var(--pi-bg-card)',
              borderColor: 'var(--pi-border-paper)',
              boxShadow: 'var(--pi-shadow-card)',
            }}
          >
            <p
              className="pi-meta-label mb-2"
              style={{ color: 'var(--pi-accent-ink)' }}
            >
              Edition Interrupted
            </p>
            <h1
              className="pi-headline pi-headline--standard mb-3"
              style={{ color: 'var(--pi-text-on-paper)' }}
            >
              Unable to display this edition
            </h1>
            <p
              className="pi-font-serif mb-6 text-base leading-relaxed"
              style={{ color: 'var(--pi-text-on-paper-muted)' }}
            >
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex min-h-[44px] cursor-pointer items-center rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.09em] transition-opacity duration-150 hover:opacity-90"
              style={{
                fontFamily: 'var(--font-sans)',
                backgroundColor: 'var(--pi-ink)',
                color: 'var(--pi-paper)',
              }}
            >
              Reload Paper &amp; Ink
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
