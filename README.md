# Fleet Envelope

**One grammar for all fleet event systems — not a central bus, a shared envelope format.**

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
