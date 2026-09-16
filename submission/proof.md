# Aval, proof artifacts

Everything below is captured output from running the code on 2026-09-16. Nothing is retyped.

## Toolchain

| Component | Version |
|---|---|
| `compact` devtool | 0.5.2 |
| Compact compiler | 0.34.0 |
| Compact language | 0.26.0 |
| Compact runtime | 0.19.0 |
| Node.js | 25.6.1 |

## The technical gate: the contract compiles

```
$ compact compile src/inflight.compact out-full
Compiling 3 circuits:

$ ls out-full/keys/
prove_funds_in_flight.prover
prove_funds_in_flight.verifier
register_attestation.prover
register_attestation.verifier
register_attestor.prover
register_attestor.verifier
```

Three circuits, six proving and verifier keys. Full source in `captures/compile.txt`.

## Test suite

```
$ npm test
Test Files  1 passed (1)
     Tests  22 passed (22)
  Duration  1.26s
```

Full per-test listing in `captures/tests.txt`. Groups: attestor registration (3), registry access control (2), the money path (4), nullifier and double-spend (4), non-transferable binding (3), block-time expiry (2), privacy assertions (4).

## Ledger state after one real proof

```
$ npx tsx scripts/seed-demo.ts
--- Aval demo seed: produced by real circuit execution ---
attestor registered : true
attestations in tree: 3
fills               : 1
nullifiers spent    : 1
nullifier           : 7fe3e3af80ac5555e7a8980793ed8432e0a78857934d5177ad25937f8eaea0f5
amount in ledger    : absent by construction
```

The amount is not present in public state. Four tests assert this against a full serialisation of the ledger rather than claiming it in prose.

## Six attacks, six reverts produced by the circuit

```
$ npx tsx scripts/attack-demo.ts
  reuse the same lock twice          BLOCKED: this lock has already backed a proof
  inflate the claimed amount         BLOCKED: no merkle path: leaf is not registered
  redirect to a different payee      BLOCKED: no merkle path: leaf is not registered
  extend your own expiry             BLOCKED: no merkle path: leaf is not registered
  prove after expiry                 BLOCKED: attestation expired
  ask for more than is locked        BLOCKED: locked amount below required threshold
```

## Frontend build

```
$ cd frontend && npm run build
dist/index.html                                             0.44 kB
dist/assets/midnight_onchain_runtime_wasm_bg-*.wasm     1,407.21 kB
dist/assets/index-*.css                                     8.81 kB
dist/assets/index-*.js                                    309.93 kB
built in 1.26s
```

The real Midnight WASM runtime bundles into the browser. Requires `vite-plugin-wasm` and `build.target: 'esnext'`.

## What is NOT claimed

- No Midnight testnet deployment. Toolchain 0.34 targets ledger 9, which is not live on testnet; the buildathon gate requires the contract to compile, not to deploy.
- No live Ethereum listener. The source-chain leg is a scripted escrow event in Wave 1.
- In-browser interactive behaviour of the frontend was verified as far as build and HTTP 200 serving. It was not driven through a real browser session.

## Reproduce

```bash
git clone https://github.com/Leihyn/aval && cd aval/contract
npm install && npm test
npx tsx scripts/seed-demo.ts
npx tsx scripts/attack-demo.ts
```

## Indistinguishability (the central claim, made runnable)

```
$ npx tsx scripts/indistinguishability.ts
--- Aval: can an observer tell 50,000 from 5,000,000? ---

  public ledger field    amount = 50,000                        amount = 5,000,000                     same?
  attestor               06b9adbc74b16b6310ac8d6956ebc680...    06b9adbc74b16b6310ac8d6956ebc680...    IDENTICAL
  fills                  1                                      1                                      IDENTICAL
  nullifier              913026c16dbac7908b9c9cc35a2e3b4f...    913026c16dbac7908b9c9cc35a2e3b4f...    IDENTICAL
  spent_size             1                                      1                                      IDENTICAL
  merkle_root            156929904683918661212229...            155683403668170556933635...            differs
```

Note on rigour: an earlier version of the privacy tests asserted the amount was *absent* from a hand-built 4-field object that never contained an amount field, so it could not fail. That was an overclaim and it was replaced. The suite now asserts indistinguishability across amounts 100x apart and across three decades of magnitude, comparing the full public surface structurally so a future leaking field fails the test.
