import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Namdev Connect]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#fafafa] text-[#191011]">
          <h1 className="text-lg font-bold mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-600 text-center max-w-md mb-4">{this.state.error.message}</p>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-[#8e2533] text-white text-sm font-semibold"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
