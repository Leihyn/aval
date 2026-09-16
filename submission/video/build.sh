#!/usr/bin/env bash
# Rebuild the demo video from source. Four stages, in order:
#
#   1. narration.py   synthesise the voice track, measure every utterance,
#                     write timing.json (the timeline AND the caption windows)
#   2. build_audio.py concatenate silence and speech into narration.wav, and
#                     emit aval-demo.srt from the same timings
#   3. render2.py     draw 1920x1080 frames, burning in the same captions
#   4. ffmpeg         normalise loudness and mux
#
# Stage 1 needs macOS `say`. Everything else is ffmpeg and Pillow.
#
# Stage 1 is skipped with --no-synth, which is what you want after
# use_human_voice.py has already written timing.json from a real read.
#
#   bash build.sh              # synthetic narration
#   bash build.sh --no-synth   # keep whatever audio/ and timing.json hold
set -euo pipefail
cd "$(dirname "$0")"

if [ "${1:-}" = "--no-synth" ]; then
  [ -f timing.json ] || { echo "--no-synth needs an existing timing.json" >&2; exit 1; }
  echo "skipping synthesis; using timing.json ($(python3 -c "import json;print(json.load(open('timing.json'))['source'])") source)"
else
  python3 narration.py
fi
python3 build_audio.py

# -16 LUFS with 1.5 dB of headroom is the streaming/YouTube target. loudnorm
# does not change duration, which build_audio.py has just asserted matches the
# frame count; re-checked at the end.
ffmpeg -y -loglevel error -i narration.wav \
       -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 48000 -ac 1 narration-norm.wav

rm -rf frames2
python3 render2.py

ffmpeg -y -loglevel error -framerate 30 -i frames2/%06d.png -i narration-norm.wav \
       -c:v libx264 -pix_fmt yuv420p -crf 20 -preset slow \
       -c:a aac -b:a 128k -ar 48000 -ac 2 \
       -movflags +faststart aval-demo.mp4

V=$(ffprobe -v error -show_entries format=duration -of csv=p=0 aval-demo.mp4)
T=$(python3 -c "import json;print(json.load(open('timing.json'))['total'])")
echo "aval-demo.mp4  ${V}s   timeline ${T}s"
python3 - "$V" "$T" <<'PY'
import sys
v, t = float(sys.argv[1]), float(sys.argv[2])
assert abs(v-t) < 0.1, f'video/timeline drift {abs(v-t):.3f}s'
print('OK: video length matches the timeline')
PY
