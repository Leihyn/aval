# Aval — Implementation Plan

## Section 1: Plan Metadata

| Field | Value |
|---|---|
| Project | Aval |
| Hackathon | The Midnight Buildathon (AKINDO WaveHack), Wave 1 |
| Hard deadline | 2026-09-16 15:00:00 UTC |
| Safety line | 2026-09-16 13:00:00 UTC — package whatever exists |
| Architecture doc | `ARCHITECTURE.md` (896 lines) |
| PRD | `PRD.md` (470 lines) |
| Scope mode | rush |

### How to use this plan

Every task names the exact files, the exact command, and the expected output. Code is never written from memory: it is copied from the named ARCHITECTURE.md section. At every risk point there is a decision tree telling you what to do when the expected output does not appear. Phase gates are checklists, and they are not optional.

Phases 1 and 2 are already complete at the time of writing. They are documented here because the plan must be runnable from a clean clone, and because their gates are the regression checks for everything after.

---

## Section 2: Phase Overview

| Phase | Purpose | Est. | Depends on | Status |
|---|---|---:|---|---|
| 1 | Toolchain and contract | 1.0h | — | **COMPLETE** |
| 2 | Simulator and test suite | 1.5h | 1 | **COMPLETE** |
| 3 | Watcher, types, seed script | 0.5h | 2 | pending |
| 4 | Demo frontend | 1.5h | 2 | pending |
| 5 | README, LICENSE, domain guide | 0.75h | 3 | pending |
| 6 | Slide deck and demo video | 1.5h | 4 | pending |
| 7 | Deploy and livetest | 0.75h | 4 | pending |
| 8 | Package and submit | 0.75h | 5,6,7 | pending |

Total remaining after Phase 2: **5.75h** against the window to the safety line. Slack is real but not generous.

---

## Section 3: Phase 1 — Toolchain and Contract  [COMPLETE]

### Task 1.1 — Install the Compact toolchain

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
export PATH="$HOME/.local/bin:$PATH"
compact update
compact compile --version
```

Expected: `0.34.0`

#### Decision Point DT-1: the compiler does not install or does not report a version

Run: `compact compile --version`
Expected: `0.34.0`

**If it works:** continue to Task 1.2.

**If `compact: command not found`:**
1. `ls -la ~/.local/bin/compact` — confirm the binary landed
2. `export PATH="$HOME/.local/bin:$PATH"`
3. Re-run. If still failing, invoke the absolute path `~/.local/bin/compact`.

**If `compact update` fails to fetch a toolchain:**
1. `compact list` to see what is available for this platform
2. `compact update 0.31` — the previous stable line, and the one that targets the currently-deployed ledger
3. If the contract then fails to compile on 0.31, the `kernel.blockTimeLessThan` call is the likely cause; replace the expiry assert with a public `now` argument and note the downgrade in the README.

**If nothing works:** the technical gate cannot be cleared and the submission is not viable. Escalate immediately, do not continue building.

### Task 1.2 — Write and compile the contract

Copy `contract/src/inflight.compact` from **ARCHITECTURE.md Section 3** exactly.

```bash
cd contract
compact compile src/inflight.compact out
find out -type f
```

Expected: `out/contract/index.js`, `out/contract/index.d.ts`, three `out/zkir/*.zkir`.

Commit: `contract: Aval in-flight proof circuit`

#### Decision Point DT-1b: information-flow errors on compile

Expected error shape if you mistype a `disclose`:
`potential witness-value disclosure must be declared but is not`

**If you see it:** this is the compiler enforcing the dual ledger, not a bug. Read the "via this path through the program" trace; it names the exact expression that leaks. Wrap the value that enters the ledger operation, not the boolean result of it. For the Merkle check specifically, disclose the computed **root**, never the path.

**If you see `expected first argument of blockTimeLessThan to have type Uint<64>`:** remove the `as Field` cast; `expiry` is already `Uint<64>`.

### Task 1.3 — Full compile with proving keys

```bash
compact compile src/inflight.compact out-full
ls out-full/keys/
```

Expected: six files, three `.prover` and three `.verifier`. Roughly 15s.

### Phase 1 gate

- [x] `compact compile --version` reports 0.34.0
- [x] `out/contract/index.d.ts` exists
- [x] Three `.zkir` circuits emitted
- [x] Six proving/verifier keys emitted
- [x] **Technical Gate cleared: a Compact contract compiles**

---

## Section 4: Phase 2 — Simulator and Test Suite  [COMPLETE]

### Task 2.1 — Install the runtime

```bash
cd contract
npm install @midnight-ntwrk/compact-runtime@0.19.0
npm install -D vitest@^2
node -e "import('@midnight-ntwrk/compact-runtime').then(()=>console.log('ok'))"
```

Expected: `ok`. The runtime version must match `compact compile --runtime-version`.

#### Decision Point DT-5: the runtime will not install or will not load

Run the node one-liner above.

**If it works:** continue to Task 2.2.

**If the version is unavailable on npm:**
1. `npm view @midnight-ntwrk/compact-runtime versions --json`
2. Pick the version matching `compact compile --runtime-version`
3. If no match exists, downgrade the toolchain with `compact update 0.31` and re-check.

**If the import throws at load:** check Node version is >= 20 with `node -v`. The package is ESM-only; `"type": "module"` must be set in `contract/package.json`.

**If nothing works:** tests cannot run and 15% of the rubric is lost, but the technical gate still holds on compile alone. Document the failure in the README rather than pretending the suite exists, and continue to Phase 4.

### Task 2.2 — Write the simulator

Copy `contract/test/simulator.ts` from **ARCHITECTURE.md Section 5**.

#### Decision Point DT-5b: `Cannot read properties of undefined (reading 'state')`

**Cause:** `CircuitContext` in runtime 0.19.0 has no `transactionContext`.

**Fix:** state is reached at `ctx.callContext.currentQueryContext.state`. Both the `public` getter and the context rebuild must use it.

### Task 2.3 — Write and run the tests

Copy `contract/test/inflight.test.ts` from **ARCHITECTURE.md Section 6**.

```bash
npx vitest run
```

Expected: `Tests  22 passed (22)`

Commit: `test: 22 passing simulator tests covering access control, nullifiers, binding, expiry, privacy`

### Phase 2 gate

- [x] Runtime loads
- [x] Simulator constructs a contract and reads public ledger state
- [x] 22 tests pass
- [x] Privacy group asserts the amount is absent from a full public-state dump
- [x] No Docker, no proof server, no wallet required

---

## Section 5: Phase 3 — Watcher, Types, Seed Script

### Task 3.1 — Extract shared types

Create `contract/src-ts/types.ts` from **ARCHITECTURE.md Section 4**.

```bash
mkdir -p contract/src-ts
npx tsc --noEmit -p contract 2>&1 | head
```

Expected: no errors referencing `types.ts`.

Commit: `types: shared LockRecord, AvalPrivateState, LockedEvent`

### Task 3.2 — Write the attestor watcher

Create `contract/src-ts/watcher.ts` from **ARCHITECTURE.md Section 7**.

The one rule: the leaf is computed with `pureCircuits.leaf_hash`, never a reimplementation.

#### Decision Point DT-9: the watcher's leaf does not match what the circuit recomputes

Symptom: `no merkle path: leaf is not registered` on a lock you just attested.

1. Confirm the watcher calls `pureCircuits.leaf_hash` and not a local hash helper.
2. Confirm argument ORDER matches the Compact signature exactly: `(lock_id, amount, counterparty, expiry, salt)`. A swapped `counterparty`/`salt` compiles fine in TS and fails silently at proof time.
3. Confirm the same `salt` instance reaches both the attestation and the proof. A regenerated salt produces a different leaf.
4. Still failing: log both leaves as hex and diff them.

Commit: `watcher: attest source-chain locks using the circuit's own leaf hash`

### Task 3.3 — Write the seed script

Create `contract/scripts/seed-demo.ts` from **ARCHITECTURE.md Section 8**.

```bash
cd contract && npx tsx scripts/seed-demo.ts
```

Expected:
```
attestor registered : true
fills               : 1
nullifiers spent    : 1
```

Commit: `scripts: demo seed produced by real circuit execution`

### Phase 3 gate

- [ ] `types.ts` compiles
- [ ] Watcher registers an attestation the prover can then use
- [ ] Seed script runs and prints a non-zero fill count
- [ ] Seed state is produced by real execution, not hand-written JSON (Thesis invariant)

---

## Section 6: Phase 4 — Demo Frontend

### Task 4.1 — Scaffold

```bash
mkdir -p frontend/src/lib
cd frontend && npm install
```

Copy `package.json`, `vite.config.ts`, `index.html` from **ARCHITECTURE.md Section 9**.

### Task 4.2 — Demo driver and app

Copy `frontend/src/lib/demo.ts`, `src/main.tsx`, `src/index.css`, `src/App.tsx` from **ARCHITECTURE.md Section 9**.

```bash
npm run build
```

Expected: `dist/index.html` written, exit 0.

#### Decision Point DT-8: the bundler cannot resolve `@contract` or chokes on the runtime

Run: `npm run build`

**If it works:** continue to Task 4.3.

**If `Failed to resolve import "@contract/test/simulator"`:**
1. Confirm the `resolve.alias` block in `vite.config.ts` points at `../contract`
2. Vite aliases do not append extensions for TS across package roots — import the explicit path `@contract/test/simulator.ts` if needed

**If the build fails inside `@midnight-ntwrk/compact-runtime` (node built-ins, wasm, or CJS interop):**
1. Keep `optimizeDeps.exclude` set for that package
2. If it still fails, the runtime is not browser-safe in this version. **Fall back:** run the seed script in Node, write its `LedgerView` output to `frontend/src/lib/ledger-snapshot.json`, and have the UI render that snapshot with the interactive prove button disabled and a visible note reading "ledger state captured from a real circuit run; re-run `npm run seed` to regenerate".
3. This fallback preserves the Thesis invariant because the state is still genuinely produced, not fabricated. It costs interactivity, not honesty.

**If nothing works:** cut the frontend. The submission still clears the gate and scores Engineering + QA. Note the cut in the README. Do NOT let this block Phases 5-8.

### Task 4.3 — Visual check

```bash
npm run dev
```

Open the local URL. Confirm both panes render, the prove button works, and raising the threshold above 2,000,000 produces a visible rejection.

Commit: `frontend: two-pane privacy demo driven by the real simulator`

### Phase 4 gate

- [ ] `npm run build` exits 0
- [ ] Two panes render side by side, and stack on a narrow viewport
- [ ] Successful proof updates the ledger pane
- [ ] Threshold above the held amount produces a visible rejection, not a silent failure
- [ ] No amount appears anywhere in the right-hand pane

---

## Section 7: Phase 5 — README, LICENSE, Domain Guide

### Task 5.1 — LICENSE

```bash
curl -sL https://www.apache.org/licenses/LICENSE-2.0.txt -o LICENSE
head -2 LICENSE
```

Expected: `Apache License`

#### Decision Point DT-2: the licensing or repo-topic gate is missed

These are the two cheapest auto-DQs in the competition.

1. `LICENSE` must exist at the repo root and be Apache-2.0. Verify: `head -2 LICENSE`.
2. The GitHub repo must carry the **`midnightntwrk` topic label**. This is a repository topic, not a file, and it is invisible from the local clone.
   ```bash
   gh repo edit --add-topic midnightntwrk
   gh repo view --json repositoryTopics
   ```
3. If `gh` is unavailable: set it manually in the GitHub UI under the repo description gear icon.
4. Verify by loading the public repo page in a logged-out browser.

### Task 5.2 — README

The README is the judge's landing page. Above the fold it must carry: what Aval proves, the one command that runs the tests, and the passing count. It must also state the attestor trust assumption plainly (DT-6) and name every prerequisite explicitly, which is the direct answer to the loudest complaint in Midnight's own docs issues.

Required sections: what it is, the problem, how it works (with the dual-ledger table), quick start, verification, trust model, what is not built, roadmap, developer-experience findings.

#### Decision Point DT-6: the trust assumption reads as a flaw rather than a bounded design choice

**Symptom:** a reviewer concludes "this needs a trusted third party, so it is not really trustless".

**Response, in the README, not in a rebuttal:**
1. Lead with the bilateral case: the counterparty runs the attestor themselves. Their *contract* cannot see Ethereum even though they can. Trust collapses to "Bob trusts Bob's own node".
2. Present the ladder: k-of-n quorum → bonded and slashable attestors (a fabricated lockId is provably contradicted by the source-chain escrow, so anyone can slash) → source-chain light client.
3. Name the residual honestly: a malicious attestor can fabricate a lock. This is the same trust model as every fast-finality bridge shipping today. Aval adds privacy to that model; it does not claim to beat it.
4. Never bury this in a footnote. Judges reward a bounded assumption and punish a hand-wave.

### Task 5.3 — Domain guide

Generate `DOMAIN-GUIDE.md` from **ARCHITECTURE.md Section 10**.

Commit: `docs: README, Apache-2.0 license, domain guide`

### Phase 5 gate

- [ ] `LICENSE` is Apache-2.0 at the repo root
- [ ] README states the test command and the passing count above the fold
- [ ] README states the trust assumption plainly
- [ ] README names every prerequisite, and states that Docker is NOT one
- [ ] `DOMAIN-GUIDE.md` exists

---

## Section 8: Phase 6 — Slide Deck and Demo Video

### Task 6.1 — Slide deck

Eight slides: the dead window; why you cannot just show them; the primitive; the dual-ledger split; the demo screenshot; the security table; the trust ladder; the roadmap.

### Task 6.2 — Demo video

Follow the scene script in **PRD.md Section 6**. Target 3 minutes.

#### Decision Point DT-4: the video or deck will not be finished in time

This is an auto-DQ risk, and the most common way a working project scores zero.

**Ladder, in order of preference:**
1. Full recorded walkthrough with voiceover, 3 minutes.
2. **Quick cut:** screen-record the terminal running `npm test` and the frontend two-pane flow, then splice with ffmpeg. No voiceover, on-screen captions instead. Ships in about 30 minutes.
3. **Slides with narration over the two screenshots.** Roughly 15 minutes.
4. **Silent screen capture with captions**, uploaded unlisted. Under 10 minutes.

Any of these satisfies "a demo / video pitch". None of them is skippable.

**Hard rule:** at the safety line (13:00 UTC), if no video exists, drop to rung 4 immediately and ship it.

Commit: `docs: slide deck and demo video links`

### Phase 6 gate

- [ ] Deck exists and opens from a logged-out browser
- [ ] Video exists and plays from a logged-out browser
- [ ] Video shows the two-pane view and the ledger dump with no amount in it
- [ ] Video shows the test suite passing

---

## Section 9: Phase 7 — Deploy and Livetest

### Task 7.1 — Deploy the frontend

```bash
cd frontend && npx vercel deploy --prod
```

Expected: a URL. Confirm HTTP 200 in a logged-out browser.

#### Decision Point DT-11: deployment is impossible or the toolchain blocks it

**On Midnight testnet deployment:** it is NOT attempted and NOT required. Toolchain 0.34 targets ledger 9, which is not live on testnet, and the buildathon's Technical Gate requires the contract to compile, not to deploy. Say this in the README rather than leaving judges to wonder.

**If the Vercel deploy fails:**
1. `npm run build && npx serve dist` locally, confirm it works
2. Retry `vercel deploy --prod`
3. If Vercel is unavailable, push `dist/` to a `gh-pages` branch and enable GitHub Pages
4. If both fail: the repo plus the video still demonstrate the UX. A live URL is not a gate requirement. Note it and move on.

### Task 7.2 — Livetest

Open the deployed URL logged out. Run the hero flow. Confirm the ledger pane never shows an amount.

### Phase 7 gate

- [ ] Live URL returns 200 logged out
- [ ] Hero flow completes on the deployed build
- [ ] Rejection path visible on the deployed build

---

## Section 10: Phase 8 — Package and Submit

### Task 8.1 — Proof artifacts

Write `submission/proof.md` containing the actual compile output, the actual test output, the ledger dump, and the toolchain versions. Paste real output; never retype it.

### Task 8.2 — Final verification

```bash
cd contract && npm install && npm test          # from a clean clone
cd ../frontend && npm run build
```

#### Decision Point DT-3: the deadline is closing and work is unfinished

At the safety line (13:00 UTC), stop building and package. Priority order for what must exist:

1. Public repo, Apache-2.0, `midnightntwrk` topic — gate
2. Compiling contract — gate
3. README — gate
4. Demo video, at whatever rung of DT-4 is reachable — gate
5. Slide deck — gate
6. Passing tests — 15%
7. Frontend — 15%
8. Live URL — not a gate

Items 1-5 are auto-DQ if missing. Items 6-8 are score. **Never trade a gate item for a score item.**

#### Decision Point DT-7: scope reads as over-claiming

If any artifact describes Aval as a finished platform for four verticals, fix the wording. One vertical is shipped. Three are roadmapped, explicitly labelled as not built. "Realistic scope" is 15% of the score, and over-claiming is how projects lose it.

#### Decision Point DT-12: the off-chain preimage channel is unavailable

Alice cannot prove without the preimage. This fails closed: no funds move, nothing is at risk. In Wave 1 the channel is a direct function return inside the demo. Encryption, retry, and delivery guarantees are Wave 2. Do not build them now.

### Task 8.3 — Submit

Work `SUBMISSION-CHECKLIST.md` top to bottom. Submit with more than 60 minutes to spare.

Commit: `submission: proof artifacts and links`

### Phase 8 gate

- [ ] Every item in SUBMISSION-CHECKLIST.md checked
- [ ] Clean-clone test run passes
- [ ] Every URL opened in a private window
- [ ] Submitted before 14:00 UTC

---

## Section 11: Decision Tree Index

| ID | Covers | Risk | Section |
|---|---|---|---|
| DT-1 | Compiler will not install | R1 CRITICAL | Phase 1 |
| DT-1b | Information-flow compile errors | R1 CRITICAL | Phase 1 |
| DT-2 | License and repo-topic gates | R2 CRITICAL | Phase 5 |
| DT-3 | Deadline pressure triage | R3 CRITICAL | Phase 8 |
| DT-4 | Video or deck unfinished | R4 CRITICAL | Phase 6 |
| DT-5 | Runtime will not install or load | R5 HIGH | Phase 2 |
| DT-5b | CircuitContext shape | R5 HIGH | Phase 2 |
| DT-6 | Trust assumption misread | R6 HIGH | Phase 5 |
| DT-7 | Scope over-claiming | R7 HIGH | Phase 8 |
| DT-8 | Frontend build failure | R8 MEDIUM | Phase 4 |
| DT-9 | Leaf mismatch | R9 MEDIUM | Phase 3 |
| DT-11 | Deployment blocked | R11 MEDIUM | Phase 7 |
| DT-12 | Preimage channel unavailable | R13 MEDIUM | Phase 8 |

13 decision trees covering all CRITICAL and HIGH risks plus the three MEDIUM risks with real failure modes. R10 and R12 need no tree: R10 is a documentation note and R12 is an expectations matter, not a build risk.
