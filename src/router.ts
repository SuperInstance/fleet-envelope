/**
 * router.ts — Subscribe to events by intent pattern.
 *
 *   on('room.*', (event) => { ... });
 *   on('poker.*', (event) => { ... });
 *   on('cns.packet', (event) => { ... });
 */

import type { FleetEvent } from './envelope.js';

type Handler = (event: FleetEvent) => void;

/**
 * Convert a glob intent pattern to a RegExp.
 * 'room.*'     → /^room\..+$/
 * 'poker.bet'  → /^poker\.bet$/
 * '*'          → /^.+$/
 * 'cns.*.alert'→ /^cns\..+\.alert$/
 */
function patternToRegex(pattern: string): RegExp {
  // Escape regex special chars except * and .
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.+');
  // Restore escaped dots that should be literal dots between segments
  // The pattern uses literal dots as namespace separators
  return new RegExp(`^${escaped}$`);
}

/**
 * Simple intent-pattern-based event router.
 *
 * Not a central bus — each system can have its own Router instance.
 * The point is shared grammar, not shared infrastructure.
 */
export class Router {
  private handlers: Array<{ pattern: RegExp; raw: string; handler: Handler }> = [];

  /**
   * Subscribe to events matching an intent pattern.
   *
   * @param pattern  Glob pattern: 'room.*', 'poker.bet', 'cns.*.alert', '*'
   * @param handler  Called when a matching event is dispatched
   * @returns Unsubscribe function
   */
  on(pattern: string, handler: Handler): () => void {
    const regex = patternToRegex(pattern);
    const entry = { pattern: regex, raw: pattern, handler };
    this.handlers.push(entry);
    return () => {
      this.handlers = this.handlers.filter(h => h !== entry);
    };
  }

  /**
   * Dispatch an event to all matching handlers.
   * Returns the number of handlers that were called.
   */
  dispatch(event: FleetEvent): number {
    let count = 0;
    for (const { pattern, handler } of this.handlers) {
      if (pattern.test(event.intent)) {
        handler(event);
        count++;
      }
    }
    return count;
  }

  /** Remove all handlers. */
  clear(): void {
    this.handlers = [];
  }

  /** List all registered patterns. */
  get patterns(): string[] {
    return this.handlers.map(h => h.raw);
  }
}

/**
 * Module-level default router for convenience.
 * Systems that want isolation should create their own Router instance.
 */
const defaultRouter = new Router();

export function on(pattern: string, handler: Handler): () => void {
  return defaultRouter.on(pattern, handler);
}

export function dispatch(event: FleetEvent): number {
  return defaultRouter.dispatch(event);
}

export { defaultRouter };
