# AKINDO submission form — Aval

Form: https://app.akindo.io/wave-hacks/jaMZjqPOBsLXvjdG
Every URL below verified HTTP 200 from a logged-out session.

---

## BLOCKER — do this first

The form says: *"Please post a demo video of your product with a public YouTube URL."*

The video is an MP4, not a YouTube link. **Upload it before filling the form:**

```
~/Desktop/dev/aval/submission/video/aval-demo.mp4      175s · 1080p · narrated · 6.7MB
```

Set it **Unlisted** or **Public** (not Private, judges must be able to open it).

The video is narrated and the captions are burned in, so it reads with the sound off.
Upload the caption track too, so YouTube has real selectable subtitles that its search
can index:

```
YouTube Studio -> Subtitles -> Add -> Upload file -> With timing
~/Desktop/dev/aval/submission/video/aval-demo.srt      31 cues, timed from the audio
```

Suggested YouTube title (63 chars, no special characters):

```
Aval: prove money is in flight without revealing the amount
```

Suggested YouTube description:

```
Aval proves money is committed but not yet arrived, so a counterparty can act now instead of waiting for settlement. Built on Midnight for the Midnight Buildathon, Wave 1.

The amount never reaches the chain. Verify it yourself in under a minute, with no Docker, no proof server and no wallet:

  git clone https://github.com/Leihyn/aval && cd aval/contract
  npm install && npm test        -> 31 passed

Repo: https://github.com/Leihyn/aval
Apache-2.0
```

---

## Product icon  *(required)*

Upload:

```
~/Desktop/dev/aval/submission/akindo/icon-512.png
```

A 1024px version sits beside it if the form wants larger. The mark is a split disc: solid emerald on the left for what the counterparty learns, hollow blue on the right for what the chain learns.

---

## Product name  *(required)*

```
Aval
```

> Note: the form currently has `AVAL` in caps. Either is fine, but `Aval` matches the repo, the deck, the video and the README. Worth changing for consistency.

---

## Tagline  *(required, 100 words or less)*

Already filled and good. For reference:

```
Prove money is committed but not yet arrived, so a counterparty can act now instead of waiting for settlement.
```

---

## Product type  *(required)*

```
Functional
```

Not `Prototype`. The contract compiles to real circuits, 31 tests pass from a clean clone with no toolchain installed, and the frontend executes the real circuits in the browser.

---

## Image gallery  *(required, up to 5)*

Upload all five from `~/Desktop/dev/aval/submission/akindo/`, in this order:

| # | File | Shows |
|---|------|-------|
| 1 | `g1-product.png` | The product running in a browser |
| 2 | `g2-indistinguishable.png` | 50,000 vs 5,000,000, public state identical |
| 3 | `g3-attacks.png` | Six attacks, six reverts from the circuit |
| 4 | `g4-tests.png` | 31 tests passing, clone-and-run instructions |
| 5 | `g5-soundness.png` | The soundness bug found, exploited, fixed |

---

## About  *(required)*

The form pre-seeds these seven headings:

```
## What it does

## The problem it solves

## Challenges I ran into

## Technologies I used

## How we built it

## What we learned

## What's next for
```

**Select all in the form's Write box, delete it, and paste everything between the two rules below.** It already uses those exact seven headings in that exact order, so the preview will render correctly. 1,222 words.

Same text also lives on its own at `submission/akindo/ABOUT.md` if you prefer to copy from a file.

---

## What it does

Aval proves money is **committed but not yet arrived**, so a counterparty can release their side immediately instead of waiting for settlement.

Alice locks funds in an escrow on a source chain. She proves to Bob's Midnight contract that the locked amount clears his threshold and is earmarked for him, **without revealing how much she locked, which lock it was, or who she is**. Bob's contract verifies and releases.

The public ledger records a Merkle root, a nullifier, and a fill count. It never records an amount.

Verify it yourself in under a minute — no Docker, no proof server, no wallet:

```bash
git clone https://github.com/Leihyn/aval && cd aval/contract
npm install && npm test        # → 31 passed
```

## The problem it solves

$2M leaves Ethereum at 09:00 and lands at 09:41. For 41 minutes the money exists, it is irrevocably committed, and it is **useless** — the counterparty will not release against a screenshot.

Your two options today are to wait, or to settle on a public chain and broadcast the size of every leg you move, permanently, to your competitors. That is not a privacy nicety, it is your book.

That window is a gap between a fact being **true** and that fact being **publicly verifiable**. It is where cross-chain working capital dies. Aval closes it.

**This is an instrument, not a statement.** Commitment + membership proof + threshold is a common shape. Three mechanisms are not, and all three exist because settlement needs them and a balance claim does not:

| Mechanism | How | Why a solvency proof doesn't need it |
|---|---|---|
| **Single use** | nullifier from the private `lock_id` + `salt` | a reserves claim is reusable by design |
| **Counterparty bound** | `counterparty` hashed into the leaf | a credential is meant to be shown to anyone |
| **Expiring** | `kernel.blockTimeLessThan`, ledger time | a balance proof is about *now* |

A proof you **spend**, not one you show.

## Challenges I ran into

**There is no in-circuit ECDSA.** The natural design verifies an attestor's signature inside the circuit. `Secp256k1Point`, `Secp256k1Scalar`, `Secp256k1Base` and `secp256k1EcdsaVerify` are all **unbound in the shipped 0.34.0 standard library**, although the release notes describe them. Found by compiling probes, not by reading docs. The Merkle-membership design I moved to turned out to be *strictly more private*: a signature check would force the prover to reveal which attestation they used.

**Two security bugs, both found by adversarial review, both exploited before fixing.**

1. **A total soundness break.** `prove_funds_in_flight` never bound the witness-supplied Merkle path to the leaf it recomputed. `find_path` is a **witness** — it runs on the prover's machine and is not cryptographically verified — so passing the leaf in was a *hint*, not a constraint. A proof-of-concept produced an **accepted** proof claiming `2^64-1` units against a real **1-unit** attestation, paid to the wrong counterparty, past expiry, leaving the honest nullifier unspent. One `assert` fixed it.
2. **A permissionless bootstrap.** `register_attestor()` could be called by anyone, so a stranger could front-run deployment and **permanently brick the contract** with no rotation path. Replaced with a constructor that fixes the attestor at deploy.

Both are now regression tests that **are the attack**, not descriptions of it: `contract/test/soundness.test.ts` and `contract/test/bootstrap.test.ts`. Both are disclosed in the README rather than quietly patched.

**A test that could not fail.** An early "privacy" test asserted the amount was *absent* from public state — but it checked a hand-picked object that never had an amount field. It was replaced with **indistinguishability**, which is an equality you can run.

## Technologies I used

- **Compact** (language 0.26.0, compiler 0.34.0) — the contract, 2 circuits + constructor
- **`@midnight-ntwrk/compact-runtime` 0.19.0** — circuits execute in-process and in the browser
- **TypeScript + vitest** — 31 tests, simulator harness with injectable block time
- **React 19 + Vite 6 + Tailwind v4** — the two-pane demo
- **`vite-plugin-wasm`** — required to bundle Midnight's WASM core for a browser (`esnext` target; `vite-plugin-top-level-await` breaks on this bundle)

## How we built it

A `HistoricMerkleTree<10, Bytes<32>>` holds attestation commitments. The attestor registers `leaf_hash(lock_id, amount, counterparty, expiry, salt)` — a hash, revealing nothing. The holder proves membership with a privately-supplied path, and the circuit:

1. recomputes the leaf and **binds the path to it** (the fix above)
2. discloses only the computed **root**, never the path or leaf — so the proof is unlinkable to a specific attestation
3. asserts `kernel.blockTimeLessThan(expiry)` using ledger block time, not a caller timestamp
4. discloses only the **boolean** `amount >= required`
5. derives a nullifier from the private `lock_id` + `salt`, discloses only that, and spends it

**8 `disclose()` call sites** bridge private to public, each annotated in source with what an observer actually learns. Compact's information-flow analysis **refuses to compile** if a witness reaches the ledger without one — three drafts were rejected before this compiled.

## What we learned

**`disclose()` does not publish.** It clears the compiler's private-data check so a value may cross into a public position; the **ledger write** is what makes it visible. Exported circuit *parameters* are treated as private too, not just witnesses.

**Witness values are adversarial input.** This is the lesson that cost the most. Every one of the first 23 tests shared a single *honest* `find_path` implementation, so 23/23 green said nothing about whether a hostile prover could substitute a different path. A test suite that never swaps in a malicious witness cannot detect a witness-trust bug.

**A claim that cannot fail is not evidence.** Three separate claims here turned out to be unfalsifiable — the privacy test, a UI banner that would white-screen instead of reporting a leak, and the Merkle binding. All three were caught by attacking them. Every number in the docs is now checked against the code by a script, because they drifted four times: `bash contract/scripts/verify-claims.sh`.

**Being precise about privacy.** `required`, `counterparty` and `expiry` are **public proof inputs**. An observer learns the payee, the expiry, and a lower bound on the amount. What stays private is the amount *itself*, the specific lock, and the prover's identity. Claiming more would be an overclaim.

## What's next for Aval

**Wave 2** — a real source-chain attestor with a live Ethereum listener, a k-of-n attestor quorum, and an encrypted preimage channel. Plus the identity-precondition predicate on the same primitive.

**Trust model, stated plainly.** Midnight cannot see Ethereum, and there is no trustless answer without a light client. In the bilateral deployment the counterparty runs the attestor: their *contract* cannot see Ethereum even though they can, so trust collapses to them trusting their own node. Above that: quorum → bonded and slashable attestors → source-chain light client. **Residual: a malicious attestor can fabricate a lock** — the same trust model as every fast-finality bridge shipping today. Aval adds privacy to that model; it does not claim to beat it.

**On deployment.** The default toolchain targets ledger 9, which is not live on Preprod. The contract was therefore also compiled against **ledger 8**, which is what Preprod runs — it compiles clean with a one-line pragma change, and **both builds are committed** so the claim can be diffed rather than trusted. Deployment is gated on a local proof server needing a container runtime and on a faucet CAPTCHA. Neither is a property of this code.

---

---

## Deliverable URL  *(required)*

```
https://github.com/Leihyn/aval
```

Public · Apache-2.0 · carries the `midnightntwrk` topic label (verified present).

---

## Video

```
<paste your YouTube URL here after uploading>
```

---

## Live demo

**Leave blank.**

The frontend runs locally only; there is no deployed URL. Pointing this field at the repo would misuse it, and an empty optional field costs nothing.

---

## Build with  *(required)*

Press Enter after each:

```
Midnight
```

---

## Product Category  *(required, max 3)*

```
Market Infrastructure
DeFi
Privacy
```

---

## Tags  *(required, max 10)*

Press Enter after each:

```
Compact
TypeScript
Zero-Knowledge
React
Vite
Tailwind
vitest
Merkle Proofs
Nullifiers
Cross-Chain
```

---

## Product detail visibility

```
Show
```

Hiding it works against you. The repo is public and the whole submission argues that claims should be checkable.

---

## Connect

Your own handles:

| Field | Value |
|---|---|
| X | `https://x.com/<your_handle>` |
| Discord | your Discord (already answered as an entry question) |
| Telegram | your Telegram (already answered as an entry question) |
| Email | your email |

---

## Pre-submit checklist

- [ ] Video uploaded to YouTube, set Unlisted or Public, link opens in a private window
- [ ] `aval-demo.srt` uploaded as the caption track (English)
- [ ] Icon uploaded
- [ ] All 5 gallery images uploaded
- [ ] About pasted in full, preview renders the headings correctly
- [ ] Deliverable URL opens in a private window
- [ ] `midnightntwrk` topic visible on the repo page in a private window
- [ ] Product type set to `Functional`
- [ ] Visibility set to `Show`
- [ ] Submit with more than 60 minutes to spare

---

## Two quick commands

```bash
open ~/Desktop/dev/aval/submission/akindo     # icon + 5 gallery images + ABOUT.md
open ~/Desktop/dev/aval/submission/video      # the mp4 to upload to YouTube
```
