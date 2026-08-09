import { describe, it, expect } from 'vitest';
import { emit, stamp } from '../src/emitter.js';
import { validateEvent } from '../src/envelope.js';
import type { FleetEvent } from '../src/envelope.js';

describe('emitter', () => {
  it('creates a valid event in one line', () => {
    const event = emit('poker.bet', { actor: 'flash', amount: 50 }, 'cortex');

    expect(event.id).toBeDefined();
    expect(event.source).toBe('system');
    expect(event.intent).toBe('poker.bet');
    expect(event.tier).toBe('cortex');
    expect(event.payload).toEqual({ actor: 'flash', amount: 50 });
    expect(event.timestamp).toBeGreaterThan(0);
    expect(event.provenance).toEqual(['system']);
    expect(event.hops).toBe(0);
  });

  it('defaults to edge tier and system source', () => {
    const event = emit('room.enter', { agent: 'wesley' });

    expect(event.tier).toBe('edge');
    expect(event.source).toBe('system');
  });

  it('accepts custom source and options', () => {
    const event = emit(
      'cns.query',
      { question: 'status?' },
      'cortex',
      'flash',
      { worldId: 'the-tap', roomId: 'bridge', target: 'hermes' },
    );

    expect(event.source).toBe('flash');
    expect(event.target).toBe('hermes');
    expect(event.worldId).toBe('the-tap');
    expect(event.roomId).toBe('bridge');
  });

  it('rejects invalid intents', () => {
    expect(() => emit('invalid', {}, 'edge')).toThrow();
    expect(() => emit('UPPER.CASE', {}, 'edge')).toThrow();
  });

  it('rejects invalid tiers', () => {
    // @ts-expect-error testing runtime validation
    expect(() => emit('test.thing', {}, 'invalid')).toThrow();
  });
});

describe('stamp (provenance chain)', () => {
  it('appends to provenance and increments hops', () => {
    const event = emit('room.enter', { agent: 'flash' }, 'reflex', 'flash');
    expect(event.provenance).toEqual(['flash']);
    expect(event.hops).toBe(0);

    const stamped1 = stamp(event, 'spatial-registry');
    expect(stamped1.provenance).toEqual(['flash', 'spatial-registry']);
    expect(stamped1.hops).toBe(1);

    const stamped2 = stamp(stamped1, 'cns-bridge');
    expect(stamped2.provenance).toEqual(['flash', 'spatial-registry', 'cns-bridge']);
    expect(stamped2.hops).toBe(2);
  });

  it('preserves the original event (immutable)', () => {
    const event = emit('room.enter', {}, 'reflex', 'flash');
    const stamped = stamp(event, 'router');

    expect(event.hops).toBe(0); // Original unchanged
    expect(event.provenance).toEqual(['flash']);
    expect(stamped.hops).toBe(1);
  });
});

describe('validateEvent', () => {
  it('validates a correctly formed event', () => {
    const event = emit('test.thing', {}, 'edge', 'tester');
    expect(validateEvent(event)).toEqual([]);
  });

  it('catches missing fields', () => {
    const errors = validateEvent({ source: 'x' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('id'))).toBe(true);
  });

  it('catches intent format violations', () => {
    const errors = validateEvent({
      id: 'x',
      source: 'x',
      intent: 'no-namespace',
      tier: 'edge',
      payload: {},
      timestamp: 0,
      provenance: ['x'],
      hops: 0,
    });
    expect(errors.some(e => e.includes('Invalid intent'))).toBe(true);
  });

  it('catches provenance/source mismatch', () => {
    const errors = validateEvent({
      id: 'x',
      source: 'flash',
      intent: 'test.thing',
      tier: 'edge',
      payload: {},
      timestamp: 0,
      provenance: ['not-flash'],  // Should be 'flash'
      hops: 0,
    });
    expect(errors.some(e => e.includes('provenance[0]'))).toBe(true);
  });

  it('catches hops/provenance mismatch', () => {
    const errors = validateEvent({
      id: 'x',
      source: 'flash',
      intent: 'test.thing',
      tier: 'edge',
      payload: {},
      timestamp: 0,
      provenance: ['flash', 'router'],
      hops: 0,  // Should be 1
    });
    expect(errors.some(e => e.includes('hops'))).toBe(true);
  });
});
