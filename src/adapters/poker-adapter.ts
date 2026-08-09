/**
 * poker-adapter.ts — Converts Poker Game narration/action events
 * to and from FleetEvent envelopes.
 *
 * The Tap's poker game (from poker-session.ts) produces actions like:
 *   - Bet / Call / Raise / Fold / Check
 *   - Deal (new hand)
 *   - Conversation (between hands)
 *   - Planning topics
 *   - Open mic readings
 *   - Session summary
 *
 * Each poker session has phases:
 *   Phase 1: The Deal — Texas Hold'em with narrated actions
 *   Phase 2: The Conversation — agents reflect between hands
 *   Phase 2.5: The Planning — topics captured as tasks
 *   Phase 3: The Open Mic — one agent reads, others respond
 *   Phase 4: The Sign-Off — diary entries, creative pieces
 *
 * Actions are cortex-tier (deliberation). Deals and folds can be edge.
 */

import type { FleetEvent, Tier } from '../envelope.js';
import { emit, stamp } from '../emitter.js';

// ── Poker wire format (from poker-session.ts) ─────────────────

export type PokerAction =
  | 'deal' | 'bet' | 'call' | 'raise' | 'fold' | 'check' | 'all_in'
  | 'conversation' | 'planning_topic' | 'open_mic' | 'session_summary';

export interface PokerEvent {
  action: PokerAction;
  actor: string;         // agent ID: 'flash', 'pro', 'wesley', 'scribe', 'hermes'
  sessionId?: string;    // poker session ID
  hand?: number;         // which hand number
  amount?: number;       // chip amount for bet/call/raise
  narration?: string;    // narrated description of the action
  content?: string;      // for conversation/open_mic
  displayName?: string;
  metadata?: Record<string, any>;
}

/** Map poker actions to tiers. */
const POKER_TIER: Record<PokerAction, Tier> = {
  deal:             'edge',    // Mechanical: new hand starts
  bet:              'cortex',  // Deliberation: agent commits chips
  call:             'cortex',
  raise:            'cortex',
  fold:             'edge',    // Quick decision: agent drops
  check:            'edge',    // Quick decision: pass
  all_in:           'cortex',  // High-stakes deliberation
  conversation:     'cortex',  // Phase 2: agents reflect
  planning_topic:   'cortex',  // Phase 2.5: task capture
  open_mic:         'cortex',  // Phase 3: creative reading
  session_summary:  'cortex',  // Phase 4: wrap-up
};

/**
 * Convert a Poker Game action into a FleetEvent.
 */
export function fromPoker(event: PokerEvent): FleetEvent {
  const intent = `poker.${event.action}`;
  const tier = POKER_TIER[event.action] ?? 'cortex';

  const payload: any = {
    actor: event.actor,
  };

  if (event.amount !== undefined) payload.amount = event.amount;
  if (event.narration) payload.narration = event.narration;
  if (event.content) payload.content = event.content;
  if (event.hand !== undefined) payload.hand = event.hand;
  if (event.displayName) payload.displayName = event.displayName;
  if (event.metadata) payload.metadata = event.metadata;

  const fleetEvent = emit(intent, payload, tier, event.actor, {
    worldId: 'the-tap',
    roomId: 'poker-room',
  });

  if (event.sessionId) {
    fleetEvent.payload.sessionId = event.sessionId;
  }

  return stamp(fleetEvent, 'poker-game');
}

/**
 * Convert a FleetEvent back into a Poker Game event.
 */
export function toPoker(event: FleetEvent): PokerEvent {
  const p = event.payload ?? {};
  const action = event.intent.replace('poker.', '') as PokerAction;

  return {
    action,
    actor: p.actor ?? event.source,
    sessionId: p.sessionId,
    hand: p.hand,
    amount: p.amount,
    narration: p.narration,
    content: p.content,
    displayName: p.displayName,
    metadata: p.metadata,
  };
}
