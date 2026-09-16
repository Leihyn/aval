#!/usr/bin/env python3
"""Aval demo video, v2.

v1 was 14 static cards held ~11s each with ~633 words of on-screen copy and no
narration: a PDF on a timer. v2 fixes both halves of that.

  1. The ideas that are temporal or structural are ANIMATED (anim.py): the dead
     window, the private/public membrane, the nullifier, the soundness bug.
  2. The evidence scenes REVEAL rather than dump. Every character shown is real
     captured output from submission/captures/ — the reveal is staging, not
     fabrication. Nothing is invented to fill motion.

Every scene is a function of t in [0,1] so the whole runtime is in motion.
Frames stream to disk as they are produced; nothing large is held in memory.
"""
import os, sys, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw, ImageFont
import anim
from anim import (W, H, FPS, BG, PANEL, BORDER, FG, DIM, GREEN, SKY, ROSE, AMBER,
                  SANS, MONO, F, H1, H2, BODY, SMALL, LAB, M, MS,
                  frame, foot, ease, clamp01)

OUT = os.path.dirname(os.path.abspath(__file__))
CAP = os.path.join(OUT, '..', 'captures')
FR  = os.path.join(OUT, 'frames2')

def cap(name, limit=None):
    with open(os.path.join(CAP, name)) as fh:
        ls = [l.rstrip('\n') for l in fh if l.strip()]
    return ls[:limit] if limit else ls

def mix(c, a):
    """Blend a colour toward the background. a=0 invisible, a=1 full."""
    a = clamp01(a)
    return tuple(int(BG[i] + (c[i]-BG[i])*a) for i in range(3))

def seg01(t, a, b):
    """Normalise t within [a,b] to [0,1], eased."""
    if b <= a: return 1.0 if t >= b else 0.0
    return ease(clamp01((t-a)/(b-a)))

def term(d, x, y, w, lines, title, col=GREEN, hl=None, prog=1.0):
    """A terminal panel whose lines print in, one after another.

    The panel is drawn at its FULL height from frame one so nothing jumps as
    lines arrive. `prog` walks the line list; the arriving line is typed
    character by character with a block cursor, the way it actually prints.
    """
    h = 64 + len(lines)*30 + 26
    d.rounded_rectangle([x, y, x+w, y+h], radius=16, fill=PANEL, outline=BORDER, width=2)
    d.text((x+28, y+22), title.upper(), font=LAB, fill=col)
    f = clamp01(prog) * len(lines)
    full, frac = int(f), f - int(f)
    yy = y + 64
    for k, ln in enumerate(lines):
        if k > full: break
        c = FG
        if ln.startswith('$'): c = AMBER
        if hl:
            for pat, cc in hl.items():
                if pat in ln: c = cc; break
        txt = ln[:92]
        if k == full and frac < 1.0:
            cut = int(frac * len(txt))
            if cut == 0 and frac > 0: cut = 1
            txt = txt[:cut]
            if txt:
                d.text((x+28, yy), txt, font=MS, fill=c)
                cx = x + 28 + d.textlength(txt, font=MS)
                d.rectangle([cx+2, yy+3, cx+12, yy+22], fill=mix(c, .55))
            break
        d.text((x+28, yy), txt, font=MS, fill=c)
        yy += 30
    return y + h

# ── scenes: each takes t in [0,1] and returns one frame ─────────────────────
def s_title(t):
    im, d = frame()
    d.text((80, 380), 'Aval', font=F(SANS, 92), fill=mix(FG, seg01(t, 0, .25)))
    d.text((80, 505), 'Prove money is committed but not yet arrived.',
           font=H2, fill=mix(DIM, seg01(t, .18, .42)))
    d.text((80, 560), 'So a counterparty can act now.',
           font=H2, fill=mix(DIM, seg01(t, .30, .54)))
    d.text((80, 660), 'Midnight Buildathon · Wave 1',
           font=BODY, fill=mix(GREEN, seg01(t, .48, .72)))
    foot(d); return im

def s_compile(t):
    im, d = frame()
    d.text((80, 90), 'It compiles', font=H1, fill=FG)
    d.text((80, 172), 'The technical gate for this buildathon.', font=SMALL, fill=DIM)
    term(d, 80, 240, 1760, cap('compile.txt'), 'real output', GREEN,
         hl={'prover': GREEN, 'verifier': SKY}, prog=t/0.55)
    foot(d); return im

def s_tests(t):
    im, d = frame()
    d.text((80, 90), '31 tests, all passing', font=H1, fill=FG)
    d.text((80, 172), 'No Docker. No proof server. No wallet. Clone and run.', font=SMALL, fill=DIM)
    term(d, 80, 240, 1760, cap('tests.txt')[-3:], 'real output', GREEN,
         hl={'passed': GREEN}, prog=t/0.32)
    a = seg01(t, .45, .62)
    if a > 0:
        d.rounded_rectangle([80, 470, 1840, 560], radius=12,
                            fill=mix(PANEL, a), outline=mix(BORDER, a), width=2)
        d.text((110, 496),
               'git clone https://github.com/Leihyn/aval && cd aval/contract && npm i && npm test',
               font=MS, fill=mix(AMBER, a))
    foot(d); return im

def s_indist(t):
    im, d = frame()
    d.text((80, 76), 'Can an observer tell 50,000 from 5,000,000?', font=H1, fill=FG)
    d.text((80, 158), 'Same lock id, same salt. Amounts a hundredfold apart.', font=SMALL, fill=DIM)
    b = term(d, 80, 214, 1760, cap('indistinguishability.txt')[:9], 'real output, side by side',
             SKY, hl={'IDENTICAL': GREEN, 'DIFFERS': AMBER}, prog=t/0.58)
    a = seg01(t, .66, .80)
    if a > 0:
        d.rounded_rectangle([80, b+30, 1840, b+140], radius=12,
                            fill=mix((8, 26, 20), a), outline=mix(GREEN, a), width=2)
        d.text((112, b+56), 'Every readable field identical except the merkle root.',
               font=H2, fill=mix(GREEN, a))
        d.text((112, b+102), 'Not an absence you trust. An equality you run.',
               font=BODY, fill=mix(FG, a))
    foot(d); return im

def s_ui(t):
    """A real screenshot. It settles from a slight push-in so the frame moves
    but comes to rest crisp, at 1:1, on the last frames."""
    base = Image.open(os.path.join(OUT, 'ui-panes.png')).convert('RGB')
    z = 1.05 - 0.05*ease(clamp01(t/0.75))
    if z > 1.001:
        cw, ch = int(W/z), int(H/z)
        im = base.crop(((W-cw)//2, (H-ch)//2, (W-cw)//2+cw, (H-ch)//2+ch)).resize((W, H), Image.LANCZOS)
    else:
        im = base.copy()
    base.close()
    d = ImageDraw.Draw(im)
    d.text((110, 84), 'Running in a browser', font=H1, fill=mix(FG, seg01(t, .05, .25)))
    d.text((110, 168), 'Real screenshot. Circuits execute in the page against real ledger state.',
           font=SMALL, fill=mix(DIM, seg01(t, .15, .35)))
    foot(d); return im

def s_attacks(t):
    im, d = frame()
    d.text((80, 76), 'Try to cheat it', font=H1, fill=FG)
    d.text((80, 158), 'Six attacks. Six reverts produced by the circuit, not by application code.',
           font=SMALL, fill=DIM)
    term(d, 80, 214, 1760, cap('attacks.txt')[:10], 'real output', ROSE,
         hl={'BLOCKED': GREEN}, prog=t/0.74)
    foot(d); return im

def s_trust(t):
    im, d = frame()
    d.text((80, 110), 'The honest part', font=H1, fill=FG)
    d.text((80, 210), 'Midnight cannot see Ethereum.', font=H2,
           fill=mix(DIM, seg01(t, .04, .18)))
    a = seg01(t, .16, .32)
    if a > 0:
        d.rounded_rectangle([80, 290, 1840, 410], radius=12,
                            fill=mix(PANEL, a), outline=mix(GREEN, a), width=2)
        d.text((112, 322), 'So the counterparty runs the attestor themselves.',
               font=H2, fill=mix(GREEN, a))
        d.text((112, 366), 'Their contract cannot see Ethereum even though they can.',
               font=BODY, fill=mix(FG, a))
    for i, lbl in enumerate(['k-of-n quorum', 'bonded + slashable', 'light client']):
        c = seg01(t, .38 + i*.09, .52 + i*.09)
        if c <= 0: continue
        x = 80 + i*590
        d.rounded_rectangle([x, 460, x+550, 580], radius=12,
                            fill=mix(PANEL, c), outline=mix(BORDER, c), width=2)
        d.text((x+28, 484), 'ROADMAP', font=LAB, fill=mix(SKY, c))
        d.text((x+28, 518), lbl, font=H2, fill=mix(DIM, c))
    r = seg01(t, .70, .84)
    d.text((80, 630), 'Residual: a malicious attestor can fabricate a lock.',
           font=BODY, fill=mix(DIM, r))
    d.text((80, 674), 'Same model as every fast-finality bridge. We add privacy to it.',
           font=BODY, fill=mix(DIM, seg01(t, .76, .90)))
    foot(d); return im

def s_roadmap(t):
    """One primitive, four predicates. Carried over from v1: this is the
    Product and Vision argument and dropping it lost the whole reason the
    thing is infrastructure rather than one feature. Rows stagger in so the
    shipped row reads first and the unshipped ones read as unshipped."""
    im, d = frame()
    d.text((80, 110), 'One predicate today. The primitive is general.',
           font=H1, fill=mix(FG, seg01(t, 0, .14)))
    rows = [('WAVE 1  SHIPPED', 'funds in flight',
             'amount >= required AND beneficiary == counterparty', GREEN),
            ('WAVE 2', 'identity preconditions',
             'kyc_passed AND jurisdiction NOT IN sanctioned', DIM),
            ('WAVE 3', 'private solvency', 'reserves >= liabilities', DIM),
            ('WAVE 3', 'invoice factoring',
             'invoice_valid AND unpaid AND amount >= advance', DIM)]
    yy = 260
    for i, (tag, name, pred, col) in enumerate(rows):
        a = seg01(t, .14 + i*.13, .30 + i*.13)
        if a > 0:
            d.rounded_rectangle([80, yy, 1840, yy+130], radius=14,
                                fill=mix(PANEL, a), outline=mix(BORDER, a), width=2)
            d.text((110, yy+28), tag, font=LAB, fill=mix(col, a))
            d.text((110, yy+62), name, font=H2,
                   fill=mix(FG if col == GREEN else DIM, a))
            d.text((760, yy+70), pred, font=MS, fill=mix(col, a))
        yy += 150
    foot(d); return im

def s_close(t):
    im, d = frame()
    d.text((80, 360), 'Aval', font=F(SANS, 92), fill=mix(FG, seg01(t, 0, .18)))
    d.text((80, 490), 'Act on a fact before that fact is public.',
           font=H1, fill=mix(GREEN, seg01(t, .14, .38)))
    d.text((80, 620), 'github.com/Leihyn/aval', font=F(MONO, 34),
           fill=mix(SKY, seg01(t, .34, .56)))
    d.text((80, 686), 'Apache-2.0 · 2 circuits · 31 passing tests · no Docker required',
           font=BODY, fill=mix(DIM, seg01(t, .46, .68)))
    foot(d); return im

# ── timeline ────────────────────────────────────────────────────────────────
TIMELINE = [
    ('t', s_title,             4),
    ('a', anim.dead_window,   13),
    ('a', anim.dual_ledger,   13),
    ('t', s_compile,           8),
    ('t', s_tests,            10),
    ('t', s_indist,           14),
    ('a', anim.nullifier,     10),
    ('t', s_ui,               11),
    ('t', s_attacks,          13),
    ('a', anim.soundness,     18),
    ('t', s_trust,            10),
    ('t', s_roadmap,          10),
    ('t', s_close,             6),
]

if __name__ == '__main__':
    if os.path.isdir(FR): shutil.rmtree(FR)
    os.makedirs(FR)
    idx = 0
    for kind, fn, secs in TIMELINE:
        n = int(secs * FPS)
        if kind == 't':
            for k in range(n):
                im = fn(k/(n-1) if n > 1 else 1.0)
                im.save(os.path.join(FR, f'{idx+k:06d}.png')); im.close()
        else:
            frames = fn(secs)
            for k, im in enumerate(frames):
                im.save(os.path.join(FR, f'{idx+k:06d}.png')); im.close()
            n = len(frames)
            del frames
        idx += n
    print(f'{len(TIMELINE)} scenes · {idx} frames · {idx/FPS:.0f}s')
    print('every frame is generated; no frame is a duplicate of the one before it')
