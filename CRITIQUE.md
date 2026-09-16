# Adversarial critique — Aval, Wave 1

Written at T-10h against README.md, contract/src/inflight.compact, BRIEF.md,
submission/wave1-progress.md, contract/test/inflight.test.ts, PRD.md §1 and §6.

---

## Q1. The ZK-redundancy attack

The README oversells, then corrects itself 130 lines later. The correction is good
but the accounting inside it is wrong. README:160 claims "the zero-knowledge layer
buys **exactly two things**", listing (1) privacy from third parties and (2) "A
machine-checkable gate." Item 2 is not bought by zero-knowledge. A registry of
plaintext `(lock_id, amount, counterparty)` tuples plus a membership check hands
Bob's contract the identical on-chain predicate with no proof system anywhere. In
the bilateral case ZK buys precisely one thing: privacy from the chain and every
third party. Claiming two inflates the count in front of a judge who can subtract.

**Change README:160.**
Replacement: *"So in Wave 1 the zero-knowledge layer buys exactly one thing:
privacy from the chain and from every third party. The second property, an
on-chain predicate Bob's contract can act on, is bought by the attestation
registry, not by the proof. It is worth having. It is not the ZK doing the work."*

---

## Q2. Scope read

Discipline, four to one. "What is NOT built" (README:203-212) is the strongest
section in the repo; volunteering that a lost attestor key "permanently bricks the
registry, and every unproven lock behind it is stranded" is not something an
unfinished platform writes about itself.

Two residues. The Roadmap table (README:218-224) carries five unshipped rows
against one shipped row, so the eye reads 1/6 done rather than 1/1 done. Cut the
two Wave 3 rows.

Worst-offending sentence, README:216: *"The primitive is 'prove a
committed-but-unsettled fact satisfies a predicate'. Funds in flight is one
predicate."* It demotes a finished instrument to one instance of an unbuilt
platform, and it sits directly above the five-row table that confirms the reading.
Delete it, or move it beneath the table.

---

## Q3. Demo witness test

Told, on the property that matters. The PRD diagnosed this itself in §6
[CRITIQUE E-1]: *"An absence in a developer-rendered JSON is not evidence: the
pane would look identical if the contract leaked the amount and the renderer
omitted the key."* The fix it then specified — two runs at 1x and 100x, both
ledgers diffed on screen, identical nullifier and `fills`, one hash differing —
was never built. `grep -riE "indistinguish|100x|side-by-side|diff" contract/scripts
frontend/src` returns one unrelated hit at `attack-demo.ts:44`. The 112s video is
68s under the 180s script, so that beat is gone.

What a judge sees is Scene 4's single pane with no `amount` key. That is an
absence, which is a claim. Scene 5 is genuinely witnessed: `attack-demo.ts` prints
six real revert strings. Cheating is shown. Privacy is asserted.

---

## Q4. Cluster drift

Yes, once, in the hook. README:22: *"Revealing it tells your counterparty exactly
how much room you have, which is not a privacy nicety, it is your negotiating
position."* That is the private-solvency pitch verbatim, and it is the second
paragraph a judge reads, before any differentiation. It is also the sentence the
trust model later retracts, so it drifts into the 15-entry credit/solvency cluster
and goes false for the shipped deployment in a single move.

The PRD is worse: §1 lists "KYC passed, but the documents are private" and "A
balance is sufficient, but revealing it hands a counterparty your negotiating
position" as problem bullets, planting Aval in both saturated clusters at once.

Mitigation already exists and works: README:39-43 contrasts explicitly against
solvency and credential proofs, and README:34 disarms the comparison by making it
first. Fix README:22 only.

---

## Q5. Highest-leverage fix

Build the indistinguishability test the PRD specified and never shipped. One new
case in `contract/test/inflight.test.ts`: two fresh simulators, same `lock_id` and
same `salt`, amounts `50_000n` and `5_000_000n`, both proved; assert the serialized
public dumps are byte-identical on `attestor`, `fills` and the nullifier, and
differ only in `root`.

It passes by construction — `nullifier_of` at `inflight.compact:76` hashes
`lock_id` and `salt` only, never the amount — so there is no risk of authoring a
red test at T-10h. Add one row to the README Verification table and one line to the
Security-properties table.

~30 minutes. It converts the central claim from an absence a judge must trust into
an equality a judge can run, lands inside the 40% Engineering and 15% QA buckets,
and needs no re-record and no new scope.

---

**Verdict: SHIP WITH FIXES.**
