"""Draw the README's pictures from hooks/clawd-anims.ts: one animated SVG per clip, and
the hero, a mock of the band with Clawd dancing beside it.

Each animation is a strip of frames side by side, slid one frame at a time by a CSS
`steps()` animation inside a viewBox one frame wide, so GitHub plays it in an <img>.
usage: python3 -I tools/gen_svgs.py hooks/clawd-anims.ts assets
"""
import json
import os
import re
import sys

src = open(sys.argv[1], encoding='utf-8').read()
out_dir = sys.argv[2]
os.makedirs(out_dir, exist_ok=True)
PALETTE = json.loads(re.search(r'PALETTE = (\[.*\])', src).group(1))


def frames(name):
    body = re.search(r'\n  ' + name + r': \[\n(.*?)\n  \],', src, re.S).group(1)
    return [json.loads(line.strip().rstrip(',')) for line in body.split('\n')]


# name: (sprite, first frame, last frame, fps), the ranges the band plays.
CLIPS = {
    'dance': ('DancingHappy', 4, 38, 12),
    'laptop': ('Laptop', 17, 33, 12),
    'campfire': ('Campfire', 4, 19, 8),
    'compact': ('Compact', 0, 38, 10),
    'crab': ('CrabWalking', 4, 11, 12),
    'meditate': ('Meditating', 2, 59, 12),
    'hula': ('Hula', 6, 53, 12),
    'wave': ('Waving', 3, 16, 12),
    'facepalm': ('Facepalm', 2, 33, 12),
}


def bbox(fs):
    xs = [x for f in fs for r in f for x, ch in enumerate(r) if ch != '.']
    return min(xs), max(xs)


def rects(frame, x0, lo, hi):
    """One frame as runs of same-coloured pixels, shifted to x0."""
    parts = []
    for y, row in enumerate(frame):
        x = lo
        while x <= hi:
            ch = row[x]
            if ch == '.':
                x += 1
                continue
            end = x
            while end + 1 <= hi and row[end + 1] == ch:
                end += 1
            parts.append(f'<rect x="{x0 + x - lo}" y="{y}" width="{end - x + 1}" height="1" fill="{PALETTE[ord(ch) - 97]}"/>')
            x = end + 1
    return ''.join(parts)


def strip(fs, lo, hi, fps, cls):
    """The frames side by side and the CSS that steps through them."""
    w = hi - lo + 1
    n = len(fs)
    body = ''.join(rects(f, i * w, lo, hi) for i, f in enumerate(fs))
    css = (f'.{cls}{{animation:{cls} {n / fps:.3f}s steps({n}) infinite}}'
           f'@keyframes {cls}{{to{{transform:translateX(-{n * w}px)}}}}')
    return css, f'<g class="{cls}">{body}</g>', w


def clip_svg(name, scale=10):
    sprite, a, b, fps = CLIPS[name]
    fs = frames(sprite)[a:b + 1]
    lo, hi = bbox(fs)
    css, g, w = strip(fs, lo, hi, fps, 'f')
    h = len(fs[0])
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w * scale}" height="{h * scale}" '
            f'viewBox="0 0 {w} {h}" shape-rendering="crispEdges"><style>{css}</style>{g}</svg>\n')


# The band, as a terminal draws it: a cell is 9x18 px, a sprite pixel 9x9.
CELL_W, ROW_H = 9, 18
ROWS = [
    [('ctx ', '#7d828c'), ('━━━', '#5ad19a'), ('───────', '#4b4f58'), (' 23%', '#5ad19a'), ('  ', ''),
     ('cache ', '#7d828c'), ('━━━━━━━━━', '#5ad19a'), ('─', '#4b4f58'), (' 92%', '#5ad19a')],
    [('5h ', '#7d828c'), ('━━━━', '#8fd17a'), ('──────', '#4b4f58'), (' 37%', '#8fd17a'), ('  ', ''),
     ('7d ', '#7d828c'), ('━━', '#6fd18e'), ('────────', '#4b4f58'), (' 17%', '#6fd18e')],
    [('Opus 5.5', '#d97757'), (' ', ''), ('high', '#e8875f'), (' · ', '#7d828c'), ('cache 52m left', '#7d828c'),
     (' · ', '#7d828c'), ('$0.42', '#5fb8ff'), (' · ', '#7d828c'), ('Clawd: warm', '#ff8f5a')],
]


def hero_svg():
    sprite, a, b, fps = CLIPS['dance']
    fs = frames(sprite)[a:b + 1]
    lo, hi = bbox(fs)
    css, g, w = strip(fs, lo, hi, fps, 'f')
    cols = max(sum(len(t) for t, _ in r) for r in ROWS)
    pad = 2
    text_w = cols * CELL_W
    width = pad * CELL_W + text_w + 2 * CELL_W + w * CELL_W + pad * CELL_W
    height = 3 * ROW_H + 2 * 14 + 30 + 14
    top = 30 + 14
    sprite_x = pad * CELL_W + text_w + 2 * CELL_W
    lines = []
    for i, row in enumerate(ROWS):
        n = sum(len(t) for t, _ in row)
        x = pad * CELL_W + (cols - n) * CELL_W
        for text, color in row:
            if text.strip():
                lines.append(f'<text x="{x}" y="{top + i * ROW_H + 13}" fill="{color}">{text}</text>')
            x += len(text) * CELL_W
    dots = ''.join(f'<circle cx="{16 + i * 16}" cy="15" r="5" fill="{c}"/>' for i, c in enumerate(['#ff5f57', '#febc2e', '#28c840']))
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
        f'<style>{css}text{{font:15px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre}}</style>'
        f'<rect width="{width}" height="{height}" rx="10" fill="#1f2125"/>'
        f'<rect width="{width}" height="30" rx="10" fill="#2a2d33"/><rect y="20" width="{width}" height="10" fill="#2a2d33"/>{dots}'
        + ''.join(lines)
        + f'<svg x="{sprite_x}" y="{top}" width="{w * CELL_W}" height="{6 * 9}" viewBox="0 0 {w} 6" shape-rendering="crispEdges">{g}</svg>'
        f'<line x1="0" x2="{width}" y1="{height - 14}" y2="{height - 14}" stroke="#3a3d44"/>'
        '</svg>\n'
    )


for name in CLIPS:
    open(os.path.join(out_dir, f'clawd-{name}.svg'), 'w').write(clip_svg(name))
open(os.path.join(out_dir, 'hero.svg'), 'w').write(hero_svg())
print('wrote', len(CLIPS) + 1, 'svgs to', out_dir)
