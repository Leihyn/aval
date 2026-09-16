# Hackathon Brief: Midnight Buildathon Wave 1

## Hard facts (verified via Akindo public API, not inferred)
- Event: The Midnight Buildathon, hosted by Midnight Network on AKINDO WaveHack
- URL: https://app.akindo.io/wave-hacks/jaMZjqPOBsLXvjdG
- **Wave 1 submission deadline: 2026-09-16 15:00:00 UTC** (hard)
- Prize: Wave 1 pool US$3,500 USDT. W2 $4,000, W3 $5,000. Total $12,500.
- **Distribution mode: `point` — pool split PROPORTIONALLY to judge points, not winner-take-all.**
- **59 submissions already in Wave 1.** Average payout ~$59. Top decile realistically $150-400.
- Real prize is the **Midnight Build Club**: 8-week program ending in a pitch to Midnight's investor network + accelerator.

## Technical gate (auto-DQ if unmet)
- >=1 Compact contract that COMPILES
- Meaningful Midnight functionality, not a fork/copy
- Public GitHub repo with the `midnightntwrk` GitHub **topic label**
- Apache License 2.0 on the Midnight code
- README covering project, setup, architecture, Midnight integration, how judges test it
- Slide deck
- Demo / video pitch

## Judging rubric (weights)
| Criterion | Weight | What it actually checks |
|---|---|---|
| Engineering & Implementation | 40% | Compact contract compiles, private state management, dual-ledger understanding, organized repo, clear README |
| Quality Assurance & Reliability | 15% | simulation + test files exist, tests pass, stable under basic use |
| Product & Vision | 15% | idea soundness, connection to Midnight core capabilities, REALISTIC scope and roadmap |
| User Experience & Design | 15% | frontend intuitive, connects to contract, functional end-to-end |
| Communication | 10% | video + slide deck clarity |
| Business Development & Viability | 5% | target audience, market, adoption path |

## Competitive field (all 59 clustered, from API)
- 15 credit/solvency proofs (Vantage, datum, Freeboard, Candor x2, ZeroScore, HORIZON, proofFi, kymider, Nocturne, Amana, RentProof, VeilCommerce, ZK-Flow, CryptoSure)
- 8 identity/credential disclosure (NightHire, VeilPass, ClearScope, Alethia, Vero, DIDz, WhisperScore, EduProof)
- 6 games, 5 payroll, 5 provenance, 3 health, 2 voting
- ~4 likely DQ (Telegram price bots, no Compact contract)
- **ZERO projects on in-flight / pending / cross-chain settlement state. This is the uncontested gap.**

## The product: Aval
**Name: Aval. Trade-finance term for a third-party guarantee that a payment will happen.**

One-liner: Prove money is committed but not yet arrived, so your counterparty can act now instead of waiting.

### The gap it attacks
There is always a window between "the fact is true" and "the fact is publicly verifiable." Bridged funds are in transit. KYC passed but documents are private. An invoice is signed but unsettled. A balance is sufficient but private. In that window counterparties wait or demand trust. That window is where working capital dies.

### Wave 1 scope (ONE vertical, end to end)
**Proof of funds in flight.** Alice locks funds on a source chain. She proves to Bob's Midnight contract that `amount >= required AND beneficiary == counterparty`, without revealing the amount, her identity, or which attestation she used. Bob's contract releases his leg immediately instead of waiting for bridge finality.

### Roadmap (explicitly NOT built in Wave 1)
Identity preconditions, private solvency, invoice factoring. Same primitive, different predicate.

## Architecture (EMPIRICALLY VERIFIED, compiles today)
1. **Attestor watcher** (off-chain TS) watches source-chain escrow. On `Locked(lockId, amount, beneficiary, expiry)` it computes `leaf = H(lockId, amount, beneficiary, salt)` and calls `registerAttestation(leaf)` on Midnight, inserting into a `HistoricMerkleTree`. It sends the preimage to Alice off-chain.
2. **Alice** calls `prove_funds_in_flight(required, counterparty)` with witnesses `lockId, amount, salt, merklePath`. Circuit: recompute leaf -> verify Merkle path against ledger root -> assert `amount >= required` -> compute `nullifier = H("nul:v1", lockId, salt)` -> disclose ONLY the nullifier -> assert not spent -> insert -> increment fills.
3. **Public ledger sees:** a Merkle root, a nullifier set, a fill count. It never sees the amount, the lockId, or which attestation was used.

### Trust model (state plainly, do NOT hide)
- **Bilateral (what we build): the counterparty runs the attestor.** Bob's *contract* cannot see Ethereum even though Bob can. So Bob registers what his own node saw; Alice's ZK proof buys her privacy from everyone who is not Bob, and buys the contract an on-chain-verifiable fact. Trust assumption collapses to "Bob trusts Bob."
- Ladder above: k-of-n quorum -> bonded/slashable attestors (a fabricated lockId is provably contradicted by source-chain escrow state, so anyone can slash) -> source-chain light client. All roadmap.
- Shrinkers: attest to a LOCK not a balance (monotone, irrevocable, unique id); expiry on every attestation; nullifier bound to lockId.
- **Residual, stated in README:** a malicious attestor can fabricate a lock. Same trust model as every fast-finality bridge shipping today. We add privacy to that model; we do not claim to beat it.

## Verified toolchain state (Rule 2: verified, not inferred)
- `compact` 0.5.2 installed at ~/.local/bin/compact; compiler 0.34.0; language 0.26.0; runtime 0.19.0
- Full compile WITH proving keys: works, 16s for 2 circuits
- `contract/src/inflight.compact` ALREADY COMPILES (skip-zk verified), emits TS contract + ZKIR
- BOUND stdlib types: Bytes, Field, Uint, Boolean, Vector, Maybe, Either, MerkleTree, HistoricMerkleTree, List, Map, Set, Counter, JubjubPoint
- **UNBOUND (do NOT design around these): Secp256k1Point, Secp256k1Scalar, Secp256k1Base, secp256k1EcdsaVerify, Cell.** Release notes describe them; the shipped stdlib does not have them. NO in-circuit ECDSA.
- Compact enforces information-flow: any witness value reaching the ledger needs an explicit `disclose()`. Disclose the computed Merkle ROOT, not the path.
- Generated ledger API gives `attestations.findPathForLeaf(leaf)` which makes the witness impl trivial.

## Environment constraints
- macOS arm64, Node v25.6.1, npm 11.9.0
- **NO DOCKER.** Midnight's proof server needs Docker. Therefore: compile + simulator tests work; real testnet deploy does NOT without installing Docker/colima first.
- Toolchain 0.34 targets ledger 9 which is NOT on testnet. Anything deployed must drop to 0.31.x. NOTE: multiple ECDSA verifies crashed the compiler before 0.34, irrelevant since ECDSA is unavailable anyway.

## Reusable assets already on this desktop
- `github_repos/DarkSTARK` — Pedersen commitments + nullifiers, React 19 + Vite + Tailwind v4 frontend, Remotion video project, 53 Cairo + 109 coordinator tests
- `github_repos/crosscredit` — cross-chain collateral aggregation, near-identical problem framing, narrative half written
- `github_repos/omniswap-sdk` — cross-chain swap SDK, 6 chains, HTLCs
- `blindbond`, `veilbid` — sealed-bid auction narratives, prior AKINDO submission doc

## Builder
Onatola Timilehin Faruq. GitHub: Leihyn. Portfolio: faruukku.vercel.app
Prior ZK/privacy work: omniswap-sdk, nocturne (Noir/UltraHonk), omnishield-wallet, DarkSTARK.

## Priority order under deadline pressure
1. Contract compiles + simulator tests pass (clears gate + 55% of rubric)
2. README + Apache 2.0 + `midnightntwrk` topic + public repo (gate)
3. Slide deck + demo video (10%)
4. Frontend wired to contract (15%)
5. Docker + testnet deploy (bonus only, do NOT let this block submission)
