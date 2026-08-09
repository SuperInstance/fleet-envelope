/**
 * fleet-envelope — One grammar for all fleet event systems.
 *
 * Not a central bus. A shared envelope format.
 * Every system speaks the same packet shape, transports however it wants.
 *
 * @example
 *   import { emit } from 'fleet-envelope';
 *
 *   // One-line event creation
 *   const event = emit('poker.bet', { actor: 'flash', amount: 50 }, 'cortex');
 *
 * @example
 *   import { Router } from 'fleet-envelope';
 *
 *   const router = new Router();
 *   router.on('room.*', (e) => console.log('Room event!', e.intent));
 *   router.on('poker.*', (e) => console.log('Poker event!', e.intent));
 *   router.dispatch(event);
 */

// Core types
export type { FleetEvent, Tier } from './envelope.js';
export { validateEvent, isFleetEvent, TIER_PRIORITY } from './envelope.js';

// Emitter
export { emit, stamp } from './emitter.js';
export type { EmitOptions } from './emitter.js';

// Router
export { Router, on, dispatch, defaultRouter } from './router.js';

// Adapters — each system converts to/from FleetEvent
export * as TapAdapter from './adapters/tap-adapter.js';
export * as CNSAdapter from './adapters/cns-adapter.js';
export * as CronAdapter from './adapters/cron-adapter.js';
export * as SpatialAdapter from './adapters/spatial-adapter.js';
export * as PokerAdapter from './adapters/poker-adapter.js';

// Adapter types (for direct import)
export type { TapMessage } from './adapters/tap-adapter.js';
export type { USCPPacket, USCPHeader, USCPBody, UCSPSignature } from './adapters/cns-adapter.js';
export type { CronEvent } from './adapters/cron-adapter.js';
export type { SpatialEvent } from './adapters/spatial-adapter.js';
export type { PokerEvent, PokerAction } from './adapters/poker-adapter.js';
