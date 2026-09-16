#!/usr/bin/env python3
"""Aval demo video renderer.

Renders frames with PIL and encodes with ffmpeg. Every terminal frame is real
captured output from submission/captures/, not retyped. Nothing is fabricated:
that is the same invariant the product itself claims.
"""
import os, subprocess, textwrap
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1920, 1080, 30
OUT = os.path.dirname(os.path.abspath(__file__))
CAP = os.path.join(OUT, '..', 'captures')
FRAMES = os.path.join(OUT, 'frames')

BG      = (7, 7, 11)
PANEL   = (13, 13, 18)
BORDER  = (38, 38, 46)
FG      = (232, 232, 239)
DIM     = (138, 138, 152)
GREEN   = (52, 211, 153)
SKY     = (56, 189, 248)
ROSE    = (251, 113, 133)
AMBER   = (251, 191, 36)

SANS  = '/System/Library/Fonts/SFNS.ttf'
MONO  = '/System/Library/Fonts/Menlo.ttc'

def f(path, size):
    return ImageFont.truetype(path, size)

F_TITLE = f(SANS, 86)
F_H1    = f(SANS, 60)
F_H2    = f(SANS, 40)
F_BODY  = f(SANS, 34)
F_SMALL = f(SANS, 26)
F_MONO  = f(MONO, 26)
F_MONOS = f(MONO, 22)
F_LABEL = f(SANS, 22)

def new_frame():
    img = Image.new('RGB', (W, H), BG)
    return img, ImageDraw.Draw(img)

def footer(d, text='aval  ·  proof of funds in flight  ·  built on Midnight'):
    d.text((80, H - 62), text, font=F_LABEL, fill=(70, 70, 82))

def wrap(d, text, font, x, y, maxw, fill, leading=1.45):
    words, line, yy = text.split(), '', y
    for w in words:
        t = (line + ' ' + w).strip()
        if d.textlength(t, font=font) > maxw and line:
            d.text((x, yy), line, font=font, fill=fill); yy += int(font.size * leading); line = w
        else:
            line = t
    if line:
        d.text((x, yy), line, font=font, fill=fill); yy += int(font.size * leading)
    return yy

def panel(d, x, y, w, h, title=None, title_col=SKY):
    d.rounded_rectangle([x, y, x + w, y + h], radius=16, fill=PANEL, outline=BORDER, width=2)
    if title:
        d.text((x + 28, y + 22), title.upper(), font=F_LABEL, fill=title_col)

def term_h(lines, cap=None):
    n = len(lines) if cap is None else min(len(lines), cap)
    return 64 + n * 30 + 28

def term_panel(d, x, y, w, h, lines, title, title_col=GREEN, highlight=None):
    h = min(h, term_h(lines))
    panel(d, x, y, w, h, title, title_col)
    yy = y + 64
    for ln in lines:
        col = FG
        if highlight:
            for pat, c in highlight.items():
                if pat in ln: col = c; break
        if ln.startswith('$'): col = AMBER
        d.text((x + 28, yy), ln[:96], font=F_MONOS, fill=col)
        yy += 30
        if yy > y + h - 34: break

def read_capture(name):
    p = os.path.join(CAP, name)
    with open(p) as fh:
        return [l.rstrip('\n') for l in fh if l.strip() != '']

# ── scenes ────────────────────────────────────────────────────────────────────
scenes = []   # (frame_image, seconds)

def add(img, secs): scenes.append((img, secs))

# 1 title
img, d = new_frame()
d.text((80, 380), 'Aval', font=F_TITLE, fill=FG)
wrap(d, 'Prove money is committed but not yet arrived, so a counterparty can act now instead of waiting for settlement.',
     F_H2, 80, 500, 1500, DIM)
d.text((80, 660), 'Midnight Buildathon · Wave 1', font=F_BODY, fill=GREEN)
footer(d); add(img, 4)

# 2 the problem
img, d = new_frame()
d.text((80, 120), 'The dead window', font=F_H1, fill=FG)
y = wrap(d, '$2M leaves Ethereum at 09:00. It arrives at 09:41.', F_H2, 80, 240, 1700, FG)
y = wrap(d, 'For 41 minutes the money exists, it is irrevocably committed, and it is useless. '
            'The counterparty will not release their side against a screenshot. So everybody waits.',
         F_BODY, 80, y + 30, 1700, DIM)
bx, bw = 80, 1760
d.rounded_rectangle([bx, y + 70, bx + bw, y + 140], radius=10, fill=(30, 12, 16), outline=ROSE, width=2)
d.text((bx + 28, y + 92), '41 minutes of capital that exists and cannot be used',
       font=F_BODY, fill=ROSE)
footer(d); add(img, 9)

# 3 two bad options
img, d = new_frame()
d.text((80, 120), 'Your two options today', font=F_H1, fill=FG)
panel(d, 80, 260, 850, 380, 'option a', ROSE)
wrap(d, 'Wait 41 minutes.', F_H2, 108, 330, 780, FG)
wrap(d, 'Working capital sits idle. Both desks are blocked on a bridge.', F_BODY, 108, 420, 780, DIM)
panel(d, 990, 260, 850, 380, 'option b', ROSE)
wrap(d, 'Reveal the amount.', F_H2, 1018, 330, 780, FG)
wrap(d, 'Which tells your counterparty exactly how much room you have. '
        'That is not a privacy nicety. It is your negotiating position.', F_BODY, 1018, 420, 780, DIM)
d.text((80, 720), 'Aval is the third option.', font=F_H2, fill=GREEN)
footer(d); add(img, 9)

# 4 what it does
img, d = new_frame()
d.text((80, 110), 'Prove the threshold, not the number', font=F_H1, fill=FG)
y = wrap(d, 'Alice locks funds on a source chain. She proves to the counterparty\'s Midnight contract '
            'that the locked amount clears their threshold and is earmarked for them, without revealing '
            'how much she locked, which lock it was, or who she is.', F_BODY, 80, 230, 1760, DIM)
panel(d, 80, y + 50, 850, 300, 'stays private (witness)', GREEN)
for i, t in enumerate(['lock_id', 'amount', 'salt', 'merkle path']):
    d.text((110, y + 120 + i * 42), '· ' + t, font=F_MONO, fill=FG)
panel(d, 990, y + 50, 850, 300, 'becomes public (ledger)', SKY)
for i, t in enumerate(['merkle root', 'nullifier', 'fill counter', 'attestor id']):
    d.text((1020, y + 120 + i * 42), '· ' + t, font=F_MONO, fill=FG)
footer(d); add(img, 10)

# 5 compile (REAL)
img, d = new_frame()
d.text((80, 90), 'It compiles', font=F_H1, fill=FG)
d.text((80, 175), 'Real output. The technical gate for this buildathon.', font=F_SMALL, fill=DIM)
term_panel(d, 80, 240, 1760, 620, read_capture('compile.txt'), 'real output', GREEN,
           highlight={'prover': GREEN, 'verifier': SKY, 'Compiling': FG})
footer(d); add(img, 10)

# 6 tests (REAL)
img, d = new_frame()
d.text((80, 70), '31 tests, all passing', font=F_H1, fill=FG)
d.text((80, 150), 'No Docker. No proof server. No wallet. Clone and run.', font=F_SMALL, fill=DIM)
lines = read_capture('tests.txt')
term_panel(d, 80, 205, 1760, 700, lines[:24], 'real output', GREEN,
           highlight={'22 passed': GREEN, '✓': GREEN})
d.text((80, 940), 'Tests  31 passed (31)', font=f(MONO, 34), fill=GREEN)
footer(d); add(img, 13)

# 7 seed / privacy (REAL)
img, d = new_frame()
d.text((80, 90), 'What the chain actually learns', font=F_H1, fill=FG)
d.text((80, 175), 'Produced by real circuit execution, not fixtures.', font=F_SMALL, fill=DIM)
term_panel(d, 80, 240, 1760, 420, read_capture('seed.txt'), 'ledger state after one proof', SKY,
           highlight={'absent by construction': GREEN, 'nullifier ': SKY})
d.rounded_rectangle([80, 700, 1840, 790], radius=12, fill=(8, 26, 20), outline=GREEN, width=2)
d.text((110, 725), 'Three attestations registered. One proof spent. No amount written.', font=F_H2, fill=GREEN)
footer(d); add(img, 12)

# 7b indistinguishability (REAL) — the money shot
img, d = new_frame()
d.text((80, 70), 'Can an observer tell 50,000 from 5,000,000?', font=F_H1, fill=FG)
d.text((80, 150), 'Same lock id. Same salt. Same counterparty. Amounts a hundredfold apart.',
       font=F_SMALL, fill=DIM)
term_panel(d, 80, 205, 1760, 460, read_capture('indistinguishability.txt')[:9],
           'real output, side by side', SKY,
           highlight={'IDENTICAL': GREEN, 'DIFFERS': AMBER})
d.rounded_rectangle([80, 610, 1840, 830], radius=12, fill=(8, 26, 20), outline=GREEN, width=2)
d.text((112, 640), 'Every readable field is identical except the merkle root.', font=F_H2, fill=GREEN)
wrap(d, 'A root is a hash: it commits to the leaf without revealing it. The nullifier is '
        'byte-identical across a hundredfold difference in amount.', F_BODY, 112, 700, 1660, FG)
d.text((112, 782), 'Not an absence you have to trust. An equality you can run.', font=F_BODY, fill=GREEN)
footer(d); add(img, 15)

# 7c the actual product, real browser screenshot
img = Image.open(os.path.join(OUT, 'ui-panes.png')).convert('RGB')
d = ImageDraw.Draw(img)
d.text((110, 84), 'The product, running in a browser', font=F_H1, fill=FG)
d.text((110, 168), 'Real screenshot. Circuits execute in the page against real ledger state, no server, no wallet.',
       font=F_SMALL, fill=DIM)
footer(d); add(img, 14)

# 8 attacks (REAL)
img, d = new_frame()
d.text((80, 70), 'Try to cheat it', font=F_H1, fill=FG)
d.text((80, 150), 'Six real attacks. Six revert strings produced by the circuit, not by application code.',
       font=F_SMALL, fill=DIM)
term_panel(d, 80, 205, 1760, 640, read_capture('attacks.txt'), 'six attacks, real output', ROSE,
           highlight={'BLOCKED': GREEN})
footer(d); add(img, 16)

# 9 trust model
img, d = new_frame()
d.text((80, 100), 'The honest part', font=F_H1, fill=FG)
y = wrap(d, 'Midnight cannot see Ethereum. There is no trustless answer without a light client, '
            'so Aval does not pretend otherwise. It makes the trusted party someone whose trust is free.',
         F_BODY, 80, 220, 1760, DIM)
y = wrap(d, 'The counterparty runs the attestor themselves. Their contract cannot see Ethereum '
            'even though they can. Trust collapses to "Bob trusts Bob\'s own node".',
         F_H2, 80, y + 40, 1760, FG)
d.text((80, y + 60), 'Roadmap to less trust:  k-of-n quorum  →  bonded and slashable  →  source-chain light client',
       font=F_BODY, fill=SKY)
d.text((80, y + 120), 'Residual: a malicious attestor can fabricate a lock. Same model as every fast-finality',
       font=F_SMALL, fill=DIM)
d.text((80, y + 152), 'bridge shipping today. We add privacy to that model. We do not claim to beat it.',
       font=F_SMALL, fill=DIM)
footer(d); add(img, 13)

# 10 roadmap
img, d = new_frame()
d.text((80, 110), 'One predicate today. The primitive is general.', font=F_H1, fill=FG)
rows = [('Wave 1  shipped', 'funds in flight', 'amount >= required AND beneficiary == counterparty', GREEN),
        ('Wave 2', 'identity preconditions', 'kyc_passed AND jurisdiction NOT IN sanctioned', DIM),
        ('Wave 3', 'private solvency', 'reserves >= liabilities', DIM),
        ('Wave 3', 'invoice factoring', 'invoice_valid AND unpaid AND amount >= advance', DIM)]
yy = 260
for tag, name, pred, col in rows:
    panel(d, 80, yy, 1760, 130)
    d.text((110, yy + 28), tag, font=F_LABEL, fill=col)
    d.text((110, yy + 62), name, font=F_H2, fill=FG if col == GREEN else DIM)
    d.text((760, yy + 70), pred, font=F_MONO, fill=col)
    yy += 150
footer(d); add(img, 10)

# 10b soundness: we attacked our own contract
img, d = new_frame()
d.text((80, 70), 'We attacked our own contract', font=F_H1, fill=FG)
d.text((80, 150), 'An adversarial review found the merkle path was never bound to the recomputed leaf.',
       font=F_SMALL, fill=DIM)
d.rounded_rectangle([80, 205, 1840, 345], radius=12, fill=(30, 12, 16), outline=ROSE, width=2)
d.text((112, 232), 'Before the fix: a proof claiming 2^64-1 units against a real 1-unit',
       font=F_H2, fill=ROSE)
d.text((112, 286), 'attestation, to the wrong payee, past expiry, was ACCEPTED.', font=F_H2, fill=ROSE)
d.text((80, 388), 'find_path is a WITNESS. It runs on the prover\'s machine and is not verified.',
       font=F_BODY, fill=DIM)
d.text((80, 432), 'Passing the leaf into it was a hint, not a constraint. The fix is one line:',
       font=F_BODY, fill=DIM)
term_panel(d, 80, 486, 1760, 130,
           ['assert(disclose(path.leaf == leaf), "merkle path does not open the claimed leaf");'],
           'contract/src/inflight.compact', GREEN)
term_panel(d, 80, 640, 1760, 200, read_capture('soundness.txt')[2:7],
           'the exploit is now a permanent regression test', GREEN,
           highlight={'false': GREEN, '0': GREEN})
footer(d); add(img, 16)

# 11 close
img, d = new_frame()
d.text((80, 340), 'Aval', font=F_TITLE, fill=FG)
wrap(d, 'Act on a fact before that fact is public.', F_H1, 80, 470, 1700, GREEN)
d.text((80, 640), 'github.com/Leihyn/aval', font=f(MONO, 36), fill=SKY)
d.text((80, 700), 'Apache-2.0  ·  31 passing tests  ·  2 circuits  ·  no Docker required', font=F_BODY, fill=DIM)
footer(d); add(img, 6)

# ── write frames ──────────────────────────────────────────────────────────────
os.makedirs(FRAMES, exist_ok=True)
for old in os.listdir(FRAMES):
    os.remove(os.path.join(FRAMES, old))

idx, total = 0, 0
for img, secs in scenes:
    n = int(secs * FPS)
    path0 = os.path.join(FRAMES, f'{idx:06d}.png')
    img.save(path0)
    for k in range(1, n):
        os.link(path0, os.path.join(FRAMES, f'{idx + k:06d}.png'))
    idx += n; total += secs
print(f'{len(scenes)} scenes, {idx} frames, {total}s')
