#!/usr/bin/env python3
"""Narration script, text-to-speech, and the timing table the renderer reads.

The split that matters: the NARRATION carries the argument, the SCREEN carries
the evidence. The voice never reads the on-screen text back at you, because
reading speed and speaking speed are different and the result is a video that
fights itself.

Each cue below is one spoken utterance AND one caption line, so the caption is
always exactly what is being said, and the .srt timings are measured from the
real audio rather than estimated from word counts.

    python3 narration.py          # synthesise, measure, write timing.json

Audio is macOS `say` (offline, no network, no cost). It is synthetic and
audibly so; a human read or a neural TTS pass would be better and the timing
table would not need to change, only the wav files.
"""
import json, os, subprocess, sys

HERE  = os.path.dirname(os.path.abspath(__file__))
AUD   = os.path.join(HERE, 'audio')
VOICE = 'Samantha'
RATE  = 135          # `say`'s rate scale, NOT literal wpm: Samantha
                     # delivers ~166 wpm at -r 150. 135 measures ~158 wpm,
                     # which is the comfortable range for dense technical copy.
LEAD  = 0.55         # scene appears, then the voice starts
GAP   = 0.36         # between cues inside a scene
TAIL  = 1.05         # voice ends, beat before the cut

# scene key -> (minimum seconds for the visual to read, [cues])
SCRIPT = [
 ('s_title', 4.5, [
   "Aval proves that money is committed, but has not yet arrived."]),

 ('dead_window', 12, [
   "Two million dollars leaves Ethereum at nine. It lands at nine forty one.",
   "For forty one minutes that money is real, it is irrevocable, and it is useless.",
   "Nobody releases their side of a trade against a screenshot."]),

 ('dual_ledger', 12, [
   "The alternative is to settle in public, and broadcast the size of every position you move.",
   "Aval does neither. The amount, the lock, and your identity never reach the chain.",
   "A root, a nullifier and a count do."]),

 ('s_compile', 8, [
   "It compiles. Two circuits, each with a prover and a verifier."]),

 ('s_tests', 9, [
   "Thirty one tests pass from a clean clone.",
   "No Docker, no proof server, no wallet. One command."]),

 ('s_indist', 13, [
   "Same lock, same salt, and amounts a hundred fold apart.",
   "Every field an observer can read comes back identical, except the Merkle root.",
   "That is not an absence you trust. It is an equality you can run yourself."]),

 ('nullifier', 10, [
   "The proof is single use.",
   "The nullifier comes from the private lock id and salt, so one lock backs exactly one proof, ever.",
   "The second proof is turned away at the door."]),

 ('s_ui', 10, [
   "It runs in a browser. Real circuits, executing in the page, against real ledger state.",
   "On the left, what the counterparty learns. On the right, everything the chain knows."]),

 ('s_attacks', 12, [
   "We tried to cheat it six ways.",
   "Reuse the lock. Inflate the amount. Redirect the payee. Extend the expiry.",
   "Every one is stopped by the circuit, not by application code."]),

 ('soundness', 16, [
   "Then we broke it ourselves.",
   "The Merkle path is a witness. It runs on the prover's machine, and it is never verified.",
   "So a hostile prover could return the path of a different leaf, and claim any amount at all.",
   "One assert line fixed it. That exploit is now a permanent regression test."]),

 ('s_trust', 10, [
   "Midnight cannot see Ethereum, and there is no trustless answer without a light client.",
   "So the counterparty runs the attestor themselves. A malicious attestor can still fabricate a lock.",
   "Same model as every fast finality bridge. Aval adds privacy to it, it does not beat it."]),

 ('s_roadmap', 9, [
   "Funds in flight is one predicate.",
   "The roadmap is identity preconditions, private solvency, and invoice factoring."]),

 ('s_close', 6, [
   "Aval. Act on a fact, before that fact is public."]),
]

def dur(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                          '-of', 'csv=p=0', path], capture_output=True, text=True)
    return float(out.stdout.strip())

def synth():
    os.makedirs(AUD, exist_ok=True)
    scenes, t, i = [], 0.0, 0
    for key, floor, cues in SCRIPT:
        rows, off = [], LEAD
        for c in cues:
            txt = os.path.join(AUD, f'{i:03d}.txt')
            aif = os.path.join(AUD, f'{i:03d}.aiff')
            wav = os.path.join(AUD, f'{i:03d}.wav')
            with open(txt, 'w') as fh: fh.write(c)
            subprocess.run(['say', '-v', VOICE, '-r', str(RATE), '-f', txt, '-o', aif], check=True)
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', aif,
                            '-ar', '48000', '-ac', '1', wav], check=True)
            d = dur(wav)
            rows.append({'text': c, 'wav': os.path.relpath(wav, HERE),
                         'rel': off, 'len': d})
            off += d + GAP
            i += 1
        spoken = off - GAP + TAIL
        length = max(floor, spoken)
        for r in rows:
            r['start'] = t + r['rel']
            r['end']   = t + r['rel'] + r['len']
        scenes.append({'key': key, 'start': t, 'dur': length, 'spoken': spoken, 'cues': rows})
        t += length
    return {'scenes': scenes, 'total': t, 'voice': VOICE, 'rate': RATE,
            'lead': LEAD, 'gap': GAP, 'tail': TAIL}

if __name__ == '__main__':
    if not subprocess.run(['which', 'say'], capture_output=True).returncode == 0:
        sys.exit('no `say` binary; cannot synthesise narration')
    tb = synth()
    with open(os.path.join(HERE, 'timing.json'), 'w') as fh:
        json.dump(tb, fh, indent=1)
    print(f"{'scene':14}{'floor':>7}{'spoken':>8}{'final':>8}  cues")
    for s in tb['scenes']:
        print(f"{s['key']:14}{dict(SCRIPT_F := {k: f for k, f, _ in SCRIPT})[s['key']]:>7.1f}"
              f"{s['spoken']:>8.1f}{s['dur']:>8.1f}  {len(s['cues'])}")
    words = sum(len(c['text'].split()) for s in tb['scenes'] for c in s['cues'])
    print(f"\ntotal {tb['total']:.1f}s  ({int(tb['total'])//60}m{tb['total']%60:04.1f}s)"
          f"  ·  {words} spoken words  ·  "
          f"{sum(len(s['cues']) for s in tb['scenes'])} caption cues")
