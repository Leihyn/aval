# INTERROGATE REPORT — Aval

**Date:** 2026-09-16. Audit ran 05:43Z–06:46Z; the 15:00Z Wave 1 deadline was 8h 14m away at close.
**Mode:** DEEP (bespoke dispatch — see *Lens inventory* below)
**Purpose:** prepare the builder for the live interview the Official Rules reserve the right to call, and surface anything that would embarrass them in it.
**Scope note:** read-only. This phase modified no source or doc file. The repo was being edited concurrently throughout — `frontend/`, `submission/`, and `contract/src/` all changed under this audit. Every finding carries the timestamp of its verification.

---

## The one thing to read first

**It was found, and it was fixed, inside this phase. Verify it is still in before you submit.**

`prove_funds_in_flight` did not check that the Merkle path it proved against was a path for
the leaf it had just computed. `find_path` is a **witness** — it runs on the prover's own
machine and is not cryptographically verified, so passing `leaf` into it is a hint, not a
constraint. `merkleTreePathRoot` hashes `path.leaf`, and nothing tied the two together.

I wrote a proof-of-concept against the real compiled contract. It produced an **accepted
proof** claiming `amount = 2^64-1` against a real attestation for 1 unit, paid to the
**wrong counterparty**, **41,000 time units past the real expiry**, leaving the honest
lock's nullifier **unspent** so that attestation could back a second proof as well.

That single omission falsified two of the three headline differentiators, all three
"binding" tests, three of the six attack-demo reverts, four rows of the README security
table, and both `FEATURE-OBSERVABLES` rows F-007 and F-008.

**Why it mattered so much for this specific audience:** Midnight's own teaching repo merged
`midnightntwrk/midnight-expert` PR #239, *"Bind the Merkle path's leaf to the caller's
commitment in two examples,"* on **2026-09-05** — eleven days before this deadline (verified
live against the GitHub API: merged `2026-09-05T13:19:36Z`). Its PR body contains the same
analysis, reached independently here. And both of Aval's nearest-construction competitors in
this same wave already do it right: `OoJae/onepledge` asserts `lenderPath.leaf == lender`
(`registry.compact:176`) and `notePath.leaf == note` (`:199`); `ceciliagalvaoo/Attesta`
asserts `path.leaf == commitment` twice (`attesta.compact:251`, `:333`).

**Status at 06:45Z: RESOLVED and verified against live artifacts.**
`contract/src/inflight.compact:141` now carries
`assert(disclose(path.leaf == leaf), "merkle path does not open the claimed leaf");`
Both the ledger-9 and ledger-8 builds were recompiled (06:44Z / 06:45Z), the two sources
still differ by exactly the one `pragma` line, and a genuine adversarial-witness regression
test landed at `contract/test/soundness.test.ts`. Re-running my exploit against the current
`out/`:

```
ATTACK forged proof -> rejected: failed assert: merkle path does not open the claimed leaf
fills 0n -> 0n     spent 0n -> 0n
```

Suite is now **24 passed (24)** across 2 files.

**What that leaves.** The engineering hole is closed. What is still open is that **every
artifact in the submission now states a test count that is wrong** — the deck and the video
say 22, the README's Verification table says `22 / 24 passed`, the suite says 24 — and
`submission/proof.md` still opens
with "Nothing is retyped" above a number no run has ever printed. See F-03, F-04, F-05.

---

## Lens inventory (what ran, what did not)

Dispatched as four parallel adversarial lenses plus direct contract analysis, rather than
the canonical 23-persona roster, because the caller named six specific interview questions
to prioritise. Mapping to the canonical personas:

| Canonical persona | Covered | How |
|---|:--:|---|
| P1 Economic Adversary, P2 State Machine, P3 Cryptography, P4 Access Control | yes | direct contract analysis + 3 runnable PoCs |
| P5 Integration, P7 API design | partial | witness/ledger boundary, frontend↔contract import path |
| P6 Dependencies, P8 Config Guardian | yes | secret scan over 68 tracked files, manifests, gitignore, live repo gate |
| P9 Honesty Cop | yes | dedicated agent, full claim-vs-code sweep of 9 documents |
| P10 Judge Simulation, P23 Competitive Positioning | yes | dedicated agent, web research + competitor source reads |
| P11 Sponsor Compliance | yes | live GitHub API verification of every gate item |
| P12 UX, P14 Demo Reliability | yes | dedicated agent (frontend/deck/video) |
| P15 Performance, P16 Deployment, P18 Edge cases, P19 Upgrade safety | yes | capacity probe to exhaustion, ledger-8 diff, deploy-blocker review |
| P17 Code quality, P13 Traction | partial | spot checks only |
| P20 Narrative, P21 Deadline, P22 Architecture honesty | yes | inline |

**Not run:** none of the canonical personas was skipped outright, but P13 (traction) and
P17 (code quality) got spot coverage rather than a dedicated pass, because neither moves
this rubric materially. Per-persona working files were kept in the session scratchpad
rather than written into the repo, because `.interrogate-*` is not in `.gitignore` and the
repo ships to judges today.

---

## Verified solid

Everything below was executed, not read.

| # | What was verified | Evidence |
|---|---|---|
| 1 | Test suite really passes, 24/24 | `npx vitest run` → `Tests  24 passed (24)`, 2 files, 1.44s (verified 06:46Z) |
| 2 | Contract compiles, the Technical Gate | `compact compile src/inflight.compact` → `Compiling 3 circuits:`, 3 `.zkir` |
| 3 | Proving keys really generate | fresh compile → 6 keys (3 `.prover`, 3 `.verifier`) + 3 `.bzkir`, 11.8s |
| 4 | Committed artifacts match the published source | all 3 committed `out/zkir/*.zkir` are **byte-identical** to a fresh compile; the only `index.js` delta is `expectedVk` (empty in the keyless build). Judges running `npm test` are testing `src/inflight.compact`. |
| 5 | The ledger-8 claim is true | `diff src/inflight.compact src-ledger8/inflight.compact` = exactly one line (`pragma language_version >= 0.26` → `>= 0.16`); `out-ledger8/zkir/` holds 3 `.zkir` |
| 6 | Every submission gate item is live and green | GitHub API: `private:false`, `license: Apache-2.0`, topics include `midnightntwrk`; README/LICENSE/`contract/src/inflight.compact` all HTTP 200 raw; `git log origin/main..HEAD` empty |
| 7 | The "no credentials" claim holds | 0 secret-pattern hits and 0 `process.env`/`import.meta.env` references across all 68 tracked files |
| 8 | Salt has real entropy | `contract/src-ts/watcher.ts:12` uses `crypto.getRandomValues(new Uint8Array(32))` |
| 9 | Indistinguishability is genuinely sound | `scripts/indistinguishability.ts` reproduces; the property is independent of F-01; the nullifier is byte-identical across a 100× amount difference because `nullifier_of` touches only `lock_id` and `salt` |
| 10 | Registry access control is real | `assert(disclose(id == attestor))` at `inflight.compact:105` genuinely gates writes; PoC confirms a non-attestor is rejected |
| 11 | Expiry reads real ledger block time | `kernel.blockTimeLessThan` — not a caller-supplied timestamp. Sound now that F-01 is fixed; before the fix a forger could choose the value it was compared against. |
| 12 | `disclose()` discipline is real | six annotated call sites; Compact's information-flow analysis is genuinely load-bearing |
| 13 | Capture files `attacks.txt` and `indistinguishability.txt` match their live scripts | re-ran both; output matches |
| 14 | **The frontend really does run in a real browser** — pipeline item D-4 is settled, positive | headless Chromium via Playwright 1.63 against `vite preview`: WASM instantiates, boot reaches `ready`, `fills` goes to 1 on prove, **zero console errors**. Repro: `cd frontend && npx vite preview --port 4173 &` then `node verify-browser.mjs` |
| 15 | The frontend is not a mock | `demo.ts` imports `@contract/test/simulator`, which imports the compiled `../out/contract/index.js`. Zero hardcoded ledger JSON, zero mock/fixture/stub hits across `frontend/src` |
| 16 | Frontend builds clean and is browser-safe | `npm run build` exit 0 twice, no warnings; built bundle has zero `node:` builtin imports and zero `require(` |
| 17 | The privacy pane's leak detector genuinely fires | proven by deliberate injection + real-browser run, not by assertion — and the injection exposed and fixed a real white-screen crash before being reverted (`proof.md:129-147`) |

---

## Open gaps

Severity: **P0** showstopper · **P1** critical · **P2** important · **P3** nitpick.
Effort: **E1** <15 min · **E2** 15-60 min · **E3** 1-4h · **E4** 4h+.

### P0 — showstopper

---

#### F-01 · The Merkle path was never bound to the recomputed leaf — total soundness break · **FIXED 06:45Z**

**Location:** `contract/src/inflight.compact:127-135` (fix now at `:141`)
**Effort:** E1 (one line) · **Demo:** was BLOCKS · **Submission:** was BLOCKS · **Status: RESOLVED, re-verified against live artifacts**

```compact
const leaf = leaf_hash(lock_id, amount, counterparty, expiry, salt);   // L127
const path = find_path(leaf);                                          // L128  <- witness
const root = disclose(merkleTreePathRoot<10, Bytes<32>>(path));        // L134  <- uses path.leaf
assert(attestations.checkRoot(root), "attestation not registered");    // L135
```

`find_path` is a **witness**. A witness runs on the prover's own machine and is not
cryptographically verified — Midnight's own security doc says so in as many words:
*"Witness implementations run outside zero-knowledge circuits and are not cryptographically
verified… contract logic must never trust witness values without validation."* Passing
`leaf` into `find_path(leaf)` is a **hint**, not a constraint.

`merkleTreePathRoot` hashes `path.leaf` — confirmed in the generated circuit,
`contract/out/contract/index.js:412-421`:

```js
_merkleTreePathRoot_0(path_0) {
  return { field: this._folder_0(..., this._degradeToTransient_0(
      this._persistentHash_2({ domain_sep: ..., data: path_0.leaf })), path_0.path) };
}
```

`leaf_0` is computed at line 689 of the generated body and then **never referenced again**.
The recomputation is cosmetic.

**PoC result** (script in session scratchpad, imports the real compiled contract, changes
exactly one thing — the `find_path` implementation):

```
registered leaf (public, readable by anyone): ddf8ca317d0acf70fa03687d36d8bd94...
honest content: amount=1  counterparty=BOB  expiry=9000

CONTROL inflate amount       -> rejected: no merkle path: leaf is not registered
CONTROL redirect to Carol    -> rejected: no merkle path: leaf is not registered
CONTROL extend own expiry    -> rejected: no merkle path: leaf is not registered

ATTACK forged proof        -> *** ACCEPTED ***

fills   0n -> 1n
spent   0n -> 1n
nullifier written = ebafb98f3e5d72f7b955feefd451f87d... (derived from the FORGED lock)
real lock nullifier still unspent = true
```

The forged proof claimed `amount = 18446744073709551615` against a 1-unit attestation, for
`CAROL` when the leaf was bound to `BOB`, with `expiry = 99999` at block time `50000` when
the real expiry was `9000` — and it left the real nullifier unspent, so that attestation
can back a second proof.

The three CONTROL rows are exactly what the shipped tests and `attack-demo.ts` assert. They
pass **only** because `contract/test/simulator.ts:41-45` implements `find_path` honestly.
At the time of discovery every one of the 23 tests used that single honest witness and none
overrode it, so 23/23 green said nothing about this property. `contract/test/soundness.test.ts`
(added 06:45Z) is now the test that does: it swaps in a hostile `find_path` and asserts the
forged proof is rejected, no fill is recorded, and the honest lock's nullifier stays unspent.

**The fix, now shipped** at `contract/src/inflight.compact:141`:

```compact
assert(disclose(path.leaf == leaf), "merkle path does not open the claimed leaf");
```

I first verified an equivalent one-liner in a scratchpad copy (compiles, blocks the forgery,
honest path unaffected). A concurrent agent then landed the shipped version. Re-verified by me
at 06:45Z against the **live** `contract/out/`:

- compiled output contains the assert; `out/` and `out-ledger8/` both regenerated (06:44Z/06:45Z)
- `src-ledger8/inflight.compact` still differs from `src/` by exactly the one `pragma` line
- my exploit → `rejected: failed assert: merkle path does not open the claimed leaf`, `fills 0n -> 0n`, `spent 0n -> 0n`
- `npx vitest run` → `Tests  24 passed (24)` — a real adversarial-witness regression test now exists at `contract/test/soundness.test.ts`, which swaps in a hostile `find_path` and asserts rejection, no fill, and the honest nullifier left unspent

**Before submitting, re-run those two commands.** This landed an hour before the deadline in a
repo three agents were editing.

**Why this is worse than a normal bug for this specific audience:** Midnight's own
`midnight-expert` repo merged PR #239 on 2026-09-05 fixing the identical class in
`NullifierDoubleSpend.compact` and `ticket.compact` — *"files developers copy"* — using
literally this assertion. And both of Aval's nearest-construction competitors in this same
wave (`OoJae/onepledge`, `ceciliagalvaoo/Attesta`) already have it. A Midnight Foundation
engineer comparing entries in this cluster will find it in minutes.

**Claims that were falsified while F-01 was open** — all of these are TRUE again now that the
binding is in. Listed because they are exactly what a judge will probe, and because if the fix
is ever reverted, every one of them goes false at once:

| File:line | Claim |
|---|---|
| `contract/src/inflight.compact:58-61` | "change either value and the recomputed leaf no longer matches any registered leaf" |
| `contract/src/inflight.compact:137-142` | "it is bound into the leaf, so the prover cannot alter it without invalidating the Merkle proof" |
| `DOMAIN-GUIDE.md:14, 26, 29, 31` | rules 1, 2, 6 and the Leaf definition |
| `README.md:41-43` | the Single use / Counterparty bound / Expiring differentiator table |
| `README.md:45-47` | "single-use, counterparty-bound, expiring bearer instrument" |
| `README.md:80-84` | four rows of the Security-properties table |
| `PRD.md:137-145` | "why this is not a solvency proof" table + bearer-instrument line |
| `PRD.md:270-272` | Flow 3 error cases ("leaf mismatch, no path" ×3) |
| `PRD.md:502` | demo Scene 5 voiceover — **this is in the rendered video** |
| `ARCHITECTURE.md:146, 234-242, 364-365, 775, 804` | incl. Safety Architecture "Layer 1: Input validation" |
| `FEATURE-OBSERVABLES.md` F-007, F-008 | marked "Verified: YES"; their stated Sentinel failures are exactly what the PoC produced |
| `submission/proof.md:58-68` | "Six attacks, six reverts produced by the circuit" |
| `submission/wave1-progress.md:9, 21` | "counterparty swap, amount inflation, expiry extension all rejected" |
| `.pipeline/SUBMIT-THIS.md` submission comment | "an attestation is not transferable… the prover cannot inflate the amount" |

---

#### F-02 · `attack-demo.ts` claims the circuit blocks attacks the test harness blocks

**Location:** `contract/scripts/attack-demo.ts:59`
**Effort:** E2 · **Demo:** WARNS · **Submission:** WARNS
*(Downgraded from P0 now that F-01 is fixed: the property is genuinely enforced, the demo just still does not demonstrate it.)*

The script prints, verbatim:

```
  All six blocked by the circuit, not by application code.
```

Three of the six are blocked by application code — specifically by
`contract/test/simulator.ts:43`, which throws `no merkle path: leaf is not registered`.
That string is not one of the contract's seven assert messages. The contract's messages are
`attestor already registered`, `no attestor registered`, `caller is not the attestor`,
`attestation not registered`, `attestation expired`, `locked amount below required threshold`,
`this lock has already backed a proof`. A judge who greps the `.compact` for the revert
string in the demo output will not find it.

README, `submission/proof.md`, and the paste-ready submission comment all point judges at
this script.

**Now that F-01 is fixed this is cheap to make true, and worth doing.** Give `attack-demo.ts`
the hostile `find_path` from `test/soundness.test.ts` for those three cases. The output then
reads `BLOCKED: merkle path does not open the claimed leaf` — a real circuit assert — and the
demo starts demonstrating the strongest thing in the contract instead of the weakest thing in
the harness. Alternatively add a seventh row for the forged-path attack and keep the other six
labelled honestly.

---

#### F-03 · `submission/proof.md` falsifies its own opening promise

**Location:** `submission/proof.md:3` vs `:37` and `:41`
**Effort:** E1 · **Demo:** NONE · **Submission:** BLOCKS

Line 3: *"Everything below is captured output from running the code on 2026-09-16.
**Nothing is retyped.**"*

Line 37: `     Tests  23 passed (22)`

No run has ever produced that string. The stale capture on disk
(`submission/captures/tests.txt:26`) prints `Tests  22 passed (22)`. The current real run
prints `Tests  23 passed (23)`. The line at :37 is a hand-edit of a captured number, inside
the one artifact whose entire stated value is that its numbers were not hand-edited.

Line 41 then gives a per-group breakdown — `3 + 2 + 4 + 4 + 3 + 2 + 4` — which sums to **22**,
two lines after claiming 23. The real groups are 3/2/4/4/3/2/**5**.

And line 30 / 41 point the reader at `captures/tests.txt`, which still lists only 22 test
names, uses pre-rename titles ("publishes a nullifier that is unlinkable to the registered
leaf" vs. the current "…is not the registered leaf"), and is missing the indistinguishability
tests entirely.

This is the single most embarrassing catchable item after F-01, because it is
self-inflicted and takes 60 seconds to find: the document called *proof* contains a number
that was provably retyped, and retyped wrong.

**Two further contradictions inside the same file, both added after this audit began**
(`proof.md` was revised at ~06:40Z while this report was being written — the new browser-
verification section is genuinely good work and resolves D-4, see *Verified solid* #14):

- `proof.md:87` still says *"In-browser interactive behaviour of the frontend was verified as
  far as build and HTTP 200 serving. **It was not driven through a real browser session.**"*
  while `proof.md:114-127` is a new section titled *"Verified in a real browser (headless
  Chromium)"*. Both are in the same document. Delete line 87.
- `proof.md:56` still says *"Four tests assert this against a **full serialisation** of the
  ledger"* and `:112` repeats *"comparing the full public surface structurally so a future
  leaking field fails the test"* — the F-08 overclaim, restated twice.

---

### P1 — critical

---

#### F-04 · The test-count propagation has now failed three times in a row, and the README says two tests fail

**Effort:** E1 · **Demo:** WARNS · **Submission:** WARNS
**State as of 06:46Z.** Actual: `npx vitest run` → `Tests  24 passed (24)`, 2 files.

**Root cause, and it is one line.** Every sweep replaces the leading number and never the one
in parentheses, because `PLAN.md:162` seeds the malformed string as the canonical expected
output and each sweep re-reads it:

```
PLAN.md:162   Expected: `Tests  24 passed (22)`
```

It has produced `23 passed (22)` (22→23 sweep), then `24 passed (22)` (23→24 sweep). Fix
`PLAN.md:162` or the next sweep makes it a fourth time.

**Exactly six lines are still wrong.** Everything else in the repo now correctly says 24.

| File:line | Current | Should be |
|---|---|---|
| `README.md:11` | `# → Tests  24 passed (22)` | `# → Tests  24 passed (24)` |
| `README.md:154` | `**22 / 24 passed**, 651ms` | `**24 / 24 passed**` (and drop the 651ms — no run has printed it) |
| `submission/proof.md:37` | `     Tests  24 passed (22)` | paste the real line |
| `ARCHITECTURE.md:114` | "22 security + privacy tests" | 24 |
| `PLAN.md:162` | `Expected: Tests  24 passed (22)` | the real string |
| `submission/deck.py` + `video/render.py` | 22 in six places | see F-05 |

`README.md:154` is the worst of them: in the *Verification* table, `22 / 24 passed` reads as
**two tests failing**. It is the row a judge checking your claims looks at first.

`PLAN.md:208-212` contains the project's own procedure for preventing exactly this —
*"In the SAME commit, update every occurrence… A stale count is a verifiability defect in a
submission whose entire pitch is verifiability."* — and `PLAN.md:285` leaves its checkbox
unticked. The procedure exists. It has not been executed to completion once.

Good news since this audit opened: `submission/captures/tests.txt` **was** regenerated and
now correctly reads `Tests  24 passed (24)`.

---

#### F-05 · The deck and the video both display 22; the suite prints 24

**Location:** `submission/video/render.py:151,153,155,156,239`; `submission/deck.py:94,176`
**Effort:** E2 (regenerate capture + 6 string literals + re-run two scripts) · **Demo:** BLOCKS · **Submission:** WARNS

```python
# submission/video/render.py
151  d.text((80, 70), '22 tests, all passing', font=F_H1, fill=FG)
153  lines = read_capture('tests.txt')          # <- reads the STALE 22-test capture
156  d.text((80, 940), 'Tests  22 passed (22)', font=f(MONO, 34), fill=GREEN)
239  d.text((80, 700), 'Apache-2.0  ·  22 passing tests  ·  3 circuits  ·  no Docker required', ...)

# submission/deck.py
94   d.text((1020,275),'Tests  22 passed (22)',font=F(MONO,34),fill=GREEN)
176  'Apache-2.0  ·  3 circuits  ·  6 proving keys  ·  22 passing tests'
```

Both pipelines render `submission/captures/tests.txt` — the stale 05:27Z capture — directly
onto the screen as pixels. `pdftotext` extracts **zero text** from the deck: every slide is a
rasterized PNG, so the number cannot be patched, only re-rendered.

**This got worse during the audit, not better.** Both artifacts were re-rendered at 06:41Z
(deck grew from 10 to 11 pages, video from 127s to 141s) and the 22 was carried straight
through. The pipeline was re-run with the fix available and the fix was not applied.

A judge watching the video sees **22**, opens the README and sees **22 / 24 passed**
(implying two failures), then runs the suite and gets **24**. Three numbers, three artifacts,
and Quality Assurance is 15% of the score.

**Fix:** regenerate `submission/captures/tests.txt` from a real run, change the six string
literals above, re-run `deck.py` and `render.py`. Everything else in the pipeline already works.

Scene 5's narration (`PRD.md:502`) is: *"Inflate the amount: the leaf no longer matches. Point
it at a different counterparty: same. Extend your own expiry: same."* While F-01 was open all
three were false, which made the video a demo blocker. **Since 06:45Z all three are true
again** — so this is now the strongest thirty seconds in the video rather than its biggest
liability. Lean on it in rehearsal.

This is pipeline item **D-8**, raised by critique and never resolved: *"Decide explicitly:
update docs only and leave the video saying 22, or re-render."* It is still undecided.

---

#### F-06 · `register_attestor()` is permissionless — anyone can brick the deployment

**Location:** `contract/src/inflight.compact:85-93`
**Effort:** E2 · **Demo:** NONE · **Submission:** WARNS

```compact
export circuit register_attestor(): [] {
  assert(!attestor_registered, "attestor already registered");
  const id = derive_id(local_secret_key());
  attestor = disclose(id);
  attestor_registered = true;
}
```

There is no access control. The first caller of all time becomes the permanent attestor, and
there is no rotation circuit — the contract exports exactly three circuits and none of them
revokes or rotates. PoC output:

```
Mallory called register_attestor first -> attestor_registered = true
Bob is locked out forever -> failed assert: attestor already registered
Bob cannot use his own deployment -> failed assert: caller is not the attestor
```

Between Bob deploying and Bob's bootstrap transaction landing, any observer can take the
role permanently. Recovery requires redeploying, which means a fresh `attestations` tree and
every pending attestation stranded.

README:264 discloses the one-shot design, but frames the risk only as *"a lost attestor key
permanently bricks the registry"* — the hostile-first-caller vector is not mentioned anywhere.

**Fix direction:** bind the attestor at construction, or have `register_attestor` take an
expected id committed at deploy time.

---

#### F-07 · `required` and `counterparty` are public proof inputs, and both "what an observer learns" tables omit them

**Location:** `README.md:204-209`, `PRD.md:88-95`
**Effort:** E1 · **Demo:** NONE · **Submission:** WARNS

`contract/out/contract/index.js:266-272` puts all three circuit arguments into
`partialProofData.input` — the proof's **public** inputs:

```js
input: { value: _descriptor_4.toValue(required_0)
                .concat(_descriptor_1.toValue(counterparty_0)
                .concat(_descriptor_4.toValue(expiry_0))), ... }
```

The contract is honest about this in its own comment (`inflight.compact:115-117`). The two
documents are not. Both "What an observer still learns" tables list only `fills`, tree size,
`attestor` id, and *"that a threshold was cleared"*. An observer actually learns:

- the **exact threshold value** `required` — a hard lower bound on the amount, not just "a bit"
- the **payee address** `counterparty`
- the expiry

For the treasury desk in the README's own opening scenario, "Bob is owed at least $2,000,000"
is close to the information the whole design exists to hide. These tables are the sections
that claim to be the complete honest accounting (*"a submission that only publishes its wins
has not been audited"*). Being incomplete *there* costs more than the omission is worth.

This also sharpens the honest answer to interview Q1 — see below.

---

#### F-08 · The indistinguishability dump reproduces the exact pattern critique condemned, one size larger

**Location:** `contract/test/inflight.test.ts:233-249`
**Effort:** E2 · **Demo:** NONE · **Submission:** WARNS

The comment claims:

> *"Serialise EVERY reachable field of public ledger state. **Deliberately not a hand-picked
> projection**… Enumerating the whole surface means a future field that did leak the amount
> would be caught here rather than silently pass."*

`dumpPublic` is a hand-written object literal with seven named keys. It happens to cover all
five current ledger fields, so today's assertions are sound — but nothing enumerates the
ledger object's own keys. Add an `export ledger` field tomorrow and it is silently absent
from the dump. The mechanism is identical to the 4-key version the project itself retired;
only the count changed.

The assertion is fine. **The comment is the false part** — and it is false in the one place
the project has already been caught once. Either enumerate reflectively
(`Object.keys(ledger(...))`) or delete the two sentences that overclaim.

---

#### F-09 · The frontend's "leaked" indicator checks less than its own copy claims

**Location:** `frontend/src/App.tsx` (`PRIVATE_INPUTS`, the `leaked` filter, and the pane copy);
`frontend/src/lib/demo.ts:22-28`
**Effort:** E2 · **Demo:** WARNS · **Submission:** WARNS
**(Read-only finding. `frontend/` is owned by a concurrent agent and moved three times during
this audit — re-check against HEAD before acting.)**

*Downgraded from the initial reading.* The detector is **not** vacuous: the concurrent agent
empirically injected an `amount` field into `readLedger`, drove the page in real headless
Chromium, and the pane rendered `Privacy claim failed / The ledger object exposes: amount`.
That injection surfaced and fixed a genuine crash (an undeclared ledger key made
`FIELD[k].label` throw at three call sites, white-screening React instead of showing the
banner) and was then reverted — verified clean at 06:41Z. That is good adversarial work and
it is now written up in `proof.md:129-147`.

What remains true:

- `leaked` is `PRIVATE_INPUTS.filter(f => Object.hasOwn(view, f))` against `readLedger()`'s
  curated `LedgerView`, never against `sim.public`. It catches an exact **key-name** match on
  a field the renderer chose to copy. It cannot catch a leak that lands in `sim.public` and
  is simply not copied, a leak under a differently-named key, or an amount hidden inside a
  value past the `.slice(0, 24) + '…'` truncation boundary.
- The pane copy is broader than the check: *"This list is re-checked against the live ledger
  object on every update. If one of these ever appeared on chain, this pane would say so."*
  Only the first clause is true. Change it to "checks that none of these key names appear",
  or make the check enumerate `sim.public`'s own keys.
- `demo.ts:22-28` is still a hand-picked five-field projection with `.slice(0, 24)` truncation
  and a `?? ''` fallback on the root — pipeline item **D-1**, raised by critique at P0, spec'd
  in PLAN Task 2b.2, still unshipped. PLAN's own words: *"the pane would look exactly the same
  if the contract DID write the amount and the renderer simply had no `amount` key."*

---

### P2 — important

---

#### F-10 · Registry capacity is 1,024 **lifetime** inserts, not "concurrent", and exhaustion is an unhandled runtime error

**Location:** `contract/src/inflight.compact:29`; claim at `PRD.md:321`
**Effort:** E3 · **Demo:** NONE · **Submission:** WARNS

`PRD.md:321` says: *"tree depth 10 = 1,024 **concurrent** registered attestations."* That is
wrong, and the error is in the direction that flatters the design. The tree never evicts. A
lock that has been proven and whose nullifier is spent still occupies its slot forever. It is
1,024 **lifetime** inserts.

Probed to exhaustion:

```
after insert #1022: firstFree=1023 isFull=false
after insert #1023: firstFree=1024 isFull=true
insert #1024 (0-indexed) FAILED: Error: exceeded structure bounds
FINAL firstFree = 1024n  isFull = true
path for leaf #0 still findable after fill: true
```

The failure is a raw runtime error, not one of the contract's asserts, because the contract
never calls the `isFull()` the generated API provides. After that the registry is permanently
write-dead: no eviction, no reset, no second tree, no admin circuit. Existing leaves stay
provable, so nothing in flight is lost — but nothing new can be registered, ever.

At 20 settlements a day that is about 51 days.

---

#### F-11 · No caller binding on `prove_funds_in_flight` + unencrypted preimage channel = anyone who sees the preimage can burn the nullifier

**Location:** `contract/src/inflight.compact:118-157`
**Effort:** E3 · **Demo:** NONE · **Submission:** WARNS

`prove_funds_in_flight` never calls `local_secret_key()`. There is no identity in the circuit
at all. That is a deliberate bearer-instrument design and the README frames it that way — but
it composes badly with README:262, *"No encryption on the preimage channel."* Anyone who
observes the preimage can produce the proof first, burning the nullifier and denying the
legitimate holder.

Recoverable: the attestor can re-attest the same lock with a fresh salt, which yields a
different nullifier. That consumes a tree slot (see F-10) and is documented nowhere.

---

#### F-12 · Cross-deployment double-spend is prevented only by off-chain watcher policy

**Location:** `README.md:265`
**Effort:** E4 · **Demo:** NONE · **Submission:** NONE (disclosed)

The README states it honestly: the nullifier is per-deployment, and cross-counterparty reuse
is *"prevented by the beneficiary binding inside the leaf, which is off-chain watcher policy
rather than a contract invariant."* With F-01 unfixed, even that binding is not enforced. Worth
rehearsing an answer (see the interview section) because it is an obvious follow-up.

---

#### F-13 · Source-chain reorgs are not handled anywhere

**Location:** `contract/src-ts/watcher.ts` (whole file)
**Effort:** E3 · **Demo:** NONE · **Submission:** WARNS

`attestLock` registers a commitment the moment it is handed a `LockedEvent`. There is no
confirmation-depth wait, no reorg detection, and no removal path in the contract. If the
attestor observes a lock in a block that is later reorged out, the attestation stands and
remains provable until its expiry. Not documented in any judge-facing file.

---

#### F-14 · Judge-facing artifacts are unpushed at the time of writing

**Effort:** E1 · **Demo:** WARNS · **Submission:** WARNS

At 05:43Z the whole frontend rewrite was uncommitted. By 06:42Z it had been committed and
pushed — `origin/main:frontend/src/App.tsx` and the local copy are both 557 lines and
`git diff origin/main -- frontend/` is empty. That risk closed.

The risk moved rather than disappeared. At 06:42Z:

```
## main...origin/main
 M submission/aval-deck.pdf      M submission/deck.py
 M submission/slide-07.png       M submission/slide-08.png
 M submission/slide-09.png       M submission/slide-10.png
 M submission/video/aval-demo.mp4  M submission/video/render.py
?? submission/screenshots/       ?? submission/slide-11.png
?? submission/video/ui-panes.png
```

The deck, the video, and the new browser screenshots that `proof.md:127` links to are all
unpushed. **`proof.md` currently points at `submission/screenshots/ui-initial.png` and
`ui-after-proof.png`, which are untracked** — that link is a 404 for anyone but this machine.

`origin/main` is what the judge sees. Commit and push everything under `submission/` before
submitting, then re-open the raw links from a logged-out window.

---

#### F-15 · `submission/links.md` misstates the two artifacts it exists to describe

**Location:** `submission/links.md:6-7`
**Effort:** E1 · **Demo:** NONE · **Submission:** WARNS

| Claim | Reality (measured 06:42Z) |
|---|---|
| "Demo video (**112s**, 1080p)" | `ffprobe` → **141.0s**. 1080p/h264 is right. |
| "Slide deck (**9 slides**, PDF)" | `pdfinfo` → **11 pages**, and 11 `slide-*.png` on disk. |

Both drifted because the deck and video were re-rendered at 06:41Z and `links.md` was not
touched. Two numbers, ten seconds to fix — but this is the file a judge reads *first*, and
getting the length of your own video wrong is the cheapest possible credibility loss.

---

### P3 — nitpick

- **F-16** · `ARCHITECTURE.md:74` puts `concerns.md` at the repo root in the file tree. The real file is `.pipeline/concerns.md`, and `.pipeline/` is gitignored — a judge cloning the repo finds it at neither location. (`E1`)
- **F-17** · `ARCHITECTURE.md:79` annotates `out/` as "generated (gitignored)". False — `.gitignore` excludes only `contract/out-full/`; `contract/out/` is tracked (8 files) and has to be, because the tests and the frontend import from it. (`E1`)
- **F-18** · `ARCHITECTURE.md:781-788` describes `submission/screenshots/two-pane.png` and `tests.png`. Neither exists; the new `submission/screenshots/` holds `ui-initial.png` and `ui-after-proof.png` and is untracked (F-14). (`E1`)
- **F-19** · `ARCHITECTURE.md:1-3` calls itself "THE SINGLE SOURCE OF TRUTH. Every file, every line, every config." Given F-04, F-16, F-17 and F-18, it is not. Soften the line or fix the four. (`E1`)
- **F-20** · `README.md:80-84` security table attributes 4+3+1+2+2+5 = 17 tests, but the "cannot inflate the amount, 1 test" row is one of the 3 already counted in the "not transferable" row. A judge who adds the column gets an overlap. (`E1`)
- **F-21** · `frontend/package.json` still declares `vite-plugin-top-level-await` as a devDependency while `README.md:283` tells the Midnight team it *"should be omitted"* and `vite.config.ts` correctly does not use it. Dead dependency contradicting the project's own DX feedback. (`E1`)
- **F-22** · `leaf_hash`'s inner hash (`inflight.compact:70`) has no domain separator, while `nullifier_of` and `derive_id` both do. Not currently exploitable — the field positions differ — but inconsistent, and a future third `Vector<3, Bytes<32>>` hash would make it a real question. (`E1`)
- **F-23** · "3 circuits" (README, deck, `App.tsx`) is defensible but ambiguous: `inflight.compact` exports 3 stateful circuits *and* 3 `export pure circuit`s, so a judge grepping `export.*circuit` counts 6. It matches the compiler's own "Compiling 3 circuits:" line, so it is not wrong — just be ready to say "three stateful, three pure helpers" if asked. (`E1`)

---

## Summary

| Severity | Count | Demo impact | Submission impact |
|---|---|---|---|
| P0 — **1 of 2 closed during this phase** | 2 (F-01 RESOLVED, F-03 open) | — | 1 BLOCKS |
| P1 | 6 | 3 WARNS | 6 WARNS |
| P2 | 7 | 1 WARNS | 6 WARNS |
| P3 | 8 | — | — |
| **Total** | **23** (1 resolved) | **0 BLOCKS, 4 WARNS** | **1 BLOCKS, 12 WARNS** |

F-02 moved P0 → P1 and F-01 closed once the leaf binding landed.

**DEMO GATE: HAZARDS** (upgraded from BLOCKED at 06:45Z). The video's Scene 5 narration is
true again now that F-01 is fixed. What remains is that the deck and the video both display
**22** while the suite prints **24**, and `links.md` misstates both artifacts (F-05, F-15).
Nothing will visibly fail on stage; the numbers will simply not match the repo.

**SUBMISSION GATE: BLOCKED**, on F-03 alone. `submission/proof.md:3` promises "Nothing is
retyped" and `:37` prints a string no run has produced, `:41` sums to a different total than
`:37` claims, and `:87` now contradicts `:114-127` inside the same file. That is a provably
false statement in the artifact whose entire purpose is verifiability, in a submission whose
entire pitch is verifiability. It is ten minutes of work.

F-01, the only finding that was a genuine engineering blocker, was **closed during this phase**
and re-verified against live artifacts at 06:45Z.

---

## Interview preparation

> **F-01 is fixed, so every answer below is now true.** Before the interview, re-run
> `cd contract && npx vitest run` and confirm `contract/src/inflight.compact:141` still carries
> the `path.leaf == leaf` assert. If that line is ever lost in a merge, the Q2 answer becomes a
> claim a judge can disprove from the source you handed them — see the "if it is ever reverted"
> variant at the end of Q2.

---

### Q1. "If the attestor sees the amount to build the leaf, and the counterparty runs the attestor, what is the ZK actually buying you?"

*This is your strongest question, because you already answered it in the README before anyone
asked. Do not hedge it now. Say the number "one" out loud.*

> "One thing, and I'll name it precisely: privacy from the chain and from every third party.
> Not privacy from my counterparty.
>
> In the bilateral deployment Bob runs the attestor, and he has to. The attestor computes
> `leaf_hash(lock_id, amount, counterparty, expiry, salt)`, and you cannot compute that leaf
> without the amount. He holds `lock_id` and `salt` too, so he can recompute my nullifier. My
> proof is unlinkable to the public. It is not unlinkable to him.
>
> What the chain gets instead: the ledger never records the amount, the lock id, or which of
> the registered attestations I used. What it does record — and I want to be exact, because my
> own observer table was not exact enough and I'd rather correct it than have you find it — is
> the Merkle root, the nullifier, the fill count, and, because they are public inputs to the
> circuit, the threshold `required` and the `counterparty` address. So an observer learns a
> lower bound on the amount and who is being paid. Not the amount, and not which lock.
>
> The thing it is **not** buying, and I want to say this before you do: the on-chain predicate
> Bob's contract gates on is bought by the attestation registry, not by the proof. A registry of
> plaintext `(lock_id, amount, counterparty)` tuples plus a membership check would give his
> contract the identical gate with no proof system anywhere. Counting that as a ZK benefit
> would be inflating the total in front of someone who can subtract.
>
> Privacy from the counterparty is rung two — the k-of-n quorum, where no single attestor sees
> a whole lock. What makes that roadmap credible rather than aspirational is that
> `prove_funds_in_flight` does not change to get there. The circuit proves membership in a
> tree; it never learns which attestor inserted the leaf. Going from one attestor to k-of-n is
> a change to `register_attestation` alone."

**Do not say:** "it hides the amount from your counterparty" (false in what ships), or "it
gives us two things" (the second one is the registry's, not the proof's — your own critique
caught this and corrected it).

---

### Q2. "This is a merkle-membership proof. Roughly a quarter of the field built the same construction. Why is yours different?"

*Concede the shape immediately. You will not win an argument about whether it is a common
construction — it is, and your own blind reviewer said so. Win on the three mechanisms.*

> "You're right about the shape and I'm not going to argue it. Commitment, membership proof,
> threshold predicate, nullifier — if you've read a proof-of-reserves circuit you've seen it. I
> had a blind reviewer tell me the same thing and I recorded their verdict rather than mine.
>
> The difference is mechanical, not categorical. Three things are in my circuit that are not in
> a solvency or credential proof, and they are there because settlement needs them and a
> balance claim does not.
>
> **Single use.** The nullifier is derived from the private `lock_id` and `salt`, so one lock
> backs exactly one proof, ever. A reserves claim is a reusable statement about a standing
> balance — reuse is the normal case there, not an attack.
>
> **Counterparty bound.** `counterparty` is hashed into the leaf, so an attestation issued for
> Bob is worthless to Carol. A credential is a broadcast claim, deliberately presentable to
> anyone.
>
> **Expiring.** `kernel.blockTimeLessThan`, against ledger block time, not a timestamp the
> caller passes in. A balance proof is about now. An in-flight proof is about a window that
> closes.
>
> Nine of the twenty-three tests cover those three. Together they make the output a single-use,
> counterparty-bound, expiring bearer instrument. That is the difference between a proof you
> show and a proof you spend."

**If a judge names a specific competitor** (OnePledge and Attesta are the two in this wave with
the closest construction): do not bluff that you have read them. Say *"I haven't read theirs;
if they've built the same three mechanisms then we converged, and the interesting question is
what each of us bound into the leaf."*

**Volunteer the near-miss.** This is a better answer than the clean one, because it shows you
know *why* the three mechanisms are load-bearing:

> "One thing worth telling you, because it's the most interesting thing that happened to this
> contract. Until this morning, two of those three weren't actually enforced. `find_path` is a
> witness — it runs on the prover's machine — and I was passing the leaf into it as if that
> bound the result. It doesn't; it's a hint. `merkleTreePathRoot` hashes `path.leaf`, and I
> never asserted those were the same value. So a prover could borrow any registered leaf's path
> and claim whatever amount, counterparty and expiry they liked. It's one line —
> `assert(path.leaf == leaf)` — and it's in now, with a regression test that swaps in a hostile
> witness rather than trusting my own honest one. I gather your `midnight-expert` repo patched
> the same class in two example contracts a couple of weeks ago, which tracks: it's the sharpest
> edge in the whole Compact witness model."

**If it is ever reverted:** say it plainly and early — *"designed, yes; soundly implemented,
not right now"* — and name the one-line fix. That costs points. It costs fewer than being caught.

---

### Q3. "Your attestor can fabricate a lock that never existed. Why should anyone trust this?"

*They shouldn't trust it more than a fast-finality bridge. Say that first — it disarms the
question and it is what your README already says.*

> "They shouldn't trust it more than they trust a fast-finality bridge, and I don't claim they
> should. Let me be concrete about what I did and didn't do.
>
> Who is trusted: the attestor. Why that is cheap in Wave 1: Bob runs it. Bob is the one giving
> up value. He is attesting to what his own node saw on Ethereum, so the assumption collapses
> to 'Bob trusts Bob's node,' which isn't really an assumption. Bob's *contract* still can't see
> Ethereum, which is why the attestation has to exist at all.
>
> Three design choices that shrink the assumption rather than wave at it:
>
> I attest to a **lock, not a balance**. A lock in escrow is monotone, irrevocable, and uniquely
> identified. A balance is mutable and re-attestable. That removes a whole class of attack for
> free, and it's the reason I picked this vertical rather than solvency.
>
> Every attestation **expires**, against ledger block time.
>
> The nullifier is **bound to the lock**, so even a malicious attestor can't let one lock be
> spent twice.
>
> The ladder above it, none of it built: k-of-n quorum, then bonded slashable attestors, then a
> source-chain light client. The middle rung is the interesting one, because a fabricated
> `lockId` is provably contradicted by the source-chain escrow state, so trust becomes economics.
>
> The residual is in the README, not buried: a malicious attestor can fabricate a lock. That is
> the same trust model as every fast-finality bridge shipping today. I add privacy to that model.
> I don't claim to beat it."

**Prepare the follow-up, because it is coming:** *"Who adjudicates the slashing, given Midnight
can't see Ethereum?"*

> "Fair. The slashing rung needs either a light client or a second trusted verifier to adjudicate
> the contradiction, so it isn't independent of rung three, it's gated on it. What it does buy in
> the meantime is that the fabrication is *detectable* and *attributable* — the escrow state is
> public, the attestor id is on the ledger, and the fabricated leaf is permanent. That turns a
> silent lie into a public one. It doesn't turn it into an automatic one."

---

### Q4. "Why didn't you deploy when others did?"

*Separate two things they will conflate, and lead with the evidence you actually produced.*

> "Two things that are easy to conflate: 'we didn't deploy' and 'it wouldn't deploy.' I did the
> work to separate them.
>
> The default toolchain, 0.34.0, targets ledger 9, which isn't live on Preprod. So I also
> compiled against ledger 8, which is what Preprod actually runs — toolchain 0.31.1, language
> 0.23, runtime 0.16. It compiles clean, three circuits, with exactly one line changed: the
> `pragma language_version` floor. Both builds are in the repo, `contract/out/` and
> `contract/out-ledger8/`. You can `diff` the two sources and run the compile yourself rather
> than taking my word.
>
> What actually stopped me was two things, neither of which is a property of my contract. First,
> the only proof provider in the JS SDK is an HTTP client to a local Midnight proof server —
> there's no in-process prover in Node — so proving needs a container runtime, and mine wouldn't
> allocate; the disk was at 100% with 82MB free. Second, the Preprod faucet is browser-based
> with a CAPTCHA, so I couldn't get testnet funds without a human in the loop.
>
> And I'll own the call: the Technical Gate asks that the contract compile, not that it deploy.
> I read that and chose to spend the hours on the circuit and the test suite rather than on a
> deploy that could have eaten the whole night. If you think that was the wrong call I'd rather
> be docked for the call than for hiding it."

**Concede the asymmetry when pressed.** A deployment exercises the proof server, wallet
integration, and real network conditions that a simulator cannot. The ledger-8 build is evidence
of *tooling readiness*, not proof of *live behaviour*. Say that yourself rather than defending
equivalence you don't believe.

---

### Q5. "What breaks first at scale?"

*You have a measured answer, and it includes correcting your own PRD. That correction is worth
more than the answer.*

> "The attestation tree, and I want to correct my own PRD while I'm here. It says '1,024
> concurrent attestations.' That's wrong, and wrong in the flattering direction. It's 1,024
> **lifetime** inserts. The tree never evicts. A lock that's been proven and whose nullifier is
> spent still occupies its slot forever.
>
> I ran it to exhaustion. Insert number 1,024 throws `exceeded structure bounds` — a raw runtime
> error, not one of my asserts, because I never call the `isFull()` the generated API hands me.
> After that the registry is permanently write-dead: no eviction, no reset, no second tree, no
> admin circuit. Existing leaves stay provable, so nothing already in flight is lost, but nothing
> new can be registered.
>
> At twenty settlements a day that's about fifty-one days.
>
> Depth is a one-line change and depth 20 is a million leaves, but the honest fix isn't a bigger
> number — it's an epoch. A new tree per period with the old roots retained, which
> `HistoricMerkleTree` already supports. That's the first thing I'd build.
>
> Second thing: the nullifier set is an unbounded `Set`, so ledger state grows monotonically with
> settlement count and never shrinks. Third: one attestor, no rotation, so throughput and
> availability are both bounded by a single process — and today, a single process anyone can
> claim, because `register_attestor` has no access control on its first call."

That last clause volunteers F-06. Do it. It reads as someone who audited their own contract.

---

### Q6. "What would you do differently with another week?"

*Order it by what is broken, not by what is impressive. The first item is the one that proves
you learned something.*

> "In order:
>
> **One. Finish the job I started this morning: an adversarial-witness harness for every witness,
> not just `find_path`.** All twenty-three of my tests used a single honest `find_path` from my own
> simulator. That proves the honest prover behaves. It proves nothing about a malicious one — and a
> witness is, by definition, code the prover controls. That is exactly how a real soundness bug
> survived twenty-three green checks. I've added the one test that would have caught it; what I'd
> build next is the pattern: for every witness the contract declares, a test that swaps in a hostile
> implementation and asserts the circuit still holds.
>
> **Two.** Bind the attestor at construction so the bootstrap can't be front-run, and add rotation.
>
> **Three.** Epoch the attestation tree instead of making the depth bigger.
>
> **Four.** The real Ethereum listener with confirmation-depth handling — right now a source-chain
> reorg leaves a live attestation for a lock that no longer exists — and an encrypted preimage
> channel, because today anyone who intercepts a preimage can burn the nullifier.
>
> **Five.** The k-of-n quorum, because that is the rung where the privacy claim actually becomes
> the one I want to make.
>
> **Six.** Deploy. Install the container runtime, clear the disk, get through the faucet. It's
> half a day and it closes the one gap I can't argue my way out of.
>
> The meta-answer is the first one. I was proud of having twenty-three passing tests, and a test
> suite is exactly as good as the adversary it models. Mine modelled a well-behaved user. It has
> twenty-four now, and the twenty-fourth is the only one that ever tried to break in."

---

### Additional questions they are likely to ask

| # | Question | Where you stand |
|---|---|---|
| 7 | *"Why `HistoricMerkleTree` over plain `MerkleTree`?"* | **Strong.** Alice's proof is generated after the attestor may have inserted other leaves; a plain tree's moving root would invalidate it mid-flight. Load-bearing, not decoration. |
| 8 | *"Why no in-circuit signature check on the attestor?"* | **Strong.** `Secp256k1Point/Scalar/Base` and `secp256k1EcdsaVerify` are unbound in the shipped 0.34.0 stdlib although the release notes describe them. You verified this by compiling probes. And the Merkle pivot is strictly more private: a signature check forces the prover to reveal *which* attestation they used. |
| 9 | *"Your README says one test fails."* | **Weak — fix before the interview.** See F-04. |
| 10 | *"I have one $2M lock. I show it to two counterparties on two deployments. Both release. What stops me?"* | **Answerable.** Nothing in the contract — the nullifier is per-deployment and you say so in the README. What stops it in practice is that the source-chain lock names one beneficiary, and each attestor is that beneficiary watching their own node; Carol's attestor sees `beneficiary = Bob` and refuses. That is watcher policy, not a contract invariant, and you should say so in those words. |
| 11 | *"Who pays for this and why?"* | **Answer exists but is buried in `PRD.md:112`, not in the README or the deck.** Say: "Bridge-integrated lenders and OTC desks that already eat bridge-latency risk. They'd run the attestor themselves and pay in avoided float cost, not a subscription." Consider putting one sentence of this in the README — Business Development is 5% and currently unclaimed. |
| 12 | *"Nobody has run your frontend in a browser."* | **Weak, and true.** `proof.md:87` admits it. Be ready to run it live rather than defend it. |
| 13 | *"This README is 6,000 words. Will a judge read it?"* | Concede. Point out the load-bearing claims are above the fold. |

---

## The adversarial half: what a judge could catch you on

Ranked by how fast they'd find it and how much it costs.

1. ~~**F-01, the unbound Merkle path.**~~ **Closed 06:45Z.** Kept at the top because it is the
   thing a judge would have found in minutes — their own repo fixed it eleven days ago and both
   nearest competitors carry the assertion. Re-verify the line is still present before submitting.
2. **F-03, `proof.md` "nothing is retyped" containing a retyped number.** Sixty seconds. Costs
   credibility across every other claim in the submission, which is expensive precisely because
   the submission's whole pitch is verifiability.
3. **F-04, README saying `22 / 24 passed`.** In the Verification table. Reads as two tests failing.
4. **F-05, the deck and the video saying 22 while the suite says 24.** First two artifacts many
   judges open, and both were re-rendered at 06:41Z with the fix available and not applied.
5. **F-02, "blocked by the circuit, not by application code."** One grep of the `.compact` for
   the revert string in the demo output.
5b. **F-15, `links.md` saying the video is 112s when it is 141s and the deck is 9 slides when
   it is 11.** The first file a judge opens, describing artifacts they are about to watch.
6. **F-07, the observer table omitting `required` and `counterparty`.** Only caught by someone
   who reads the circuit signature, but that is exactly who is interviewing you — and it is
   caught in the section that claims to be the complete honest accounting.
7. **F-09, the frontend "leaked" pane that cannot fail.** Caught by anyone who opens `App.tsx`.
8. **F-06, permissionless `register_attestor`.** Caught by anyone who reads three circuits.
9. **F-15 to F-18, ARCHITECTURE.md pointing at files that don't exist** and calling itself the
   single source of truth.

### Claimed and not true

- `submission/proof.md:3` — "Nothing is retyped." (F-03)
- `contract/scripts/attack-demo.ts:59` — "All six blocked by the circuit, not by application code." (F-02)
- `contract/test/inflight.test.ts:233-239` — "Deliberately not a hand-picked projection." (F-08)
- `frontend/src/App.tsx:429-431` — "If one of these ever appeared on chain, this pane would say so." (F-09)
- `PRD.md:321` — "1,024 concurrent registered attestations." (F-10)
- `ARCHITECTURE.md:79` — "`out/` generated (gitignored)." (F-16)
- `ARCHITECTURE.md:804` — Safety Architecture "Layer 1: Input validation — leaf recomputation in-circuit." (F-01)
- `FEATURE-OBSERVABLES.md` F-007, F-008 — "Verified: YES." (F-01)
- `PRD.md:114-117` — "the only entry in its category." Not supportable: `TacitPay/TacitPay`
  ships an explicit in-flight escrow window with a documented exposure gap, and
  `swd-dev00/midnight-shield` is a cross-chain Cardano↔Midnight settlement project. All four
  competitor repos named in this report were verified to exist via the GitHub API.
- `.pipeline/BRIEF.md` — "ZERO projects on in-flight / pending / cross-chain settlement state."
  Overstated for the same reason. "Least crowded corner of a crowded field" is defensible;
  "uncontested gap" is not.

### Questions that currently have no good answer

1. ~~**"Show me a test where the prover supplies a hostile witness."**~~ **Answered at 06:45Z** —
   `contract/test/soundness.test.ts`. It was the absence of exactly this test that let F-01 survive
   23 green checks, which makes it the best thing you can say in Q6. The residue: it covers
   `find_path` only. `local_secret_key`, `get_lock_id`, `get_amount` and `get_salt` are all still
   modelled solely by the honest simulator. Be ready to say that before a judge finds it.
2. ~~**"Has anyone loaded your frontend in a browser and clicked prove?"**~~ **Answered during
   this audit — say yes.** Headless Chromium, WASM instantiates, boot reaches `ready`, prove
   moves `fills` to 1, zero console errors, and the privacy pane's failure mode was tested by
   deliberate injection. Repro is two commands. The only remaining exposure is that
   `proof.md:87` still says the opposite of `proof.md:114-127` (F-03) and the screenshots it
   links are untracked (F-14). Fix those two and this becomes a strength.
3. **"What is the verified capacity story in a judge-facing document?"** The README never
   mentions capacity at all, and the PRD's only mention is wrong. You have a measured answer
   (F-10) but it lives nowhere a judge will read.
4. **"Who is the buyer?"** Answered in `PRD.md:112`. Absent from README, deck, and
   `submission/*`. Free points on a 5% criterion, currently unclaimed.
5. **"Did you re-run your own test-count propagation check before submitting?"**
   `PLAN.md:208-212` specifies it, `PLAN.md:285` leaves the checkbox unticked, and running that
   exact grep today still returns stale hits. The procedure existed and was not executed.

---

## Recommended order of work, with 8h 10m on the clock (06:50Z)

0. ~~**F-01**~~ — done at 06:45Z. Re-run `npx vitest run` (expect `24 passed (24)`) and confirm
   `inflight.compact:141` still holds the assert. Two minutes.
1. **F-03 + F-04 — six lines, ten minutes, and this is now the only submission blocker.**
   `README.md:11`, `README.md:154`, `submission/proof.md:37`, `submission/proof.md:41`,
   `ARCHITECTURE.md:114`, `PLAN.md:162`. Delete `proof.md:87` (it contradicts `:114-127`). Fix
   `PLAN.md:162` first or the next sweep produces `25 passed (22)`.
2. **F-15** — two numbers in `links.md`: the video is 141s not 112s, the deck is 11 slides not 9.
   One minute.
3. **F-05** — six string literals in `submission/deck.py` and `submission/video/render.py`, then
   re-run both. `captures/tests.txt` is already regenerated, so the pipeline will pick up the
   right numbers. If you will not re-render, say so in one README line rather than leaving it
   undecided a third time.
4. **F-02** — give `attack-demo.ts` the hostile witness from `soundness.test.ts`. Twenty minutes,
   and it converts your weakest demo artifact into your strongest.
5. **F-07** — two rows added to two tables. Ten minutes, and it strengthens your Q1 answer.
6. **F-14** — commit and push everything under `submission/` before you submit, including
   `submission/screenshots/`, which `proof.md:127` already links to. The judge sees `origin/main`.
   Then open the raw links from a logged-out window.
7. **F-06, F-10** — leave them. Both are better interview material than patch material at this
   hour, as long as you volunteer them rather than waiting to be asked.

Items 1, 2 and 6 are about fifteen minutes total and they clear the submission gate. Items 3
through 5 are another hour and a half and they move the submission from "a judge can find three
numbers that disagree" to "every claim in it checks out."
