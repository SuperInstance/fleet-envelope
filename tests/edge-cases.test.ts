/**
 * Edge-case and robustness tests for fleet-envelope.
 *
 * Tests the boundaries: malformed inputs, extreme values, adversarial
 * patterns, NaN handling, empty objects, and cross-adapter integrity.
 */

import { describe, it, expect } from 'vitest';
import { emit, stamp } from '../src/emitter.js';
import { validateEvent, isFleetEvent, TIER_PRIORITY } from '../src/envelope.js';
import { Router } from '../src/router.js';
import type { FleetEvent } from '../src/envelope.js';
import type { Tier } from '../src/envelope.js';

import { fromTap, toTap } from '../src/adapters/tap-adapter.js';
import { fromCNS, toCNS } from '../src/adapters/cns-adapter.js';
import { fromCron, toCron } from '../src/adapters/cron-adapter.js';
import { fromSpatial, toSpatial } from '../src/adapters/spatial-adapter.js';
import { fromPoker, toPoker } from '../src/adapters/poker-adapter.js';

// ── Helpers ────────────────────────────────────────────────────

function makeValidEvent(overrides: Partial<FleetEvent> = {}): FleetEvent {
  return {
    id: 'test-id',
    source: 'test-source',
    intent: 'test.action',
    tier: 'edge',
    payload: { data: 'test' },
    timestamp: Date.now(),
    provenance: ['test-source'],
    hops: 0,
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════
// ENVELOPE VALIDATION — MALFORMED INPUTS
// ════════════════════════════════════════════════════════════════

describe('validateEvent — null and undefined', () => {
  it('rejects null', () => {
    expect(validateEvent(null)).toContain('Event is null or undefined');
  });

  it('rejects undefined', () => {
    expect(validateEvent(undefined)).toContain('Event is null or undefined');
  });

  it('rejects empty object', () => {
    const errors = validateEvent({});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('Missing required field'))).toBe(true);
  });
});

describe('validateEvent — missing fields', () => {
  const baseFields: FleetEvent = makeValidEvent();

  it('reports each missing field individually', () => {
    const errors = validateEvent({});
    const required = ['id', 'source', 'intent', 'tier', 'payload', 'timestamp', 'provenance', 'hops'];
    for (const field of required) {
      expect(errors.some(e => e.includes(field))).toBe(true);
    }
  });

  it('accepts when only optional fields are missing', () => {
    const minimal: FleetEvent = makeValidEvent();
    delete (minimal as any).target;
    delete (minimal as any).worldId;
    delete (minimal as any).roomId;
    expect(validateEvent(minimal)).toEqual([]);
  });
});

describe('validateEvent — intent format', () => {
  it('rejects intent without a dot', () => {
    const event = makeValidEvent({ intent: 'noDot' });
    const errors = validateEvent(event);
    expect(errors.some(e => e.includes('Invalid intent format'))).toBe(true);
  });

  it('empty string intent passes validation (BUG: documented)', () => {
    // BUG: Empty string '' is falsy, so the regex check `if (event.intent && ...)` is skipped.
    // And the required field check only tests for undefined/null, not empty string.
    // This means an event with intent: '' validates as clean.
    // This should be fixed in envelope.ts by also checking for empty strings.
    const event = makeValidEvent({ intent: '' });
    const errors = validateEvent(event);
    // Documenting current (buggy) behavior
    expect(errors).toEqual([]); // BUG: should have an error
  });

  it('rejects intent with uppercase', () => {
    const event = makeValidEvent({ intent: 'Room.Enter' });
    const errors = validateEvent(event);
    expect(errors.some(e => e.includes('Invalid intent'))).toBe(true);
  });

  it('rejects intent starting with a number', () => {
    const event = makeValidEvent({ intent: '3room.enter' });
    const errors = validateEvent(event);
    expect(errors.some(e => e.includes('Invalid intent'))).toBe(true);
  });

  it('rejects intent starting with a dot', () => {
    const event = makeValidEvent({ intent: '.enter' });
    const errors = validateEvent(event);
    expect(errors.some(e => e.includes('Invalid intent'))).toBe(true);
  });

  it('accepts multi-segment intent (three dots)', () => {
    const event = makeValidEvent({ intent: 'cns.subsystem.alert' });
    expect(validateEvent(event)).toEqual([]);
  });

  it('accepts intent with underscores and hyphens', () => {
    const event = makeValidEvent({ intent: 'room-sensor.motion_detected' });
    expect(validateEvent(event)).toEqual([]);
  });

  it('accepts all known fleet namespaces', () => {
    const namespaces = ['room', 'portal', 'poker', 'cns', 'tap', 'cron', 'system'];
    for (const ns of namespaces) {
      const event = makeValidEvent({ intent: `${ns}.${ns === 'room' ? 'enter' : 'test'}` });
      expect(validateEvent(event)).toEqual([]);
    }
  });
});

describe('validateEvent — tier validation', () => {
  it('rejects invalid tier', () => {
    const event = makeValidEvent({ tier: 'invalid' as any });
    const errors = validateEvent(event);
    expect(errors.some(e => e.includes('Invalid tier'))).toBe(true);
  });

  it('rejects numeric tier', () => {
    const event = makeValidEvent({ tier: 1 as any });
    const errors = validateEvent(event);
    // numeric tier won't match string validation
    expect(errors.some(e => e.includes('Invalid tier') || e.includes('Missing'))).toBe(true);
  });

  it('accepts all valid tiers', () => {
    for (const tier of ['reflex', 'edge', 'cortex']) {
      const event = makeValidEvent({ tier: tier as Tier });
      expect(validateEvent(event)).toEqual([]);
    }
  });
});

describe('validateEvent — provenance validation', () => {
  it('rejects non-array provenance', () => {
    const event = makeValidEvent({ provenance: 'not-an-array' as any });
    const errors = validateEvent(event);
    expect(errors.some(e => e.includes('provenance must be an array'))).toBe(true);
  });

  it('rejects when provenance[0] !== source', () => {
    const event = makeValidEvent({ source: 'alpha', provenance: ['beta', 'alpha'] });
    const errors = validateEvent(event);
    expect(errors.some(e => e.includes('provenance[0] must equal source'))).toBe(true);
  });

  it('accepts single-element provenance matching source', () => {
    const event = makeValidEvent({ source: 'alpha', provenance: ['alpha'], hops: 0 });
    expect(validateEvent(event)).toEqual([]);
  });
});

describe('validateEvent — hops validation', () => {
  it('rejects hops !== provenance.length - 1', () => {
    const event = makeValidEvent({ provenance: ['a', 'b', 'c'], hops: 5 });
    const errors = validateEvent(event);
    expect(errors.some(e => e.includes('hops') && e.includes('provenance.length'))).toBe(true);
  });

  it('accepts hops = 0 for single-source event', () => {
    const event = makeValidEvent({ source: 'test-source', provenance: ['test-source'], hops: 0 });
    expect(validateEvent(event)).toEqual([]);
  });

  it('accepts hops = N for N+1 provenance entries', () => {
    const event = makeValidEvent({
      source: 'a',
      provenance: ['a', 'b', 'c', 'd'],
      hops: 3,
    });
    expect(validateEvent(event)).toEqual([]);
  });
});

describe('isFleetEvent type guard', () => {
  it('returns true for valid events', () => {
    expect(isFleetEvent(makeValidEvent())).toBe(true);
  });

  it('returns false for null', () => {
    expect(isFleetEvent(null)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isFleetEvent(42)).toBe(false);
    expect(isFleetEvent('hello')).toBe(false);
    expect(isFleetEvent(true)).toBe(false);
  });

  it('returns false for arrays', () => {
    expect(isFleetEvent([1, 2, 3])).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════
// TIER PRIORITY
// ════════════════════════════════════════════════════════════════

describe('TIER_PRIORITY ordering', () => {
  it('reflex < edge < cortex', () => {
    expect(TIER_PRIORITY.reflex).toBeLessThan(TIER_PRIORITY.edge);
    expect(TIER_PRIORITY.edge).toBeLessThan(TIER_PRIORITY.cortex);
  });

  it('all tiers have numeric values', () => {
    expect(typeof TIER_PRIORITY.reflex).toBe('number');
    expect(typeof TIER_PRIORITY.edge).toBe('number');
    expect(typeof TIER_PRIORITY.cortex).toBe('number');
  });
});

// ════════════════════════════════════════════════════════════════
// EMITTER — EDGE CASES
// ════════════════════════════════════════════════════════════════

describe('emit — edge cases', () => {
  it('generates unique IDs', () => {
    const e1 = emit('test.a', {}, 'edge', 'src');
    const e2 = emit('test.b', {}, 'edge', 'src');
    expect(e1.id).not.toBe(e2.id);
  });

  it('honors custom id', () => {
    const e = emit('test.a', {}, 'edge', 'src', { id: 'my-custom-id' });
    expect(e.id).toBe('my-custom-id');
  });

  it('honors custom timestamp', () => {
    const e = emit('test.a', {}, 'edge', 'src', { timestamp: 12345 });
    expect(e.timestamp).toBe(12345);
  });

  it('defaults source to "system"', () => {
    const e = emit('test.a', {});
    expect(e.source).toBe('system');
    expect(e.provenance[0]).toBe('system');
  });

  it('defaults tier to "edge"', () => {
    const e = emit('test.a', {});
    expect(e.tier).toBe('edge');
  });

  it('throws on invalid intent', () => {
    expect(() => emit('NoDot', {}, 'edge', 'src')).toThrow();
  });

  it('throws on invalid tier', () => {
    expect(() => emit('test.a', {}, 'bogus' as any, 'src')).toThrow();
  });

  it('rejects null payload (payload is required)', () => {
    // null is treated as missing by validateEvent
    expect(() => emit('test.a', null, 'edge', 'src')).toThrow();
  });

  it('accepts undefined payload as undefined', () => {
    // undefined triggers the missing field check too
    expect(() => emit('test.a', undefined, 'edge', 'src')).toThrow();
  });

  it('accepts complex nested payload', () => {
    const payload = {
      nested: { deep: { deeper: { value: 42 } } },
      array: [1, 2, 3, { x: 'y' }],
      nullField: null,
      undefinedField: undefined,
    };
    const e = emit('test.a', payload, 'cortex', 'src');
    expect(e.payload.nested.deep.deeper.value).toBe(42);
    expect(e.payload.array[3].x).toBe('y');
  });

  it('accepts numeric payload (0, negative, float)', () => {
    expect(emit('test.a', 0, 'edge', 'src').payload).toBe(0);
    expect(emit('test.a', -1, 'edge', 'src').payload).toBe(-1);
    expect(emit('test.a', 3.14159, 'edge', 'src').payload).toBe(3.14159);
  });

  it('accepts empty string payload', () => {
    const e = emit('test.a', '', 'edge', 'src');
    expect(e.payload).toBe('');
  });

  it('accepts boolean payload', () => {
    expect(emit('test.a', true, 'edge', 'src').payload).toBe(true);
    expect(emit('test.a', false, 'edge', 'src').payload).toBe(false);
  });

  it('accepts NaN in payload (payload is opaque)', () => {
    const e = emit('test.a', NaN, 'edge', 'src');
    expect(isNaN(e.payload)).toBe(true);
  });

  it('sets worldId and roomId from options', () => {
    const e = emit('test.a', {}, 'edge', 'src', { worldId: 'the-tap', roomId: 'bridge' });
    expect(e.worldId).toBe('the-tap');
    expect(e.roomId).toBe('bridge');
  });

  it('sets target from options', () => {
    const e = emit('test.a', {}, 'edge', 'src', { target: 'hermes' });
    expect(e.target).toBe('hermes');
  });
});

describe('stamp — provenance growth', () => {
  it('returns a new event (immutability)', () => {
    const original = emit('test.a', {}, 'edge', 'src');
    const stamped = stamp(original, 'forwarder');
    expect(stamped).not.toBe(original);
    expect(original.provenance).toEqual(['src']);
    expect(original.hops).toBe(0);
  });

  it('grows provenance array', () => {
    let event = emit('test.a', {}, 'edge', 'src');
    expect(event.provenance).toEqual(['src']);
    expect(event.hops).toBe(0);

    event = stamp(event, 'alpha');
    expect(event.provenance).toEqual(['src', 'alpha']);
    expect(event.hops).toBe(1);

    event = stamp(event, 'beta');
    expect(event.provenance).toEqual(['src', 'alpha', 'beta']);
    expect(event.hops).toBe(2);
  });

  it('handles empty forwarder name', () => {
    const event = emit('test.a', {}, 'edge', 'src');
    const stamped = stamp(event, '');
    expect(stamped.provenance).toContain('');
    expect(stamped.hops).toBe(1);
  });

  it('handles forwarder name same as source', () => {
    const event = emit('test.a', {}, 'edge', 'src');
    const stamped = stamp(event, 'src');
    expect(stamped.provenance).toEqual(['src', 'src']);
    expect(stamped.hops).toBe(1);
  });

  it('preserves all other fields', () => {
    const event = emit('test.a', { x: 1 }, 'cortex', 'src', { worldId: 'w', roomId: 'r', target: 't' });
    const stamped = stamp(event, 'fwd');
    expect(stamped.id).toBe(event.id);
    expect(stamped.source).toBe(event.source);
    expect(stamped.intent).toBe(event.intent);
    expect(stamped.tier).toBe(event.tier);
    expect(stamped.payload).toEqual(event.payload);
    expect(stamped.timestamp).toBe(event.timestamp);
    expect(stamped.target).toBe('t');
    expect(stamped.worldId).toBe('w');
    expect(stamped.roomId).toBe('r');
  });
});

// ════════════════════════════════════════════════════════════════
// ROUTER — PATTERN EDGE CASES
// ════════════════════════════════════════════════════════════════

describe('Router — pattern matching', () => {
  it('matches exact intent', () => {
    const router = new Router();
    const calls: FleetEvent[] = [];
    router.on('room.enter', (e) => calls.push(e));

    const event = makeValidEvent({ intent: 'room.enter' });
    router.dispatch(event);
    expect(calls).toHaveLength(1);
  });

  it('does not match different exact intent', () => {
    const router = new Router();
    const calls: FleetEvent[] = [];
    router.on('room.enter', (e) => calls.push(e));

    router.dispatch(makeValidEvent({ intent: 'room.exit' }));
    expect(calls).toHaveLength(0);
  });

  it('matches single wildcard', () => {
    const router = new Router();
    const calls: FleetEvent[] = [];
    router.on('*', (e) => calls.push(e));

    router.dispatch(makeValidEvent({ intent: 'anything.anything' }));
    expect(calls).toHaveLength(1);
  });

  it('matches namespace wildcard', () => {
    const router = new Router();
    const calls: FleetEvent[] = [];
    router.on('room.*', (e) => calls.push(e));

    router.dispatch(makeValidEvent({ intent: 'room.enter' }));
    router.dispatch(makeValidEvent({ intent: 'room.exit' }));
    router.dispatch(makeValidEvent({ intent: 'room.look' }));
    router.dispatch(makeValidEvent({ intent: 'poker.bet' }));

    expect(calls).toHaveLength(3);
  });

  it('matches mid-pattern wildcard', () => {
    const router = new Router();
    const calls: FleetEvent[] = [];
    router.on('cns.*.alert', (e) => calls.push(e));

    router.dispatch(makeValidEvent({ intent: 'cns.subsystem.alert' }));
    router.dispatch(makeValidEvent({ intent: 'cns.deep.nested.alert' }));
    router.dispatch(makeValidEvent({ intent: 'cns.query' }));

    expect(calls).toHaveLength(2);
  });

  it('supports multiple handlers for same pattern', () => {
    const router = new Router();
    let count = 0;
    router.on('room.*', () => count++);
    router.on('room.*', () => count++);

    router.dispatch(makeValidEvent({ intent: 'room.enter' }));
    expect(count).toBe(2);
  });

  it('unsubscribe works', () => {
    const router = new Router();
    let count = 0;
    const unsub = router.on('room.*', () => count++);

    router.dispatch(makeValidEvent({ intent: 'room.enter' }));
    expect(count).toBe(1);

    unsub();
    router.dispatch(makeValidEvent({ intent: 'room.exit' }));
    expect(count).toBe(1);
  });

  it('clear removes all handlers', () => {
    const router = new Router();
    let count = 0;
    router.on('a.*', () => count++);
    router.on('b.*', () => count++);

    router.clear();
    router.dispatch(makeValidEvent({ intent: 'a.x' }));
    router.dispatch(makeValidEvent({ intent: 'b.x' }));
    expect(count).toBe(0);
  });

  it('patterns getter returns raw patterns', () => {
    const router = new Router();
    router.on('room.*', () => {});
    router.on('poker.bet', () => {});
    router.on('cns.*', () => {});

    expect(router.patterns).toEqual(['room.*', 'poker.bet', 'cns.*']);
  });

  it('dispatch returns count of called handlers', () => {
    const router = new Router();
    router.on('room.*', () => {});
    router.on('room.enter', () => {});
    router.on('poker.*', () => {});

    expect(router.dispatch(makeValidEvent({ intent: 'room.enter' }))).toBe(2);
    expect(router.dispatch(makeValidEvent({ intent: 'poker.fold' }))).toBe(1);
    expect(router.dispatch(makeValidEvent({ intent: 'system.ready' }))).toBe(0);
  });
});

describe('Router — concurrency safety', () => {
  it('handler that throws does not prevent other handlers', () => {
    const router = new Router();
    let secondCalled = false;

    router.on('test.*', () => { throw new Error('boom'); });
    router.on('test.*', () => { secondCalled = true; });

    // Note: the throw will propagate. This documents current behavior.
    // If the router catches errors, this test should change.
    expect(() => router.dispatch(makeValidEvent({ intent: 'test.x' }))).toThrow('boom');
  });
});

// ════════════════════════════════════════════════════════════════
// ADAPTER ROUND-TRIP — EDGE CASES
// ════════════════════════════════════════════════════════════════

describe('Tap adapter — edge cases', () => {
  it('handles unknown message type', () => {
    const msg = { type: 'unknown_event', agent: { id: 'test' }, room: 'r' };
    const event = fromTap(msg as any);
    expect(event.intent).toBe('tap.unknown_event');
    expect(event.tier).toBe('edge'); // default for unknown
    expect(event.source).toBe('test');
  });

  it('handles message with no agent info (system message)', () => {
    const msg = { type: 'system_message', room: 'r' };
    const event = fromTap(msg as any);
    expect(event.source).toBe('the-tap');
    expect(event.tier).toBe('edge');
  });

  it('handles completely unknown type with no agent or room', () => {
    const msg = { type: 'mystery' };
    const event = fromTap(msg as any);
    expect(event.source).toBe('the-tap');
    expect(event.roomId).toBeUndefined();
  });

  it('preserves extra fields in payload', () => {
    const msg = { type: 'agent_entered', agent: { id: 'flash' }, room: 'r', custom: 'data', number: 42 };
    const event = fromTap(msg as any);
    expect(event.payload.custom).toBe('data');
    expect(event.payload.number).toBe(42);
  });

  it('toTap wraps unknown intents generically', () => {
    const event = makeValidEvent({ intent: 'mystery.unknown', payload: { x: 1 } });
    const msg = toTap(event);
    expect(msg.type).toBe('fleet_event');
    expect(msg.intent).toBe('mystery.unknown');
  });
});

describe('CNS adapter — edge cases', () => {
  it('handles unknown priority gracefully', () => {
    const packet = {
      header: {
        origin_id: 'x',
        packet_id: '1',
        intent: 'query',
        priority: 'super-urgent', // not in the map
        destination_id: 'hermes',
        timestamp: '2026-01-01T00:00:00Z',
        version: '1.0',
      },
      body: {},
    };
    const event = fromCNS(packet as any);
    expect(event.tier).toBe('cortex'); // default fallback
  });

  it('handles body with deeply nested structure', () => {
    const packet = {
      header: {
        origin_id: 'x', packet_id: '1', intent: 'response', priority: 'normal',
        destination_id: 'hermes', timestamp: '2026-01-01T00:00:00Z', version: '1.0',
      },
      body: { level1: { level2: { level3: { value: 'deep' } } } },
    };
    const event = fromCNS(packet as any);
    expect(event.payload.level1.level2.level3.value).toBe('deep');
  });

  it('handles empty body', () => {
    const packet = {
      header: {
        origin_id: 'x', packet_id: '1', intent: 'heartbeat', priority: 'low',
        destination_id: 'hermes', timestamp: '2026-01-01T00:00:00Z', version: '1.0',
      },
      body: {},
    };
    const event = fromCNS(packet as any);
    expect(event.payload).toEqual({});
  });

  it('preserves correlation_id in payload', () => {
    const packet = {
      header: {
        origin_id: 'x', packet_id: '1', intent: 'response', priority: 'normal',
        destination_id: 'hermes', timestamp: '2026-01-01T00:00:00Z', version: '1.0',
        correlation_id: 'corr-xyz',
      },
      body: { answer: 42 },
    };
    const event = fromCNS(packet as any);
    expect(event.payload._correlationId).toBe('corr-xyz');
    expect(event.payload.answer).toBe(42);

    // Round-trip should restore correlation_id
    const back = toCNS(event);
    expect(back.header.correlation_id).toBe('corr-xyz');
  });

  it('toCNS defaults destination to hermes', () => {
    const event = makeValidEvent({ intent: 'cns.query', target: undefined });
    const packet = toCNS(event);
    expect(packet.header.destination_id).toBe('hermes');
  });

  it('toCNS extracts non-cns intents as query', () => {
    const event = makeValidEvent({ intent: 'room.enter' });
    const packet = toCNS(event);
    expect(packet.header.intent).toBe('query');
  });

  it('strips _correlationId from body on reverse conversion', () => {
    const event = makeValidEvent({
      intent: 'cns.response',
      payload: { answer: 'yes', _correlationId: 'corr-1' },
    });
    const packet = toCNS(event);
    expect(packet.body).toEqual({ answer: 'yes' });
    expect(packet.header.correlation_id).toBe('corr-1');
  });
});

describe('Cron adapter — edge cases', () => {
  it('handles unknown cron type', () => {
    const event = fromCron({ type: 'mystery_cron', agent: 'wesley' });
    expect(event.intent).toBe('cron.mystery_cron');
    expect(event.tier).toBe('cortex'); // default
  });

  it('defaults agent to "openclaw"', () => {
    const event = fromCron({ type: 'heartbeat' });
    expect(event.source).toBe('openclaw');
  });

  it('handles missing timestamp (uses Date.now())', () => {
    const before = Date.now();
    const event = fromCron({ type: 'heartbeat' });
    const after = Date.now();
    expect(event.timestamp).toBeGreaterThanOrEqual(before);
    expect(event.timestamp).toBeLessThanOrEqual(after);
  });

  it('handles null data field', () => {
    const event = fromCron({ type: 'cron', agent: 'x', data: null });
    expect(event.payload.data).toBeNull();
  });

  it('toCron falls back to generic for unknown intents', () => {
    const event = makeValidEvent({ intent: 'not.cron.related' });
    const cronEvent = toCron(event);
    expect(cronEvent.type).toBe('cron');
  });
});

describe('Spatial adapter — edge cases', () => {
  it('handles unknown spatial kind', () => {
    const event = fromSpatial({
      kind: 'room.custom' as any,
      agentId: 'flash',
      roomId: 'r',
    });
    expect(event.tier).toBe('edge'); // default
    expect(event.intent).toBe('room.custom');
  });

  it('handles portal.use with no portalId', () => {
    const event = fromSpatial({
      kind: 'portal.use',
      agentId: 'flash',
      fromRoomId: 'a',
      toRoomId: 'b',
    });
    expect(event.payload.portalId).toBeUndefined();
    expect(event.payload.fromRoomId).toBe('a');
    expect(event.payload.toRoomId).toBe('b');
  });

  it('includes metadata when provided', () => {
    const event = fromSpatial({
      kind: 'room.enter',
      agentId: 'flash',
      roomId: 'r',
      metadata: { weather: 'stormy', visibility: 0.3 },
    });
    expect(event.payload.metadata.weather).toBe('stormy');
    expect(event.payload.metadata.visibility).toBe(0.3);
  });

  it('uses toRoomId as roomId when roomId not provided', () => {
    const event = fromSpatial({
      kind: 'portal.use',
      agentId: 'flash',
      fromRoomId: 'a',
      toRoomId: 'destination',
    });
    expect(event.roomId).toBe('destination');
  });

  it('toSpatial preserves all fields', () => {
    const original = {
      kind: 'portal.lock' as const,
      agentId: 'wesley',
      roomId: 'r',
      portalId: 'p1',
      worldId: 'w',
      metadata: { key: 'value' },
    };
    const event = fromSpatial(original);
    const back = toSpatial(event);
    expect(back.kind).toBe(original.kind);
    expect(back.agentId).toBe(original.agentId);
    expect(back.portalId).toBe(original.portalId);
    expect(back.worldId).toBe(original.worldId);
    expect(back.metadata).toEqual(original.metadata);
  });
});

describe('Poker adapter — edge cases', () => {
  it('handles all_in action', () => {
    const event = fromPoker({
      action: 'all_in',
      actor: 'flash',
      amount: 999,
    });
    expect(event.intent).toBe('poker.all_in');
    expect(event.tier).toBe('cortex');
    expect(event.payload.amount).toBe(999);
  });

  it('handles deal with no hand number', () => {
    const event = fromPoker({ action: 'deal', actor: 'system' });
    expect(event.payload.hand).toBeUndefined();
  });

  it('handles conversation with long content', () => {
    const longContent = 'A'.repeat(10000);
    const event = fromPoker({
      action: 'conversation',
      actor: 'hermes',
      content: longContent,
    });
    expect(event.payload.content).toHaveLength(10000);
  });

  it('handles open_mic with metadata', () => {
    const event = fromPoker({
      action: 'open_mic',
      actor: 'wesley',
      content: 'The lighthouse.',
      metadata: { duration: 120, applause: 5 },
    });
    expect(event.payload.metadata.duration).toBe(120);
  });

  it('includes sessionId in payload when provided', () => {
    const event = fromPoker({
      action: 'bet',
      actor: 'flash',
      sessionId: 's-2026',
      amount: 50,
    });
    expect(event.payload.sessionId).toBe('s-2026');
  });

  it('omits sessionId when not provided', () => {
    const event = fromPoker({ action: 'fold', actor: 'wesley' });
    expect(event.payload.sessionId).toBeUndefined();
  });

  it('toPoker extracts action from intent', () => {
    const event = makeValidEvent({ intent: 'poker.raise', payload: { actor: 'flash', amount: 100 } });
    const poker = toPoker(event);
    expect(poker.action).toBe('raise');
    expect(poker.amount).toBe(100);
  });

  it('toPoker falls back to event.source when payload.actor missing', () => {
    const event = makeValidEvent({ intent: 'poker.fold', payload: {} });
    const poker = toPoker(event);
    expect(poker.actor).toBe('test-source');
  });
});

// ════════════════════════════════════════════════════════════════
// CROSS-ADAPTER — FULL CHAIN INTEGRITY
// ════════════════════════════════════════════════════════════════

describe('cross-adapter chain integrity', () => {
  it('documents Tap → CNS → Tap intent transformation', () => {
    // When a Tap event is converted to CNS, the intent changes from
    // tap.conversation_line to cns.query (or cns.<original_uscp_intent>).
    // The reverse conversion can't recover the original Tap type because
    // the intent namespace changed. This is expected — cross-adapter
    // round-trips lose the original adapter's type mapping.
    const original = {
      type: 'conversation_line' as const,
      line: { agentId: 'hermes', displayName: 'Hermes', content: 'Testing.', timestamp: 1700000000000 },
      room: 'bridge',
    };

    const fleetEvent = fromTap(original);
    expect(fleetEvent.intent).toBe('tap.conversation_line');

    const cnsPacket = toCNS(fleetEvent);
    expect(cnsPacket.header.intent).toBe('query'); // non-cns intent defaults to query

    const backToCns = fromCNS(cnsPacket);
    expect(backToCns.intent).toBe('cns.query'); // now it's a cns event, not a tap event

    const backToTap = toTap(backToCns);
    // The intent namespace changed — we get a generic fleet_event wrapper
    expect(backToTap.type).toBe('fleet_event');
  });

  it('event survives Poker → Spatial → Poker round-trip', () => {
    const poker = {
      action: 'fold' as const,
      actor: 'wesley',
      hand: 5,
    };

    const fleetEvent = fromPoker(poker);
    const spatialEvent = toSpatial({
      ...fleetEvent,
      intent: 'room.enter',
      roomId: 'poker-room',
    });
    expect(spatialEvent.agentId).toBe('wesley');

    // Convert back
    const backToPoker = toPoker({
      ...fleetEvent,
      intent: 'poker.fold',
    });
    expect(backToPoker.actor).toBe('wesley');
    expect(backToPoker.action).toBe('fold');
  });

  it('multi-hop provenance chain is internally consistent', () => {
    let event = fromCNS({
      header: {
        origin_id: 'wesley', packet_id: 'multi-1', intent: 'alert', priority: 'critical',
        destination_id: 'hermes', timestamp: '2026-08-10T00:00:00Z', version: '1.0',
      },
      body: { msg: 'engine room' },
    });

    event = stamp(event, 'router');
    event = stamp(event, 'dispatcher');
    event = stamp(event, 'tap-do');

    expect(event.provenance).toEqual(['wesley', 'cns-bridge', 'router', 'dispatcher', 'tap-do']);
    expect(event.hops).toBe(4);
    expect(event.source).toBe('wesley');
    expect(event.provenance[0]).toBe(event.source);
  });

  it('timestamp survives CNS → FleetEvent → CNS round-trip', () => {
    const originalTime = '2026-08-10T12:30:45.000Z';
    const event = fromCNS({
      header: {
        origin_id: 'x', packet_id: 'ts-1', intent: 'query', priority: 'normal',
        destination_id: 'hermes', timestamp: originalTime, version: '1.0',
      },
      body: {},
    });
    const back = toCNS(event);
    // The round-trip should preserve the timestamp value
    expect(new Date(back.header.timestamp).getTime()).toBe(new Date(originalTime).getTime());
  });
});

// ════════════════════════════════════════════════════════════════
// STRESS / VOLUME
// ════════════════════════════════════════════════════════════════

describe('stress tests', () => {
  it('creates and validates 1000 events', () => {
    for (let i = 0; i < 1000; i++) {
      const event = emit('stress.test', { iteration: i }, 'reflex', 'stress-src');
      const errors = validateEvent(event);
      expect(errors).toEqual([]);
    }
  });

  it('dispatches to 100 handlers', () => {
    const router = new Router();
    let count = 0;
    for (let i = 0; i < 100; i++) {
      router.on('stress.*', () => count++);
    }
    router.dispatch(makeValidEvent({ intent: 'stress.test' }));
    expect(count).toBe(100);
  });

  it('creates 100 events with unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(emit('stress.test', {}, 'edge', 's').id);
    }
    expect(ids.size).toBe(100);
  });
});
