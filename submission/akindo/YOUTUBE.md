# YouTube upload: Aval demo

The AKINDO form requires a **public YouTube URL**, not a file. This is everything
needed to get one. Open this file alone and you can finish the upload without
looking anywhere else.

The video and caption file are final and pushed. Nothing here waits on code.

---

## Do this

1. Upload `~/Desktop/dev/aval/submission/video/aval-demo.mp4` (175s, 1080p, 6.7MB)
2. Paste the **Title** below
3. Paste the **Description** below, the whole block
4. Paste the **Tags** below
5. Apply the **Settings** table
6. Add captions: `Subtitles -> Add -> Upload file -> With timing ->`
   `~/Desktop/dev/aval/submission/video/aval-demo.srt`
7. Set visibility **Unlisted** or **Public**, publish, then open the link in a
   private window to confirm a logged-out visitor can watch it
8. Paste that URL into the AKINDO form's Video field, and into `FORM.md`
   under `## Video`

---

## Title

80 characters, under YouTube's 100 limit.

```
Aval: prove funds are committed before they arrive, without revealing the amount
```

---

## Description

The first two lines are what shows above "Show more", so the hook sits there
deliberately. The timestamps render as chapters.

```
$2M leaves Ethereum at 09:00 and lands at 09:41. For 41 minutes that money is real, it is irrevocable, and it is useless, because nobody releases their side against a screenshot.

Aval closes that window. It proves money is committed but not yet arrived, so a counterparty can act now instead of waiting for settlement, and it does that without putting the amount on a public chain.

Alice locks funds in escrow on a source chain. She proves to Bob's Midnight contract that the locked amount clears his threshold and is earmarked for him, without revealing how much she locked, which lock it was, or who she is. The public ledger records a Merkle root, a nullifier and a fill count. It never records an amount.

VERIFY IT YOURSELF, in under a minute. No Docker, no proof server, no wallet:

  git clone https://github.com/Leihyn/aval && cd aval/contract
  npm install && npm test        -> 31 passed

CHAPTERS
0:00 The dead window
0:22 What crosses, and what never does
0:38 It compiles, and 31 tests pass
0:55 Can an observer tell 50,000 from 5,000,000?
1:13 A proof you spend, not one you show
1:26 Running in a browser
1:41 Six attacks, six reverts
1:55 We broke it ourselves
2:17 The honest part
2:38 One predicate today, and what is next

WHAT MAKES IT AN INSTRUMENT RATHER THAN A STATEMENT
Single use: a nullifier derived from the private lock id and salt, so one lock backs exactly one proof, ever.
Counterparty bound: the payee is hashed into the leaf, so the proof is not transferable.
Expiring: enforced with kernel.blockTimeLessThan against ledger time, not a caller timestamp.

THE HONEST PART
Midnight cannot see Ethereum, and there is no trustless answer to that without a light client. In the bilateral deployment the counterparty runs the attestor themselves. A malicious attestor can still fabricate a lock, which is the same trust model as every fast finality bridge shipping today. Aval adds privacy to that model, it does not claim to beat it.

We also broke our own contract during review. The Merkle path is a witness, it runs on the prover's machine and is never verified, so a hostile prover could return the path of a different leaf and claim any amount. One assert line fixed it, and that exploit is now a permanent regression test rather than a footnote.

BUILT WITH
Compact (language 0.26.0, compiler 0.34.0), @midnight-ntwrk/compact-runtime 0.19.0, TypeScript, vitest, React 19, Vite 6, Tailwind v4.

Repo: https://github.com/Leihyn/aval
License: Apache-2.0
Submitted to the Midnight Buildathon, Wave 1.
```

---

## Tags

Paste as one comma separated list.

```
Midnight Network, zero knowledge, ZK proofs, Compact language, privacy, cross chain, bridge, settlement, proof of funds, Merkle proof, nullifier, DeFi, market infrastructure, hackathon, Midnight Buildathon, blockchain privacy, smart contracts, TypeScript, React
```

---

## Settings

| Field | Value |
|---|---|
| Visibility | **Unlisted** or **Public**, never Private. Judges must be able to open it. |
| Category | Science & Technology |
| Audience | Not made for kids |
| Video language | English |
| Captions | Upload `aval-demo.srt` |
| Comments | Your call, nothing depends on it |

---

## Why upload the .srt when captions are already visible

The captions are **burned into the pixels**, so the video reads with the sound
off and does not depend on a judge clicking CC. `aval-demo.mp4` carries only a
video stream and an audio stream, no subtitle track.

Uploading `aval-demo.srt` on top is a different job: it gives YouTube a real
selectable track that its search can index, and it makes auto translation
possible. Both are generated from one timing table, so they cannot drift apart.

---

## Where the chapters come from

They are not eyeballed. They are generated from `submission/video/timing.json`,
the same table that drives the scene lengths and the caption windows, then
checked back against it:

- 10 chapters, the first at `0:00`, as YouTube requires
- every stamp lands on a real scene boundary
- shortest chapter is 13s, against YouTube's 10s minimum
- monotonically increasing

Scenes shorter than 10s are merged into a neighbour rather than dropped, because
YouTube silently ignores a chapter under 10s and that breaks the whole list.

---

## Troubleshooting

**Chapters do not appear.** All three conditions must hold: the first stamp is
exactly `0:00`, there are at least three, and each runs 10s or longer. Also
check the stamps kept their own lines when pasted, since YouTube will not parse
them inline.

**The caption upload is rejected.** Choose "With timing", not "Without timing".
The `.srt` carries its own timings and YouTube will refuse to auto-align a file
that already has them.

**The link works for you but not in a private window.** It is still Private
rather than Unlisted. Private means only you, which fails the submission.

**Processing sits at a low resolution.** 1080p can take several minutes to
transcode after the upload itself finishes. The link is usable meanwhile, so
submit it rather than waiting.
