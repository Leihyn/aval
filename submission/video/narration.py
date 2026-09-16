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

def flat_cues():
    """Every cue in playback order, as (scene_index, cue_index, text)."""
    return [(si, ci, t) for si, (_, _, cues) in enumerate(SCRIPT)
            for ci, t in enumerate(cues)]

def say_wav(i, text):
    """Synthesise one cue with macOS `say`. Returns a repo-relative wav path."""
    txt = os.path.join(AUD, f'{i:03d}.txt')
    aif = os.path.join(AUD, f'{i:03d}.aiff')
    wav = os.path.join(AUD, f'{i:03d}.wav')
    with open(txt, 'w') as fh: fh.write(text)
    subprocess.run(['say', '-v', VOICE, '-r', str(RATE), '-f', txt, '-o', aif], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', aif,
                    '-ar', '48000', '-ac', '1', wav], check=True)
    return os.path.relpath(wav, HERE)

def compute_timing(get_wav, source):
    """Lay the cues out in time and return the table the renderer reads.

    `get_wav(i, text)` supplies the audio for cue i however it likes: synthesised,
    or cut from a human read. Everything downstream (scene lengths, caption
    windows, the .srt) is derived from the MEASURED length of whatever comes
    back, so a slower or faster read simply produces a longer or shorter film.
    """
    os.makedirs(AUD, exist_ok=True)
    scenes, t, i = [], 0.0, 0
    for key, floor, cues in SCRIPT:
        rows, off = [], LEAD
        for c in cues:
            rel = get_wav(i, c)
            d = dur(os.path.join(HERE, rel))
            rows.append({'text': c, 'wav': rel, 'rel': off, 'len': d})
            off += d + GAP
            i += 1
        spoken = off - GAP + TAIL
        length = max(floor, spoken)
        for r in rows:
            r['start'] = t + r['rel']
            r['end']   = t + r['rel'] + r['len']
        scenes.append({'key': key, 'start': t, 'dur': length, 'spoken': spoken, 'cues': rows})
        t += length
    return {'scenes': scenes, 'total': t, 'source': source, 'voice': VOICE,
            'rate': RATE, 'lead': LEAD, 'gap': GAP, 'tail': TAIL}

def report(tb):
    floors = {k: f for k, f, _ in SCRIPT}
    print(f"{'scene':14}{'floor':>7}{'spoken':>8}{'final':>8}  cues")
    for s in tb['scenes']:
        print(f"{s['key']:14}{floors[s['key']]:>7.1f}{s['spoken']:>8.1f}{s['dur']:>8.1f}  {len(s['cues'])}")
    cues = [c for s in tb['scenes'] for c in s['cues']]
    speech = sum(c['len'] for c in cues)
    words  = sum(len(c['text'].split()) for c in cues)
    print(f"\nsource {tb['source']}  \u00b7  total {tb['total']:.1f}s "
          f"({int(tb['total'])//60}m{tb['total']%60:04.1f}s)  \u00b7  {words} words  "
          f"\u00b7  {len(cues)} cues  \u00b7  {words/(speech/60):.0f} wpm  "
          f"\u00b7  {speech/tb['total']*100:.0f}% voiced")

def synth():
    return compute_timing(say_wav, 'tts')

if __name__ == '__main__':
    if '--list' in sys.argv:
        # the script to read from, numbered to match audio/NNN.wav
        for i, (si, ci, text) in enumerate(flat_cues()):
            if ci == 0: print(f"\n--- {SCRIPT[si][0]} ---")
            print(f'{i:03d}  {text}')
        sys.exit(0)
    if subprocess.run(['which', 'say'], capture_output=True).returncode != 0:
        sys.exit('no `say` binary; cannot synthesise narration')
    tb = synth()
    with open(os.path.join(HERE, 'timing.json'), 'w') as fh:
        json.dump(tb, fh, indent=1)
    report(tb)
