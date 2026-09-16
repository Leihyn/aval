#!/usr/bin/env python3
"""Assemble the narration track and the caption sidecar from timing.json.

The track is built by CONCATENATION, not mixing: silence, cue, silence, cue...
so the audio length equals the video length by construction rather than by
hoping two independent clocks agree. Any drift would show up immediately as a
duration mismatch, which the check at the end asserts.
"""
import json, os, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
AUD  = os.path.join(HERE, 'audio')
TB   = json.load(open(os.path.join(HERE, 'timing.json')))
FPS  = 30

def silence(seconds, path):
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi',
                    '-i', 'anullsrc=r=48000:cl=mono', '-t', f'{max(seconds,0.001):.4f}',
                    '-ar', '48000', '-ac', '1', path], check=True)

def dur(path):
    o = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                        '-of', 'csv=p=0', path], capture_output=True, text=True)
    return float(o.stdout.strip())

def build_track():
    parts, si = [], 0
    for sc in TB['scenes']:
        cursor = 0.0
        for c in sc['cues']:
            if c['rel'] - cursor > 0.001:
                p = os.path.join(AUD, f'sil{si:03d}.wav'); si += 1
                silence(c['rel'] - cursor, p); parts.append(p)
            parts.append(os.path.join(HERE, c['wav']))
            cursor = c['rel'] + c['len']
        if sc['dur'] - cursor > 0.001:
            p = os.path.join(AUD, f'sil{si:03d}.wav'); si += 1
            silence(sc['dur'] - cursor, p); parts.append(p)
    lst = os.path.join(AUD, 'concat.txt')
    with open(lst, 'w') as fh:
        for p in parts:
            fh.write(f"file '{os.path.abspath(p)}'\n")
    out = os.path.join(HERE, 'narration.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
                    '-i', lst, '-c', 'copy', out], check=True)
    return out

def ts(t):
    h, r = divmod(t, 3600); m, s = divmod(r, 60)
    return f'{int(h):02d}:{int(m):02d}:{int(s):02d},{int(round((s%1)*1000)):03d}'

def build_srt():
    """Cue windows match the burned-in captions exactly: a cue holds until the
    next one starts, or until its scene ends."""
    lines, n = [], 0
    for sc in TB['scenes']:
        end_of_scene = sc['start'] + sc['dur']
        for j, c in enumerate(sc['cues']):
            nxt = sc['cues'][j+1]['start'] if j+1 < len(sc['cues']) else end_of_scene
            n += 1
            lines += [str(n), f'{ts(c["start"])} --> {ts(nxt)}', c['text'], '']
    out = os.path.join(HERE, 'aval-demo.srt')
    open(out, 'w').write('\n'.join(lines))
    return out, n

if __name__ == '__main__':
    wav = build_track()
    srt, n = build_srt()
    a, v = dur(wav), TB['total']
    print(f'narration.wav  {a:.3f}s')
    print(f'timeline total {v:.3f}s')
    print(f'drift          {abs(a-v)*1000:.0f} ms   ({abs(a-v)*FPS:.2f} frames)')
    print(f'{srt}  ({n} cues)')
    assert abs(a-v) < 0.05, f'audio/video drift {abs(a-v):.3f}s is too large'
    print('OK: audio length matches the timeline')
