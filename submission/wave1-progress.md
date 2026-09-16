# Wave 1 progress

Aval was started and completed inside Wave 1. There is no prior submission to diff against, so this describes what was built rather than what changed.

## Built this Wave

**The contract.** `contract/src/inflight.compact`, three circuits: `register_attestor`, `register_attestation`, `prove_funds_in_flight`. Compiles to three ZKIR circuits and six proving/verifier keys. Private state is carried by five witnesses; six explicit `disclose()` sites bridge private to public, each annotated in source with what an observer actually learns.

**A test suite that asserts the privacy claim rather than stating it.** 23 tests, all passing, covering attestor bootstrap, registry access control, the threshold path including the exact-equality boundary, nullifier-based double-spend prevention, non-transferable binding (counterparty swap, amount inflation, expiry extension all rejected), block-time expiry in both directions, and four privacy tests that serialise the entire public ledger and assert the amount does not appear in it.

**An attestor watcher and a seed script**, both driving the real simulator. The watcher computes commitments with `pureCircuits.leaf_hash` exported by the compiler rather than a reimplementation, so there is exactly one definition of the commitment in the system.

**A two-pane demo frontend.** React 19, Vite 6, Tailwind v4. It imports the same simulator the tests use, so it is not a mock of the protocol. Getting the Midnight WASM runtime to bundle for a browser required `vite-plugin-wasm` and an `esnext` target.

**An attack script** that runs six real attacks and prints the six revert strings the circuit produces.

## Design decisions worth surfacing

**No in-circuit ECDSA, because it does not exist.** The natural design verifies an attestor's signature inside the circuit. `Secp256k1Point`, `Secp256k1Scalar`, `Secp256k1Base` and `secp256k1EcdsaVerify` are all unbound in the shipped 0.34.0 standard library despite the release notes describing them. Verified by compiling probes. Authority instead comes from writing to the ledger, authenticated by Midnight's own transaction layer, plus a Merkle membership proof. That turned out to be strictly more private: a signature check would force the prover to reveal which attestation they used.

**Expiry is enforced by `kernel.blockTimeLessThan`,** not a caller-supplied timestamp, so a prover cannot backdate.

**The trust assumption is stated in the README, not buried.** In the bilateral deployment the counterparty runs the attestor, so trust collapses to them trusting their own node. The ladder above that (quorum, bonded and slashable, light client) is roadmap and is labelled as such.

## Not built in Wave 1

Midnight testnet deployment (toolchain 0.34 targets ledger 9, not live on testnet; the gate requires compilation, not deployment), a live Ethereum listener, encryption on the preimage channel, and the three other verticals (identity preconditions, private solvency, invoice factoring), which are roadmap.

## Planned for Wave 2

The real source-chain attestor with a live listener, a k-of-n attestor quorum, an encrypted preimage channel, and the identity-precondition predicate on the same primitive.
