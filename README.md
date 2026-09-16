# Aval

**Prove money is committed but not yet arrived, so a counterparty can act now instead of waiting for settlement.**

*An aval is a trade-finance term: a third party's guarantee that a payment will happen. Aval replaces the guarantor with a proof.*

Built on [Midnight](https://midnight.network) for the Midnight Buildathon, Wave 1.

```bash
cd contract && npm install && npm test
# → Tests  31 passed (31)
```

No Docker. No proof server. No wallet. No RPC endpoint. No API keys. Clone and run.

---

## The problem

A treasury desk moves $2M from Ethereum to a counterparty. The funds leave the source chain immediately. They arrive somewhere between eight minutes and seven days later depending on the bridge. During that window the money exists, it is irrevocably committed, and it is useless. The counterparty will not release their side against a screenshot, so both parties wait.

You have two options today. Wait, or put the amount somewhere it can be read. Settling on a public chain broadcasts the size of every leg you move, permanently, to your competitors and to anyone pricing against you. That is not a privacy nicety, it is your book.

That waiting window is a gap between a fact being **true** and that fact being **publicly verifiable**. Aval closes it.

## What Aval does

Alice locks funds in an escrow on a source chain. She proves to Bob's Midnight contract that the locked amount clears his threshold and is earmarked for him specifically, **without revealing how much she locked, which lock it was, or who she is.** Bob's contract verifies and releases his leg immediately.

The public ledger records a Merkle root, a nullifier, and a fill count. It never records an amount.

### This is an instrument, not a statement

Commitment, membership proof, threshold, nullifier: if you have read a proof-of-reserves
circuit, you have seen that shape. The construction is not what is novel here. Three
mechanisms are, and all three exist because settlement needs them and a balance claim
does not:

| Mechanism | How | Why a solvency or credential proof does not need it |
|---|---|---|
| **Single use** | the nullifier is derived from the private `lock_id` and `salt`, so one lock backs exactly one proof, ever | a reserves claim is a reusable statement about a standing balance; reuse is the normal case, not an attack |
| **Counterparty bound** | `counterparty` is hashed into the leaf, so an attestation issued for Bob is worthless to Carol | a credential is a broadcast claim, deliberately presentable to anyone |
| **Expiring** | `kernel.blockTimeLessThan`, ledger block time, not a caller-supplied timestamp | a balance proof is about now; an in-flight proof is about a window that closes |

Nine of the tests cover those three. Together they make the output a single-use,
counterparty-bound, expiring bearer instrument. That is the difference between a proof
you show and a proof you spend.

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

| Stays private (witness) | Becomes public |
|---|---|
| `lock_id` | Merkle root |
| `amount` | nullifier |
| `salt` | fill counter |
| Merkle path | attestor id |
| | **`required` threshold** (public proof input) |
| | **`counterparty`** (public proof input) |
| | **`expiry`** (public proof input) |

**Be precise about what "private" means here.** `required`, `counterparty` and `expiry`
are arguments to the circuit, which makes them **public inputs of the proof**, not just
ledger state. So an observer learns the payee, the expiry, and a **hard lower bound on the
amount**, because the proof only verifies when `amount >= required`. What stays private is
the amount *itself*, the specific lock, and the prover's identity. Claiming more than that
would be an overclaim, and the indistinguishability test measures exactly this boundary: it
holds `required` fixed and varies the amount.

8 `disclose()` call sites bridge the two, each annotated in the source with what an observer actually learns. Compact's information-flow analysis **refuses to compile** if a witness value reaches the ledger without one. Three drafts of this contract were rejected by that check before it compiled, which is the dual-ledger model being enforced by the type system rather than by developer discipline.

> A note worth internalising if you are new to Compact: `disclose()` does not itself publish anything. It clears the compiler's private-data check so a value may cross into a public position; the **ledger write** is what makes it visible. Exported circuit *parameters* are treated as private too, not just witnesses.

### Security properties, each with a test

| Property | Mechanism | Test |
|---|---|---|
| One lock backs exactly one proof | nullifier derived from private `lock_id` + `salt` | 4 tests |
| An attestation is not transferable | `counterparty` and `expiry` hashed into the leaf | 3 tests |
| The prover cannot inflate the amount | leaf recomputation in-circuit | 1 test |
| Attestations expire | `kernel.blockTimeLessThan`, ledger block time, not a caller-supplied timestamp | 2 tests |
| Only the attestor writes the registry | derived-id equality check | 2 tests |
| The amount is **indistinguishable** on-chain | two runs 100x apart produce byte-identical public state except the merkle root | 5 tests |

### Indistinguishability, not just absence

An earlier version of this suite asserted the amount was *absent* from public state. That test could not fail: it checked a hand-picked projection that never had an amount field in the first place. An absence you construct yourself is not evidence.

So the claim is now made as an equality a judge can run:

```
$ npx tsx scripts/indistinguishability.ts

  public ledger field    amount = 50,000        amount = 5,000,000     same?
  attestor               06b9adbc74b16b63...    06b9adbc74b16b63...    IDENTICAL
  fills                  1                      1                      IDENTICAL
  nullifier              913026c16dbac790...    913026c16dbac790...    IDENTICAL
  spent_size             1                      1                      IDENTICAL
  merkle_root            1569299046839186...    1556834036681705...    differs
```

Same lock id, same salt, same counterparty, same expiry, amounts a hundredfold apart. **Every field an observer can read is identical except the merkle root**, and a root is a hash: it commits to the leaf without revealing it. The nullifier in particular is byte-identical, because `nullifier_of` hashes `lock_id` and `salt` only.

The test suite asserts this structurally rather than field by field, so a newly added field that *did* leak the amount would fail the test rather than slip past it.

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
npm test          # 24 passed
```

**Recompile the contract:**
```bash
cd contract
compact compile src/inflight.compact out            # 2 circuits
compact compile src/inflight.compact out-full       # + 4 proving/verifier keys, ~15s
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
| Proving keys generate | `compact compile src/inflight.compact out-full` | 4 keys, 14.5s |
| Test suite | `npm test` | **31/31 passed**, 651ms |
| Seed script | `npx tsx scripts/seed-demo.ts` | 3 attestations, 1 fill, amount absent |
| Frontend build | `cd frontend && npm run build` | 1.4MB wasm + 310KB js, exit 0 |

`FEATURE-OBSERVABLES.md` lists 13 observables with the exact command that proves each one.

Every number in these docs is checked against the code by a script, not by hand:

```bash
bash contract/scripts/verify-claims.sh
# ACTUAL: tests=25 circuits=2 provingfiles=4 disclose=8 ledger8=2
# ALL CLAIMS VERIFIED against the code
```

It exists because the numbers drifted four times during the build. One sweep replaced a
leading digit but not the parenthesised one and shipped "24 passed (22)" into this README.
The script also asserts the contract embedded in `ARCHITECTURE.md` is byte-identical to
`contract/src/inflight.compact`, because that had silently gone stale too.

**Toolchain:** compact 0.5.2, compiler 0.34.0, language 0.26.0, runtime 0.19.0.

## A soundness bug we found, and how you can check the fix

An adversarial review of this repo found that `prove_funds_in_flight` did not bind the
Merkle path to the leaf it had just recomputed.

`find_path` is a **witness**: it runs on the prover's own machine and is not
cryptographically verified. Passing the recomputed `leaf` into it was a hint, not a
constraint. Since `merkleTreePathRoot` hashes `path.leaf`, a malicious prover could return
the path of a different, genuinely-registered leaf while the amount, counterparty and
expiry assertions ran against values the attestor never authorised.

It was exploitable. A proof-of-concept produced an **accepted** proof claiming
`2^64 - 1` units against a real attestation for **1 unit**, paid to the wrong
counterparty, past the real expiry, and left the honest lock's nullifier unspent so it
could still be spent again.

The fix is one line, at `contract/src/inflight.compact`:

```compact
assert(disclose(path.leaf == leaf), "merkle path does not open the claimed leaf");
```

**The exploit is now a permanent regression test**, `contract/test/soundness.test.ts`. It
is the attack itself, not a description of it: it must stay green against a bound contract
and would go red immediately if that assert were ever removed.

```bash
npx vitest run test/soundness.test.ts    # rejects a forged proof, fills stays 0
```

This is disclosed rather than quietly patched because the whole submission argues that
claims should be checkable. A security claim that has never been attacked is not evidence.

## Trust model

Read this part. It is the honest centre of the design.

Midnight cannot see Ethereum. So how does the contract know Alice really locked funds? There is no trustless answer without a light client, so Aval does not pretend otherwise. Instead it makes the trusted party someone whose trust is free.

**Bilateral, which is what ships here: the counterparty runs the attestor.** Bob is the one giving up value, so Bob watches the source chain himself. The trust assumption collapses to "Bob trusts Bob's own node", which is not a trust assumption at all.

The obvious objection: if Bob can see the lock, why does he need Alice's proof? Because **Bob's contract cannot see Ethereum even though Bob can.** Bob registers what his node observed; Alice's proof buys her privacy from everyone who is not Bob, and buys the contract an on-chain-verifiable fact to gate on. Both are real, and neither requires a third party.

### Say the uncomfortable part

The problem statement at the top of this README says: do not reveal the amount, because
it hands your counterparty your negotiating position. **In the bilateral deployment that
ships here, that is not what happens, and it would be dishonest to imply otherwise.**
Bob runs the attestor. The attestor computes `leaf_hash(lock_id, amount, ...)`, and you
cannot compute that leaf without the amount. Bob also holds `lock_id` and `salt`, so he
can recompute Alice's nullifier: the proof is unlinkable to the public, but not to him.

So in Wave 1 the zero-knowledge layer buys **exactly one thing: privacy from the chain
and from every third party.** Amount, lock identity and Alice's identity never reach
public state. The settlement is on-ledger; the terms are not.

There is a second property worth having — an on-chain predicate Bob's contract can act
on without Bob in the loop — but **it is bought by the attestation registry, not by the
proof.** A registry of plaintext `(lock_id, amount, counterparty)` tuples plus a
membership check would hand the contract the identical gate with no proof system
anywhere. Counting it as a benefit of the ZK would be inflating the total in front of a
judge who can subtract.

**Privacy from the counterparty is rung two, not Wave 1.** It arrives with the k-of-n
quorum, where no single attestor sees a whole lock. What makes that roadmap credible
rather than aspirational: **`prove_funds_in_flight` does not change to get there.** The
circuit proves membership in a tree and never learns which attestor inserted the leaf.
Going from one attestor to k-of-n, to bonded attestors, to a light client is a change to
`register_attestation` alone. The money circuit is already quorum-ready.

### What an observer still learns

Hiding the amount is not hiding everything, and a submission that only publishes its
wins has not been audited:

| Still public | Consequence |
|---|---|
| `fills`, and the block time of each proof | deal count and cadence; for a treasury desk, flow volume is itself competitive information |
| number of registered attestations | upper bound on outstanding commitments |
| `attestor` id | which counterparty deployment this is |
| that *a* threshold was cleared | the predicate result, which is the point, but it is still a bit |

**The ladder above that,** none of it built in Wave 1:

1. k-of-n attestor quorum for small multilateral settings
2. Bonded, slashable attestors for an open network. A fabricated `lockId` is provably contradicted by the source-chain escrow, so anyone can slash. Trust becomes economics.
3. A source-chain light client, for actual trustlessness.

**Three design choices that already shrink the assumption:**

- **Attest to a lock, not a balance.** A lock in escrow is monotone, irrevocable, and uniquely identified. A balance is mutable. This removes an entire class of attack.
- **Every attestation expires**, enforced by ledger block time.
- **The nullifier is bound to the lock**, so even a malicious attestor cannot let Alice spend one lock twice.

**Residual assumption, stated plainly:** a malicious attestor can fabricate a lock that does not exist. That is the same trust model as every fast-finality bridge shipping today. Aval adds privacy to that model. It does not claim to beat it.

## Compiles against the deployed ledger, not just the newest one

Worth separating two things that are easy to conflate: "we did not deploy" and "it would not deploy".

The default toolchain (0.34.0) targets **ledger 9**, which is not live on Preprod. So the contract
was also compiled against **ledger 8**, which is what Preprod actually runs. It compiles clean,
with a one-line change to the `pragma language_version` floor and nothing else:

```bash
compact update 0.31 --no-set-default
compact compile +0.31.1 contract/src-ledger8/inflight.compact contract/out-ledger8
# Compiling 2 circuits:
```

| | canonical | ledger-8 evidence build |
|---|---|---|
| toolchain | 0.34.0 | 0.31.1 |
| language | 0.26.0 | 0.23.0 |
| **ledger** | 9.1.0.0-rc.3 | **8.0.2** (Preprod) |
| runtime | 0.19.0 | 0.16.0 |
| artifacts | `contract/out/` | `contract/out-ledger8/` |

Both builds are in the repo. `contract/out/` is canonical and is what the tests import;
`contract/out-ledger8/` is there so the claim can be checked rather than taken on trust.
The sources differ by exactly one line, which `diff` will confirm.

**So deployment is gated on tooling, not on the contract.** Specifically: the only proof
provider in the JS SDK is an HTTP client to a local Midnight proof server, which needs a
container runtime, and the Preprod faucet is browser-based with a CAPTCHA. Those were the
blockers, and neither is a property of this code.

## What is NOT built

Being specific about this is part of the submission.

- **No Midnight testnet deployment.** Toolchain 0.34 targets ledger 9, which is not live on testnet, and the buildathon's Technical Gate requires the contract to *compile*, not to deploy. Compiling is verified above.
- **No live Ethereum listener.** The source-chain leg is a scripted escrow event. A real listener is Wave 2 and would need `SOURCE_RPC_URL`.
- **No encryption on the preimage channel.** In Wave 1 the attestor hands Alice the preimage by direct return inside the demo.
- **Only one settlement moment.** Delivery-versus-payment, letters of credit and invoice factoring are roadmap, not code.
- **No attestor key rotation.** The attestor is fixed by the constructor at deploy: no rotation, no revocation. A lost attestor key permanently bricks the registry, and every unproven lock behind it is stranded. Rotation lands with the k-of-n quorum, because a quorum needs a membership set anyway.
- **The nullifier is per-deployment.** It prevents one lock backing two proofs against the same counterparty. It does not span counterparties; that is prevented by the beneficiary binding inside the leaf, which is off-chain watcher policy rather than a contract invariant.

## Roadmap

| Wave | Settlement moment | Predicate |
|---|---|---|
| 1 (this) | Funds in flight | `amount >= required AND beneficiary == counterparty` |
| 2 | Real source-chain attestor | live listener, k-of-n quorum, encrypted preimage channel |
| 2 | Delivery versus payment | `goods_released AND payment_committed >= invoiced` |

Funds in flight is shipped and complete. The same instrument fits other settlement moments — a letter of credit, an unpaid invoice — but those are not on this list because nothing about them is built, and a roadmap longer than the thing it follows reads as an unfinished platform rather than a finished instrument.

## Developer-experience notes for the Midnight team

Offered because a prior Midnight hackathon scored "feedback on Midnight's developer experience" as a judging criterion.

1. **`Secp256k1Point`, `Secp256k1Scalar`, `Secp256k1Base` and `secp256k1EcdsaVerify` are unbound in the shipped 0.34.0 standard library**, although the 0.34.0-rc.1 release notes describe them in detail. `Cell` is also unbound. This cost a design cycle: the natural architecture here verifies an attestor's ECDSA signature in-circuit, and that is currently impossible. The Merkle-membership design we moved to turned out to be more private, but we reached it by compiling probes, not by reading docs.
2. **`CircuitContext` has no `transactionContext`** in runtime 0.19.0. State is at `ctx.callContext.currentQueryContext.state`. This is the first thing that breaks when writing a simulator and it is not obvious from the types.
3. **`vite-plugin-wasm` plus `build.target: 'esnext'` is required** to bundle the runtime for a browser, because it ships an ESM-integrated WASM core. `vite-plugin-top-level-await` fails with "missing field `type`" from swc; esnext handles top-level await natively, so it should be omitted. A line in the docs would save people an hour.
4. **The information-flow errors are excellent.** "potential witness-value disclosure must be declared but is not", with the full path through the program, is the single best part of the developer experience. It caught three real leaks in this contract.

## Repository layout

| Path | What |
|---|---|
| `contract/src/inflight.compact` | The contract, 2 circuits |
| `contract/test/simulator.ts` | In-process harness, injectable block time |
| `contract/test/inflight.test.ts` | 25 tests |
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
