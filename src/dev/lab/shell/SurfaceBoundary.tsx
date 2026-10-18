// One error boundary per surface (spec 3.0, states): a surface that throws shows what happened and
// leaves the shell and every other surface working.
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Glyph } from '../viz';

interface Props { name: string; resetKey: string; children: ReactNode }
interface State { error: Error | null; key: string }

export class SurfaceBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // A new call, path or surface gives the surface a fresh try.
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`Scenario Lab: ${this.props.name} failed`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <section className="lab-boundary lab-boundary-error" role="alert">
        <Glyph name="error" size={16} />
        <div>
          <p className="lab-boundary-title">{`${this.props.name} hit an error: ${error.message}`}</p>
          <button type="button" className="lab-button" onClick={() => this.setState({ error: null })}><Glyph name="retry" />Try again</button>
        </div>
      </section>
    );
  }
}
