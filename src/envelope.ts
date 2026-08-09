/**
 * envelope.ts — The Fleet Event Envelope
 *
 * One grammar for all event systems. Like TCP/IP is a grammar, not a server.
 * Every system speaks the same packet shape but transports however it wants.
 *
 * Systems using this envelope:
 *   1. The Tap's Durable Object WebSocket broadcasts
 *   2. CNS bridge filesystem signals (USCP protocol)
 *   3. OpenClaw cron/session events
 *   4. Spatial Registry room/portal events
 *   5. Poker Game narration/action events
 */

/** Deadband tier — how urgently this event needs to arrive. */
export type Tier = 'reflex' | 'edge' | 'cortex';

/**
 * A FleetEvent is the universal envelope. Every system wraps its native
 * message format in this shape when crossing boundaries.
 *
 * Required fields are minimal. Payload is opaque — each intent defines
 * its own payload schema by convention.
 */
export interface FleetEvent {
  /** UUID for this specific event. */
  id: string;

  /** The agent or system that originally emitted this event. */
  source: string;

  /** Specific target agent/system, or undefined for broadcast. */
  target?: string;

  /**
   * What kind of event this is, in dotted notation.
   * Namespace . action: 'room.enter', 'poker.bet', 'cns.packet', etc.
   */
  intent: string;

  /** Deadband tier — determines delivery urgency and routing priority. */
  tier: Tier;

  /** Event-specific data. Each intent convention defines its own shape. */
  payload: any;

  /** Milliseconds since epoch when this event was created. */
  timestamp: number;

  /**
   * Chain of forwarders. Each system that touches this event appends its ID.
   * Grows as the event hops between systems. Never shortened.
   */
  provenance: string[];

  /** How many systems this event has passed through. Equals provenance.length - 1. */
  hops: number;

  /** Which world this event originated in (e.g. 'the-tap', 'plato-shell'). */
  worldId?: string;

  /** Which room this event relates to, if applicable. */
  roomId?: string;
}

// ── Tier semantics ────────────────────────────────────────────

/**
 * REFLEX — sub-second, fire-and-forget. Movement, presence, heartbeat.
 *   The body flinches before the brain knows why.
 *
 * EDGE — few seconds, state transitions. Room entries, portal usage,
 *   game state changes. The edge of conscious awareness.
 *
 * CORTEX — seconds to minutes, deliberation. Narration, conversation,
 *   complex game actions, planning. The thinking brain.
 *
 * Lower tiers should never block on higher tiers.
 * Higher tiers should never be needed for basic operation.
 */
export const TIER_PRIORITY: Record<Tier, number> = {
  reflex: 0,
  edge: 1,
  cortex: 2,
};

// ── Intent conventions ────────────────────────────────────────

/**
 * Intent strings use dotted namespace.action format.
 *
 * Known namespaces:
 *   room.*     — Spatial Registry: room.enter, room.exit, room.look
 *   portal.*   — Spatial Registry: portal.use, portal.lock, portal.unlock
 *   poker.*    — Poker Game: poker.bet, poker.fold, poker.raise, poker.deal
 *   cns.*      — CNS Bridge: cns.packet, cns.alert, cns.heartbeat
 *   tap.*      — The Tap DO: tap.broadcast, tap.agent_entered, tap.agent_left
 *   cron.*     — OpenClaw: cron.tick, cron.session_start, cron.session_end
 *   system.*   — Fleet infrastructure: system.ready, system.error
 *
 * This list is not exhaustive — new namespaces are registered by convention.
 */

// ── Validation ────────────────────────────────────────────────

const REQUIRED_FIELDS: (keyof FleetEvent)[] = [
  'id', 'source', 'intent', 'tier', 'payload', 'timestamp', 'provenance', 'hops',
];

/** Valid dotted intent pattern: lowercase, at least one dot. */
const INTENT_PATTERN = /^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_.-]*$/;

/**
 * Validate that an object is a well-formed FleetEvent.
 * Returns an array of error strings (empty = valid).
 */
export function validateEvent(event: Partial<FleetEvent>): string[] {
  const errors: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (event[field] === undefined || event[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (event.intent && !INTENT_PATTERN.test(event.intent)) {
    errors.push(`Invalid intent format: "${event.intent}" (expected namespace.action)`);
  }

  if (event.tier && !['reflex', 'edge', 'cortex'].includes(event.tier)) {
    errors.push(`Invalid tier: "${event.tier}" (expected reflex, edge, or cortex)`);
  }

  if (event.provenance !== undefined) {
    if (!Array.isArray(event.provenance)) {
      errors.push('provenance must be an array');
    } else if (event.source && event.provenance[0] !== event.source) {
      errors.push(`provenance[0] must equal source ("${event.source}"), got "${event.provenance[0]}"`);
    }
  }

  if (event.hops !== undefined && event.provenance !== undefined) {
    const expectedHops = event.provenance.length - 1;
    if (event.hops !== expectedHops) {
      errors.push(`hops (${event.hops}) must equal provenance.length - 1 (${expectedHops})`);
    }
  }

  return errors;
}

/** Type guard: is this a valid FleetEvent? */
export function isFleetEvent(event: any): event is FleetEvent {
  return validateEvent(event).length === 0;
}
