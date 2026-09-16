# Aval

**Prove money is committed but not yet arrived, so a counterparty can act now instead of waiting for settlement.**

Built on [Midnight](https://midnight.network) for the Midnight Buildathon, Wave 1.

```bash
cd contract && npm install && npm test
# → Tests  22 passed (22)
```

No Docker. No proof server. No wallet. No RPC endpoint. No API keys. Clone and run.

---

## The problem

A treasury desk moves $2M from Ethereum to a counterparty. The funds leave the source chain immediately. They arrive somewhere between eight minutes and seven days later depending on the bridge. During that window the money exists, it is irrevocably committed, and it is useless. The counterparty will not release their side against a screenshot, so both parties wait.

You have two options today. Wait, or reveal the amount. Revealing it tells your counterparty exactly how much room you have, which is not a privacy nicety, it is your negotiating position.

That waiting window is a gap between a fact being **true** and that fact being **publicly verifiable**. Aval closes it.

## What Aval does

Alice locks funds in an escrow on a source chain. She proves to Bob's Midnight contract that the locked amount clears his threshold and is earmarked for him specifically, **without revealing how much she locked, which lock it was, or who she is.** Bob's contract verifies and releases his leg immediately.

The public ledger records a Merkle root, a nullifier, and a fill count. It never records an amount.

## How it works

```
 SOURCE CHAIN              ATTESTOR                    MIDNIGHT
 ┌──────────┐    Locked   ┌──────────┐  register_    ┌─────────────────────┐
 │  escrow  │───────────► │ watcher  │ ─attestation─►│ HistoricMerkleTree  │
 └──────────┘             └────┬─────┘   (leaf hash) └─────────────────────┘
                               │ preimage (off-chain)          ▲
                               ▼                               │
                          ┌──────────┐   prove_funds_in_flight │
                          │  Alice   │─────────────────────────┘
                          └──────────┘   witnesses: lock_id, amount, salt, path
```

### The dual ledger

| Stays private (witness) | Becomes public (ledger) |
|---|---|
| `lock_id` | Merkle root |
| `amount` | nullifier |
| `salt` | fill counter |
| Merkle path | attestor id |

Six `disclose()` call sites bridge the two, each annotated in the source with what an observer actually learns. Compact's information-flow analysis **refuses to compile** if a witness value reaches the ledger without one. Three drafts of this contract were rejected by that check before it compiled, which is the dual-ledger model being enforced by the type system rather than by developer discipline.

> A note worth internalising if you are new to Compact: `disclose()` does not itself publish anything. It clears the compiler's private-data check so a value may cross into a public position; the **ledger write** is what makes it visible. Exported circuit *parameters* are treated as private too, not just witnesses.

### Security properties, each with a test

| Property | Mechanism | Test |
|---|---|---|
| One lock backs exactly one proof | nullifier derived from private `lock_id` + `salt` | 4 tests |
| An attestation is not transferable | `counterparty` and `expiry` hashed into the leaf | 3 tests |
| The prover cannot inflate the amount | leaf recomputation in-circuit | 1 test |
| Attestations expire | `kernel.blockTimeLessThan`, ledger block time, not a caller-supplied timestamp | 2 tests |
| Only the attestor writes the registry | derived-id equality check | 2 tests |
| The amount never reaches public state | asserted against a full ledger dump | 4 tests |

## Quick start

**Prerequisites, stated in full** (this is deliberate: Midnight's own docs have an open issue about unnamed prerequisites):

- Node.js >= 20 (developed on 25.6.1)
- The Compact toolchain, only if you want to recompile the contract:
  ```bash
  curl --proto '=https' --tlsv1.2 -LsSf \
    https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
  compact update
  ```
- **Not required:** Docker, the Midnight proof server, the Lace wallet, a faucet, an RPC endpoint.

**Run the tests:**
```bash
cd contract
npm install
npm test          # 22 passed
```

**Recompile the contract:**
```bash
cd contract
compact compile src/inflight.compact out            # 3 circuits
compact compile src/inflight.compact out-full       # + 6 proving/verifier keys, ~15s
```

**Seed demo state (real circuit execution, not fixtures):**
```bash
cd contract && npx tsx scripts/seed-demo.ts
```

**Run the demo UI:**
```bash
cd frontend && npm install && npm run dev
```

## Verification

Everything below was produced by running the code, not by describing it.

| Check | Command | Result |
|---|---|---|
| Contract compiles (the Technical Gate) | `compact compile src/inflight.compact out` | 3 `.zkir` circuits |
| Proving keys generate | `compact compile src/inflight.compact out-full` | 6 keys, 14.5s |
| Test suite | `npm test` | **22 / 22 passed**, 651ms |
| Seed script | `npx tsx scripts/seed-demo.ts` | 3 attestations, 1 fill, amount absent |
| Frontend build | `cd frontend && npm run build` | 1.4MB wasm + 310KB js, exit 0 |

`FEATURE-OBSERVABLES.md` lists 13 observables with the exact command that proves each one.

**Toolchain:** compact 0.5.2, compiler 0.34.0, language 0.26.0, runtime 0.19.0.

## Trust model

Read this part. It is the honest centre of the design.

Midnight cannot see Ethereum. So how does the contract know Alice really locked funds? There is no trustless answer without a light client, so Aval does not pretend otherwise. Instead it makes the trusted party someone whose trust is free.

**Bilateral, which is what ships here: the counterparty runs the attestor.** Bob is the one giving up value, so Bob watches the source chain himself. The trust assumption collapses to "Bob trusts Bob's own node", which is not a trust assumption at all.

The obvious objection: if Bob can see the lock, why does he need Alice's proof? Because **Bob's contract cannot see Ethereum even though Bob can.** Bob registers what his node observed; Alice's proof buys her privacy from everyone who is not Bob, and buys the contract an on-chain-verifiable fact to gate on. Both are real, and neither requires a third party.

**The ladder above that,** none of it built in Wave 1:

1. k-of-n attestor quorum for small multilateral settings
2. Bonded, slashable attestors for an open network. A fabricated `lockId` is provably contradicted by the source-chain escrow, so anyone can slash. Trust becomes economics.
3. A source-chain light client, for actual trustlessness.

**Three design choices that already shrink the assumption:**

- **Attest to a lock, not a balance.** A lock in escrow is monotone, irrevocable, and uniquely identified. A balance is mutable. This removes an entire class of attack.
- **Every attestation expires**, enforced by ledger block time.
- **The nullifier is bound to the lock**, so even a malicious attestor cannot let Alice spend one lock twice.

**Residual assumption, stated plainly:** a malicious attestor can fabricate a lock that does not exist. That is the same trust model as every fast-finality bridge shipping today. Aval adds privacy to that model. It does not claim to beat it.

## What is NOT built

Being specific about this is part of the submission.

- **No Midnight testnet deployment.** Toolchain 0.34 targets ledger 9, which is not live on testnet, and the buildathon's Technical Gate requires the contract to *compile*, not to deploy. Compiling is verified above.
- **No live Ethereum listener.** The source-chain leg is a scripted escrow event. A real listener is Wave 2 and would need `SOURCE_RPC_URL`.
- **No encryption on the preimage channel.** In Wave 1 the attestor hands Alice the preimage by direct return inside the demo.
- **Only one vertical.** Identity preconditions, private solvency, and invoice factoring are roadmap, not code.

## Roadmap

The primitive is "prove a committed-but-unsettled fact satisfies a predicate". Funds in flight is one predicate.

| Wave | Vertical | Predicate |
|---|---|---|
| 1 (this) | Funds in flight | `amount >= required AND beneficiary == counterparty` |
| 2 | Identity preconditions | `kyc_passed AND jurisdiction NOT IN sanctioned` |
| 2 | Real source-chain attestor | live listener, k-of-n quorum, encrypted preimage channel |
| 3 | Private solvency | `reserves >= liabilities` |
| 3 | Invoice factoring | `invoice_valid AND unpaid AND amount >= advance` |

## Developer-experience notes for the Midnight team

Offered because a prior Midnight hackathon scored "feedback on Midnight's developer experience" as a judging criterion.

1. **`Secp256k1Point`, `Secp256k1Scalar`, `Secp256k1Base` and `secp256k1EcdsaVerify` are unbound in the shipped 0.34.0 standard library**, although the 0.34.0-rc.1 release notes describe them in detail. `Cell` is also unbound. This cost a design cycle: the natural architecture here verifies an attestor's ECDSA signature in-circuit, and that is currently impossible. The Merkle-membership design we moved to turned out to be more private, but we reached it by compiling probes, not by reading docs.
2. **`CircuitContext` has no `transactionContext`** in runtime 0.19.0. State is at `ctx.callContext.currentQueryContext.state`. This is the first thing that breaks when writing a simulator and it is not obvious from the types.
3. **`vite-plugin-wasm` plus `build.target: 'esnext'` is required** to bundle the runtime for a browser, because it ships an ESM-integrated WASM core. `vite-plugin-top-level-await` fails with "missing field `type`" from swc; esnext handles top-level await natively, so it should be omitted. A line in the docs would save people an hour.
4. **The information-flow errors are excellent.** "potential witness-value disclosure must be declared but is not", with the full path through the program, is the single best part of the developer experience. It caught three real leaks in this contract.

## Repository layout

| Path | What |
|---|---|
| `contract/src/inflight.compact` | The contract, 3 circuits |
| `contract/test/simulator.ts` | In-process harness, injectable block time |
| `contract/test/inflight.test.ts` | 22 tests |
| `contract/src-ts/watcher.ts` | Attestor: source chain to Midnight |
| `contract/scripts/seed-demo.ts` | Real-execution demo seed |
| `frontend/` | Two-pane demo |
| `PRD.md`, `ARCHITECTURE.md`, `PLAN.md` | Product spec, full code reference, build plan |
| `FEATURE-OBSERVABLES.md` | 13 observables and the command proving each |

## License

Apache License 2.0. See [LICENSE](./LICENSE).

## Built by

Onatola Timilehin Faruq, [github.com/Leihyn](https://github.com/Leihyn)

Built on [Midnight](https://midnight.network). Contract language: [Compact](https://docs.midnight.network/compact).
