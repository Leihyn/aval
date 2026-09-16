# AKINDO submit form: Aval, Wave 1

This is the **Submit** form, which is not the Create Product form. Different fields.

---

## Product Category  *(required, max 3)*

```
Market Infrastructure
DeFi
Privacy
```

---

## Updates in this Wave  *(required, max 3,000 characters)*

```
Aval proves money is committed but not yet arrived, so a counterparty can release now, not at settlement. Wave 1 built the primitive end to end.

DELIVERABLES
Repo: https://github.com/Leihyn/aval (Apache-2.0, midnightntwrk topic)
Live demo: https://aval-dusky.vercel.app
Video: [PASTE YOUR YOUTUBE URL]
Deck: submission/aval-deck.pdf

THE CONTRACT
contract/src/inflight.compact compiles to 2 circuits plus a constructor. A HistoricMerkleTree<10, Bytes<32>> holds attestation commitments. The attestor registers leaf_hash(lock_id, amount, counterparty, expiry, salt), a hash that reveals nothing. The holder proves membership with a privately supplied path, and the circuit recomputes the leaf and binds the path to it, discloses only the computed root so the proof is unlinkable to a specific attestation, asserts kernel.blockTimeLessThan(expiry) against ledger block time not a caller timestamp, discloses only the boolean amount >= required, then derives a nullifier from the private lock_id and salt and spends it.

8 disclose() call sites bridge private to public, each annotated with what it reveals. The public ledger records a Merkle root, a nullifier and a fill count. It never records an amount.

It is an instrument, not a statement: single use (the nullifier), counterparty bound (the payee is in the leaf), expiring (ledger time).

TESTING
31 tests pass from a clean clone with no toolchain installed:
  git clone https://github.com/Leihyn/aval && cd aval/contract
  npm install && npm test

Two security bugs were found by adversarial review and exploited before being fixed. A total soundness break: the witness supplied Merkle path was never bound to the leaf the circuit recomputed, and a proof of concept produced an ACCEPTED proof claiming 2^64-1 units against a real 1 unit attestation, paid to the wrong payee, past expiry. One assert fixed it. A permissionless bootstrap: register_attestor() was callable by anyone, so a stranger could front run deployment and brick the contract. Replaced with a constructor. Both are now regression tests that ARE the attack, disclosed in the README rather than quietly patched.

Privacy is tested as an equality you can run, not an absence you trust: indistinguishability.ts shows 50,000 and 5,000,000 producing identical public state except the Merkle root. attack-demo.ts runs six attacks and shows six reverts produced by the circuit, not by application code.

FRONTEND
React 19, Vite 6, Tailwind v4, deployed and running real circuits in the browser via vite-plugin-wasm. Two panes: what the counterparty learns, and a dump of public ledger state showing the amount absent.

HONEST LIMITS
Midnight cannot see Ethereum, so the counterparty runs the attestor. A malicious attestor can still fabricate a lock, the same model as every fast finality bridge. Preprod deployment is gated on a proof server needing a container runtime and a faucet CAPTCHA, so the contract is also compiled against ledger 8, what Preprod runs, and both builds are committed.
```

---

## Milestone: 2nd Wave  *(required)*

```
Make the attestor real, and reduce the trust it requires.

1. Source chain attestor with a live Ethereum listener. Watch a real escrow contract, and register leaf_hash commitments on Midnight when a lock is observed and finalized. Wave 1 attests from a script; Wave 2 attests from the chain.

2. k of n attestor quorum. Replace the single attestor fixed at deploy with a threshold set, so no one operator can fabricate a lock alone. This is the first real reduction of the residual risk stated in Wave 1.

3. Encrypted preimage channel. Deliver the lock preimage to the holder without the attestor publishing it, so the holder can prove without an out of band handoff.

4. Preprod deployment. Wave 1 compiles against ledger 8 and commits both builds, but deployment was gated on a container runtime and a faucet CAPTCHA. Wave 2 clears both and puts a live contract address in the README.

5. The identity precondition predicate on the same primitive: prove kyc_passed AND jurisdiction NOT IN sanctioned, without revealing the identity. Same Merkle membership, same nullifier, different leaf.
```

---

## Milestone: 3rd Wave  *(required)*

```
Harden the trust model and widen the predicate set.

1. Bonded and slashable attestors. An attestor posts a bond; a fraud proof against a fabricated lock slashes it. This moves the residual from "trust the quorum" to "the quorum loses money if it lies".

2. Source chain light client path. The end state stated honestly in Wave 1: verify Ethereum finality on Midnight rather than trusting an attestor at all. Scoped as a design and a prototype, since a full light client is beyond one Wave.

3. Two more predicates on the same primitive: private solvency (reserves >= liabilities) and invoice factoring (invoice_valid AND unpaid AND amount >= advance). Each reuses the leaf, the nullifier and the expiry, and only the predicate changes, which is the argument that this is infrastructure rather than one feature.

4. Counterparty SDK. A TypeScript package so an integrator adds proof of funds in flight to their own settlement flow without writing Compact.

5. Adoption path. Target users are cross chain market makers, OTC desks and bridge operators who already accept fast finality trust but cannot accept publishing position sizes. Wave 3 puts the primitive in front of one of them and reports what broke.
```
