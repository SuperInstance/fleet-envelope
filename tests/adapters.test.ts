import { describe, it, expect } from 'vitest';
import { emit, stamp } from '../src/emitter.js';
import { validateEvent } from '../src/envelope.js';
import type { FleetEvent } from '../src/envelope.js';

// Import all adapters
import { fromTap, toTap } from '../src/adapters/tap-adapter.js';
import { fromCNS, toCNS } from '../src/adapters/cns-adapter.js';
import { fromCron, toCron } from '../src/adapters/cron-adapter.js';
import { fromSpatial, toSpatial } from '../src/adapters/spatial-adapter.js';
import { fromPoker, toPoker } from '../src/adapters/poker-adapter.js';

import type { TapMessage } from '../src/adapters/tap-adapter.js';
import type { USCPPacket } from '../src/adapters/cns-adapter.js';
import type { CronEvent } from '../src/adapters/cron-adapter.js';
import type { SpatialEvent } from '../src/adapters/spatial-adapter.js';
import type { PokerEvent } from '../src/adapters/poker-adapter.js';

// ── Helper: assert a valid FleetEvent ──────────────────────────
function expectValidEvent(event: FleetEvent) {
  const errors = validateEvent(event);
  expect(errors, errors.join('; ')).toEqual([]);
}

// ── Helper: round-trip assertion ───────────────────────────────
function expectRoundTrip<T>(
  input: T,
  toFleet: (t: T) => FleetEvent,
  fromFleet: (e: FleetEvent) => T,
  keyFields: (input: T) => Record<string, any>,
) {
  const event = toFleet(input);
  expectValidEvent(event);
  const output = fromFleet(event);
  expect(keyFields(output)).toEqual(keyFields(input));
  return event;
}

// ════════════════════════════════════════════════════════════════
// TAP ADAPTER
// ════════════════════════════════════════════════════════════════
describe('Tap adapter', () => {
  it('converts agent_entered to a valid FleetEvent', () => {
    const msg: TapMessage = {
      type: 'agent_entered',
      agent: { id: 'flash', name: 'Flash' },
      room: 'bar-rail',
    };

    const event = fromTap(msg);
    expectValidEvent(event);
    expect(event.intent).toBe('tap.agent_entered');
    expect(event.tier).toBe('reflex');
    expect(event.source).toBe('flash');
    expect(event.roomId).toBe('bar-rail');
    expect(event.worldId).toBe('the-tap');
    expect(event.provenance).toContain('the-tap:do');
    expect(event.hops).toBe(1);
  });

  it('converts conversation_line to a cortex event', () => {
    const msg: TapMessage = {
      type: 'conversation_line',
      line: {
        agentId: 'wesley',
        displayName: 'Wesley',
        content: 'I fold.',
        timestamp: 1700000000000,
      },
      room: 'poker-room',
    };

    const event = fromTap(msg);
    expectValidEvent(event);
    expect(event.intent).toBe('tap.conversation_line');
    expect(event.tier).toBe('cortex');
    expect(event.source).toBe('wesley');
    expect(event.timestamp).toBe(1700000000000);
  });

  it('round-trips through toTap/fromTap', () => {
    const msg: TapMessage = {
      type: 'agent_left',
      agentId: 'pro',
      room: 'bridge',
    };

    expectRoundTrip(
      msg,
      fromTap,
      (e) => toTap(e) as TapMessage,
      (m) => ({ type: m.type, agentId: m.agentId, room: m.room }),
    );
  });
});

// ════════════════════════════════════════════════════════════════
// CNS ADAPTER
// ════════════════════════════════════════════════════════════════
describe('CNS adapter', () => {
  it('converts a USCP query packet to a valid FleetEvent', () => {
    const packet: USCPPacket = {
      header: {
        origin_id: 'flash',
        packet_id: 'pkt-001',
        intent: 'query',
        priority: 'normal',
        destination_id: 'hermes',
        timestamp: '2026-08-09T12:00:00Z',
        version: '1.0',
      },
      body: { question: 'What is the fleet status?' },
    };

    const event = fromCNS(packet);
    expectValidEvent(event);
    expect(event.intent).toBe('cns.query');
    expect(event.tier).toBe('cortex');
    expect(event.source).toBe('flash');
    expect(event.id).toBe('pkt-001');
    expect(event.provenance).toContain('cns-bridge');
    expect(event.hops).toBe(1);
    expect(event.payload.question).toBe('What is the fleet status?');
  });

  it('maps priority to tier correctly', () => {
    const critical: USCPPacket = {
      header: { origin_id: 'x', packet_id: '1', intent: 'alert', priority: 'critical', destination_id: 'hermes', timestamp: '2026-01-01T00:00:00Z', version: '1.0' },
      body: {},
    };
    expect(fromCNS(critical).tier).toBe('reflex');

    const high: USCPPacket = {
      header: { origin_id: 'x', packet_id: '2', intent: 'alert', priority: 'high', destination_id: 'hermes', timestamp: '2026-01-01T00:00:00Z', version: '1.0' },
      body: {},
    };
    expect(fromCNS(high).tier).toBe('edge');

    const low: USCPPacket = {
      header: { origin_id: 'x', packet_id: '3', intent: 'query', priority: 'low', destination_id: 'hermes', timestamp: '2026-01-01T00:00:00Z', version: '1.0' },
      body: {},
    };
    expect(fromCNS(low).tier).toBe('cortex');
  });

  it('round-trips through toCNS/fromCNS', () => {
    const packet: USCPPacket = {
      header: {
        origin_id: 'scribe',
        packet_id: 'pkt-rt',
        intent: 'response',
        priority: 'high',
        destination_id: 'flash',
        timestamp: '2026-08-09T12:00:00Z',
        version: '1.0',
        correlation_id: 'corr-1',
      },
      body: { answer: 'All systems nominal.' },
    };

    const event = fromCNS(packet);
    const back = toCNS(event);

    expect(back.header.origin_id).toBe('scribe');
    expect(back.header.intent).toBe('response');
    expect(back.header.priority).toBe('high');
    expect(back.header.destination_id).toBe('flash');
    expect(back.body.answer).toBe('All systems nominal.');
  });
});

// ════════════════════════════════════════════════════════════════
// CRON ADAPTER
// ════════════════════════════════════════════════════════════════
describe('Cron adapter', () => {
  it('converts a heartbeat to a reflex FleetEvent', () => {
    const cron: CronEvent = {
      type: 'heartbeat',
      timestamp: '2026-08-09T12:00:00Z',
    };

    const event = fromCron(cron);
    expectValidEvent(event);
    expect(event.intent).toBe('cron.heartbeat');
    expect(event.tier).toBe('reflex');
    expect(event.provenance).toContain('openclaw:cron');
    expect(event.hops).toBe(1);
  });

  it('converts session lifecycle to edge events', () => {
    const start: CronEvent = {
      type: 'session_start',
      sessionId: 's-1',
      channel: 'telegram',
      agent: 'flash',
    };

    const event = fromCron(start);
    expectValidEvent(event);
    expect(event.intent).toBe('cron.session_start');
    expect(event.tier).toBe('edge');
    expect(event.source).toBe('flash');
  });

  it('round-trips through toCron/fromCron', () => {
    const cron: CronEvent = {
      type: 'cron',
      schedule: '*/30 * * * *',
      agent: 'wesley',
      timestamp: '2026-08-09T12:00:00Z',
      data: { task: 'check-email' },
    };

    const event = fromCron(cron);
    const back = toCron(event);

    expect(back.type).toBe('cron');
    expect(back.agent).toBe('wesley');
    expect(back.data?.task).toBe('check-email');
  });
});

// ════════════════════════════════════════════════════════════════
// SPATIAL ADAPTER
// ════════════════════════════════════════════════════════════════
describe('Spatial adapter', () => {
  it('converts room.enter to a reflex FleetEvent', () => {
    const spatial: SpatialEvent = {
      kind: 'room.enter',
      agentId: 'flash',
      roomId: 'bridge',
      worldId: 'plato-shell',
    };

    const event = fromSpatial(spatial);
    expectValidEvent(event);
    expect(event.intent).toBe('room.enter');
    expect(event.tier).toBe('reflex');
    expect(event.source).toBe('flash');
    expect(event.roomId).toBe('bridge');
    expect(event.worldId).toBe('plato-shell');
    expect(event.provenance).toContain('spatial-registry');
    expect(event.hops).toBe(1);
  });

  it('converts portal.use to an edge FleetEvent', () => {
    const spatial: SpatialEvent = {
      kind: 'portal.use',
      agentId: 'wesley',
      fromRoomId: 'bar-rail',
      toRoomId: 'poker-room',
      portalId: 'portal-1',
    };

    const event = fromSpatial(spatial);
    expectValidEvent(event);
    expect(event.intent).toBe('portal.use');
    expect(event.tier).toBe('edge');
    expect(event.payload.fromRoomId).toBe('bar-rail');
    expect(event.payload.toRoomId).toBe('poker-room');
  });

  it('round-trips through toSpatial/fromSpatial', () => {
    const spatial: SpatialEvent = {
      kind: 'room.enter',
      agentId: 'pro',
      roomId: 'engine-room',
      worldId: 'the-tap',
    };

    expectRoundTrip(
      spatial,
      fromSpatial,
      toSpatial,
      (s) => ({ kind: s.kind, agentId: s.agentId, roomId: s.roomId }),
    );
  });
});

// ════════════════════════════════════════════════════════════════
// POKER ADAPTER
// ════════════════════════════════════════════════════════════════
describe('Poker adapter', () => {
  it('converts a bet to a cortex FleetEvent', () => {
    const poker: PokerEvent = {
      action: 'bet',
      actor: 'flash',
      sessionId: 's-2026-08-09',
      hand: 1,
      amount: 50,
      narration: 'Flash pushes 50 chips forward with quiet confidence.',
    };

    const event = fromPoker(poker);
    expectValidEvent(event);
    expect(event.intent).toBe('poker.bet');
    expect(event.tier).toBe('cortex');
    expect(event.source).toBe('flash');
    expect(event.payload.amount).toBe(50);
    expect(event.payload.narration).toContain('quiet confidence');
    expect(event.worldId).toBe('the-tap');
    expect(event.roomId).toBe('poker-room');
    expect(event.provenance).toContain('poker-game');
    expect(event.hops).toBe(1);
  });

  it('converts fold to an edge event', () => {
    const poker: PokerEvent = {
      action: 'fold',
      actor: 'wesley',
      hand: 2,
    };

    const event = fromPoker(poker);
    expectValidEvent(event);
    expect(event.intent).toBe('poker.fold');
    expect(event.tier).toBe('edge');
  });

  it('round-trips through toPoker/fromPoker', () => {
    const poker: PokerEvent = {
      action: 'raise',
      actor: 'scribe',
      sessionId: 's-1',
      hand: 3,
      amount: 100,
      narration: 'Scribe raises.',
    };

    expectRoundTrip(
      poker,
      fromPoker,
      toPoker,
      (p) => ({ action: p.action, actor: p.actor, amount: p.amount, hand: p.hand }),
    );
  });
});

// ════════════════════════════════════════════════════════════════
// PROVENANCE CHAIN INTEGRITY
// ════════════════════════════════════════════════════════════════
describe('provenance chain integrity', () => {
  it('chain grows correctly across multiple systems', () => {
    // Start with a CNS packet
    const packet: USCPPacket = {
      header: {
        origin_id: 'flash',
        packet_id: 'chain-1',
        intent: 'alert',
        priority: 'high',
        destination_id: 'hermes',
        timestamp: '2026-08-09T12:00:00Z',
        version: '1.0',
      },
      body: { message: 'engine room anomaly' },
    };

    // Convert to FleetEvent (passes through CNS bridge)
    let event = fromCNS(packet);
    expect(event.provenance).toEqual(['flash', 'cns-bridge']);
    expect(event.hops).toBe(1);

    // Forward through spatial registry
    event = stamp(event, 'spatial-registry');
    expect(event.provenance).toEqual(['flash', 'cns-bridge', 'spatial-registry']);
    expect(event.hops).toBe(2);

    // Forward through The Tap DO
    event = stamp(event, 'the-tap:do');
    expect(event.provenance).toEqual(['flash', 'cns-bridge', 'spatial-registry', 'the-tap:do']);
    expect(event.hops).toBe(3);

    // Original source is still first entry
    expect(event.provenance[0]).toBe('flash');
    expect(event.source).toBe('flash');
  });

  it('each adapter stamps its system ID', () => {
    const tapEvent = fromTap({ type: 'agent_entered', agent: { id: 'hermes' }, room: 'bridge' });
    expect(tapEvent.provenance).toContain('the-tap:do');

    const cnsEvent = fromCNS({
      header: { origin_id: 'x', packet_id: '1', intent: 'query', priority: 'normal', destination_id: 'hermes', timestamp: '2026-01-01T00:00:00Z', version: '1.0' },
      body: {},
    });
    expect(cnsEvent.provenance).toContain('cns-bridge');

    const cronEvent = fromCron({ type: 'heartbeat' });
    expect(cronEvent.provenance).toContain('openclaw:cron');

    const spatialEvent = fromSpatial({ kind: 'room.enter', agentId: 'flash', roomId: 'bridge' });
    expect(spatialEvent.provenance).toContain('spatial-registry');

    const pokerEvent = fromPoker({ action: 'bet', actor: 'flash', amount: 10 });
    expect(pokerEvent.provenance).toContain('poker-game');
  });

  it('hops always equals provenance.length - 1', () => {
    const events = [
      fromTap({ type: 'agent_entered', agent: { id: 'flash' }, room: 'r1' }),
      fromCNS({ header: { origin_id: 'x', packet_id: '1', intent: 'query', priority: 'normal', destination_id: 'hermes', timestamp: '2026-01-01T00:00:00Z', version: '1.0' }, body: {} }),
      fromCron({ type: 'heartbeat' }),
      fromSpatial({ kind: 'room.enter', agentId: 'flash', roomId: 'r1' }),
      fromPoker({ action: 'fold', actor: 'wesley' }),
    ];

    for (const e of events) {
      expect(e.hops).toBe(e.provenance.length - 1);
    }
  });
});
