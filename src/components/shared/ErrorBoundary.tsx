import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import { Button } from "../ui/Button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name || 'Global'}] Uncaught error:`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-8 bg-background rounded-[40px] border border-border-subtle relative overflow-hidden">
          {/* Ambient Background */}
          <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-rose-500/10 blur-[100px] rounded-full" />
          </div>

          <div className="relative z-10 flex flex-col items-center text-center max-w-md space-y-8">
            <div className="w-20 h-20 rounded-[32px] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-2xl shadow-rose-500/10">
              <AlertCircle size={40} />
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl font-black text-foreground italic tracking-tighter uppercase">
                {this.props.name ? `${this.props.name} Failed` : 'Anarchy in the Engine'}
              </h2>
              <p className="text-foreground-dim text-sm font-medium leading-relaxed">
                The component encountered a reality-bending error. We've isolated the failure to prevent a total system collapse.
              </p>
              {this.state.error && (
                <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/5 text-[10px] font-mono text-foreground-dim text-left overflow-x-auto max-h-32 custom-scrollbar">
                   {this.state.error.toString()}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 w-full">
              <button 
                onClick={this.handleReset}
                className="flex-1 h-14 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl"
              >
                <RotateCcw size={14} />
                <span>Re-Initialize</span>
              </button>
              <button 
                onClick={this.handleGoHome}
                className="w-14 h-14 rounded-2xl bg-surface-elevated border border-border-subtle text-foreground flex items-center justify-center hover:bg-surface-raised transition-all"
              >
                <Home size={18} />
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
