# THE MIDNIGHT BUILDATHON — Research Brief
**Compiled:** 2026-09-16
**Intel Depth:** ID 6 (Standard)
**Sources:** AKINDO public API [A1], midnight.network official blog [A1], midnightntwrk GitHub issues [B2], web research
**Delta note:** Rules, rubric, grant mechanics and the full 59-submission competitor field were sourced directly from the AKINDO public API before this phase and live in `BRIEF.md`. This brief covers what BRIEF.md does not: judges, sponsor priorities, prior winners, ecosystem gaps, community pain, and positioning.

---

## Overview

| Field | Value |
|-------|-------|
| Name | The Midnight Buildathon |
| Organizer | Midnight Network / Midnight Foundation |
| Platform | AKINDO WaveHack |
| Wave 1 deadline | 2026-09-16 15:00:00 UTC |
| Structure | 3 waves, Aug 27 – Nov 27 2026 |
| Chain | Midnight (Cardano-adjacent privacy L1) |
| Language | Compact (TypeScript-like, ZK-enabled) |
| Prize pool | US$12,500 total — W1 $3,500, W2 $4,000, W3 $5,000 |
| Distribution | **`point` mode — proportional to judge points, NOT winner-take-all** |
| Wave 1 field | **59 submissions** |

### Submission Requirements
- Public GitHub repo + README (project, setup, architecture, Midnight integration, how judges test)
- Slide deck, demo/video pitch, description of this Wave's progress
- `midnightntwrk` **topic label** on the repo
- Apache License 2.0 on Midnight-related code

---

## Demo Video Requirements

| Field | Value |
|-------|-------|
| Max length | Not published |
| Formats | Not specified |
| Platform | Not specified |
| Content notes | Rules require "a demo / video pitch"; Communication (10%) scores "clarity and structure of the video presentation and slide deck" |

**[ASSUMED]** 2–4 minutes. Prior Midnight hackathon judge commentary repeatedly cited "polished presentation" and "functional demo" as the differentiator, so a **working demo on screen beats slides**.

---

## Submission Form Fields
- Project/Product
- Submission comment (progress completed this Wave)
- GitHub repo URL
- Slide deck
- Demo video
- **Discord ID** (entry question, required)
- **Telegram ID** (entry question, required)

---

## Disqualifiers

**BOTTOM LINE:** One gate is binary and mechanical, and it is where careless teams die.
- **No Compact contract that compiles → automatic DQ from judging for that Wave** [A1]
- Missing `midnightntwrk` GitHub topic label [A1]
- Missing public repo, slide deck, or demo video [A1]
- Midnight code not under Apache 2.0 [A1]
- Mere fork/copy/superficial modification [A1]
- Under 18; sanctioned jurisdictions; multiple accounts; automated entry tools [A1]

**SO WHAT:** Of 59 submissions, at least 4 (two Telegram price bots, a "sentiment signals" product, an energy-finance framework) show no evidence of a Compact contract. Expect the eligible denominator to be **below 59**, which mechanically raises every compliant team's point-proportional payout.

---

## Prizes

| Wave | Pool | Build | Judging |
|---|---:|---|---|
| Wave 1 | $3,500 | Aug 27 – Sep 16 | Sep 16 – Sep 27 |
| Wave 2 | $4,000 | Sep 27 – Oct 17 | Oct 17 – Oct 27 |
| Wave 3 | $5,000 | Oct 27 – Nov 16 | Nov 16 – Nov 27 |

**BOTTOM LINE:** The cash is not the prize. $3,500 across ~55 eligible entries averages ~$64.
**SO WHAT:** Optimize for **Build Club selection** and **Wave 2/3 compounding**, not Wave 1 dollars.

---

## Judging Criteria

| Criterion | Weight | What it means | How to score high |
|---|---:|---|---|
| Engineering & Implementation | **40%** | Compact contract compiles, **private state management**, **dual-ledger model** understanding, organized repo, clear README, Midnight topics, ecosystem attribution | Show explicit `disclose()` boundaries and explain WHY each one is safe. Non-trivial private state, not a toy counter. |
| Quality Assurance & Reliability | 15% | Simulation + test files present, tests **pass**, stable under basic use | Ship a runnable simulator test suite. No Docker needed — this is free points most teams will skip. |
| Product & Vision | 15% | Idea soundness, connection to Midnight core capabilities, **realistic** scope and roadmap | A narrow shipped vertical + explicit roadmap beats four half-built ones. |
| User Experience & Design | 15% | Frontend intuitive, connects to contract, functional end-to-end | Working click-through beats novel visuals. |
| Communication | 10% | Video + deck clarity | Functional demo on screen. |
| Business Development & Viability | 5% | Audience, market, adoption path | One honest slide. |

**CONFIDENCE:** High — weights taken verbatim from the AKINDO API and the published rubric doc.
**SO WHAT:** **55% of the score (Engineering + QA) is mechanically checkable.** Compile + private state + passing tests + clean README is the highest-certainty point block in the event.

---

## Workshop Signals

| Workshop | Speaker | Topic | Strategy signal |
|---|---|---|---|
| Kickoff Workshop (2026-08-26) | Midnight team | Tech walkthrough + "what judges score" | Organizer pre-announced the rubric. There is no hidden criterion — **the published rubric IS the strategy.** Recording: `youtube.com/embed/_zT--UCqxh8` |

---

## Tech Deep Dive

**BOTTOM LINE:** Toolchain works on macOS arm64 with no Docker for compile + test. Several documented stdlib features do not exist in the shipped build.

**EVIDENCE (empirically verified on this machine, not inferred):**
- `compact` devtool 0.5.2 → compiler **0.34.0**, language **0.26.0**, runtime **0.19.0** [A1]
- Full compile with proving keys: **16s for 2 circuits**. `--skip-zk` compile: **0.5s** [A1]
- Emits `contract/index.js` + `index.d.ts`, `zkir/*.zkir`, `keys/*.prover`, `keys/*.verifier` [A1]
- **BOUND stdlib types:** `Bytes`, `Field`, `Uint`, `Boolean`, `Vector`, `Maybe`, `Either`, `MerkleTree`, `HistoricMerkleTree`, `List`, `Map`, `Set`, `Counter`, `JubjubPoint` [A1]
- **UNBOUND despite release notes describing them:** `Secp256k1Point`, `Secp256k1Scalar`, `Secp256k1Base`, `secp256k1EcdsaVerify`, `Cell` [A1]
- Toolchain **0.34 targets ledger 9, which is not yet on testnet**. Deploy targets must use 0.31.x. [A1]

**CONFIDENCE:** High — every line above came from running the compiler, not from docs.
**SO WHAT:** **There is no in-circuit ECDSA.** Any design that assumes an attestor's Ethereum signature is verified inside a circuit is dead on arrival. Authority must instead come from *writing to the ledger* (authenticated by Midnight's own tx layer) plus **Merkle membership proofs**, which is also strictly more private.

### The `disclose()` gotcha (worth a README paragraph)
A Midnight docs maintainer states it precisely:
> "`disclose()` does not publish; it clears the compiler's private-data check so a value may cross into a public position, and the ledger write is what makes it visible." [B2]

Compact statically tracks private-data flow and **refuses to compile** if a witness value reaches a ledger operation without an explicit `disclose()`. Demonstrating that you understand this distinction is a direct hit on the 40% criterion.

---

## Network / Chain Infrastructure

| Field | Value |
|---|---|
| Chain | Midnight |
| Testnet | Midnight Testnet |
| Deploy requirement | **NOT required.** The Technical Gate says the contract must *compile*, not deploy. |
| Proof server | Docker-based |
| Wallet | Lace |

**SO WHAT:** Deployment is optional. A team with no Docker can still clear the gate and score the full 55% Engineering+QA block. Do not let a deploy chase burn the window.

---

## Ecosystem Products

| Product | Purpose | Integration depth | URL |
|---|---|:---:|---|
| Compact | ZK smart-contract language | **Required** | docs.midnight.network/compact |
| Midnight.js | dApp SDK | High | github.com/midnightntwrk |
| Proof server | Generates ZK proofs (Docker) | Optional for compile | docs.midnight.network |
| Lace wallet | User wallet | Optional | — |
| midnight-local-dev | Local network | Optional | github.com/midnightntwrk/midnight-local-dev |
| Kapa / Midnight Expert MCP | AI coding assistant | Optional | docs.midnight.network/blog |

---

## Capability Sheet — what Midnight uniquely makes possible

| Primitive | What is uniquely possible here |
|---|---|
| **Dual ledger (public + private state)** | Persistent *private* state that lives on-chain across transactions. On an EVM you need FHE or an off-chain prover, and you lose persistence. |
| **`disclose()` information-flow typing** | The compiler statically proves no private value leaks to public state. Privacy is enforced at compile time, not by developer discipline. |
| **`witness` functions** | Private inputs supplied locally and constrained in-circuit, never in calldata. |
| **`HistoricMerkleTree` + `checkRoot`** | Membership proofs against *historical* roots, so a proof stays valid as the tree grows. |
| **Selective disclosure** | Prove a predicate to one party, or to a regulator, without publishing the underlying fact. Midnight's core "rational privacy" thesis. |

---

## Competitor Landscape

All 59 Wave 1 submissions pulled from the AKINDO API [A1] and clustered.

### Competition Density Map

| Theme | Submissions | Density |
|---|:---:|:---:|
| Credit / solvency / creditworthiness proofs | 15 | **HIGH** |
| Identity / credential / eligibility disclosure | 8 | **HIGH** |
| Games (casino, prediction, battleship, tag, draft) | 6 | MEDIUM |
| Payroll (private salary, DAO payroll) | 5 | MEDIUM |
| Supply chain / provenance (VIN, seafood, sensors) | 5 | MEDIUM |
| Health records | 3 | LOW |
| Invoicing / B2B commerce | 3 | LOW |
| Voting / DAO governance | 2 | LOW |
| Off-theme, likely DQ (price bots, sentiment) | ~4 | — |
| **In-flight / pending / cross-chain settlement** | **0** | **EMPTY** |
| **Developer infrastructure / tooling** | **~1** | **NEAR-EMPTY** |

### Competitor Registry (highest threat only)

| Project | Theme | Threat | Why | Source |
|---|---|:---:|---|---|
| **DIDz DApp System** (bytewizard42i) | Identity | **HIGH** | "DIDz Identity" took **3rd place in Midnight's first virtual hackathon** [A1]. Returning builder, knows the judges, already has judge mindshare. Also fielding a 2nd entry (HelixCTW) this Wave. | midnight.network/blog/virtual-hackathon-winners |
| HelixCTW (bytewizard42i) | Storage/infra | MEDIUM-HIGH | Same builder as DIDz. "Storage and retrieval layer for privacy-preserving DIDs" — the only other infra-flavored entry. | AKINDO API |
| CryptoSure (bytewizard42i) | Insurance | MEDIUM | Third entry from the same builder. Volume strategy under point-proportional scoring. | AKINDO API |
| Candor (PhiBao) / Candor (UnityNodes) | Solvency | MEDIUM | Two unrelated teams shipped the same name. Both proof-of-reserves. Mutual dilution. | AKINDO API |
| datum, Vantage, Freeboard, Nocturne | Solvency/credit | MEDIUM | Well-articulated taglines in the most crowded category. They will split the same judge attention. | AKINDO API |

**BOTTOM LINE:** One builder (bytewizard42i) is running a **3-entry volume strategy** and previously placed 3rd in a Midnight hackathon. Under point-proportional distribution, multiple entries is a rational payout strategy.
**CONFIDENCE:** High on the field data (direct API). Medium on the DIDz identity match — name and domain align exactly, but the AKINDO handle was not cross-verified against the blog's "John Santi".
**SO WHAT:** Do not compete in identity or solvency. Both are saturated *and* contain a returning placer.

---

## Community Pain (Verbatim Quotes)

All quotes exact, not paraphrased.

1. > "Docker and `git` are never named, though the template brings up the Midnight node, indexer, proof server, and database as containers."
   — midnightntwrk/midnight-docs issue #1245 [B2]

2. > "`disclose()` does not publish; it clears the compiler's private-data check so a value may cross into a public position, and the ledger write is what makes it visible."
   — midnightntwrk/midnight-docs issue #1245 [B2]

3. > "The command switches the machine-wide default compiler (per its own `--help`), so following the prerequisite repoints every other Midnight project on the reader's machine."
   — midnightntwrk/midnight-docs issue #1245 [B2]

4. > "Step 4 ("mint a token") is the only interactive step and assumes wallet setup that is never described."
   — midnightntwrk/midnight-docs issue #1245 [B2]

5. > "No teardown guidance: how to stop eleven services, and what survives the stop."
   — midnightntwrk/midnight-docs issue #1245 [B2]

**SO WHAT:** Onboarding friction is the ecosystem's loudest complaint. A README that names every prerequisite explicitly, works without Docker, and runs in one command is a *differentiator*, not hygiene. It also lands directly on "clear README" inside the 40% criterion.

---

## Past Editions Analysis

**BOTTOM LINE:** Midnight judges reward polish and a functional demo over ambition.

**EVIDENCE — Midnight's first virtual hackathon winners** [A1]:

| Place | Project | What it was | Judge commentary (verbatim) |
|---|---|---|---|
| 1st | **EDDA** (Erick Romero) | ZK Q&A platform, anonymity + community guidelines | "Technical sophistication, polished presentation, and functional demo, coupled with its open-source nature and Next.js integration, set it apart" |
| 2nd | **ZKUno Game** (Krish Dhar) | ZK Uno card game | "Refined presentation and functional game demonstrated the potential for entertaining and interactive DApps" |
| 3rd | **DIDz Identity** (John Santi) | Decentralized identity | "Video presentation effectively conveyed a clear vision for real-world applications" |

Stated criteria that round: technology, innovation, completion, real-life application, feedback on Midnight's developer experience. **Bonus points for showcasing ZK capabilities or the Compact language.**

**SO WHAT — three repeatable, cheap wins:**
1. "**Polished presentation**" and "**functional demo**" appear in all three citations. The video is not an afterthought.
2. "**Open-source nature**" was explicitly cited for 1st place. Apache 2.0 is required anyway; say it loudly.
3. "**Feedback on Midnight's developer experience**" was a scored criterion. **Shipping a section that documents toolchain findings (e.g. the unbound secp256k1 stdlib) is pre-validated point-scoring behavior.**

---

## Broader Market Context

**BOTTOM LINE:** Midnight's own 2026 messaging names our category explicitly.

**EVIDENCE:**
- Midnight's stated focus is "real-world financial use cases such as **confidential trading, private lending, institutional execution, tokenized assets, and programmable compliance**" [A1, State of the Network Jan 2026]
- **Night Sky Accelerator** (10 weeks, 4–6 teams, from July 2026) targets teams "ready to build real products with **privacy embedded at the infrastructure level**" and selects on "clear market insights and strong execution capabilities" [A1]
- **Build Club**: 8-week part-time program for high-potential **idea-stage** projects; ends in a pitch to Midnight's investor network [A1]
- Midnight has run a dedicated **Ecosystem Tooling Challenge** with five tracks aimed at "foundational tools that remove friction" [A1]
- Roadmap moving from **Hilo → Kūkolu** phase; strategy shifting toward AI-native dev tools and broader ecosystem access [B2]

**CONFIDENCE:** High — all from official Midnight blog posts.
**SO WHAT:** "Institutional execution" and "programmable compliance" are Midnight's own words for the settlement-assurance category. Positioning Aval as **infrastructure** rather than an app aligns with both the accelerator thesis and the tooling challenge precedent. Cross-hackathon data agrees: Chainlink-style "grand prize winners solve security or infrastructure problems, not consumer apps."

---

## Category Saturation

Grid and Copilot are Solana-scoped and return nothing for Midnight; `copilot_available=false`. **Substituted with a direct census of the actual 59-submission field**, which is strictly better evidence than a generic product index.

| Category | Submissions in Wave 1 | Saturation |
|---|:---:|---|
| Credit / solvency | 15 | **HIGH** |
| Identity / credentials | 8 | **HIGH** |
| Games | 6 | MEDIUM |
| Payroll | 5 | MEDIUM |
| Provenance | 5 | MEDIUM |
| Health | 3 | LOW |
| Invoicing | 3 | LOW |
| Voting | 2 | LOW |
| **In-flight settlement** | **0** | **NONE** |
| **Dev infrastructure** | **1** | **NONE** |

---

## Builder Project History (Copilot)
Not available — `copilot_available=false`, and the Colosseum corpus is Solana-scoped with no Midnight coverage. Prior-art analysis was done instead against the live 59-submission field and Midnight's own published hackathon winners (see Past Editions Analysis).

---

## Key Links & Resources

| Resource | URL |
|---|---|
| Buildathon page | https://app.akindo.io/wave-hacks/jaMZjqPOBsLXvjdG |
| Official Rules PDF | https://drive.google.com/file/d/1YKXtsw5nghcEBEW0BFrLn-U34AfH_MF4/view |
| Judging Rubric | https://docs.google.com/document/d/1-dDTqWa2CcfnSEvgXq83La2M8zAxi4jtVtKpMJRm3Oo/edit |
| Midnight Docs | https://docs.midnight.network/ |
| Compact language docs | https://docs.midnight.network/compact |
| GitHub org | https://github.com/midnightntwrk |
| Midnight Discord | https://discord.gg/SUZNRF6fu |
| RPS sample contract | https://github.com/mashharuki/midnight-rps-sample-app |
| midnight-local-dev | https://github.com/midnightntwrk/midnight-local-dev |
| Kickoff workshop recording | https://www.youtube.com/embed/_zT--UCqxh8 |
| Build Club | https://midnight.network/build-club |
| Night Sky Accelerator | https://midnight.network/night-sky-accelerator |
| Prior winners | https://midnight.network/blog/virtual-hackathon-winners |

---

## Track Coverage Matrix

Single track, so the real "coverage" dimension is **rubric criteria**, not prize tracks.

| Criterion | Weight | Overlap potential | Contested? |
|---|---:|---|---|
| Engineering & Implementation | 40% | Contract + tests + README serve this AND QA | HIGH — everyone attempts it, few do private state well |
| Quality Assurance | 15% | Same test suite serves Engineering | **LOW — most hackathon teams ship no tests. Cheapest differentiated points on the board.** |
| Product & Vision | 15% | Roadmap doc serves this AND BD | MEDIUM |
| UX & Design | 15% | Frontend serves this AND Communication | MEDIUM |
| Communication | 10% | Demo video serves this AND UX | HIGH — prior winners all cited for presentation |
| BD & Viability | 5% | One slide, shared with Product | LOW |

**Multi-criterion targets:** a passing simulator test suite hits Engineering + QA (55%). One demo video hits UX + Communication (25%). A roadmap section hits Product + BD (20%).

---

## Domain Knowledge Sources

| Source | URL | Covers | Essential? |
|---|---|---|:---:|
| Compact language docs | docs.midnight.network/compact | Syntax, ledger types, witnesses, disclose | **YES** |
| RPS sample contract | github.com/mashharuki/midnight-rps-sample-app | Working commit-reveal reference, idiomatic Compact | **YES** |
| Toolchain release notes | `~/.compact/versions/0.34.0/aarch64-darwin/toolchain-0.34.0-rc.1.md` | Breaking changes, ledger 9, what exists vs not | **YES** |
| Generated `index.d.ts` | `contract/out/contract/index.d.ts` | Actual witness + ledger TS surface for tests/frontend | **YES** |
| Midnight docs issues | github.com/midnightntwrk/midnight-docs/issues | Known doc gaps, prerequisite traps | NO |

---

## Kill List

### 1. Saturated
- Credit scores, solvency proofs, proof-of-reserves, creditworthiness (**15 competitors**)
- Identity, KYC, credential disclosure, eligibility proofs (**8 competitors**, includes a prior 3rd-place winner)
- Private payroll (5), provenance/supply chain (5), ZK games (6)

### 2. Broken Dependencies
- **Anything requiring in-circuit secp256k1/ECDSA verification** — `Secp256k1Point`, `Secp256k1Scalar`, `secp256k1EcdsaVerify` are unbound in the shipped 0.34.0 stdlib despite release notes. Empirically verified.
- Anything requiring **ledger-9 features on testnet** — 0.34 targets ledger 9, not yet deployed.
- Anything requiring the **proof server** on a machine without Docker.

### 3. Already Built
- Anything in the 59-submission field, especially the 15 credit and 8 identity entries.
- Decentralized identity specifically — a prior Midnight placer is defending that ground.

### 4. Zero Alignment
- Non-privacy apps. Four entries appear to have no Compact contract and will likely be disqualified; do not imitate.
- Pure off-chain tooling with no Compact contract — fails the Technical Gate regardless of quality.

---

## Positioning Conclusion

**BOTTOM LINE:** Build infrastructure for in-flight settlement, ship one vertical, over-invest in tests and README.

**EVIDENCE:**
- In-flight/pending settlement: **0 of 59** competitors
- Midnight's own words name "institutional execution" and "programmable compliance" as priorities [A1]
- 55% of the rubric (Engineering + QA) is mechanically checkable and most teams skip tests
- Prior winners were cited for "functional demo", "polished presentation", "open-source nature"
- "Feedback on Midnight's developer experience" was a scored criterion in a prior edition

**CONFIDENCE:** High.

**SO WHAT — the five plays:**
1. Ship in the empty category, not the crowded one.
2. Ship a **passing simulator test suite** — the single cheapest differentiated point block.
3. Write a README that names every prerequisite and runs with **one command, no Docker** — directly answers the ecosystem's loudest complaint.
4. Include a **developer-experience findings section** documenting the unbound stdlib discovery. Pre-validated as point-scoring in a prior edition.
5. State the trust assumption plainly rather than hiding it. Judges reward bounded assumptions.
