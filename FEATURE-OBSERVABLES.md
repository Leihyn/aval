# Aval: Feature Observables

Each P0/P1 feature has one verifiable observable: a check that proves the feature
works, not merely that the code exists. `Verified` reflects actual execution on this
machine, not intent.

| ID | Feature | Observable | Test command | Sentinel failure | Verified |
|---|---|---|---|---|:---:|
| F-001 | Compact contract compiles (THE GATE) | `out/zkir/` contains 3 `.zkir` files and `out/contract/index.d.ts` exists | `cd contract && compact compile src/inflight.compact out && ls out/zkir` | zero `.zkir` files emitted | **YES** |
| F-002 | Proving keys generate | `out-full/keys/` contains 3 `.prover` and 3 `.verifier` | `compact compile src/inflight.compact out-full && ls out-full/keys` | fewer than 6 key files | **YES** |
| F-003 | Threshold proof succeeds when amount clears | `fills` counter increments 0 to 1 | `npx vitest run -t "proves a registered lock clears the threshold"` | `fills` stays 0n | **YES** |
| F-004 | Threshold proof fails when amount is short | circuit throws matching `/below required threshold/` | `npx vitest run -t "rejects a lock below the required threshold"` | call resolves instead of throwing | **YES** |
| F-005 | Amount never reaches public state | full JSON dump of public ledger does NOT contain the amount string | `npx vitest run -t "never exposes the locked amount"` | dump contains `50000` | **YES** |
| F-006 | One lock backs exactly one proof | second proof on same lock throws `/already backed a proof/`, `fills` stays 1 | `npx vitest run -t "rejects the same lock being proven twice"` | `fills` reaches 2n | **YES** |
| F-007 | Attestation is non-transferable | proof against a different counterparty finds no Merkle path | `npx vitest run -t "rejects replaying an attestation"` | proof succeeds for Carol | **YES** |
| F-008 | Prover cannot inflate the amount | inflated `amount` produces a leaf with no path | `npx vitest run -t "rejects a prover who inflates"` | proof succeeds at inflated amount | **YES** |
| F-009 | Expiry enforced by ledger block time | accepted at t=8999, rejected at t=9001 with `/expired/` | `npx vitest run -t "expiry"` | accepted at t=9001 | **YES** |
| F-010 | Registry is attestor-gated | non-attestor write throws `/not the attestor/` | `npx vitest run -t "rejects a non-attestor"` | leaf inserted by a stranger | **YES** |
| F-011 | Attestor secret key never published | published `attestor` id differs from the secret key bytes | `npx vitest run -t "never writes the attestor secret key"` | published value equals the key | **YES** |
| F-012 | Seed produces state by real execution | script prints `fills: 1` from a genuine circuit run | `npx tsx scripts/seed-demo.ts` | hand-written JSON used instead | **YES** |
| F-013 | Frontend build bundles the Midnight WASM runtime | `dist/` contains index.html, a 1.4MB .wasm and a 310KB .js; build exits 0 | `cd frontend && npm run build` | build fails on "ESM integration proposal for Wasm" | **YES** |

**13 of 13 observables verified by execution.** F-013 covers the production build; in-browser interactive behaviour is verified separately at livetest.
