'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error', {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    }, error);

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <CardTitle className="text-red-600">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                An unexpected error occurred. Please check the browser console for more details.
              </p>

              {this.state.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800 mb-2">Error Details:</p>
                  <p className="text-sm text-red-700 font-mono">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <details className="mt-2">
                      <summary className="text-sm text-red-600 cursor-pointer">
                        Stack Trace
                      </summary>
                      <pre className="text-xs text-red-600 mt-2 overflow-auto max-h-48">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {this.state.errorInfo && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-800 mb-2">Component Stack:</p>
                  <pre className="text-xs text-gray-700 overflow-auto max-h-48">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}

              <div className="flex gap-4">
                <Button onClick={this.handleReset} variant="outline">
                  Try Again
                </Button>
                <Button
                  onClick={() => {
                    window.location.href = '/';
                  }}
                >
                  Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
