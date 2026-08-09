/**
 * cns-adapter.ts — Converts USCP (Unified Spatial Communication Protocol)
 * packets to and from FleetEvent envelopes.
 *
 * USCP packets have three top-level keys:
 *   { header: {...}, body: {...}, signature: {...} }
 *
 * Header fields: origin_id, packet_id, intent, priority, destination_id,
 *                timestamp, version, correlation_id
 * Body: arbitrary structured data
 * Signature: HMAC-SHA256 integrity
 *
 * USCP intents (from protocol.py):
 *   sense, command, query, response, alert, heartbeat, register, escalation
 *
 * USCP priorities: low, normal, high, critical
 *
 * These map to FleetEvents:
 *   intent: 'cns.<uscp_intent>'  (e.g. 'cns.query', 'cns.alert')
 *   tier:   priority → tier mapping (critical→reflex, high→edge, normal/low→cortex)
 */

import type { FleetEvent, Tier } from '../envelope.js';
import { emit, stamp } from '../emitter.js';

// ── USCP wire format (from cns-bridge/src/cns_bridge/packet.py) ──

export interface USCPHeader {
  origin_id: string;
  packet_id: string;
  intent: string;       // sense | command | query | response | alert | heartbeat | register | escalation
  priority: string;     // low | normal | high | critical
  destination_id: string;
  timestamp: string;    // ISO-8601
  version: string;
  correlation_id?: string;
}

export interface USCPBody {
  [key: string]: any;
}

export interface UCSPSignature {
  algorithm: string;
  value: string;
  key_id?: string;
}

export interface USCPPacket {
  header: USCPHeader;
  body: USCPBody;
  signature?: UCSPSignature;
}

/** Map USCP priority to FleetEvent tier. */
function priorityToTier(priority: string): Tier {
  switch (priority) {
    case 'critical': return 'reflex';  // Sub-second, urgent
    case 'high':     return 'edge';    // State transition urgency
    case 'normal':   return 'cortex';  // Standard deliberation
    case 'low':      return 'cortex';  // No rush
    default:         return 'cortex';
  }
}

/** Map FleetEvent tier back to USCP priority. */
function tierToPriority(tier: Tier): string {
  switch (tier) {
    case 'reflex': return 'critical';
    case 'edge':   return 'high';
    case 'cortex': return 'normal';
  }
}

/**
 * Convert a USCP packet into a FleetEvent.
 *
 * The source is the origin_id. The target is the destination_id.
 * Provenance starts with origin_id, then stamped with 'cns-bridge'.
 */
export function fromCNS(packet: USCPPacket): FleetEvent {
  const { header, body } = packet;
  const tier = priorityToTier(header.priority);
  const intent = `cns.${header.intent}`;

  const event = emit(intent, body, tier, header.origin_id, {
    target: header.destination_id !== 'hermes' ? header.destination_id : undefined,
    id: header.packet_id,
    timestamp: new Date(header.timestamp).getTime(),
  });

  // Carry over correlation_id in the payload metadata
  if (header.correlation_id) {
    event.payload = { ...event.payload, _correlationId: header.correlation_id };
  }

  // Stamp that this passed through the CNS bridge
  return stamp(event, 'cns-bridge');
}

/**
 * Convert a FleetEvent back into a USCP packet.
 * Useful when an event from another system needs to travel the CNS bus.
 */
export function toCNS(event: FleetEvent): USCPPacket {
  // Extract USCP intent from the dotted FleetEvent intent
  const uscpIntent = event.intent.startsWith('cns.')
    ? event.intent.slice(4)
    : 'query';

  // Extract correlation_id if present in payload
  const { _correlationId, ...body } = event.payload ?? {};

  return {
    header: {
      origin_id: event.source,
      packet_id: event.id,
      intent: uscpIntent,
      priority: tierToPriority(event.tier),
      destination_id: event.target ?? 'hermes',
      timestamp: new Date(event.timestamp).toISOString(),
      version: '1.0',
      correlation_id: _correlationId,
    },
    body,
    // Signature would be added by the CNS bridge transport layer
  };
}
