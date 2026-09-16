# INTERROGATE REPORT — Aval

**Date:** 2026-09-16 (started 05:43Z, 9h 16m before the 15:00Z Wave 1 deadline)
**Mode:** DEEP (bespoke dispatch — see *Lens inventory* below)
**Purpose:** prepare the builder for the live interview the Official Rules reserve the right to call, and surface anything that would embarrass them in it.
**Scope note:** read-only. Nothing under `frontend/` was touched; another agent is editing it concurrently. No source or doc file was modified by this phase.

---

## The one thing to read first

`prove_funds_in_flight` never checks that the Merkle path it proves against is a path
for the leaf it just computed. I wrote a proof-of-concept and it produced an **accepted
proof** claiming `amount = 2^64-1` against a real attestation for 1 unit, paid to the
**wrong counterparty**, **41,000 time units past the real expiry**, leaving the real
lock's nullifier **unspent** so the honest holder can still spend it too.

That single omission falsifies two of the three headline differentiators, all three
"binding" tests, three of the six attack-demo reverts, four rows of the README security
table, and both `FEATURE-OBSERVABLES` rows F-007 and F-008.

**Midnight's own teaching repo fixed the identical bug in its own example contracts on
2026-09-05, eleven days before this deadline** — `midnightntwrk/midnight-expert` PR #239,
"Bind the Merkle path's leaf to the caller's commitment in two examples" (verified live
against the GitHub API: merged `2026-09-05T13:19:36Z`). Its PR body contains the same
analysis, arrived at independently here.

**Both of Aval's nearest competitors in this same wave already do it right.** `OoJae/onepledge`
asserts `lenderPath.leaf == lender` (`registry.compact:176`) and `notePath.leaf == note`
(`:199`). `ceciliagalvaoo/Attesta` asserts `path.leaf == commitment` twice
(`attesta.compact:251`, `:333`) and ships a comment block explaining why.

The fix is one line. I applied it in a scratchpad copy and verified all three outcomes:
it **compiles** (3 circuits), it **blocks the forged proof**, and the **honest proof still
passes**. See F-01.

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
| 1 | Test suite really passes, 23/23 | `npx vitest run` → `Tests  23 passed (23)`, 1.48s |
| 2 | Contract compiles, the Technical Gate | `compact compile src/inflight.compact` → `Compiling 3 circuits:`, 3 `.zkir` |
| 3 | Proving keys really generate | fresh compile → 6 keys (3 `.prover`, 3 `.verifier`) + 3 `.bzkir`, 11.8s |
| 4 | Committed artifacts match the published source | all 3 committed `out/zkir/*.zkir` are **byte-identical** to a fresh compile; the only `index.js` delta is `expectedVk` (empty in the keyless build). Judges running `npm test` are testing `src/inflight.compact`. |
| 5 | The ledger-8 claim is true | `diff src/inflight.compact src-ledger8/inflight.compact` = exactly one line (`pragma language_version >= 0.26` → `>= 0.16`); `out-ledger8/zkir/` holds 3 `.zkir` |
| 6 | Every submission gate item is live and green | GitHub API: `private:false`, `license: Apache-2.0`, topics include `midnightntwrk`; README/LICENSE/`contract/src/inflight.compact` all HTTP 200 raw; `git log origin/main..HEAD` empty |
| 7 | The "no credentials" claim holds | 0 secret-pattern hits and 0 `process.env`/`import.meta.env` references across all 68 tracked files |
| 8 | Salt has real entropy | `contract/src-ts/watcher.ts:12` uses `crypto.getRandomValues(new Uint8Array(32))` |
| 9 | Indistinguishability is genuinely sound | `scripts/indistinguishability.ts` reproduces; the property is independent of F-01; the nullifier is byte-identical across a 100× amount difference because `nullifier_of` touches only `lock_id` and `salt` |
| 10 | Registry access control is real | `assert(disclose(id == attestor))` at `inflight.compact:105` genuinely gates writes; PoC confirms a non-attestor is rejected |
| 11 | Expiry reads real ledger block time | `kernel.blockTimeLessThan` — not a caller-supplied timestamp. (The *mechanism* is real; F-01 lets a forger choose the value it is compared against.) |
| 12 | `disclose()` discipline is real | six annotated call sites; Compact's information-flow analysis is genuinely load-bearing |
| 13 | Capture files `attacks.txt` and `indistinguishability.txt` match their live scripts | re-ran both; output matches |

---

## Open gaps

Severity: **P0** showstopper · **P1** critical · **P2** important · **P3** nitpick.
Effort: **E1** <15 min · **E2** 15-60 min · **E3** 1-4h · **E4** 4h+.

### P0 — showstopper

---

#### F-01 · The Merkle path is never bound to the recomputed leaf — total soundness break

**Location:** `contract/src/inflight.compact:127-135`
**Effort:** E1 (one line, verified) · **Demo:** BLOCKS · **Submission:** BLOCKS

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
Every one of the 23 tests uses that single honest witness. No test overrides it. So 23/23
green says nothing about this property.

**Verified fix** — insert after line 128:

```compact
assert(path.leaf == leaf, "witness returned a path for a different leaf");
```

I applied this to a scratchpad copy and ran all three checks:
- `compact compile` → `Compiling 3 circuits:` (compiles clean)
- forged proof → `rejected: failed assert: witness returned a path for a different leaf`
- honest proof → `ACCEPTED` (no regression)

**Why this is worse than a normal bug for this specific audience:** Midnight's own
`midnight-expert` repo merged PR #239 on 2026-09-05 fixing the identical class in
`NullifierDoubleSpend.compact` and `ticket.compact` — *"files developers copy"* — using
literally this assertion. And both of Aval's nearest-construction competitors in this same
wave (`OoJae/onepledge`, `ceciliagalvaoo/Attesta`) already have it. A Midnight Foundation
engineer comparing entries in this cluster will find it in minutes.

**Claims falsified by F-01** (fix the code, or fix every one of these):

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
**Effort:** E1 · **Demo:** BLOCKS · **Submission:** BLOCKS

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

---

### P1 — critical

---

#### F-04 · README states that a test fails

**Location:** `README.md:154`, `README.md:11`, `ARCHITECTURE.md:114`, `ARCHITECTURE.md:355-368`, `PLAN.md:162`
**Effort:** E1 · **Demo:** WARNS · **Submission:** WARNS

`README.md:154`:
```
| Test suite | `npm test` | **22 / 23 passed**, 651ms |
```
That reads, in the Verification table, as *one test is failing*. It is not — the suite is
23/23. `README.md:11` carries the same impossible `23 passed (22)` string as proof.md, above
the fold, as the README's headline proof-of-life. `ARCHITECTURE.md:114` still says "22 security
+ privacy tests", and `ARCHITECTURE.md:359-368` describes a test-group table that sums to 22
and names a privacy group ("privacy, what the ledger does and does not reveal", 4 tests) that
no longer exists — the current group is "privacy, indistinguishability of the amount", 5 tests.

`PLAN.md:208-212` contains the project's own procedure for preventing exactly this:
*"In the SAME commit, update every occurrence of `22`… A stale count is a verifiability
defect in a submission whose entire pitch is verifiability."* Commit `1189a14` attempted it
and produced two malformed strings while leaving `captures/tests.txt`, `ARCHITECTURE.md`, and
the rendered video behind.

Correct as-is and should not be touched: `README.md:126`, `README.md:292`, the test file itself.

---

#### F-05 · The rendered demo video says 22, and narrates three properties the circuit does not enforce

**Location:** `submission/video/render.py:151,153,156,231` → `submission/video/aval-demo.mp4`
**Effort:** E3 (re-render) or E1 (disclose in README) · **Demo:** BLOCKS · **Submission:** WARNS

```python
151  d.text((80, 70), '22 tests, all passing', font=F_H1, fill=FG)
153  lines = read_capture('tests.txt')          # <- the STALE 22-test capture
156  d.text((80, 940), 'Tests  22 passed (22)', font=f(MONO, 34), fill=GREEN)
231  d.text((80, 700), 'Apache-2.0  ·  22 passing tests  ·  3 circuits  ·  no Docker required', ...)
```

The video renders the stale capture file directly on screen. A judge watching the video sees
**22**, opens the README and sees **22 / 23 passed** (implying a failure), then runs the suite
and gets **23**. Three numbers, three artifacts, 15% of the score is Quality Assurance.

Worse, Scene 5's narration (`PRD.md:502`) is: *"Inflate the amount: the leaf no longer matches.
Point it at a different counterparty: same. Extend your own expiry: same."* All three are
falsified by F-01. This is why F-01 is a demo blocker and not just a submission blocker —
the video makes, out loud, three claims a judge can disprove with the repo they were handed.

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

#### F-09 · The frontend's "leaked" indicator is a check that cannot fail

**Location:** `frontend/src/App.tsx:41, 227-231, 429-431`; `frontend/src/lib/demo.ts:11-17, 24-27`
**Effort:** E2 · **Demo:** WARNS · **Submission:** WARNS
**(Read-only finding — frontend is owned by a concurrent agent; do not let this phase's report
race that work.)**

`PRIVATE_INPUTS = ['amount','lock_id','salt','merkle_path','prover_identity']`, and `leaked`
is `PRIVATE_INPUTS.filter(f => Object.hasOwn(view, f))` where `view` is `readLedger()`'s
fixed-shape `LedgerView` (`attestor_registered`, `attestor_id`, `merkle_root`, `nullifiers`,
`fills`). That shape can never contain a key named `amount`. The filter is structurally
always empty.

The UI then tells the viewer: *"This list is re-checked against the live ledger object on
every update. If one of these ever appeared on chain, this pane would say so."* It would not.
It checks key **names** on a hand-authored object, not value **content** against the real
ledger.

`demo.ts:24-27` also still truncates each field with `.slice(0, 24) + '…'` and hand-picks
five fields — pipeline item **D-1**, raised by critique at P0, spec'd in PLAN Task 2b.2, and
still unshipped. PLAN's own description of the defect: *"the pane would look exactly the same
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

#### F-14 · Uncommitted and untracked work at T-9h

**Effort:** E1 · **Demo:** WARNS · **Submission:** WARNS

`git status -sb` at 05:43Z:

```
## main...origin/main
 M frontend/index.html
 M frontend/src/App.tsx
?? .design-forge-state.json
?? DESIGN_SYSTEM.md
?? brand.json
?? frontend/public/
```

`origin/main` is what the judge sees. Whatever the concurrent frontend agent is producing is
not in it yet. `frontend/public/` being untracked is the sharpest one — if `index.html`
references anything in it, the published build breaks while the local one works.

---

### P3 — nitpick

- **F-15** · `ARCHITECTURE.md:74` puts `concerns.md` at the repo root in the file tree. The real file is `.pipeline/concerns.md`, and `.pipeline/` is gitignored — a judge cloning the repo finds it at neither location. (`E1`)
- **F-16** · `ARCHITECTURE.md:79` annotates `out/` as "generated (gitignored)". False — `.gitignore` excludes only `contract/out-full/`; `contract/out/` is tracked (8 files) and has to be, because the tests and the frontend import from it. (`E1`)
- **F-17** · `ARCHITECTURE.md:781-788` describes `submission/screenshots/two-pane.png` and `tests.png`. Neither exists; `submission/` ships `slide-01.png`…`slide-10.png`. (`E1`)
- **F-18** · `ARCHITECTURE.md:1-3` calls itself "THE SINGLE SOURCE OF TRUTH. Every file, every line, every config." Given F-04, F-15, F-16 and F-17, it is not. Soften the line or fix the four. (`E1`)
- **F-19** · `README.md:80-84` security table attributes 4+3+1+2+2+5 = 17 tests, but the "cannot inflate the amount, 1 test" row is one of the 3 already counted in the "not transferable" row. A judge who adds the column gets an overlap. (`E1`)
- **F-20** · `frontend/package.json` still declares `vite-plugin-top-level-await` as a devDependency while `README.md:283` tells the Midnight team it *"should be omitted"* and `vite.config.ts` correctly does not use it. Dead dependency contradicting the project's own DX feedback. (`E1`)
- **F-21** · `leaf_hash`'s inner hash (`inflight.compact:70`) has no domain separator, while `nullifier_of` and `derive_id` both do. Not currently exploitable — the field positions differ — but inconsistent, and a future third `Vector<3, Bytes<32>>` hash would make it a real question. (`E1`)

---

## Summary

| Severity | Count | Demo impact | Submission impact |
|---|---|---|---|
| P0 | 3 | 2 BLOCKS | 3 BLOCKS |
| P1 | 6 | 1 BLOCKS, 2 WARNS | 6 WARNS |
| P2 | 5 | 1 WARNS | 4 WARNS |
| P3 | 7 | — | — |
| **Total** | **21** | | |

**DEMO GATE: BLOCKED.** The rendered video narrates three security properties the circuit
does not enforce (F-01 + F-05), and displays a test count that contradicts both the README
and the actual suite.

**SUBMISSION GATE: BLOCKED.** F-01 is a live soundness break in the circuit that is 40% of
the score; F-02 and F-03 are falsifiable honesty claims in judge-facing artifacts.

All three P0s are fixable well inside the remaining window. F-01 is one verified line.

---

## Interview preparation

> **Do F-01 first.** The answers to Q2 and Q3 below assume the leaf binding is in place. If
> you walk into an interview with it unfixed and give the Q2 answer as written, you are
> claiming three mechanisms, two of which a judge can disprove from the source you handed
> them. If you cannot fix it in time, the only survivable version of Q2 is the one at the end
> of that section marked **"if unfixed."**

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

**If unfixed** — the only honest version:

> "Designed, yes. Soundly implemented, not yet. I found this morning that I never bind the
> witness-supplied Merkle path to the leaf I recompute, so two of those three mechanisms are
> not actually enforced by the circuit today — only by the honest reference witness in my test
> harness. It's a one-line assertion and I've verified the fix compiles and blocks the attack.
> I'd rather tell you that than have you find it."

That answer costs you points. It costs fewer than being caught.

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
> **One. Bind the Merkle path to the leaf, and then write the test that would have caught it.**
> Every one of my twenty-three tests uses a single honest `find_path` witness from my own
> simulator. That proves the honest prover behaves. It proves nothing about a malicious one — and
> a witness is, by definition, code the prover controls. What I'd add is an adversarial-witness
> harness: for every witness in the contract, a test that swaps in a hostile implementation. That
> is the class of test I didn't have, and it's the reason the bug survived twenty-three green
> checks.
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
> The meta-answer is the first one. I was proud of having twenty-three passing tests and a test
> suite is exactly as good as the adversary it models. Mine modelled a well-behaved user."

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

1. **F-01, the unbound Merkle path.** Minutes, for this audience specifically. Their own repo
   fixed it eleven days ago; both nearest competitors have the assertion. Costs the Engineering
   40% and takes the three-mechanism differentiation with it.
2. **F-03, `proof.md` "nothing is retyped" containing a retyped number.** Sixty seconds. Costs
   credibility across every other claim in the submission, which is expensive precisely because
   the submission's whole pitch is verifiability.
3. **F-04, README saying 22/23 passed.** Above the fold, first screen. Reads as "one test fails."
4. **F-05, the video saying 22 while the docs say 23.** First artifact many judges open.
5. **F-02, "blocked by the circuit, not by application code."** One grep of the `.compact` for
   the revert string in the demo output.
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

1. **"Show me a test where the prover supplies a hostile witness."** There isn't one. All 23
   tests share `simulator.ts`'s single honest `find_path`. This is the root cause of F-01
   surviving to submission, and there is no way to answer it except to say so. It is also the
   best thing you can say in Q6.
2. **"Has anyone loaded your frontend in a browser and clicked prove?"** No. `proof.md:87` says
   so. Pipeline item D-4 was routed to a livetest phase that never ran — the conductor's
   `current_phase` is still `stress_test` and `livetest` is `pending`. UX is 15%.
3. **"What is the verified capacity story in a judge-facing document?"** The README never
   mentions capacity at all, and the PRD's only mention is wrong. You have a measured answer
   (F-10) but it lives nowhere a judge will read.
4. **"Who is the buyer?"** Answered in `PRD.md:112`. Absent from README, deck, and
   `submission/*`. Free points on a 5% criterion, currently unclaimed.
5. **"Did you re-run your own test-count propagation check before submitting?"**
   `PLAN.md:208-212` specifies it, `PLAN.md:285` leaves the checkbox unticked, and running that
   exact grep today still returns stale hits. The procedure existed and was not executed.

---

## Recommended order of work, with 9 hours on the clock

1. **F-01** — one line, verified to compile and to block the attack. 15 minutes including a
   regression test. Do this even if you do nothing else.
2. **F-02, F-03, F-04** — the three falsifiable honesty strings. Regenerate
   `submission/captures/tests.txt` from a real run so `proof.md` stops contradicting its own
   pointer. 30 minutes.
3. **F-05** — decide the video explicitly. Either re-render, or add one line to the README
   saying the video predates the 23rd test. Do not leave it undecided a third time.
4. **F-07** — two rows added to two tables. 10 minutes, and it strengthens your Q1 answer.
5. **F-06, F-10** — if F-01 lands early. Both are also good interview material unfixed, as long
   as you volunteer them.
6. **F-14** — commit and push before you submit. The judge sees `origin/main`.

Items 1 through 4 are roughly 90 minutes and they move the submission from "a judge can
disprove three of its claims" to "a judge can verify all of them."
