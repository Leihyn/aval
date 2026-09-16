# AKINDO submission form — Aval

Form: https://app.akindo.io/wave-hacks/jaMZjqPOBsLXvjdG
Every URL below verified HTTP 200 from a logged-out session.

---

## BLOCKER — do this first

The form says: *"Please post a demo video of your product with a public YouTube URL."*

The video is an MP4, not a YouTube link. **Upload it before filling the form:**

```
~/Desktop/dev/aval/submission/video/aval-demo.mp4      157s · 1080p · 2.4MB
```

Set it **Unlisted** or **Public** (not Private, judges must be able to open it).

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

Paste the entire contents of:

```
~/Desktop/dev/aval/submission/akindo/ABOUT.md
```

It is already written in the form's exact seven-heading template (What it does / The problem it solves / Challenges I ran into / Technologies I used / How we built it / What we learned / What's next for). 1,222 words.

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
