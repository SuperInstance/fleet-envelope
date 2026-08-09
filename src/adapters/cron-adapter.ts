/**
 * cron-adapter.ts — Converts OpenClaw cron/session events
 * to and from FleetEvent envelopes.
 *
 * OpenClaw fires cron events with a shape like:
 *   { type: 'cron', schedule: 'heartbeat', timestamp: '...', data: {...} }
 *
 * Session events look like:
 *   { type: 'session_start' | 'session_end', sessionId, channel, agent }
 *
 * These map to FleetEvents:
 *   intent: 'cron.tick', 'cron.session_start', 'cron.session_end'
 *   tier:   'cortex' for regular ticks, 'edge' for session lifecycle
 */

import type { FleetEvent, Tier } from '../envelope.js';
import { emit, stamp } from '../emitter.js';

// ── OpenClaw cron/session wire format ──────────────────────────

export interface CronEvent {
  type: string;            // 'cron' | 'session_start' | 'session_end' | 'heartbeat'
  schedule?: string;       // cron expression or named schedule
  timestamp?: string;      // ISO-8601
  sessionId?: string;
  channel?: string;
  agent?: string;
  data?: any;
  [key: string]: any;
}

/** Map OpenClaw event types to FleetEvent intents and tiers. */
const CRON_TYPE_MAP: Record<string, { intent: string; tier: Tier }> = {
  heartbeat:       { intent: 'cron.heartbeat',      tier: 'reflex' },
  cron:            { intent: 'cron.tick',            tier: 'cortex' },
  session_start:   { intent: 'cron.session_start',   tier: 'edge' },
  session_end:     { intent: 'cron.session_end',     tier: 'edge' },
  reminder:        { intent: 'cron.reminder',         tier: 'edge' },
};

/**
 * Convert an OpenClaw cron/session event into a FleetEvent.
 */
export function fromCron(event: CronEvent): FleetEvent {
  const mapping = CRON_TYPE_MAP[event.type];
  const intent = mapping?.intent ?? `cron.${event.type}`;
  const tier = mapping?.tier ?? 'cortex';

  const source = event.agent ?? 'openclaw';
  const ts = event.timestamp ? new Date(event.timestamp).getTime() : Date.now();

  const fleetEvent = emit(
    intent,
    {
      schedule: event.schedule,
      sessionId: event.sessionId,
      channel: event.channel,
      data: event.data,
    },
    tier,
    source,
    { timestamp: ts },
  );

  return stamp(fleetEvent, 'openclaw:cron');
}

/**
 * Convert a FleetEvent back into an OpenClaw cron event shape.
 */
export function toCron(event: FleetEvent): CronEvent {
  // Reverse-map intent to cron type
  for (const [cronType, mapping] of Object.entries(CRON_TYPE_MAP)) {
    if (mapping.intent === event.intent) {
      return {
        type: cronType,
        timestamp: new Date(event.timestamp).toISOString(),
        agent: event.source,
        ...event.payload,
      };
    }
  }

  return {
    type: 'cron',
    timestamp: new Date(event.timestamp).toISOString(),
    agent: event.source,
    data: event.payload,
  };
}
