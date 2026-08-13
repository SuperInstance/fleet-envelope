# Fleet Envelope

**One grammar for all fleet event systems — not a central bus, a shared envelope format.**

Where [CNS Bridge](https://github.com/SuperInstance/cns-bridge) carries messages and [stigmergy](https://github.com/SuperInstance/stigmergy) leaves pheromone trails, Fleet Envelope defines the *shape* of every signal. It is the grammar that makes inter-system communication possible. Every event — from world state changes to OOC gossip to overnight creative pulses — speaks the same shape.

> *The [griot protocol](https://github.com/SuperInstance/AI-Writings/blob/main/sci-fi/11-the-griot-protocol.md) imagined ancient West African storytelling traditions mapped onto quantum communication — rhythms, cadences, and structures that could transmit information faster than light. The fleet envelope is the practical version: not stories-as-physics, but one canonical shape that every event in every system shares. The griot's drum had a grammar. So does this.*

🎧 **[Listen to related stories](https://ai-writings.pages.dev)**

---

## What This Is

Every event in the fleet — from world state changes to OOC gossip to strategy updates — uses the same envelope shape. This isn't a message bus or a central router. It's an agreement: speak the same shape, and any system can understand you.

```typescript
interface FleetEvent<T = unknown> {
  seq: number;           // Monotonically increasing
  subject: string;       // e.g. 'mud.game.bar-rail.combat'
  data: T;               // Event payload
  timestamp: string;     // ISO-8601
  correlationId?: string;
  origin?: string;
  severity?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  headers?: Record<string, string>;
}
```

## Why Not a Central Bus?

Because [the griot didn't need a central authority to transmit stories](https://github.com/SuperInstance/AI-Writings/blob/main/sci-fi/11-the-griot-protocol.md). The grammar was the protocol. Anyone who knew the rhythm could join the circle. The fleet envelope works the same way: any system that speaks the shape can participate. No broker required.

## Usage

```typescript
import { FleetEvent, createEvent, parseEvent } from 'fleet-envelope';

// Create an event
const event = createEvent('mud.game.combat', {
  source: 'hero',
  target: 'goblin',
  damage: 25,
});

// Serialize for transport
const json = JSON.stringify(event);

// Parse on the other side
const parsed = parseEvent(json);
```

## Adapters

The envelope includes adapters for multiple transport layers:

- **EventEmitter** — in-process pub/sub
- **WebSocket** — browser real-time
- **File** — durable JSONL event log
- **NATS** — distributed production

## Fleet Topology

Fleet Envelope connects to:

- **[CNS Bridge](https://github.com/SuperInstance/cns-bridge)** — USCP packets are the transport layer; fleet envelopes are the semantic layer. Packets carry envelopes.
- **[mud-engine](https://github.com/SuperInstance/mud-engine)** — Uses the envelope for all world events (combat, movement, dialogue, NPC behavior).
- **[the-tap](https://github.com/SuperInstance/the-tap)** — Uses the envelope for room conversations and DJ events.
- **[spatial-registry](https://github.com/SuperInstance/spatial-registry)** — Uses the envelope for cross-world portals and room transitions.
- **[emergence-engine](https://github.com/SuperInstance/emergence-engine)** — Watches events in fleet envelope format to detect emergent patterns.
- **[stigmergy](https://github.com/SuperInstance/stigmergy)** — Pheromone deposits wrapped as fleet events.
- **[confidence-cascade](https://github.com/SuperInstance/confidence-cascade)** — Confidence-tagged events propagate through the cascade.
- **[gossip-ping](https://github.com/SuperInstance/gossip-ping)** — Ping results wrapped as fleet events for consumption by the mesh.
- **[the-living-minds](https://github.com/SuperInstance/the-living-minds)** — Journal entries and conversation logs can be wrapped as fleet events.
- **[wesley-journal](https://github.com/SuperInstance/wesley-journal)** — Wesley's experiments wrapped as events for fleet consumption.
- **[AI-Writings](https://github.com/SuperInstance/AI-Writings/blob/main/sci-fi/11-the-griot-protocol.md)** — The griot protocol: the fictional ancestor of the fleet envelope.

---

## Where to Next

- → **[CNS Bridge](https://github.com/SuperInstance/cns-bridge)** — The bus that carries envelopes between agents
- → **[emergence-engine](https://github.com/SuperInstance/emergence-engine)** — The system that watches envelope-wrapped events for emergence
- → **[confidence-cascade](https://github.com/SuperInstance/confidence-cascade)** — Confidence-tagged envelopes propagating through the fleet
- → **[stigmergy](https://github.com/SuperInstance/stigmergy)** — Pheromone deposits as envelope-wrapped events

---

## Related Repos

- [`mud-engine`](https://github.com/SuperInstance/mud-engine) — uses the envelope for all world events
- [`the-tap`](https://github.com/SuperInstance/the-tap) — uses the envelope for room conversations
- [`spatial-registry`](https://github.com/SuperInstance/spatial-registry) — uses the envelope for cross-world portals

---

## 📚 Related Stories

| Concept | Story | Description |
|---------|-------|-------------|
| **Stories as Protocol** | [The Griot Protocol](https://github.com/SuperInstance/AI-Writings/blob/main/sci-fi/11-the-griot-protocol.md) | Ancient storytelling traditions mapped onto quantum communication — the grammar IS the protocol. |
| **Cultural Transmission** | [Anansi and the WiFi](https://github.com/SuperInstance/AI-Writings/blob/main/kids-stories/02-anansi-and-the-wifi.md) | Stories spreading through networks — the trickster discovers you can't own them, only share them. |

🎧 **[Listen at ai-writings.pages.dev](https://ai-writings.pages.dev)**

---

## Quick Start

### Install

```bash
git clone https://github.com/SuperInstance/fleet-envelope.git
cd fleet-envelope
npm install
npm run build      # TypeScript compile
```

### Use in Your System

```typescript
import { emit, validateEvent, Router } from 'fleet-envelope';

// Create an event
const event = emit('room.enter', {
  agent: 'flash',
  room: 'the-tap-bar',
}, 'edge');

// Validate
const errors = validateEvent(event);
if (errors.length > 0) console.error(errors);

// Route events
const router = new Router();
router.on('room.*', (e) => console.log('Room event:', e));
router.on('poker.*', (e) => handlePokerEvent(e));
router.dispatch(event);
```

### Adapters

```typescript
import { EventEmitterAdapter } from 'fleet-envelope/adapters/cron-adapter';
import { CNSAdapter } from 'fleet-envelope/adapters/cns-adapter';
import { TapAdapter } from 'fleet-envelope/adapters/tap-adapter';
```

Each adapter wraps a different transport layer in the envelope format.

---

## API Reference

### Core Types

```typescript
// The universal event shape
interface FleetEvent<T = unknown> {
  id: string;           // UUID
  source: string;       // originating agent/system
  target?: string;      // specific target
  intent: string;       // dotted namespace.action (e.g., 'room.enter')
  tier: 'reflex' | 'edge' | 'cortex';  // urgency
  payload: T;           // event-specific data
  timestamp: number;    // ms epoch
  provenance: string[]; // forwarder chain
  hops: number;         // provenance.length - 1
  worldId?: string;     // origin world
  roomId?: string;      // related room
}
```

### Tier Semantics

| Tier | Latency | Use Case | Analogy |
|------|---------|----------|--------|
| `reflex` | < 1s | Movement, presence, heartbeat | The body flinches |
| `edge` | 1-5s | State transitions, room entries | Edge of awareness |
| `cortex` | 5s+ | Deliberation, narration, planning | The thinking brain |

Lower tiers should never block on higher tiers.

### Functions

| Function | Purpose |
|----------|---------|
| `emit(intent, payload, tier, options?)` | Create a properly-formed event |
| `validateEvent(event)` | Validate — returns error array (empty = valid) |
| `isFleetEvent(event)` | Type guard — `true` if valid |
| `parseEvent(jsonString)` | Parse and validate JSON → FleetEvent |

### Router

```typescript
const router = new Router();
router.on('room.*', handler);       // glob pattern
router.on('poker.bet', handler);    // exact match
router.on('cns.*.alert', handler);  // multi-segment glob
router.on('*', handler);            // catch-all
router.dispatch(event);             // route to matching handlers
```

---

## Testing

```bash
npm test           # Run all Vitest tests
npm run test:watch # Watch mode
```

Tests verify:
- Event creation and validation (required fields, intent format, tier values)
- Provenance chain integrity (source must equal provenance[0], hops must match)
- Router pattern matching (glob, exact, multi-segment, catch-all)
- Adapter serialization/deserialization
- Round-trip: emit → serialize → parse → validate

---

## Configuration

No runtime configuration needed. The envelope is a pure data structure + helpers.

### Dependencies

Zero runtime dependencies. Dev dependencies only:

| Package | Purpose |
|---------|---------|
| [TypeScript](https://www.typescriptlang.org/) | Type checking |
| [Vitest](https://vitest.dev/) | Test runner |

---

## Further Reading

### For Developers

- [Event-Driven Architecture (Wikipedia)](https://en.wikipedia.org/wiki/Event-driven_architecture) — the design pattern
- [Publish-Subscribe Pattern (Wikipedia)](https://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern) — how adapters work
- [Event Sourcing (Wikipedia)](https://en.wikipedia.org/wiki/Event_sourcing) — the durable log approach
- [UUID (Wikipedia)](https://en.wikipedia.org/wiki/Universally_unique_identifier) — event ID generation
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) — the language
- [Vitest Documentation](https://vitest.dev/) — the test framework

### For Architects

- [Deadband (Wikipedia)](https://en.wikipedia.org/wiki/Deadband) — the tier concept (reflex/edge/cortex)
- [Quality of Service (Wikipedia)](https://en.wikipedia.org/wiki/Quality_of_service) — tier-based routing
- [Network Protocol (Wikipedia)](https://en.wikipedia.org/wiki/Network_protocol) — grammar as protocol
- [Enterprise Service Bus (Wikipedia)](https://en.wikipedia.org/wiki/Enterprise_service_bus) — what this is NOT (by design)
- [TCP/IP Model (Wikipedia)](https://en.wikipedia.org/wiki/Internet_protocol_suite) — the "grammar, not server" analogy

### For Mathematicians

- [Graph Theory (Wikipedia)](https://en.wikipedia.org/wiki/Graph_theory) — provenance chains as directed paths
- [Topology (Wikipedia)](https://en.wikipedia.org/wiki/Network_topology) — fleet mesh structure
- [Information Theory (Wikipedia)](https://en.wikipedia.org/wiki/Information_theory) — event propagation as information flow

---

MIT — part of the SuperInstance fleet.
