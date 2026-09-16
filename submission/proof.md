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
Compiling 2 circuits:

$ ls out-full/keys/
prove_funds_in_flight.prover
prove_funds_in_flight.verifier
register_attestation.prover
register_attestation.verifier
```

Two circuits, four proving and verifier keys. Full source in `captures/compile.txt`.

## Test suite

```
$ npm test
      Tests  31 passed (31)
   Start at  09:38:42
   Duration  1.39s (transform 276ms, setup 0ms, collect 561ms, tests 949ms, environment 0ms, prepare 246ms)
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
--- Aval: six real attacks, six real revert strings ---

  reuse the same lock twice          BLOCKED: this lock has already backed a proof
  inflate the claimed amount         BLOCKED: no merkle path: leaf is not registered
  redirect to a different payee      BLOCKED: no merkle path: leaf is not registered
  extend your own expiry             BLOCKED: no merkle path: leaf is not registered
  prove after expiry                 BLOCKED: attestation expired
  ask for more than is locked        BLOCKED: locked amount below required threshold

  All six blocked by the circuit, not by application code.
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

  public field   amount = 50,000      amount = 5,000,000    same?
  ------------------------------------------------------------------------
  attestor       06b9adbc74b16b63..   06b9adbc74b16b63..    IDENTICAL
  fills          1                    1                     IDENTICAL
  nullifier      913026c16dbac790..   913026c16dbac790..    IDENTICAL
  spent_size     1                    1                     IDENTICAL
  merkle_root    1569299046839186..   1556834036681705..    DIFFERS

  Every field an observer can read is identical except the merkle root,
  and a root is a hash: it commits to the leaf without revealing it.
  The nullifier is byte-identical across a 100x difference in amount.
```

Note on rigour: an earlier version of the privacy tests asserted the amount was *absent* from a hand-built 4-field object that never contained an amount field, so it could not fail. That was an overclaim and it was replaced. The suite now asserts indistinguishability across amounts 100x apart and across three decades of magnitude, comparing the full public surface structurally so a future leaking field fails the test.

## Verified in a real browser (headless Chromium)

The frontend is not a mock: it imports the same simulator the tests use and executes the
compiled circuits in the page. Verified by driving a real browser, not by assertion.

| Check | Result |
|---|---|
| Midnight WASM runtime instantiates | `boot: ready` |
| Ledger pane `amount` row | reads `not present` |
| Indistinguishability auto-run | 4 IDENTICAL / 1 DIFFERS (only the merkle root moves) |
| Clicking "Prove funds in flight" | threshold cleared, release path shown, `fills` goes to 1 |
| Console errors | none |

Screenshots: `submission/screenshots/ui-initial.png`, `submission/screenshots/ui-after-proof.png`.

### The privacy claim is falsifiable, and was falsified on purpose

The ledger pane states: "This list is re-checked against the live ledger object on every
update. If one of these ever appeared on chain, this pane would say so."

That claim was tested by deliberately injecting an `amount` field into `readLedger` and
rebuilding. The first attempt exposed a real bug: an undeclared ledger key made
`FIELD[k].label` throw at three call sites, so React white-screened instead of rendering
the failure banner. The claim would have been silently untrue. All three sites were
guarded, and the injection was re-run: the pane then rendered

```
Privacy claim failed
The ledger object exposes: amount
```

The injection was reverted. This is the same discipline applied to the test suite, where an
earlier "the amount is absent" assertion could not fail and was replaced with
indistinguishability.
