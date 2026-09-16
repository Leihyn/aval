# PULSE — Pipeline Rolling Context

## Active Facts
| Fact | Source | Phase |
|------|--------|-------|
| Wave 1 hard deadline 2026-09-16T15:00:00Z; grant is `point` mode = pool split PROPORTIONAL to judge points, not winner-take-all | AKINDO API [A1] | intel |
| 59 Wave-1 submissions. Saturation: credit/solvency 15, identity 8, games 6, payroll 5, provenance 5. IN-FLIGHT SETTLEMENT = 0. DEV INFRA = ~1. | AKINDO API [A1] | intel |
| NO in-circuit ECDSA on Midnight: Secp256k1Point/Scalar/Base and secp256k1EcdsaVerify are UNBOUND in shipped compiler 0.34.0 despite release notes. Verified by compiling. | empirical [A1] | intel |
| BOUND stdlib: Bytes, Field, Uint, Boolean, Vector, Maybe, Either, MerkleTree, HistoricMerkleTree, List, Map, Set, Counter, JubjubPoint. `Cell` is UNBOUND. | empirical [A1] | intel |
| DEPLOY IS NOT REQUIRED. Technical Gate requires the contract to COMPILE, not deploy. No Docker needed for compile + simulator tests. | Official Rules [A1] | intel |
| Competitor bytewizard42i runs 3 entries (DIDz, HelixCTW, CryptoSure) AND placed 3rd in Midnight's first virtual hackathon with 'DIDz Identity'. Highest-threat competitor. | midnight.network blog [A1] | intel |
| Prior Midnight winners were cited for 'polished presentation', 'functional demo', 'open-source nature'. 'Feedback on Midnight developer experience' was itself a scored criterion. | midnight.network blog [A1] | intel |
| Midnight's own 2026 priorities name 'confidential trading, private lending, institutional execution, tokenized assets, programmable compliance'. Night Sky targets 'privacy embedded at the infrastructure level'. | midnight.network blog [A1] | intel |
| `disclose()` does NOT publish — it clears the compiler's private-data check; the ledger write is what makes a value visible. Compact statically refuses to compile a leak. | midnight-docs #1245 [B2] | intel |

## Decisions Log
| Decision | Rationale | Phase |
|----------|-----------|-------|
| Kill identity + credit/solvency verticals | 15 and 8 competitors respectively; identity also contains a returning 3rd-place winner | intel |
| Target in-flight settlement as the vertical | 0 of 59 competitors; matches Midnight's own 'institutional execution' language | intel |
| Attestor authority via ledger write + Merkle membership, NOT in-circuit signature check | secp256k1 stdlib is unbound; Merkle path is also strictly more private (hides WHICH attestation was used) | intel |
| Over-invest in simulator tests and README | QA 15% is the cheapest differentiated block (most teams ship no tests); README friction is the ecosystem's loudest complaint | intel |

## Downstream Items
<!-- Owner-routed, non-blocking deferred work. Every skill reads on entry, actions rows it owns. See PULSE-PROTOCOL § Downstream Items. -->
| ID | Raised by | Owner phase | Pri | Item | Acceptance | Status |
|----|-----------|-------------|:---:|------|-----------|:------:|

## Skill Sections

### intel
**Skill:** hackathon-intel v3.1 · **Status:** COMPLETE · **Depth:** ID 6 (Standard)

#### Done
- `config.json` — E1–E7 extractions, 6 weighted judging criteria, 10 disqualifiers, network/deploy facts
- `research/research-brief.md` — 378 lines, all 12 required sections present
- `intel-state.json` — 5 phase-ledger entries, 8 sources, quality gate self-assessed 4.8/5 (PASS)

#### Additions
- Substituted a direct census of all 59 live Wave-1 submissions for the Grid/Copilot saturation data (both are Solana-scoped and return nothing for Midnight). Stronger evidence than the generic index would have been.
- Added an empirical toolchain-binding probe not requested by the skill, because release notes disagreed with the shipped compiler.

#### Deviations
- Phase 2 (social intelligence) SKIPPED — autonomous conductor run, no user available for guided Discord/Twitter review. Documented in research-brief.md.
- Competitive research and rules extraction were completed BEFORE dispatch (already in `BRIEF.md` from the AKINDO public API), so Phase 1 ran as delta research only.

#### Verified Facts
- Wave 1 deadline 2026-09-16T15:00:00Z. Grant mode `point` = proportional to judge points, not winner-take-all. 59 submissions. [A1]
- **Deploy is NOT required.** The Technical Gate requires the contract to COMPILE. No Docker needed for compile + simulator tests. [A1]
- **No in-circuit ECDSA exists.** `Secp256k1Point`/`Scalar`/`Base` and `secp256k1EcdsaVerify` are UNBOUND in shipped compiler 0.34.0. `Cell` is also unbound. Verified by compiling, not by reading docs. [A1]
- BOUND: `Bytes`, `Field`, `Uint`, `Boolean`, `Vector`, `Maybe`, `Either`, `MerkleTree`, `HistoricMerkleTree`, `List`, `Map`, `Set`, `Counter`, `JubjubPoint`. [A1]
- Saturation: credit/solvency 15, identity 8, games 6, payroll 5, provenance 5, health 3, invoicing 3, voting 2. **In-flight settlement 0. Dev infra ~1.** [A1]
- Competitor `bytewizard42i` fields 3 entries AND placed 3rd in Midnight's first virtual hackathon with "DIDz Identity". [A1]
- Prior winners cited for "polished presentation", "functional demo", "open-source nature". "Feedback on Midnight's developer experience" was itself a scored criterion. [A1]
- Midnight's 2026 priorities name "confidential trading, private lending, **institutional execution**, tokenized assets, **programmable compliance**". [A1]
- `disclose()` does not publish; it clears the compiler's private-data check. The ledger write makes a value visible. [B2]

#### Assumptions
- [ASSUMED] Demo video 2–4 min — no max length is published anywhere in the rules.
- [ASSUMED] Eligible denominator is below 59; ~4 entries show no Compact contract and should be disqualified. Not confirmed until judging.
- [MEDIUM CONFIDENCE] AKINDO handle `bytewizard42i` = "John Santi" of the prior DIDz win. Name and domain align exactly; handle not cross-verified.

#### Blockers for Downstream
None.

#### Key Decisions
- Kill identity and credit/solvency verticals — saturated (8 and 15), and identity contains a returning 3rd-place winner.
- Target in-flight settlement — 0 of 59 competitors, and it matches Midnight's own "institutional execution" language.
- Attestor authority must come from a ledger write + Merkle membership proof, NOT an in-circuit signature check (secp256k1 unbound). This is also strictly more private: a Merkle path hides WHICH attestation was used.
- Over-invest in simulator tests and README. QA is 15% and most teams ship no tests; onboarding friction is the ecosystem's loudest documented complaint.

#### For Next Skill
warroom: the idea is ALREADY DECIDED by the user. Do NOT re-generate from scratch — CONFIRM or SHARPEN:
> **Aval** — prove money is committed but not yet arrived, so a counterparty can act now instead of waiting for bridge finality. Wave-1 scope: ONE vertical (proof of funds in flight) + the reusable primitive + explicit roadmap (identity preconditions, private solvency, invoice factoring).

Bounds on any variant: must have >=1 compiling Compact contract (or auto-DQ); must not need in-circuit ECDSA, ledger-9 testnet features, or Docker; must not land in the credit/solvency or identity clusters; ~11h remain and "realistic scope" is itself 15% of the score.
