# Aval: Architecture Document

**THE SINGLE SOURCE OF TRUTH.** Every file, every line, every config.

**Verification legend**
- `[VERIFIED]`, this exact code exists on disk and has been executed successfully on this machine
- `[UNVERIFIED]`, pattern is sound but has not been run yet
- `[ASSUMED]`, no verifiable source, test immediately

**Toolchain (verified by execution, not by reading docs):**

| Component | Version | Evidence |
|---|---|---|
| `compact` devtool | 0.5.2 | `compact --version` |
| Compact compiler | 0.34.0 | `compact compile --version` |
| Compact language | 0.26.0 | `compact compile --language-version` |
| Compact runtime | 0.19.0 | `compact compile --runtime-version`, matches npm package |
| Node.js | 25.6.1 | `node -v` |

---

## Section 1: System Overview

Aval proves a committed-but-unsettled fact satisfies a counterparty's predicate, without revealing the fact.

```
                 ┌──────────────────────────────────────────────────┐
                 │              MIDNIGHT LEDGER (public)            │
                 │                                                  │
                 │  attestations : HistoricMerkleTree<10,Bytes<32>> │
                 │  spent        : Set<Bytes<32>>                   │
                 │  attestor     : Bytes<32>                        │
                 │  fills        : Counter                          │
                 └───────▲──────────────────────────▲───────────────┘
                         │ register_attestation     │ prove_funds_in_flight
                         │ (attestor only)          │ (anyone with a preimage)
                         │                          │
             ┌───────────┴──────────┐   ┌───────────┴────────────┐
             │  Attestor watcher    │   │  Alice client          │
             │  observes source     │   │  holds preimage        │
             │  chain, computes     │   │  finds merkle path     │
             │  leaf_hash(...)      │   │  supplies witnesses    │
             └───────────▲──────────┘   └────────────────────────┘
                         │ Locked(lockId, amount, beneficiary, expiry)
             ┌───────────┴──────────┐
             │  Source-chain escrow │
             └──────────────────────┘

   PRIVATE, never written to ledger: lock_id, amount, salt, merkle path
   PUBLIC, written to ledger:        merkle root, nullifier, fill count, attestor id
```

### Technology table

| Technology | Version | Purpose |
|---|---|---|
| Compact | language 0.26.0 | ZK smart contract |
| `@midnight-ntwrk/compact-runtime` | 0.19.0 | Execute circuits in JS, no proof server |
| TypeScript | 5.x | Watcher, client, tests |
| vitest | ^2 | Test runner |
| React | 19 | Demo frontend |
| Vite | 6 | Frontend build |
| Tailwind CSS | v4 | Frontend styling |

### File structure tree

```
aval/
├── README.md                          # judge landing page
├── PRD.md                             # product spec
├── ARCHITECTURE.md                    # this file
├── PLAN.md                            # implementation plan
├── LICENSE                            # Apache-2.0
├── concerns.md
├── contract/
│   ├── package.json
│   ├── src/
│   │   └── inflight.compact           # THE CONTRACT
│   ├── out/                           # generated (gitignored)
│   │   ├── contract/index.js|.d.ts
│   │   ├── zkir/*.zkir
│   │   └── keys/*.prover|.verifier
│   ├── test/
│   │   ├── simulator.ts               # in-process harness
│   │   └── inflight.test.ts           # 23 tests
│   ├── src-ts/
│   │   ├── watcher.ts                 # attestor: source chain -> Midnight
│   │   └── types.ts                   # shared types
│   └── scripts/
│       └── seed-demo.ts               # real-execution demo seed
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── index.css
│       ├── App.tsx                    # two-pane demo
│       └── lib/demo.ts                # drives the simulator
└── submission/
    ├── proof.md
    └── links.md
```

---

## Section 2: Component Architecture

| Name | Type | File path | Purpose | Dependencies |
|---|---|---|---|---|
| Aval contract | Compact | `contract/src/inflight.compact` | 3 circuits, the protocol | CompactStandardLibrary |
| Shared types | TS | `contract/src-ts/types.ts` | `LockRecord`, `AvalPrivateState` | none |
| Simulator | TS | `contract/test/simulator.ts` | Run circuits in-process, inject block time | compact-runtime, compiled output |
| Test suite | TS | `contract/test/inflight.test.ts` | 22 security + privacy tests | simulator |
| Attestor watcher | TS | `contract/src-ts/watcher.ts` | Observe locks, register leaves | simulator, pureCircuits |
| Seed script | TS | `contract/scripts/seed-demo.ts` | Real-execution demo state | simulator, watcher |
| Demo frontend | React | `frontend/src/App.tsx` | Two-pane privacy demo | demo.ts |
| Demo driver | TS | `frontend/src/lib/demo.ts` | Bridges UI to simulator | simulator |

### Data flow between components

`watcher` → `contract.register_attestation` → ledger tree. `Alice client` reads the tree for a path, supplies witnesses → `contract.prove_funds_in_flight` → ledger nullifier + counter. `frontend` renders both the counterparty view and the raw ledger view from the same simulator instance, which is what makes the privacy claim checkable rather than asserted.

### State management

All durable state lives in the Midnight ledger. The simulator threads a `CircuitContext` between calls; private state (`AvalPrivateState`) never enters that ledger.

---

## Section 3: The Contract

### Purpose

The complete protocol. Three circuits: bootstrap an attestor, register a lock commitment, prove a lock clears a threshold.

### Dependencies

`CompactStandardLibrary` only. No external Compact packages.

### Key design decisions

**Why `HistoricMerkleTree` and not `Set` of leaves.** A `Set` membership check would require disclosing the leaf, which links the proof to one specific registered attestation and destroys unlinkability. A Merkle path is supplied privately and only the computed root is disclosed, so an observer learns a valid attestation was used but not which one. "Historic" additionally means a proof built against an older root stays valid as the tree grows, so Alice's proof does not break when the attestor registers someone else's lock mid-flight.

**Why no ECDSA.** The obvious design verifies an attestor's Ethereum signature inside the circuit. That is impossible here: `Secp256k1Point`, `Secp256k1Scalar`, `Secp256k1Base` and `secp256k1EcdsaVerify` are all UNBOUND in the shipped 0.34.0 standard library, despite the release notes describing them. Verified by compiling a probe. Authority therefore comes from *writing to the ledger*, authenticated by Midnight's own transaction layer, plus a derived-id equality check. This is also strictly more private: a signature check would force Alice to reveal which attestation she used.

**Why counterparty and expiry are bound into the leaf.** Both are public circuit arguments, but hashing them into the commitment is what makes an attestation non-transferable. Change either and the recomputed leaf matches nothing in the tree. Three of the 23 tests assert exactly this.

**Why `kernel.blockTimeLessThan` and not a caller-supplied timestamp.** A `now` parameter would let the prover backdate. The ledger's own block time cannot be forged by the caller.

**Why the nullifier is derived from private values.** `nullifier_of(lock_id, salt)` is a one-way, domain-separated hash of two witness values. It is deterministic enough to block double-spending and opaque enough that an observer cannot link it to the registered leaf.

### Code

#### File: `contract/src/inflight.compact`
`[VERIFIED]`, compiles to 3 circuits and 6 proving/verifier keys in 14.5s. Source: executed on this machine.

```compact
pragma language_version >= 0.26;

// Aval, proof of funds in flight.
//
// DUAL-LEDGER SUMMARY
//   Private (witness, never written):  lock_id, amount, salt, merkle path
//   Public  (ledger, written):         merkle root, nullifier, fill counter, attestor id
//   Bridged by disclose():             6 call sites, each justified inline.
//
// Note on disclose(): it does not itself publish anything. It clears the compiler's
// private-data check so a value may cross into a public position; the ledger write is
// what makes it visible.

import CompactStandardLibrary;

export ledger attestations: HistoricMerkleTree<10, Bytes<32>>;
export ledger spent: Set<Bytes<32>>;
export ledger attestor: Bytes<32>;
export ledger attestor_registered: Boolean;
export ledger fills: Counter;

witness local_secret_key(): Bytes<32>;
witness get_lock_id(): Bytes<32>;
witness get_amount(): Uint<64>;
witness get_salt(): Bytes<32>;
witness find_path(leaf: Bytes<32>): MerkleTreePath<10, Bytes<32>>;

export pure circuit derive_id(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "aval:attestor:v1"), sk]);
}

export pure circuit leaf_hash(
  lock_id: Bytes<32>,
  amount: Uint<64>,
  counterparty: Bytes<32>,
  expiry: Uint<64>
, salt: Bytes<32>): Bytes<32> {
  const amount_b = (amount as Field) as Bytes<32>;
  const expiry_b = (expiry as Field) as Bytes<32>;
  const inner = persistentHash<Vector<3, Bytes<32>>>([lock_id, amount_b, salt]);
  return persistentHash<Vector<3, Bytes<32>>>([inner, counterparty, expiry_b]);
}

export pure circuit nullifier_of(lock_id: Bytes<32>, salt: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<3, Bytes<32>>>([pad(32, "aval:nul:v1"), lock_id, salt]);
}

export circuit register_attestor(): [] {
  assert(!attestor_registered, "attestor already registered");
  const id = derive_id(local_secret_key());
  // DISCLOSE 1/6, publishes the attestor's derived public id. The secret key never leaves witness state.
  attestor = disclose(id);
  attestor_registered = true;
}

export circuit register_attestation(leaf: Bytes<32>): [] {
  assert(attestor_registered, "no attestor registered");
  const id = derive_id(local_secret_key());
  // DISCLOSE 2/6, publishes only the BOOLEAN "caller is the attestor". One bit, and it is the access decision itself.
  assert(disclose(id == attestor), "caller is not the attestor");
  // DISCLOSE 3/6, publishes the commitment. A leaf is a hash: no amount, no lock id, no counterparty.
  attestations.insert(disclose(leaf));
}

export circuit prove_funds_in_flight(
  required: Uint<64>,
  counterparty: Bytes<32>,
  expiry: Uint<64>
): [] {
  const lock_id = get_lock_id();
  const amount  = get_amount();
  const salt    = get_salt();

  const leaf = leaf_hash(lock_id, amount, counterparty, expiry, salt);
  const path = find_path(leaf);

  // DISCLOSE (root), publishes the ROOT computed from the private path, not the path and
  // not the leaf. The root is already public state. Critically it does NOT reveal WHICH leaf
  // was used, so the proof stays unlinkable to a specific attestation.
  const root = disclose(merkleTreePathRoot<10, Bytes<32>>(path));
  assert(attestations.checkRoot(root), "attestation not registered");

  // DISCLOSE 4/6, publishes the expiry bound. Not sensitive, and bound into the leaf so the
  // prover cannot alter it without invalidating the Merkle proof.
  assert(kernel.blockTimeLessThan(disclose(expiry)), "attestation expired");

  // DISCLOSE 5/6, publishes only the BOOLEAN "amount >= required". The amount is never written.
  assert(disclose(amount >= required), "locked amount below required threshold");

  // DISCLOSE 6/6, publishes the nullifier: a one-way hash of private lock_id and salt.
  const nul = disclose(nullifier_of(lock_id, salt));
  assert(!spent.member(nul), "this lock has already backed a proof");
  spent.insert(nul);

  fills.increment(1);
}
```

### Verified status

Compiles clean. Generates `register_attestor.zkir`, `register_attestation.zkir`, `prove_funds_in_flight.zkir` plus six keys. The compiler's information-flow analysis rejected three earlier drafts that let a witness reach the ledger without `disclose()`, which is the dual-ledger model being enforced by the type system rather than by developer discipline.

---

## Section 4: Shared Types

#### File: `contract/src-ts/types.ts`
`[UNVERIFIED]`, extraction of types already exercised inside `test/simulator.ts`.

```ts
// File: contract/src-ts/types.ts
/** One source-chain lock, as known privately by its holder. */
export type LockRecord = {
  lockId: Uint8Array;
  amount: bigint;
  salt: Uint8Array;
};

/** Private state: the caller's key plus whichever lock they are proving. */
export type AvalPrivateState = {
  secretKey: Uint8Array;
  lock: LockRecord | null;
};

/** A lock event observed on the source chain. */
export type LockedEvent = {
  lockId: Uint8Array;
  amount: bigint;
  beneficiary: Uint8Array;
  expiry: bigint;
};

/** Deterministic 32-byte helper for demos and tests. Not for production keys. */
export const bytes32 = (seed: number | string): Uint8Array => {
  const b = new Uint8Array(32);
  const s = String(seed);
  for (let i = 0; i < s.length && i < 32; i++) b[i] = s.charCodeAt(i);
  b[31] = typeof seed === 'number' ? seed & 0xff : s.length;
  return b;
};
```

---

## Section 5: Simulator

### Purpose

Execute the compiled circuits in-process against real ledger state, with injectable block time, and with no Docker and no proof server. This is the component that makes the whole project verifiable by a judge in under a minute.

### Key decisions

`createCircuitContext` accepts a `time` argument, which is how expiry is tested deterministically in both directions. The context is threaded manually between calls so ledger state survives while the caller identity and private lock change, which is how a single test can model attestor, Alice, and Mallory hitting the same contract.

The witness `find_path` reads the PUBLIC tree via `ctx.ledger.attestations.findPathForLeaf(leaf)` but returns the path PRIVATELY. That asymmetry is the whole unlinkability argument in one line.

### Code

#### File: `contract/test/simulator.ts`
`[VERIFIED]`, executed; 23 tests pass against it.

See the file on disk. Its exported surface, which everything else depends on:

```ts
// File: contract/test/simulator.ts  (exported surface)
export type LockRecord = { lockId: Uint8Array; amount: bigint; salt: Uint8Array };
export type AvalPrivateState = { secretKey: Uint8Array; lock: LockRecord | null };
export const bytes32: (seed: number | string) => Uint8Array;

export class AvalSimulator {
  static create(secretKey: Uint8Array): Promise<AvalSimulator>;
  get public(): Ledger;                       // read-only public ledger view
  registerAttestor(secretKey: Uint8Array, time?: number): Promise<void>;
  registerAttestation(secretKey: Uint8Array, leaf: Uint8Array, time?: number): Promise<void>;
  proveFundsInFlight(args: {
    secretKey: Uint8Array; lock: LockRecord; required: bigint;
    counterparty: Uint8Array; expiry: bigint; time?: number;
  }): Promise<void>;
}

export const leafFor: (lock: LockRecord, counterparty: Uint8Array, expiry: bigint) => Uint8Array;
export const nullifierFor: (lock: LockRecord) => Uint8Array;
```

**Critical implementation note for anyone modifying it:** the circuit context state is reached via `ctx.callContext.currentQueryContext.state`, NOT `ctx.transactionContext.state`. The latter does not exist on `CircuitContext` in runtime 0.19.0 and was the first thing that broke.

---

## Section 6: Test Suite

### Purpose

Prove the security properties mechanically, and prove the privacy property by assertion rather than by claim.

### Code

#### File: `contract/test/inflight.test.ts`
`[VERIFIED]`, 23 tests, all passing, 671ms.

Structure (full source on disk):

| Group | Tests | What it proves |
|---|---:|---|
| attestor registration | 3 | Bootstrap is once-only; the secret key is never published |
| attestation registry access control | 2 | Only the attestor can register a commitment |
| prove_funds_in_flight, the money path | 4 | Threshold logic including the exact-equality boundary; unregistered locks rejected |
| nullifier, one lock backs exactly one proof | 4 | Double-spend blocked even by a different caller; distinct locks still independent |
| binding, an attestation is not transferable | 3 | Counterparty swap, amount inflation, and expiry extension all rejected |
| expiry, enforced by ledger block time | 2 | Accepted at 8,999; rejected at 9,001 |
| privacy, what the ledger does and does not reveal | 4 | Amount absent from a full public-state dump; lock id absent; nullifier unlinkable to leaf |

The privacy group is the one that matters for judging. It serialises the entire public ledger and asserts the amount string does not appear in it.

---

## Section 7: Attestor Watcher

### Purpose

Bridge the source chain to the Midnight registry. In the bilateral deployment the counterparty runs this themselves, which is why the trust assumption collapses to "Bob trusts Bob's own node".

### Key decision

It computes the leaf with `pureCircuits.leaf_hash` exported by the compiler, never a hand-rolled hash. There is exactly one definition of the commitment in the system, and it is the one the circuit enforces. A reimplementation that drifted by one byte would silently break every proof.

### Code

#### File: `contract/src-ts/watcher.ts`
`[UNVERIFIED]`, composed from verified primitives (`pureCircuits.leaf_hash` and `AvalSimulator.registerAttestation` are both exercised by passing tests), but this wrapper has not been run yet.

```ts
// File: contract/src-ts/watcher.ts
import { pureCircuits } from '../out/contract/index.js';
import type { AvalSimulator } from '../test/simulator.js';
import type { LockedEvent, LockRecord } from './types.js';

/** Randomness for the commitment. Keeps two identical locks from colliding. */
export const freshSalt = (): Uint8Array => crypto.getRandomValues(new Uint8Array(32));

export type Attestation = {
  leaf: Uint8Array;
  /** Sent to the beneficiary off-chain. Never published. */
  preimage: LockRecord;
  counterparty: Uint8Array;
  expiry: bigint;
};

/**
 * The attestor observed a lock on the source chain. Register a commitment to it on
 * Midnight and hand the preimage to the beneficiary out of band.
 */
export async function attestLock(
  sim: AvalSimulator,
  attestorKey: Uint8Array,
  event: LockedEvent,
  salt: Uint8Array = freshSalt(),
): Promise<Attestation> {
  const preimage: LockRecord = { lockId: event.lockId, amount: event.amount, salt };

  // Same hash the circuit uses. Exported by the compiler, not reimplemented.
  const leaf = pureCircuits.leaf_hash(
    preimage.lockId,
    preimage.amount,
    event.beneficiary,
    event.expiry,
    preimage.salt,
  );

  await sim.registerAttestation(attestorKey, leaf);

  return { leaf, preimage, counterparty: event.beneficiary, expiry: event.expiry };
}
```

---

## Section 8: Seed Script

### Purpose

Produce demo state through real circuit execution. Thesis field 5 forbids fabricated state: the product's claim is verifiability, so a demo backed by hand-written JSON would contradict the pitch.

### Code

#### File: `contract/scripts/seed-demo.ts`
`[UNVERIFIED]`, composed from verified primitives.

```ts
// File: contract/scripts/seed-demo.ts
import { AvalSimulator, bytes32 } from '../test/simulator.js';
import { attestLock } from '../src-ts/watcher.js';
import type { LockedEvent } from '../src-ts/types.js';

const ATTESTOR = bytes32('bob-attestor-key');
const ALICE = bytes32('alice-key');
const BOB = bytes32('bob-counterparty');
const EXPIRY = 9_000n;
const NOW = 1_000;

/** Three realistic in-flight locks. Amounts are private; only the count is public. */
const LOCKS: LockedEvent[] = [
  { lockId: bytes32('eth-lock-8837'), amount: 2_000_000n, beneficiary: BOB, expiry: EXPIRY },
  { lockId: bytes32('eth-lock-8841'), amount: 750_000n, beneficiary: BOB, expiry: EXPIRY },
  { lockId: bytes32('eth-lock-8852'), amount: 120_000n, beneficiary: BOB, expiry: EXPIRY },
];

export async function seed() {
  const sim = await AvalSimulator.create(ATTESTOR);
  await sim.registerAttestor(ATTESTOR, NOW);

  const attestations = [];
  for (const event of LOCKS) {
    attestations.push(await attestLock(sim, ATTESTOR, event));
  }

  // One real proof so the demo opens on a non-empty, genuinely-produced state.
  await sim.proveFundsInFlight({
    secretKey: ALICE,
    lock: attestations[0].preimage,
    required: 1_500_000n,
    counterparty: BOB,
    expiry: EXPIRY,
    time: NOW,
  });

  return { sim, attestations };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed().then(({ sim }) => {
    console.log('attestor registered :', sim.public.attestor_registered);
    console.log('fills               :', sim.public.fills.toString());
    console.log('nullifiers spent    :', sim.public.spent.size().toString());
    console.log('amount in ledger    : (absent by construction)');
  });
}
```

---

## Section 9: Demo Frontend

### Purpose

Make the privacy claim legible. Two panes rendered from one simulator instance: what the counterparty learns, next to the public ledger state.

<!-- [CRITIQUE E-2] `readLedger` in frontend/src/lib/demo.ts builds a hand-authored 5-field view and truncates each value with `.slice(0, 24)`. It is not a dump of everything on the ledger, and the previous wording claimed it was. -->
<!-- [CRITIQUE E-2] Observing an absence in developer-authored JSON proves nothing: the pane would look identical if the contract DID leak the amount and the renderer simply omitted the key. The witnessable property is indistinguishability, not absence. -->

A judge should not have to trust either the claim or the renderer. The pane therefore has two obligations: render the ledger object's own fields rather than a curated list, and support the indistinguishability comparison (same lock, two different amounts, byte-identical public state except the root hash).

### Key decision

The frontend imports the same `AvalSimulator` the tests use. It is not a mock of the protocol, it IS the protocol, running in the browser. Every number on screen comes from a real circuit execution.

### Code

#### File: `frontend/package.json`
`[UNVERIFIED]`

```json
{
  "name": "@aval/frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

#### File: `frontend/vite.config.ts`
`[UNVERIFIED]`

```ts
// File: frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@contract': new URL('../contract', import.meta.url).pathname },
  },
  optimizeDeps: { exclude: ['@midnight-ntwrk/compact-runtime'] },
});
```

#### File: `frontend/index.html`
`[UNVERIFIED]`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Aval, proof of funds in flight</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

#### File: `frontend/src/main.tsx`
`[UNVERIFIED]`

```tsx
// File: frontend/src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

#### File: `frontend/src/lib/demo.ts`
`[UNVERIFIED]`, wraps verified simulator calls.

```ts
// File: frontend/src/lib/demo.ts
import { AvalSimulator, bytes32, leafFor, type LockRecord } from '@contract/test/simulator';

export const BOB = bytes32('bob-counterparty');
export const ALICE_KEY = bytes32('alice-key');
export const ATTESTOR_KEY = bytes32('bob-attestor-key');
export const EXPIRY = 9_000n;
export const NOW = 1_000;

export type LedgerView = {
  attestorRegistered: boolean;
  attestorId: string;
  merkleRoot: string;
  nullifiers: string[];
  fills: string;
};

const hex = (b: Uint8Array) =>
  Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');

export const readLedger = (sim: AvalSimulator): LedgerView => ({
  attestorRegistered: sim.public.attestor_registered,
  attestorId: hex(sim.public.attestor),
  merkleRoot: String(sim.public.attestations.root().field ?? ''),
  nullifiers: [...sim.public.spent].map(hex),
  fills: sim.public.fills.toString(),
});

export const DEMO_LOCK: LockRecord = {
  lockId: bytes32('eth-lock-8837'),
  amount: 2_000_000n,
  salt: bytes32('salt-8837'),
};

export async function bootstrap() {
  const sim = await AvalSimulator.create(ATTESTOR_KEY);
  await sim.registerAttestor(ATTESTOR_KEY, NOW);
  await sim.registerAttestation(ATTESTOR_KEY, leafFor(DEMO_LOCK, BOB, EXPIRY), NOW);
  return sim;
}

export async function prove(sim: AvalSimulator, required: bigint) {
  await sim.proveFundsInFlight({
    secretKey: ALICE_KEY,
    lock: DEMO_LOCK,
    required,
    counterparty: BOB,
    expiry: EXPIRY,
    time: NOW,
  });
}
```

#### File: `frontend/src/index.css`
`[UNVERIFIED]`

```css
/* File: frontend/src/index.css */
@import "tailwindcss";

:root { color-scheme: dark; }
body { margin: 0; background: #07070b; color: #e8e8ef; font-family: ui-sans-serif, system-ui, sans-serif; }
```

#### File: `frontend/src/App.tsx`
`[UNVERIFIED]`

```tsx
// File: frontend/src/App.tsx
import { useEffect, useState } from 'react';
import { AvalSimulator } from '@contract/test/simulator';
import { bootstrap, prove, readLedger, DEMO_LOCK, type LedgerView } from './lib/demo';

export default function App() {
  const [sim, setSim] = useState<AvalSimulator | null>(null);
  const [view, setView] = useState<LedgerView | null>(null);
  const [status, setStatus] = useState('Attestation registered. Awaiting proof.');
  const [error, setError] = useState<string | null>(null);
  const [required, setRequired] = useState('1500000');

  useEffect(() => {
    bootstrap().then((s) => { setSim(s); setView(readLedger(s)); });
  }, []);

  const onProve = async () => {
    if (!sim) return;
    setError(null);
    try {
      await prove(sim, BigInt(required));
      setStatus(`Threshold ${Number(required).toLocaleString()} cleared. Release authorized.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('Proof rejected. No release.');
    }
    setView(readLedger(sim));
  };

  return (
    <main className="min-h-screen px-4 py-10 md:px-10">
      <header className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-semibold tracking-tight">Aval</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-400">
          Prove money is committed but not yet arrived, so a counterparty can act now
          instead of waiting for settlement. The amount never reaches the chain.
        </p>
      </header>

      <section className="mx-auto mt-8 grid max-w-5xl gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            What the counterparty learns
          </h2>
          <p className="mt-4 text-lg">{status}</p>
          {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

          <label className="mt-6 block text-xs uppercase tracking-widest text-neutral-500">
            Required threshold
          </label>
          <input
            value={required}
            onChange={(e) => setRequired(e.target.value.replace(/\D/g, ''))}
            className="mt-2 w-full rounded-lg border border-neutral-800 bg-black px-3 py-2 font-mono"
          />
          <button
            onClick={onProve}
            className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-2 font-medium text-black hover:bg-emerald-400"
          >
            Prove funds in flight
          </button>
          <p className="mt-4 text-xs text-neutral-500">
            Alice actually holds {DEMO_LOCK.amount.toLocaleString()}. Raise the threshold
            above it and the proof is rejected, which is itself the point: the counterparty
            learns only whether the bar was cleared.
          </p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-sky-400">
            What the public ledger knows
          </h2>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-black p-4 text-xs leading-relaxed">
{view ? JSON.stringify(view, null, 2) : 'loading…'}
          </pre>
          <p className="mt-4 text-xs text-neutral-500">
            No amount. No lock id. No identity. A root, a nullifier, a counter.
          </p>
        </div>
      </section>
    </main>
  );
}
```

---

## Section 10: Domain Knowledge File

Build phase generates `DOMAIN-GUIDE.md` from this spec.

| Term | Definition | Source |
|---|---|---|
| In-flight | Committed and irrevocable on a source chain, not yet settled at the destination | PRD §1 |
| Lock | An escrow entry on the source chain with a unique id, monotone and irrevocable | PRD §1 |
| Attestor | A party that can observe the source chain and registers commitments on Midnight | PRD §1 |
| Attestation | A commitment (hash) to one observed lock, stored in the Merkle tree | Contract §3 |
| Leaf | `leaf_hash(lock_id, amount, counterparty, expiry, salt)` | Contract §3 |
| Nullifier | `nullifier_of(lock_id, salt)`, a one-way tag that makes one lock spendable once | Contract §3 |
| Preimage | The private tuple `(lock_id, amount, salt)` that opens a leaf | PRD §4 |
| Witness | A private input supplied locally and constrained in-circuit, never in calldata | Compact model |
| Dual ledger | Midnight's split between public ledger state and private witness state | Research brief |
| `disclose()` | Clears the compiler's private-data check; the ledger write is what publishes | midnight-docs #1245 |
| Historic root | An older Merkle root that remains valid for membership proofs as the tree grows | Contract §3 |
| Threshold predicate | `amount >= required`, the only fact about the amount that becomes public | Contract §3 |

**Rules the code must enforce:** one lock backs exactly one proof; an attestation is bound to one counterparty and one expiry; only the registered attestor may write the registry; the amount is never written to public state; expiry is judged by ledger block time, not by the caller.

---

## Section 11: Submission Directory Plan

```
submission/
├── proof.md          # compile output, test output, ledger dump, versions   (package phase)
├── links.md          # repo, live URL, video, deck                          (package phase)
└── screenshots/
    ├── two-pane.png  # the money shot                                       (demo phase)
    └── tests.png     # 23 passing                                           (demo phase)
```

No `sponsor-tracks.md`: this buildathon has a single track.

---

## Section 12: Multi-Track Architecture

Not applicable. The Midnight Buildathon Wave 1 has one track. The analogous optimization here is rubric coverage, handled in PRD §1: the test suite serves Engineering and QA (55%), the two-pane demo serves UX and Communication (25%), the roadmap serves Product and BD (20%).

---

## Section 13: Safety Architecture

| Layer | Implements | Prevents | Tested by |
|---|---|---|---|
| 1. Input validation | Leaf recomputation in-circuit | A prover supplying any value the attestor did not sign off on (inflated amount, swapped counterparty, extended expiry) | `binding` group, 3 tests |
| 2. Access control | `derive_id(sk) == attestor` check | Anyone but the attestor writing the registry | `access control` group, 2 tests |
| 3. Replay protection | Nullifier set | One lock backing two proofs, including by a different caller | `nullifier` group, 4 tests |
| 4. Temporal bound | `kernel.blockTimeLessThan` | Proving against a stale attestation, or backdating | `expiry` group, 2 tests |
| 5. Graceful degradation | Missing Merkle path throws before any ledger write | A malformed or unregistered claim mutating state | `money path` test 4 |

Five independent layers, each with test coverage. No single-layer defense.

---

## Section 14: Configuration Reference

There is no runtime configuration in Wave 1. No RPC endpoints, no API keys, no chain ids, no addresses. The contract runs in-process against the simulator.

### Credentials Needed

| Variable | Used by | Where to obtain | Required before |
|---|---|---|---|
| (none) | none |, | none |

Wave 1 deliberately requires **zero credentials**. A judge clones and runs. The Wave 2 attestor, which listens to a real Ethereum RPC, will introduce `SOURCE_RPC_URL` and `ATTESTOR_PRIVATE_KEY`; neither exists yet and neither is stubbed, because a `.env` full of unused placeholders is noise.

---

## Section 15: Testing Strategy

| What | File | Command | Status |
|---|---|---|---|
| Contract compiles | `contract/src/inflight.compact` | `compact compile src/inflight.compact out` | PASSING, 3 circuits |
| Full compile with keys | same | `compact compile src/inflight.compact out-full` | PASSING, 6 keys, 14.5s |
| Unit + security + privacy | `contract/test/inflight.test.ts` | `npm test` | PASSING, 23/23 |
| Seed script | `contract/scripts/seed-demo.ts` | `npx tsx scripts/seed-demo.ts` | not yet run |
| Frontend build | `frontend/` | `npm run build` | not yet run |

**Critical tests** (a regression in any of these is a stop-ship): double-spend rejection, amount-inflation rejection, expiry rejection, and the privacy dump assertion.

---

## Section 16: Component Build Order

**Sequential constraints**

1. `inflight.compact` → everything. Nothing can be typed until the compiler emits `index.d.ts`. **DONE.**
2. `test/simulator.ts` → tests, watcher, seed, frontend. All four import it. **DONE.**
3. `test/inflight.test.ts` → gates everything downstream; a red suite means stop. **DONE, 23/23.**
4. `src-ts/types.ts` → watcher, seed.
5. `src-ts/watcher.ts` → seed script.
6. `scripts/seed-demo.ts` → demo screenshots.

**Parallel group (no interdependency, can be built concurrently):**
- `frontend/src/lib/demo.ts` + `frontend/src/App.tsx`
- `README.md` + `LICENSE`
- Slide deck

**P1 deliverability check:** the PRD's P1 outcome is "clears the technical gate and scores Engineering + QA". That is satisfied by components 1-3 alone, all of which are complete. Everything after component 3 is upside, which is the correct risk posture with under a day remaining.

---

## Section 17: Deployment Sequence

| Order | Service | Startup command | Health check | Depends on | Env vars |
|---:|---|---|---|---|---|
| 1 | Contract build | `cd contract && npx compact compile src/inflight.compact out` | `ls out/contract/index.js` | compact toolchain on PATH | none |
| 2 | Test suite | `cd contract && npm install && npm test` | exit 0, "23 passed" | 1 | none |
| 3 | Frontend build | `cd frontend && npm install && npm run build` | `ls dist/index.html` | 1 | none |
| 4 | Vercel deploy | `vercel deploy --prod` (root `frontend/`) | HTTP 200 on the deploy URL | 3 | none |

No Midnight testnet deployment in Wave 1. Toolchain 0.34 targets ledger 9, which is not live on testnet, and the buildathon's Technical Gate requires the contract to *compile*, not to be deployed. Stated rather than hidden.

---

## Section 18: Addresses & External References

| Item | Value |
|---|---|
| Contract address | none, not deployed in Wave 1 |
| Source-chain escrow | simulated; real listener is Wave 2 |
| Explorer links | none applicable |
| Midnight docs | https://docs.midnight.network/ |
| Compact releases | https://github.com/midnightntwrk/compact/releases |
| Runtime package | https://www.npmjs.com/package/@midnight-ntwrk/compact-runtime |

---

## Section 19: Integration Map

| From | To | Protocol | Credential | Health check | Priority |
|---|---|---|---|---|---|
| Test suite | compiled contract | in-process import | none | `npm test` → 23 passed | P0 |
| Simulator | `@midnight-ntwrk/compact-runtime` | npm import | none | `node -e "import('@midnight-ntwrk/compact-runtime')"` | P0 |
| Watcher | compiled contract `pureCircuits` | in-process import | none | `leaf_hash` returns 32 bytes | P1 |
| Frontend | simulator | bundler alias `@contract` | none | `npm run build` exits 0 | P1 |
| Frontend | Vercel | HTTPS | Vercel token (deploy only) | HTTP 200 | P2 |
| Watcher | source-chain RPC | JSON-RPC | `SOURCE_RPC_URL` | **Wave 2, not built** | none |

Wire's test list derives from the P0 and P1 rows. The final row is deliberately out of scope and must not be counted as a broken connection.
