/**
 * tap-adapter.ts — Converts The Tap's Durable Object WebSocket messages
 * to and from FleetEvent envelopes.
 *
 * The Tap DO broadcasts messages like:
 *   { type: "agent_entered", agent: {...}, room: "bar-rail" }
 *   { type: "agent_left", agentId: "flash", room: "bar-rail" }
 *   { type: "conversation_line", line: { agentId, displayName, content, ... } }
 *
 * These map to FleetEvents:
 *   intent: 'tap.agent_entered', 'tap.agent_left', 'tap.conversation_line'
 *   tier:   'reflex' for presence, 'cortex' for conversation
 */

import type { FleetEvent, Tier } from '../envelope.js';
import { emit, stamp } from '../emitter.js';

// ── The Tap DO wire format (observed from room-do.ts) ─────────

export interface TapMessage {
  type: string;
  agent?: { id: string; name?: string; [key: string]: any };
  agentId?: string;
  room?: string;
  line?: {
    agentId: string;
    displayName: string;
    content: string;
    timestamp: number;
    speechAct?: string;
    signalStrength?: number;
    tokensUsed?: number;
  };
  [key: string]: any;
}

/** Map Tap message types to FleetEvent intents and tiers. */
const TAP_TYPE_MAP: Record<string, { intent: string; tier: Tier }> = {
  agent_entered:      { intent: 'tap.agent_entered',      tier: 'reflex' },
  agent_left:         { intent: 'tap.agent_left',          tier: 'reflex' },
  conversation_line:  { intent: 'tap.conversation_line',   tier: 'cortex' },
  system_message:     { intent: 'tap.system_message',      tier: 'edge' },
  game_update:        { intent: 'tap.game_update',         tier: 'edge' },
};

/**
 * Convert a Tap DO broadcast message into a FleetEvent.
 *
 * The source is the agent mentioned in the message (or 'the-tap' for system messages).
 * The provenance starts with the origin and gets 'the-tap:do' stamped on it.
 */
export function fromTap(message: TapMessage, worldId?: string): FleetEvent {
  const mapping = TAP_TYPE_MAP[message.type];

  // Unknown message types get a generic mapping
  const intent = mapping?.intent ?? `tap.${message.type}`;
  const tier = mapping?.tier ?? 'edge';

  // Determine source from the message
  let source = 'the-tap';
  if (message.agent?.id) {
    source = message.agent.id;
  } else if (message.agentId) {
    source = message.agentId;
  } else if (message.line?.agentId) {
    source = message.line.agentId;
  }

  const event = emit(intent, message, tier, source, {
    worldId: worldId ?? 'the-tap',
    roomId: message.room,
    timestamp: message.line?.timestamp,
  });

  // Stamp that this passed through the Tap DO
  return stamp(event, 'the-tap:do');
}

/**
 * Convert a FleetEvent back into a Tap DO broadcast message.
 * Useful when an event from another system needs to be broadcast to Tap clients.
 */
export function toTap(event: FleetEvent): TapMessage {
  // Reverse-map intent to Tap message type
  for (const [tapType, mapping] of Object.entries(TAP_TYPE_MAP)) {
    if (mapping.intent === event.intent) {
      return {
        type: tapType,
        ...event.payload,
      };
    }
  }

  // Unknown intents get wrapped generically
  return {
    type: 'fleet_event',
    intent: event.intent,
    source: event.source,
    payload: event.payload,
  };
}
