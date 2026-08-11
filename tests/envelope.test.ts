import { describe, it, expect } from 'vitest';
import {
  validateEvent,
  isFleetEvent,
  TIER_PRIORITY,
  type FleetEvent,
  type Tier,
} from '../src/envelope.js';

// ── Helpers ──────────────────────────────────────────────────

function validEvent(overrides: Partial<FleetEvent> = {}): FleetEvent {
  return {
    id: 'evt-001',
    source: 'test-agent',
    intent: 'room.enter',
    tier: 'edge',
    payload: { agentId: 'flash', roomId: 'bar-rail' },
    timestamp: Date.now(),
    provenance: ['test-agent'],
    hops: 0,
    ...overrides,
  };
}

// ── validateEvent ────────────────────────────────────────────

describe('validateEvent', () => {
  describe('valid events', () => {
    it('accepts a minimal valid event', () => {
      expect(validateEvent(validEvent())).toEqual([]);
    });

    it('accepts event with optional fields (worldId, roomId, target)', () => {
      const event = validEvent({
        worldId: 'the-tap',
        roomId: 'bar-rail',
        target: 'barnacle',
      });
      expect(validateEvent(event)).toEqual([]);
    });

    it('accepts all three tier values', () => {
      for (const tier of ['reflex', 'edge', 'cortex'] as Tier[]) {
        expect(validateEvent(validEvent({ tier }))).toEqual([]);
      }
    });

    it('accepts events with complex payloads', () => {
      const event = validEvent({
        payload: { nested: { deep: [1, 2, { x: 'y' }] } },
      });
      expect(validateEvent(event)).toEqual([]);
    });

    it('accepts multi-hop events', () => {
      const event = validEvent({
        source: 'agent-a',
        provenance: ['agent-a', 'router-1', 'router-2'],
        hops: 2,
      });
      expect(validateEvent(event)).toEqual([]);
    });
  });

  describe('missing required fields', () => {
    for (const field of ['id', 'source', 'intent', 'tier', 'payload', 'timestamp', 'provenance', 'hops']) {
      it(`rejects missing ${field}`, () => {
        const event = validEvent();
        delete (event as any)[field];
        const errors = validateEvent(event);
        expect(errors.some(e => e.includes(`Missing required field: ${field}`))).toBe(true);
      });
    }

    it('rejects null values for required fields', () => {
      const event = validEvent({ id: null as any });
      expect(validateEvent(event).length).toBeGreaterThan(0);
    });

    it('reports multiple missing fields at once', () => {
      const errors = validateEvent({});
      expect(errors.length).toBe(8); // all 8 required fields
    });
  });

  describe('intent validation', () => {
    it('rejects intent without a dot', () => {
      const errors = validateEvent(validEvent({ intent: 'nostdot' }));
      expect(errors.some(e => e.includes('Invalid intent format'))).toBe(true);
    });

    it('rejects intent with uppercase', () => {
      const errors = validateEvent(validEvent({ intent: 'Room.Enter' }));
      expect(errors.some(e => e.includes('Invalid intent format'))).toBe(true);
    });

    it('accepts standard namespace.action intents', () => {
      const intents = [
        'room.enter', 'room.exit', 'room.look',
        'portal.use', 'portal.lock',
        'poker.bet', 'poker.fold', 'poker.raise',
        'cns.packet', 'cns.alert', 'cns.heartbeat',
        'tap.broadcast', 'tap.agent_entered',
        'cron.tick', 'cron.session_start',
        'system.ready', 'system.error',
      ];
      for (const intent of intents) {
        expect(validateEvent(validEvent({ intent }))).toEqual([]);
      }
    });

    it('accepts deeply nested intents', () => {
      expect(validateEvent(validEvent({ intent: 'cns.alert.critical.escalation' }))).toEqual([]);
    });

    it('accepts intents with numbers and underscores', () => {
      expect(validateEvent(validEvent({ intent: 'room2.enter_main' }))).toEqual([]);
    });

    it('rejects intent starting with a number', () => {
      const errors = validateEvent(validEvent({ intent: '2room.enter' }));
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects intent starting with a dot', () => {
      const errors = validateEvent(validEvent({ intent: '.enter' }));
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('tier validation', () => {
    it('rejects invalid tier', () => {
      const errors = validateEvent(validEvent({ tier: 'invalid' as any }));
      expect(errors.some(e => e.includes('Invalid tier'))).toBe(true);
    });

    it('rejects undefined tier', () => {
      const event = validEvent();
      delete (event as any).tier;
      const errors = validateEvent(event);
      expect(errors.some(e => e.includes('tier') || e.includes('Missing'))).toBe(true);
    });
  });

  describe('provenance validation', () => {
    it('rejects non-array provenance', () => {
      const errors = validateEvent(validEvent({ provenance: 'not-an-array' as any }));
      expect(errors.some(e => e.includes('provenance must be an array'))).toBe(true);
    });

    it('rejects provenance[0] != source', () => {
      const errors = validateEvent(validEvent({
        source: 'agent-a',
        provenance: ['agent-b'],
      }));
      expect(errors.some(e => e.includes('provenance[0] must equal source'))).toBe(true);
    });

    it('accepts provenance[0] == source', () => {
      expect(validateEvent(validEvent({
        source: 'agent-a',
        provenance: ['agent-a'],
      }))).toEqual([]);
    });
  });

  describe('hops validation', () => {
    it('rejects hops != provenance.length - 1', () => {
      const errors = validateEvent(validEvent({
        provenance: ['agent-a', 'router-1'],
        hops: 5,
      }));
      expect(errors.some(e => e.includes('hops') && e.includes('provenance.length'))).toBe(true);
    });

    it('accepts hops = 0 for single-element provenance', () => {
      expect(validateEvent(validEvent({
        source: 'test-agent',
        provenance: ['test-agent'],
        hops: 0,
      }))).toEqual([]);
    });

    it('accepts hops = N for N+1 element provenance', () => {
      expect(validateEvent(validEvent({
        source: 'a',
        provenance: ['a', 'b', 'c', 'd'],
        hops: 3,
      }))).toEqual([]);
    });
  });
});

// ── isFleetEvent type guard ──────────────────────────────────

describe('isFleetEvent', () => {
  it('returns true for valid events', () => {
    expect(isFleetEvent(validEvent())).toBe(true);
  });

  it('returns false for invalid events', () => {
    expect(isFleetEvent({})).toBe(false);
  });

  it('returns false for null', () => {
    expect(isFleetEvent(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isFleetEvent(undefined)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isFleetEvent(42)).toBe(false);
    expect(isFleetEvent('hello')).toBe(false);
    expect(isFleetEvent(true)).toBe(false);
  });

  it('returns false for arrays', () => {
    expect(isFleetEvent([1, 2, 3])).toBe(false);
  });

  it('returns false for partial objects', () => {
    expect(isFleetEvent({ id: 'x' })).toBe(false);
  });

  it('returns true even with extra fields', () => {
    const event = validEvent({ extraField: 'hello' } as any);
    // validateEvent doesn't check for extra fields, only missing/invalid ones
    expect(isFleetEvent(event)).toBe(true);
  });
});

// ── TIER_PRIORITY ────────────────────────────────────────────

describe('TIER_PRIORITY', () => {
  it('has reflex < edge < cortex', () => {
    expect(TIER_PRIORITY.reflex).toBeLessThan(TIER_PRIORITY.edge);
    expect(TIER_PRIORITY.edge).toBeLessThan(TIER_PRIORITY.cortex);
  });

  it('reflex is 0', () => {
    expect(TIER_PRIORITY.reflex).toBe(0);
  });

  it('edge is 1', () => {
    expect(TIER_PRIORITY.edge).toBe(1);
  });

  it('cortex is 2', () => {
    expect(TIER_PRIORITY.cortex).toBe(2);
  });

  it('has exactly three tiers', () => {
    expect(Object.keys(TIER_PRIORITY).length).toBe(3);
  });
});

// ── Edge cases ───────────────────────────────────────────────

describe('edge cases', () => {
  it('handles empty payload object', () => {
    expect(validateEvent(validEvent({ payload: {} }))).toEqual([]);
  });

  it('handles null payload', () => {
    // null payload is rejected as missing
    const errors = validateEvent(validEvent({ payload: null as any }));
    expect(errors.some(e => e.includes('payload'))).toBe(true);
  });

  it('handles zero timestamp', () => {
    expect(validateEvent(validEvent({ timestamp: 0 }))).toEqual([]);
  });

  it('handles very large timestamps', () => {
    expect(validateEvent(validEvent({ timestamp: Number.MAX_SAFE_INTEGER }))).toEqual([]);
  });

  it('handles empty id string', () => {
    // Empty string is not undefined/null, so it passes validation
    expect(validateEvent(validEvent({ id: '' }))).toEqual([]);
  });

  it('handles provenance with empty strings', () => {
    expect(validateEvent(validEvent({
      source: '',
      provenance: [''],
    }))).toEqual([]);
  });
});
