## What it does

Aval proves money is **committed but not yet arrived**, so a counterparty can release now, not at settlement.

Alice locks funds in escrow on a source chain. She proves to Bob's Midnight contract that the locked amount clears his threshold and is earmarked for him, **without revealing how much she locked, which lock it was, or who she is**.

The public ledger records a Merkle root, a nullifier and a fill count. It never records an amount.

Live demo: https://aval-dusky.vercel.app

Verify it in under a minute. No Docker, no proof server, no wallet:

```bash
git clone https://github.com/Leihyn/aval && cd aval/contract
npm install && npm test        # 31 passed
```

## The problem it solves

$2M leaves Ethereum at 09:00 and lands at 09:41. For 41 minutes the money is real, irrevocably committed, and **useless**, because nobody releases against a screenshot.

Your options are to wait, or to settle in public and broadcast the size of every leg you move, permanently, to your competitors. That is not a privacy nicety, it is your book. That window is the gap between a fact being **true** and being **publicly verifiable**. It is where cross-chain working capital dies.

**This is an instrument, not a statement.** Commitment plus membership proof plus threshold is a common shape. What is not: the proof is **single use** (a nullifier from the private `lock_id` and `salt`), **counterparty bound** (the payee is hashed into the leaf), and **expiring** (`kernel.blockTimeLessThan` against ledger time). Settlement needs all three; a balance claim needs none.

A proof you **spend**, not one you show.

## Challenges I ran into

**There is no in-circuit ECDSA.** `Secp256k1Point`, `Secp256k1Scalar` and `secp256k1EcdsaVerify` are **unbound in the shipped 0.34.0 standard library**, although the release notes describe them. Found by compiling probes, not by reading docs.

**Two security bugs, both found by adversarial review, both exploited before fixing.**

1. **A total soundness break.** `prove_funds_in_flight` never bound the witness supplied Merkle path to the leaf it recomputed. `find_path` is a **witness**: it runs on the prover machine and is never verified, so passing the leaf in was a hint, not a constraint. A proof of concept produced an **accepted** proof claiming `2^64-1` units against a real 1 unit attestation, paid to the wrong payee, past expiry. One `assert` fixed it.
2. **A permissionless bootstrap.** `register_attestor()` was callable by anyone, so a stranger could front run deployment and **permanently brick the contract**. Replaced with a constructor.

Both are now regression tests that **are the attack**, disclosed in the README.

## Technologies I used

**Compact** (language 0.26.0, compiler 0.34.0): 2 circuits plus constructor. **`compact-runtime` 0.19.0**, so circuits run in process and in the browser. **TypeScript and vitest**: 31 tests, simulator harness with injectable block time. **React 19, Vite 6, Tailwind v4** for the demo, with **`vite-plugin-wasm`** and an `esnext` target for Midnight's WASM core (`vite-plugin-top-level-await` breaks on it).

## How we built it

A `HistoricMerkleTree<10, Bytes<32>>` holds attestation commitments. The attestor registers `leaf_hash(lock_id, amount, counterparty, expiry, salt)`, a hash that reveals nothing. The holder proves membership with a privately supplied path, and the circuit:

1. recomputes the leaf and **binds the path to it** (the fix above)
2. discloses only the computed **root**, never the path or leaf, so the proof is unlinkable to a specific attestation
3. asserts `kernel.blockTimeLessThan(expiry)` against ledger block time, not a caller timestamp
4. discloses only the **boolean** `amount >= required`
5. derives a nullifier from the private `lock_id` and `salt`, discloses only that, and spends it

**8 `disclose()` call sites** bridge private to public, each annotated with what it reveals. Compact **refuses to compile** if a witness reaches the ledger without one: three drafts were rejected before this compiled.

## What we learned

**`disclose()` does not publish**, it clears the compiler's private data check; the **ledger write** is what makes a value visible. Exported circuit *parameters* count as private too, not just witnesses.

**Witness values are adversarial input.** The first 23 tests all shared one honest `find_path`, so 23 of 23 green said nothing about whether a hostile prover could substitute a different path.

**A claim that cannot fail is not evidence.** Three claims here were unfalsifiable: a privacy test that checked an object with no amount field, a UI banner that would white screen instead of reporting a leak, and the Merkle binding. All three were caught by attacking them. Every number in the docs is now checked against the code by `contract/scripts/verify-claims.sh`, because they drifted four times.

**Be precise about privacy.** `required`, `counterparty` and `expiry` are **public proof inputs**: an observer learns the payee, the expiry and a lower bound, never the amount, the lock, or who proved it.

## What's next for Aval

**Wave 2:** a real source chain attestor with a live Ethereum listener, a k of n quorum, an encrypted preimage channel, and the identity precondition predicate.

**Trust model, stated plainly.** Midnight cannot see Ethereum, and there is no trustless answer without a light client. So the counterparty runs the attestor: their *contract* cannot see Ethereum even though they can. Above that: quorum, then bonded and slashable attestors, then a light client. **Residual: a malicious attestor can fabricate a lock**, the same model as every fast finality bridge shipping today. Aval adds privacy to it, it does not claim to beat it.

**On deployment.** The toolchain targets ledger 9, which is not live on Preprod, so the contract is also compiled against **ledger 8**, which Preprod runs. **Both builds are committed**, so the claim can be diffed.