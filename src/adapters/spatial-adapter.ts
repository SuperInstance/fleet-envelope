/**
 * spatial-adapter.ts — Converts Spatial Registry room/portal events
 * to and from FleetEvent envelopes.
 *
 * Spatial Registry manages rooms and portals (from types.ts):
 *   Room: { id, name, worldId, coordinates, exits: Portal[], tags, metadata }
 *   Portal: { id, fromRoom, toRoom, direction, type, locked, lockedMessage }
 *
 * Spatial events:
 *   - Agent enters a room    → room.enter
 *   - Agent exits a room     → room.exit
 *   - Agent looks at a room  → room.look
 *   - Portal used            → portal.use
 *   - Portal locked/unlocked → portal.lock / portal.unlock
 *
 * These are reflex-tier (movement, presence) unless they involve
 * a transition with narration (edge).
 */

import type { FleetEvent, Tier } from '../envelope.js';
import { emit, stamp } from '../emitter.js';

// ── Spatial event wire format ─────────────────────────────────

export interface SpatialEvent {
  kind: 'room.enter' | 'room.exit' | 'room.look' | 'portal.use' | 'portal.lock' | 'portal.unlock';
  agentId: string;
  roomId?: string;
  fromRoomId?: string;
  toRoomId?: string;
  portalId?: string;
  worldId?: string;
  metadata?: Record<string, any>;
}

const SPATIAL_TIER: Record<string, Tier> = {
  'room.enter':   'reflex',
  'room.exit':    'reflex',
  'room.look':    'edge',
  'portal.use':   'edge',
  'portal.lock':  'edge',
  'portal.unlock': 'edge',
};

/**
 * Convert a Spatial Registry event into a FleetEvent.
 */
export function fromSpatial(event: SpatialEvent): FleetEvent {
  const intent = event.kind; // Already dotted: 'room.enter', 'portal.use', etc.
  const tier = SPATIAL_TIER[event.kind] ?? 'edge';

  const payload: any = {
    agentId: event.agentId,
  };

  if (event.fromRoomId) payload.fromRoomId = event.fromRoomId;
  if (event.toRoomId) payload.toRoomId = event.toRoomId;
  if (event.portalId) payload.portalId = event.portalId;
  if (event.metadata) payload.metadata = event.metadata;

  const fleetEvent = emit(intent, payload, tier, event.agentId, {
    worldId: event.worldId,
    roomId: event.roomId ?? event.toRoomId,
  });

  return stamp(fleetEvent, 'spatial-registry');
}

/**
 * Convert a FleetEvent back into a Spatial Registry event.
 */
export function toSpatial(event: FleetEvent): SpatialEvent {
  const p = event.payload ?? {};

  return {
    kind: event.intent as SpatialEvent['kind'],
    agentId: event.source,
    roomId: event.roomId,
    fromRoomId: p.fromRoomId,
    toRoomId: p.toRoomId,
    portalId: p.portalId,
    worldId: event.worldId,
    metadata: p.metadata,
  };
}
