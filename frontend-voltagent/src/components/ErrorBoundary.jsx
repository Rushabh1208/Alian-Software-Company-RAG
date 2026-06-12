import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
            <p className="text-sm font-semibold uppercase tracking-[0.28em]">Frontend error</p>
            <p className="mt-3 text-sm">{this.state.error.message}</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
