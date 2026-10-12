"""Pull Clawd's pixel sprites out of Claude Desktop's clawdQuestEngine bundle.

Each sprite: w, h, fps, palette, base (w*h chars: '.' clear, digit = palette index)
and deltas: frames split by '(', each a comma list of <base36 index><value>, applied
cumulatively to the previous frame.
usage: python3 -I extract_sprites.py engine.js out.json
"""
import json
import re
import sys

src = open(sys.argv[1], encoding='utf-8').read()
pat = re.compile(r'(\w+):\{cat:"(\w+)",w:(\d+),h:(\d+),fps:(\d+),palette:\[([^\]]*)\],base:"([^"]*)",deltas:(?:"([^"]*)"\.split\("(.)"\)|\[([^\]]*)\])(?:,a0:\[([^\]]*)\])?')
out = {}
for m in pat.finditer(src):
    name, cat, w, h, fps, pal, base, dstr, sep, darr, a0 = m.groups()
    deltas = dstr.split(sep) if dstr is not None else json.loads('[' + darr + ']')
    w, h = int(w), int(h)
    assert len(base) == w * h, (name, len(base), w * h)
    frames, cur = [base], list(base)
    for chunk in deltas:
        for ent in filter(None, chunk.split(',')):
            cur[int(ent[:-1], 36)] = ent[-1]
        frames.append(''.join(cur))
    out[name] = {'cat': cat, 'w': w, 'h': h, 'fps': int(fps), 'palette': json.loads('[' + pal + ']'), 'frames': frames, 'a0': json.loads('[' + (a0 or '') + ']')}
json.dump(out, open(sys.argv[2], 'w'))
for k, v in out.items():
    print(f"{k:20s} {v['cat']:10s} {v['w']}x{v['h']} fps={v['fps']} frames={len(v['frames'])} pal={len(v['palette'])}")
