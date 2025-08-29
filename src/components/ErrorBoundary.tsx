import React from "react";

type ErrorBoundaryState = { hasError: boolean; error?: any };

export class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  override componentDidCatch(error: any) {
    this.setState({ hasError: true, error });
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="container mx-auto px-6 py-12">
          <div className="dashboard-card text-center">
            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground">Please refresh the page or try again later.</p>
          </div>
        </div>
      );
    }
    return this.props.children as React.ReactNode;
  }
}

