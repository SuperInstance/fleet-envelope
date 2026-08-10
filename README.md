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

MIT — part of the SuperInstance fleet.
