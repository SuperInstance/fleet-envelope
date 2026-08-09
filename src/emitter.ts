/**
 * emitter.ts — One-line event creation.
 *
 *   const event = emit('poker.bet', { actor: 'flash', amount: 50 }, 'cortex');
 */

import type { FleetEvent, Tier } from './envelope.js';
import { validateEvent } from './envelope.js';

let _counter = 0;

/**
 * Generate a UUID v4. Uses crypto.randomUUID when available,
 * falls back to a timestamp+counter based ID.
 */
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  _counter = (_counter + 1) % 0xffffff;
  return `${Date.now().toString(36)}-${(_counter).toString(36).padStart(6, '0')}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface EmitOptions {
  /** Override the auto-generated UUID. */
  id?: string;
  /** Specific target agent/system. */
  target?: string;
  /** Which world this originated in. */
  worldId?: string;
  /** Which room this relates to. */
  roomId?: string;
  /** Override timestamp (ms epoch). Defaults to Date.now(). */
  timestamp?: number;
}

/**
 * Create a properly-formed FleetEvent in one line.
 *
 * @param intent  Dotted intent string: 'poker.bet', 'room.enter', 'cns.packet'
 * @param payload Event-specific data
 * @param tier    Deadband tier (default: 'edge')
 * @param source  Who is emitting this (default: 'system')
 * @param options Optional overrides
 *
 * @example
 *   const e = emit('poker.bet', { actor: 'flash', amount: 50, narration: 'Flash pushes chips forward.' }, 'cortex');
 *   const e2 = emit('room.enter', { agent: 'wesley', from: 'bar-rail' }, 'reflex', 'wesley');
 */
export function emit(
  intent: string,
  payload: any,
  tier: Tier = 'edge',
  source: string = 'system',
  options: EmitOptions = {},
): FleetEvent {
  const event: FleetEvent = {
    id: options.id ?? uuid(),
    source,
    target: options.target,
    intent,
    tier,
    payload,
    timestamp: options.timestamp ?? Date.now(),
    provenance: [source],
    hops: 0,
    worldId: options.worldId,
    roomId: options.roomId,
  };

  const errors = validateEvent(event);
  if (errors.length > 0) {
    throw new Error(`Invalid FleetEvent: ${errors.join('; ')}`);
  }

  return event;
}

/**
 * Stamp an event as it passes through a system.
 * Appends to the provenance chain and increments hops.
 *
 * @param event   The event being forwarded
 * @param forwarder  The system/agent forwarding this event
 * @returns A new event object with updated provenance
 */
export function stamp(event: FleetEvent, forwarder: string): FleetEvent {
  return {
    ...event,
    provenance: [...event.provenance, forwarder],
    hops: event.hops + 1,
  };
}
