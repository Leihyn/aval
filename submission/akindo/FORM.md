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

## YouTube upload

Title, description, chapters, tags and settings live in their own file so there
is only one copy to keep right:

```
submission/akindo/YOUTUBE.md
```

Come back here with the URL and put it under `## Video`.

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

## Tagline  *(required, 100 CHARACTERS or less)*

The limit is 100 **characters**, not words. The long form used everywhere else
is 110 characters and will not fit, so the trailing clause is dropped: "act now"
already implies it.

```
Prove money is committed but not yet arrived, so a counterparty can act now.
```

76 characters. Alternatives, if you want a different emphasis:

| Chars | Tagline |
|---:|---|
| 81 | `Prove money is committed but not yet arrived. The amount never reaches the chain.` |
| 76 | `Prove funds are committed but not yet arrived, without revealing the amount.` |

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

Aval proves money is **committed but not yet arrived**, so a counterparty can release now, not at settlement.

Alice locks funds in escrow on a source chain. She proves to Bob's Midnight contract that the locked amount clears his threshold and is earmarked for him, **without revealing how much she locked, which lock it was, or who she is**.

The public ledger records a Merkle root, a nullifier and a fill count. It never records an amount.

Live demo: https://aval-dusky.vercel.app

Verify it in under a minute. No Docker, no proof server, no wallet:

```bash
git clone https://github.com/Leihyn/aval && cd aval/contract
npm install && npm test        # 31 passed
```

## The problem it solves

$2M leaves Ethereum at 09:00 and lands at 09:41. For 41 minutes the money is real, irrevocably committed, and **useless**, because nobody releases against a screenshot.

Your options are to wait, or to settle in public and broadcast the size of every leg you move, permanently, to your competitors. That is not a privacy nicety, it is your book. That window is the gap between a fact being **true** and being **publicly verifiable**. It is where cross-chain working capital dies.

**This is an instrument, not a statement.** Commitment plus membership proof plus threshold is a common shape. What is not: the proof is **single use** (a nullifier from the private `lock_id` and `salt`), **counterparty bound** (the payee is hashed into the leaf), and **expiring** (`kernel.blockTimeLessThan` against ledger time). Settlement needs all three; a balance claim needs none.

A proof you **spend**, not one you show.

## Challenges I ran into

**There is no in-circuit ECDSA.** `Secp256k1Point`, `Secp256k1Scalar` and `secp256k1EcdsaVerify` are **unbound in the shipped 0.34.0 standard library**, although the release notes describe them. Found by compiling probes, not by reading docs.

**Two security bugs, both found by adversarial review, both exploited before fixing.**

1. **A total soundness break.** `prove_funds_in_flight` never bound the witness supplied Merkle path to the leaf it recomputed. `find_path` is a **witness**: it runs on the prover machine and is never verified, so passing the leaf in was a hint, not a constraint. A proof of concept produced an **accepted** proof claiming `2^64-1` units against a real 1 unit attestation, paid to the wrong payee, past expiry. One `assert` fixed it.
2. **A permissionless bootstrap.** `register_attestor()` was callable by anyone, so a stranger could front run deployment and **permanently brick the contract**. Replaced with a constructor.

Both are now regression tests that **are the attack**, disclosed in the README.

## Technologies I used

**Compact** (language 0.26.0, compiler 0.34.0): 2 circuits plus constructor. **`compact-runtime` 0.19.0**, so circuits run in process and in the browser. **TypeScript and vitest**: 31 tests, simulator harness with injectable block time. **React 19, Vite 6, Tailwind v4** for the demo, with **`vite-plugin-wasm`** and an `esnext` target for Midnight's WASM core (`vite-plugin-top-level-await` breaks on it).

## How we built it

A `HistoricMerkleTree<10, Bytes<32>>` holds attestation commitments. The attestor registers `leaf_hash(lock_id, amount, counterparty, expiry, salt)`, a hash that reveals nothing. The holder proves membership with a privately supplied path, and the circuit:

1. recomputes the leaf and **binds the path to it** (the fix above)
2. discloses only the computed **root**, never the path or leaf, so the proof is unlinkable to a specific attestation
3. asserts `kernel.blockTimeLessThan(expiry)` against ledger block time, not a caller timestamp
4. discloses only the **boolean** `amount >= required`
5. derives a nullifier from the private `lock_id` and `salt`, discloses only that, and spends it

**8 `disclose()` call sites** bridge private to public, each annotated with what it reveals. Compact **refuses to compile** if a witness reaches the ledger without one: three drafts were rejected before this compiled.

## What we learned

**`disclose()` does not publish**, it clears the compiler's private data check; the **ledger write** is what makes a value visible. Exported circuit *parameters* count as private too, not just witnesses.

**Witness values are adversarial input.** The first 23 tests all shared one honest `find_path`, so 23 of 23 green said nothing about whether a hostile prover could substitute a different path.

**A claim that cannot fail is not evidence.** Three claims here were unfalsifiable: a privacy test that checked an object with no amount field, a UI banner that would white screen instead of reporting a leak, and the Merkle binding. All three were caught by attacking them. Every number in the docs is now checked against the code by `contract/scripts/verify-claims.sh`, because they drifted four times.

**Be precise about privacy.** `required`, `counterparty` and `expiry` are **public proof inputs**: an observer learns the payee, the expiry and a lower bound, never the amount, the lock, or who proved it.

## What's next for Aval

**Wave 2:** a real source chain attestor with a live Ethereum listener, a k of n quorum, an encrypted preimage channel, and the identity precondition predicate.

**Trust model, stated plainly.** Midnight cannot see Ethereum, and there is no trustless answer without a light client. So the counterparty runs the attestor: their *contract* cannot see Ethereum even though they can. Above that: quorum, then bonded and slashable attestors, then a light client. **Residual: a malicious attestor can fabricate a lock**, the same model as every fast finality bridge shipping today. Aval adds privacy to it, it does not claim to beat it.

**On deployment.** The toolchain targets ledger 9, which is not live on Preprod, so the contract is also compiled against **ledger 8**, which Preprod runs. **Both builds are committed**, so the claim can be diffed.

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

## Live demo  *(optional, but fill it)*

```
https://aval-dusky.vercel.app
```

The frontend, deployed. Verified after deploy, logged out: HTTP 200, the WASM
served as `application/wasm`, and a headless Chrome render reporting
`Midnight runtime ready. Circuits are executing in this browser tab, against
real ledger state.` with both panes and the `not present` amount row drawn.
Zero application errors in the console.

It needs no cross-origin isolation headers, because the bundle references
neither `SharedArrayBuffer` nor `crossOriginIsolated`.

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
