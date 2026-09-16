# Aval, domain guide

The vocabulary this codebase uses, and the rules the code enforces. Written so a
reader who has never seen a settlement system can follow `inflight.compact`.

## Concepts

| Term | Definition |
|---|---|
| **In flight** | Committed and irrevocable on a source chain, not yet settled at the destination. The window Aval exists to close. |
| **Lock** | An escrow entry on the source chain with a unique id. Monotone and irrevocable: once locked, funds can only go to the destination or return after timeout. Aval attests to locks, never to balances, because a balance is mutable and a lock is not. |
| **Attestor** | A party that can observe the source chain and registers commitments on Midnight. In the bilateral deployment this is the counterparty themselves. |
| **Attestation** | A commitment to one observed lock, stored as a leaf in the public Merkle tree. A hash, so it reveals nothing on its own. |
| **Leaf** | `leaf_hash(lock_id, amount, counterparty, expiry, salt)`. Binding `counterparty` and `expiry` into the hash is what makes an attestation non-transferable. |
| **Preimage** | The private tuple `(lock_id, amount, salt)` that opens a leaf. Delivered to the beneficiary off-chain, never published. |
| **Nullifier** | `nullifier_of(lock_id, salt)`. A one-way tag that makes one lock spendable exactly once. Derived from private values only, so it cannot be linked to its leaf, and it is identical regardless of the amount. |
| **Witness** | A private input supplied locally and constrained inside the circuit. Never appears in calldata or on the ledger. |
| **Dual ledger** | Midnight's split between public ledger state and private witness state. The reason this protocol is possible here and not on an EVM. |
| **`disclose()`** | Clears the compiler's private-data check so a value may cross into a public position. It does not itself publish: the ledger write is what makes a value visible. |
| **Historic root** | An older Merkle root that stays valid for membership proofs as the tree grows, so a proof does not break when someone else's attestation is registered mid-flight. |
| **Threshold predicate** | `amount >= required`. The only fact about the amount that ever becomes public, and it becomes public as a single boolean. |
| **Indistinguishability** | The property the tests assert: two runs with amounts a hundredfold apart produce byte-identical public state except the Merkle root. |

## Rules the code enforces

1. One lock backs exactly one proof, ever. Enforced by the nullifier set.
2. An attestation is bound to one counterparty and one expiry. Enforced by hashing both into the leaf.
3. Only the registered attestor may write the registry. Enforced by a derived-id equality check.
4. The amount is never written to public state. Enforced structurally: no public field holds it, and the test suite asserts indistinguishability rather than absence.
5. Expiry is judged by ledger block time, never by a caller-supplied timestamp. Enforced by `kernel.blockTimeLessThan`.
6. A prover cannot alter any attested field. Enforced by recomputing the leaf in-circuit; any change produces a leaf with no Merkle path.

## Glossary, domain term to code identifier

| Domain | Code |
|---|---|
| attestation registry | `ledger attestations: HistoricMerkleTree<10, Bytes<32>>` |
| spent nullifiers | `ledger spent: Set<Bytes<32>>` |
| attestor identity | `ledger attestor: Bytes<32>`, derived by `derive_id` |
| proofs completed | `ledger fills: Counter` |
| the private lock | witnesses `get_lock_id`, `get_amount`, `get_salt` |
| membership proof | witness `find_path` plus `merkleTreePathRoot` |
| the money circuit | `prove_funds_in_flight` |
