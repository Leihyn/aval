# Aval: Implementation Plan

## Section 1: Plan Metadata

| Field | Value |
|---|---|
| Project | Aval |
| Hackathon | The Midnight Buildathon (AKINDO WaveHack), Wave 1 |
| Hard deadline | 2026-09-16 15:00:00 UTC |
| Safety line | 2026-09-16 13:00:00 UTC, package whatever exists |
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
| 1 | Toolchain and contract | 1.0h | none | **COMPLETE** |
| 2 | Simulator and test suite | 1.5h | 1 | **COMPLETE** |
| 2b | **Critique elevations (E-1, E-3, E-4, E-5, E-6)** | 1.25h | 2 | **pending, do FIRST** |
| 3 | Watcher, types, seed script | 0.5h | 2 | **COMPLETE** |
| 4 | Demo frontend | 1.5h | 2 | **COMPLETE** (build verified; in-browser run NOT verified, see 7.2) |
| 5 | README, LICENSE, domain guide | 0.75h | 3 | partial (README + LICENSE done, DOMAIN-GUIDE.md missing) |
| 6 | Slide deck and demo video | 1.5h | 4 | pending |
| 7 | Deploy and livetest | 0.75h | 4 | pending |
| 8 | Package and submit | 0.75h | 5,6,7 | pending |

Total remaining after Phase 2: **5.75h** against the window to the safety line. Slack is real but not generous.

---

## Section 3: Phase 1, Toolchain and Contract  [COMPLETE]

### Task 1.1: Install the Compact toolchain

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
1. `ls -la ~/.local/bin/compact`, confirm the binary landed
2. `export PATH="$HOME/.local/bin:$PATH"`
3. Re-run. If still failing, invoke the absolute path `~/.local/bin/compact`.

**If `compact update` fails to fetch a toolchain:**
1. `compact list` to see what is available for this platform
2. `compact update 0.31`, the previous stable line, and the one that targets the currently-deployed ledger
3. If the contract then fails to compile on 0.31, the `kernel.blockTimeLessThan` call is the likely cause; replace the expiry assert with a public `now` argument and note the downgrade in the README.

**If nothing works:** the technical gate cannot be cleared and the submission is not viable. Escalate immediately, do not continue building.

### Task 1.2: Write and compile the contract

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

### Task 1.3: Full compile with proving keys

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

## Section 4: Phase 2, Simulator and Test Suite  [COMPLETE]

### Task 2.1: Install the runtime

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

### Task 2.2: Write the simulator

Copy `contract/test/simulator.ts` from **ARCHITECTURE.md Section 5**.

#### Decision Point DT-5b: `Cannot read properties of undefined (reading 'state')`

**Cause:** `CircuitContext` in runtime 0.19.0 has no `transactionContext`.

**Fix:** state is reached at `ctx.callContext.currentQueryContext.state`. Both the `public` getter and the context rebuild must use it.

### Task 2.3: Write and run the tests

Copy `contract/test/inflight.test.ts` from **ARCHITECTURE.md Section 6**.

```bash
npx vitest run
```

Expected: `Tests  23 passed (22)`

Commit: `test: 23 passing simulator tests covering access control, nullifiers, binding, expiry, privacy`

### Phase 2 gate

- [x] Runtime loads
- [x] Simulator constructs a contract and reads public ledger state
- [x] 23 tests pass
- [x] Privacy group asserts the amount is absent from a full public-state dump
- [x] No Docker, no proof server, no wallet required

---

## Section 4b: Phase 2b, Critique Elevations  [DO THIS BEFORE PHASE 5-8]

<!-- [CRITIQUE] Added by hackathon-critique. Build follows this plan literally, so an
     approved elevation absent from here is an elevation that never ships. -->

Five approved elevations plus one deferred. Total about 1.25h. Every one of them is
prose or a single test except Task 2b.2, which is the one that matters most.

### Task 2b.1: Indistinguishability test  [E-1, approved]

Add to `contract/test/inflight.test.ts`, in the `privacy` describe block. Full spec in
**PRD.md Section 4.2a**.

Two simulators, identical except the locked amount (50_000 vs 5_000_000), same
`lock_id`, `salt`, `counterparty`, `expiry`, `required`. Both prove successfully. Assert:

```
attestor            byte-identical
attestor_registered identical
fills               identical (1n)
spent (nullifiers)  BYTE-IDENTICAL   <- the load-bearing assertion
root                differs
```

Also fix the two defects in the existing privacy group while you are in the file:
- `never exposes the locked amount` builds `root: Array.from(sim.public.attestations.root().field ?? [])`. The `?? []` makes the test pass silently if `.field` is ever undefined. Remove the fallback and assert the root is non-empty first.
- `reveals only an aggregate fill count` asserts `fills === 1n` and nothing else. It is a duplicate of the money-path test and asserts no privacy property. Either delete it or make it assert that `fills` is the ONLY monotone public counter.

```bash
cd contract && npx vitest run
```

**HARD REQUIREMENT, count propagation:** the passing count changes. In the SAME commit,
update every occurrence of `22` as a test count in `README.md`, `PRD.md`,
`ARCHITECTURE.md`, `FEATURE-OBSERVABLES.md`, `PLAN.md`, the deck and the demo script.
Verify with `grep -rn "22 " *.md | grep -i test`. A stale count is a verifiability
defect in a submission whose entire pitch is verifiability.

Add an `F-014` row to `FEATURE-OBSERVABLES.md` for this test.

Commit: `test: indistinguishability, two amounts 100x apart produce identical public state`

### Task 2b.2: Render the real ledger object in the right pane  [E-3, DEFERRED, highest value]

**Not auto-approved** (it changes existing frontend behaviour). Do it if there is any
time at all; it is the single highest-leverage change in the submission.

`frontend/src/lib/demo.ts` `readLedger` hand-authors five fields and truncates each with
`.slice(0, 24)`. The PRD and ARCHITECTURE both described that pane as a "literal dump"
until critique corrected the wording. The deeper problem is epistemic: **the pane would
look exactly the same if the contract DID write the amount and the renderer simply had
no `amount` key.** The judge is being asked to trust the renderer, which is the one
thing the product says they should not have to do.

1. Enumerate the ledger object's own fields rather than a hardcoded list, so a new
   public field appears automatically.
2. Stop truncating, or show full value on hover. A truncated hash reads as hiding.
3. Remove the `?? ''` fallback on `attestations.root().field` — same silent-pass defect
   as the test.
4. Add a second mode to the UI: run the proof at two different amounts and render both
   ledger states side by side with the differing line highlighted. This is the Scene 4
   money shot from **PRD.md Section 6** and the video needs it on screen.

### Task 2b.3: Trust-model and leakage honesty  [E-4, approved]

Propagate **PRD.md Section 1 "Who learns what"** and **"What an observer still learns"**
into `README.md` under `## Trust model`. The three things that must reach the README:

1. In the bilateral deployment **Bob already knows the amount** (he computes the leaf
   from it) and can recompute the nullifier. The README currently opens by selling "do
   not reveal the amount to your counterparty", which the shipped trust model
   contradicts. Say what the ZK actually buys: privacy from the chain and every third
   party, plus a machine-checkable gate Bob's contract can act on without Bob.
2. Privacy *from the counterparty* is the k-of-n roadmap rung, and the reason that
   roadmap is credible is that **`prove_funds_in_flight` does not change to get there** —
   the circuit never learns which attestor inserted the leaf, so only
   `register_attestation` changes. The money circuit is already quorum-ready.
3. The leakage table: `fills` and proof timing leak deal count and cadence; tree size
   bounds outstanding commitments; the attestor id identifies the deployment.

Add to `README.md` `## What is NOT built`:
- `register_attestor` is one-shot. No rotation, no revocation. A lost attestor key permanently bricks the registry.
- The nullifier set is per-deployment, so cross-counterparty reuse is prevented by the beneficiary binding in the leaf, not by the nullifier.

### Task 2b.4: De-cluster the positioning  [E-5, approved]

A blind peer re-derivation given only `research/research-brief.md` and `PRD.md` scored
this positioning **similar**, not differentiated: the construction (attested Merkle leaf
plus threshold predicate plus nullifier) is what 23 of the 59 entries are building, and
the demo's own closing line said so out loud.

1. **README roadmap table:** the Wave 2 row reads `kyc_passed AND jurisdiction NOT IN sanctioned` and the Wave 3 row reads `reserves >= liabilities`. Those are the two categories intel killed (8 and 15 competitors). Reorder so **"Real source-chain attestor: live listener, k-of-n quorum, encrypted preimage channel"** is the first Wave 2 row, because it is the credibility item. Reframe the other rows toward settlement moments: delivery-versus-payment, letters of credit, invoice factoring.
2. **Add the differentiator to the README**, verbatim from **PRD.md Section 1 "Why this is not a solvency proof with a different label"**: single use, counterparty-bound, expiring. Three mechanisms, nine tests. That is the difference between a proof you show and a proof you spend.
3. **Deck and video** use the rewritten **PRD.md Section 6 Scene 6**. Do not reintroduce "KYC" or "reserves" in any judge-facing artifact. `grep -rn -i "kyc\|reserves cover" *.md` must come back clean except inside the critique comments explaining why.

### Task 2b.5: Name the product  [E-6, approved]

`README.md` never explains what "Aval" means. A judge scoring 59 entries sees a word
they do not know. One line, high on the page:

> An aval is a trade-finance term: a third party's guarantee that a payment will happen. Aval replaces the guarantor with a proof.

It also reinforces the trade-finance frame, which is the frame that keeps this out of
the credit and identity clusters.

### Phase 2b gate

- [ ] Indistinguishability test added and passing
- [ ] `?? []` and `?? ''` silent-pass fallbacks removed from the test and from `demo.ts`
- [ ] Test count updated everywhere; `grep -rn "22" *.md | grep -i test` returns nothing stale
- [ ] README states that the bilateral counterparty already knows the amount
- [ ] README carries the leakage table and the two structural gaps
- [ ] README carries the single-use / counterparty-bound / expiring differentiator
- [ ] No "KYC" or "reserves" in any judge-facing artifact
- [ ] README explains the name

---

## Section 5: Phase 3, Watcher, Types, Seed Script

### Task 3.1: Extract shared types

Create `contract/src-ts/types.ts` from **ARCHITECTURE.md Section 4**.

```bash
mkdir -p contract/src-ts
npx tsc --noEmit -p contract 2>&1 | head
```

Expected: no errors referencing `types.ts`.

Commit: `types: shared LockRecord, AvalPrivateState, LockedEvent`

### Task 3.2: Write the attestor watcher

Create `contract/src-ts/watcher.ts` from **ARCHITECTURE.md Section 7**.

The one rule: the leaf is computed with `pureCircuits.leaf_hash`, never a reimplementation.

#### Decision Point DT-9: the watcher's leaf does not match what the circuit recomputes

Symptom: `no merkle path: leaf is not registered` on a lock you just attested.

1. Confirm the watcher calls `pureCircuits.leaf_hash` and not a local hash helper.
2. Confirm argument ORDER matches the Compact signature exactly: `(lock_id, amount, counterparty, expiry, salt)`. A swapped `counterparty`/`salt` compiles fine in TS and fails silently at proof time.
3. Confirm the same `salt` instance reaches both the attestation and the proof. A regenerated salt produces a different leaf.
4. Still failing: log both leaves as hex and diff them.

Commit: `watcher: attest source-chain locks using the circuit's own leaf hash`

### Task 3.3: Write the seed script

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

## Section 6: Phase 4, Demo Frontend

### Task 4.1: Scaffold

```bash
mkdir -p frontend/src/lib
cd frontend && npm install
```

Copy `package.json`, `vite.config.ts`, `index.html` from **ARCHITECTURE.md Section 9**.

### Task 4.2: Demo driver and app

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
2. Vite aliases do not append extensions for TS across package roots, import the explicit path `@contract/test/simulator.ts` if needed

**If the build fails inside `@midnight-ntwrk/compact-runtime` (node built-ins, wasm, or CJS interop):**
1. Keep `optimizeDeps.exclude` set for that package
2. If it still fails, the runtime is not browser-safe in this version. **Fall back:** run the seed script in Node, write its `LedgerView` output to `frontend/src/lib/ledger-snapshot.json`, and have the UI render that snapshot with the interactive prove button disabled and a visible note reading "ledger state captured from a real circuit run; re-run `npm run seed` to regenerate".
3. This fallback preserves the Thesis invariant because the state is still genuinely produced, not fabricated. It costs interactivity, not honesty.

**If nothing works:** cut the frontend. The submission still clears the gate and scores Engineering + QA. Note the cut in the README. Do NOT let this block Phases 5-8.

### Task 4.3: Visual check

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

## Section 7: Phase 5, README, LICENSE, Domain Guide

### Task 5.1: LICENSE

```bash
curl -sL https://www.apache.org/licenses/LICENSE-2.0.txt -o LICENSE
head -2 LICENSE
```

Expected: `Apache License`

#### Decision Point DT-2: the licensing or repo-topic gate is missed

These are the two cheapest gate failures to hit.

<!-- [CRITIQUE] At 04:23Z `git remote -v` returned NOTHING and this was logged as an
     auto-DQ blocker. RESOLVED CONCURRENTLY at 04:26-04:34Z by the conductor. Re-verified
     at 04:50Z: origin = https://github.com/Leihyn/aval, HTTP 200, private=false,
     topics include `midnightntwrk`, license spdx_id = Apache-2.0, pushed_at
     2026-09-16T04:34:09Z. The gate item is MET. Step 0 is retained as a re-check because
     it is the cheapest way to score zero with working code, and because a force-push or
     a repo rename would silently un-meet it. -->

0. **Re-verify the repo gate.** It was met at 04:34Z; confirm it is still met before submitting:
   ```bash
   git remote -v                                        # expect origin -> Leihyn/aval
   git status -sb                                       # expect nothing unpushed
   curl -s https://api.github.com/repos/Leihyn/aval | \
     python3 -c "import sys,json;d=json.load(sys.stdin);print(d['private'],d['topics'],d['license']['spdx_id'])"
   ```
   Expect `False`, a topic list containing `midnightntwrk`, and `Apache-2.0`. Then load
   the public URL in a logged-out browser and confirm the README renders.
1. `LICENSE` must exist at the repo root and be Apache-2.0. Verify: `head -2 LICENSE`.
2. The GitHub repo must carry the **`midnightntwrk` topic label**. This is a repository topic, not a file, and it is invisible from the local clone.
   ```bash
   gh repo edit --add-topic midnightntwrk
   gh repo view --json repositoryTopics
   ```
3. If `gh` is unavailable: set it manually in the GitHub UI under the repo description gear icon.
4. Verify by loading the public repo page in a logged-out browser.

### Task 5.2: README

The README is the judge's landing page. Above the fold it must carry: what Aval proves, the one command that runs the tests, and the passing count. It must also state the attestor trust assumption plainly (DT-6) and name every prerequisite explicitly, which is the direct answer to the loudest complaint in Midnight's own docs issues.

Required sections: what it is, the problem, how it works (with the dual-ledger table), quick start, verification, trust model, what is not built, roadmap, developer-experience findings.

#### Decision Point DT-6: the trust assumption reads as a flaw rather than a bounded design choice

**Symptom:** a reviewer concludes "this needs a trusted third party, so it is not really trustless".

**Response, in the README, not in a rebuttal:**
1. Lead with the bilateral case: the counterparty runs the attestor themselves. Their *contract* cannot see Ethereum even though they can. Trust collapses to "Bob trusts Bob's own node".
2. Present the ladder: k-of-n quorum → bonded and slashable attestors (a fabricated lockId is provably contradicted by the source-chain escrow, so anyone can slash) → source-chain light client.
3. Name the residual honestly: a malicious attestor can fabricate a lock. This is the same trust model as every fast-finality bridge shipping today. Aval adds privacy to that model; it does not claim to beat it.
4. Never bury this in a footnote. Judges reward a bounded assumption and punish a hand-wave.

### Task 5.3: Domain guide

Generate `DOMAIN-GUIDE.md` from **ARCHITECTURE.md Section 10**.

Commit: `docs: README, Apache-2.0 license, domain guide`

### Phase 5 gate

- [ ] `LICENSE` is Apache-2.0 at the repo root
- [ ] README states the test command and the passing count above the fold
- [ ] README states the trust assumption plainly
- [ ] README names every prerequisite, and states that Docker is NOT one
- [ ] `DOMAIN-GUIDE.md` exists

---

## Section 8: Phase 6, Slide Deck and Demo Video

### Task 6.1: Slide deck

Eight slides: the dead window; why you cannot just show them; the primitive; the dual-ledger split; the demo screenshot; the security table; the trust ladder; the roadmap.

### Task 6.2: Demo video

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

## Section 9: Phase 7, Deploy and Livetest

### Task 7.1: Deploy the frontend

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

### Task 7.2: Livetest

Open the deployed URL logged out. Run the hero flow. Confirm the ledger pane never shows an amount.

<!-- [CRITIQUE] The single highest-risk unverified claim in the whole submission. -->

**The in-browser run has never been verified.** `npm run build` exits 0 and the bundle
is clean (no `node:` builtins, no `require(`, 1.4MB wasm emitted), but no one has loaded
the page and clicked the button. The Midnight runtime is an ESM-integrated WASM core
built for Node; building it is not the same as executing it in a browser, and
`AvalSimulator.create()` runs at mount inside a `useEffect`. If it throws, the page
renders `loading…` forever and the two-pane demo — 15% UX, plus the Scene 4 money shot —
is dead.

Verify explicitly, before recording the video:

```bash
cd frontend && npm run build && npx vite preview --port 4173
# open http://localhost:4173 in a real browser
```

1. Both panes render, right pane shows real JSON not `loading…`.
2. Open devtools console. **Zero uncaught exceptions.** A WASM instantiation failure shows here first.
3. Click "Prove funds in flight" at the default threshold. `fills` goes 0 to 1 and a nullifier appears.
4. Raise the threshold above 2,000,000 on a fresh reload. Visible rejection with the revert string, not a silent failure.

**If any of those fail:** go to DT-8 rung 2, the real-execution snapshot. Record in the
README that the UI renders captured state and that the interactive path did not bundle.
The snapshot preserves the no-fabricated-state invariant but it **costs the money shot**,
so if you fall back, Scene 4 of the video must switch to a terminal recording of the
test suite showing the indistinguishability assertion instead. Do not let the video
claim an interactive demo that does not run.

### Phase 7 gate

- [ ] Live URL returns 200 logged out
- [ ] Hero flow completes on the deployed build
- [ ] Rejection path visible on the deployed build
- [ ] **Browser devtools console shows zero uncaught exceptions on load and after prove**
- [ ] If the interactive path failed, the README says so and Scene 4 was re-cut

---

## Section 10: Phase 8, Package and Submit

### Task 8.1: Proof artifacts

Write `submission/proof.md` containing the actual compile output, the actual test output, the ledger dump, and the toolchain versions. Paste real output; never retype it.

### Task 8.2: Final verification

```bash
cd contract && npm install && npm test          # from a clean clone
cd ../frontend && npm run build
```

#### Decision Point DT-3: the deadline is closing and work is unfinished

At the safety line (13:00 UTC), stop building and package. Priority order for what must exist:

1. Public repo, Apache-2.0, `midnightntwrk` topic, gate
2. Compiling contract, gate
3. README, gate
4. Demo video, at whatever rung of DT-4 is reachable, gate
5. Slide deck, gate
6. Passing tests, 15%
7. Frontend, 15%
8. Live URL, not a gate

Items 1-5 are auto-DQ if missing. Items 6-8 are score. **Never trade a gate item for a score item.**

#### Decision Point DT-7: scope reads as over-claiming

If any artifact describes Aval as a finished platform for four verticals, fix the wording. One vertical is shipped. Three are roadmapped, explicitly labelled as not built. "Realistic scope" is 15% of the score, and over-claiming is how projects lose it.

#### Decision Point DT-12: the off-chain preimage channel is unavailable

Alice cannot prove without the preimage. This fails closed: no funds move, nothing is at risk. In Wave 1 the channel is a direct function return inside the demo. Encryption, retry, and delivery guarantees are Wave 2. Do not build them now.

### Task 8.3: Submit

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
