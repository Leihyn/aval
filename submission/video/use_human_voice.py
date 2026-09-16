#!/usr/bin/env python3
"""Replace the synthetic narration with a real human read.

    python3 use_human_voice.py <dir-of-31-clips>
    python3 use_human_voice.py <one-continuous-recording>
    bash build.sh --no-synth

Two ways to hand the audio over:

  DIRECTORY  31 files, one per cue, sorted by filename. Most reliable: nothing
             has to be guessed, and a fluffed line is a single re-record.

  ONE FILE   the whole script read straight through, with a clear pause (about
             three quarters of a second) between cues. This splits on those
             pauses. If it does not find exactly 31 segments it stops and shows
             what it did find rather than silently mis-aligning the captions.

Either way the timeline is rebuilt from the MEASURED length of the real audio,
so the film re-times to the read: scene lengths, caption windows and the .srt
all follow. Nothing needs to be timed to a stopwatch.

`python3 narration.py --list` prints the script to read from.
"""
import json, os, re, subprocess, sys
import narration as N

HERE, AUD = N.HERE, N.AUD
CUES = N.flat_cues()
SPLIT_NOISE, SPLIT_MINSIL, PAD = '-34dB', 0.55, 0.12

def sh(*a):
    return subprocess.run(a, capture_output=True, text=True)

def to_wav(src, dst, ss=None, to=None):
    """48 kHz mono, 80 Hz high-pass to drop desk rumble and handling noise.
    Levels are left alone; build.sh loudness-normalises the finished track."""
    cmd = ['ffmpeg', '-y', '-loglevel', 'error']
    if ss is not None: cmd += ['-ss', f'{ss:.3f}']
    if to is not None: cmd += ['-to', f'{to:.3f}']
    cmd += ['-i', src, '-af', 'highpass=f=80', '-ar', '48000', '-ac', '1', dst]
    subprocess.run(cmd, check=True)

def segments(src):
    """Speech spans in a continuous read, found as the gaps between silences."""
    out = sh('ffmpeg', '-hide_banner', '-i', src, '-af',
             f'silencedetect=noise={SPLIT_NOISE}:d={SPLIT_MINSIL}', '-f', 'null', '-').stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', out)]
    ends   = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', out)]
    total  = float(sh('ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                      '-of', 'csv=p=0', src).stdout.strip())
    marks = sorted([(s, 'start') for s in starts] + [(e, 'end') for e in ends])
    spans, cur = [], 0.0
    for at, kind in marks:
        if kind == 'start':
            if at - cur > 0.25: spans.append((cur, at))
        else:
            cur = at
    if total - cur > 0.25: spans.append((cur, total))
    return [(max(0, a-PAD), min(total, b+PAD)) for a, b in spans]

def ingest(src):
    os.makedirs(AUD, exist_ok=True)
    if os.path.isdir(src):
        files = sorted(f for f in os.listdir(src)
                       if not f.startswith('.') and os.path.isfile(os.path.join(src, f)))
        if len(files) != len(CUES):
            sys.exit(f'{src} holds {len(files)} files but the script has {len(CUES)} cues.\n'
                     f'  found: {", ".join(files[:6])}{" ..." if len(files) > 6 else ""}')
        for i, f in enumerate(files):
            to_wav(os.path.join(src, f), os.path.join(AUD, f'{i:03d}.wav'))
        print(f'{len(files)} clips ingested from {src}')
    else:
        spans = segments(src)
        if len(spans) != len(CUES):
            print(f'split {src} into {len(spans)} segments, but the script has {len(CUES)} cues.')
            print(f'nothing was written. options:')
            print(f'  - re-record leaving a clearer pause (~0.75s) between cues')
            print(f'  - or hand me a directory of {len(CUES)} clips instead')
            print(f'\nsegments found (start -> end):')
            for j, (a, b) in enumerate(spans):
                print(f'  {j:3d}  {a:7.2f} -> {b:7.2f}  ({b-a:5.2f}s)'
                      + (f'   "{CUES[j][2][:46]}"' if j < len(CUES) else ''))
            sys.exit(1)
        for i, (a, b) in enumerate(spans):
            to_wav(src, os.path.join(AUD, f'{i:03d}.wav'), ss=a, to=b)
        print(f'{len(spans)} segments cut from {src}')

def main():
    if len(sys.argv) != 2: sys.exit(__doc__)
    src = sys.argv[1]
    if not os.path.exists(src): sys.exit(f'no such path: {src}')
    ingest(src)
    tb = N.compute_timing(lambda i, text: os.path.relpath(
        os.path.join(AUD, f'{i:03d}.wav'), HERE), 'human')
    json.dump(tb, open(os.path.join(HERE, 'timing.json'), 'w'), indent=1)
    N.report(tb)
    print('\nnow run:  bash build.sh --no-synth')

if __name__ == '__main__':
    main()
