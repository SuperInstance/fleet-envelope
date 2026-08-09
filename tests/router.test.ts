import { describe, it, expect } from 'vitest';
import { Router } from '../src/router.js';
import { emit } from '../src/emitter.js';
import type { FleetEvent } from '../src/envelope.js';

describe('Router', () => {
  it('matches exact intents', () => {
    const router = new Router();
    const received: FleetEvent[] = [];

    router.on('poker.bet', (e) => received.push(e));
    router.dispatch(emit('poker.bet', { amount: 50 }, 'cortex', 'flash'));
    router.dispatch(emit('poker.fold', {}, 'edge', 'wesley'));

    expect(received).toHaveLength(1);
    expect(received[0].intent).toBe('poker.bet');
  });

  it('matches wildcard patterns', () => {
    const router = new Router();
    const pokerEvents: FleetEvent[] = [];
    const roomEvents: FleetEvent[] = [];

    router.on('poker.*', (e) => pokerEvents.push(e));
    router.on('room.*', (e) => roomEvents.push(e));

    router.dispatch(emit('poker.bet', {}, 'cortex', 'flash'));
    router.dispatch(emit('poker.fold', {}, 'edge', 'wesley'));
    router.dispatch(emit('room.enter', {}, 'reflex', 'pro'));
    router.dispatch(emit('room.exit', {}, 'reflex', 'pro'));

    expect(pokerEvents).toHaveLength(2);
    expect(roomEvents).toHaveLength(2);
  });

  it('matches mid-segment wildcards', () => {
    const router = new Router();
    const received: FleetEvent[] = [];

    router.on('cns.*.alert', (e) => received.push(e));

    router.dispatch(emit('cns.system.alert', {}, 'reflex'));
    router.dispatch(emit('cns.query', {}, 'cortex'));  // Should NOT match
    router.dispatch(emit('cns.network.alert', {}, 'reflex'));

    expect(received).toHaveLength(2);
  });

  it('matches everything with *', () => {
    const router = new Router();
    let count = 0;

    router.on('*', () => count++);

    router.dispatch(emit('poker.bet', {}, 'cortex'));
    router.dispatch(emit('room.enter', {}, 'reflex'));
    router.dispatch(emit('cns.query', {}, 'cortex'));

    expect(count).toBe(3);
  });

  it('supports unsubscribe', () => {
    const router = new Router();
    let count = 0;

    const unsub = router.on('test.*', () => count++);
    router.dispatch(emit('test.thing', {}, 'edge'));
    expect(count).toBe(1);

    unsub();
    router.dispatch(emit('test.thing', {}, 'edge'));
    expect(count).toBe(1); // Still 1, handler removed
  });

  it('returns match count from dispatch', () => {
    const router = new Router();
    router.on('poker.*', () => {});
    router.on('poker.bet', () => {});

    const count = router.dispatch(emit('poker.bet', {}, 'cortex'));
    expect(count).toBe(2); // Both handlers matched
  });

  it('isolates separate router instances', () => {
    const r1 = new Router();
    const r2 = new Router();
    let r1Count = 0;
    let r2Count = 0;

    r1.on('poker.*', () => r1Count++);
    r2.on('room.*', () => r2Count++);

    r1.dispatch(emit('poker.bet', {}, 'cortex'));
    r1.dispatch(emit('room.enter', {}, 'reflex'));

    expect(r1Count).toBe(1);
    expect(r2Count).toBe(0);
  });
});
