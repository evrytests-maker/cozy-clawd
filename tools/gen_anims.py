"""Turn the extracted Claude Desktop sprites into the mod's hooks/clawd-anims.ts.

Every sprite is mirrored (props on Clawd's left, as the desktop draws him sitting on
the composer), placed so its body box (a0, 24x16) lands on one canvas spot, then
halved by taking the top-left pixel of each 2x2 block aligned to that body box.
usage: python3 -I gen_anims.py sprites.json out.ts
"""
import json
import re
import sys
from pathlib import Path

d = json.load(open(sys.argv[1]))
USE = ['LookingAround', 'LookingAroundEyesOnly', 'Swaying', 'Turning', 'Waving', 'DancingHappy',
       'Excited', 'Disappointed', 'Dizzy', 'Facepalm', 'Meditating', 'Laptop', 'Hula',
       'CrabWalking', 'Running', 'Walking', 'Pointing', 'Spark', 'BreakDancing', 'Jumping']
# Frames past the last one a clip in clawd.ts plays are never drawn: they are left out.
LAST = {}
for m in re.finditer(r"sprite: '(\w+)', from: \d+, to: (\d+)", open(Path(sys.argv[2]).with_name('clawd.ts')).read()):
    LAST[m[1]] = max(LAST.get(m[1], 0), int(m[2]))
# Full-res canvas: props up to 12px left of the body, 8px right for hearts, 4px headroom.
LEFT, RIGHT, TOP = 12, 8, 4
CW, CH = LEFT + 24 + RIGHT, TOP + 16

palette = []
out = {}
EYES = ('#141413', '#000000')


# 3 terminal rows = 6 pixel rows: drop the headroom and the two middle body rows that
# most nearly repeat the row above them (never one holding an eye, never two adjacent).
def squash(frames):
    def cost(r):
        c = 0
        for f in frames:
            if any(ch != '.' and palette[ord(ch) - 97] in EYES for ch in f[r]):
                return 10 ** 9
            c += sum(a != b for a, b in zip(f[r], f[r - 1]))
        return c
    # Only the middle of the body may go: the head (eyes) and the legs always stay.
    mid = range(TOP // 2 + 2, TOP // 2 + 6)
    drop = min(((a, b) for a in mid for b in mid if b > a + 1), key=lambda p: cost(p[0]) + cost(p[1]))
    keep = [r for r in range(TOP // 2, CH // 2) if r not in drop]
    return [[f[r] for r in keep] for f in frames]

for name in USE:
    s = d[name]
    w, h = s['w'], s['h']
    x0, y0 = s['a0'][0], s['a0'][1]
    mx0 = w - (x0 + 24)  # body box x after mirroring
    frames = []
    for fr in s['frames'][:LAST[name] + 1]:
        canvas = [['.'] * CW for _ in range(CH)]
        for i, ch in enumerate(fr):
            if ch == '.':
                continue
            x, y = w - 1 - i % w, i // w
            cx, cy = x - mx0 + LEFT, y - y0 + TOP
            if 0 <= cx < CW and 0 <= cy < CH:
                color = s['palette'][int(ch, 36)].lower()
                if color not in palette:
                    palette.append(color)
                canvas[cy][cx] = 'abcdefghijklmnopqrstuvwxyz'[palette.index(color)]
        frames.append([''.join(canvas[y][x] for x in range(0, CW, 2)) for y in range(0, CH, 2)])
    out[name] = squash(frames)

# The laptop bobs a pixel as Clawd types, which halving turns into the laptop flickering
# between two shapes: hold it still, lid and base, from where it lands to where he lifts
# it, in front of his hands so they never cover the keyboard.
gray = 'abcdefghijklmnopqrstuvwxyz'[palette.index('#8b8b8b')]
for i in range(15, 35):
    f = [list(r.replace(gray, '.')) for r in out['Laptop'][i]]
    for y, x in [(4, 3), (5, 4), (5, 5), (5, 6)]:
        f[y][x] = gray
    out['Laptop'][i] = [''.join(r) for r in f]

# Typing at four speeds, all on the laptop sprite's own stroke (on the keys, on the keys,
# a pixel up): resting on the keys (low), a pixel up (mid), up by his face (high), over
# his head (top). The clips in clawd.ts play TYPING's sheets in this order.
body, hand = ('abcdefghijklmnopqrstuvwxyz'[palette.index(c)] for c in ('#d97757', '#be684d'))
HAND = {'low': [(4, 5), (4, 6)], 'mid': [(3, 5), (3, 6)], 'high': [(2, 5), (2, 6)], 'top': [(1, 5), (1, 6)]}
STROKE = ['low', 'low', 'mid']
TYPING = [
    ['low'] * 6 + ['mid', 'low'],              # waiting on the model: a tap now and then
    STROKE,                                    # calm clicks
    STROKE,                                    # fast: the same stroke, quicker
    STROKE * 2 + ['high', 'low', 'top', 'low'],  # fast and hard: strikes to his face and over his head
]


def typing(pose):
    f = [list(r) for r in out['Laptop'][17]]
    for y, x in [(2, 5), (2, 6), (3, 5), (4, 4), (4, 5)]:
        f[y][x] = '.'
    f[3][6] = f[4][6] = body                   # his arm, up to the hand
    if pose == 'top':
        f[2][6] = body
    for y, x in HAND[pose]:
        f[y][x] = hand
    return [''.join(r) for r in f]


out['LaptopType'] = [typing(p) for sheet in TYPING for p in sheet]



# Drawn here, at the band's own scale: props on the 6 free columns left of Clawd. Letters in the art below map to colours.
INK = {
    'a': '#d97757', 'b': '#141413', 'c': '#be684d',                     # Clawd
    'r': '#d04648', 'o': '#d27d2c', 'y': '#dad45e',                     # flame
    'l': '#854c30', 's': '#757161', 'e': '#442434',                     # logs, stones, char
    'w': '#faf7e5', 'g': '#cfcabb', 'm': '#8b8b8b',                     # sheets of context, packed
    'k': '#b8c0cc', 'h': '#6b7280',                                     # the press
}


def ink(rows):
    def letter(ch):
        if ch == '.':
            return '.'
        color = INK[ch]
        if color not in palette:
            palette.append(color)
        return 'abcdefghijklmnopqrstuvwxyz'[palette.index(color)]
    return [''.join(letter(ch) for ch in r) for r in rows]


# Clawd facing out, arms down, held out to the props or one raised; `dy` presses him a pixel down.
def clawd(arm='down', dy=0):
    rows = ['aaaaaaaa', 'abaaaaba', 'aaaaaaaaaaaa', 'aaaaaaaa', 'a.a..a.a', 'a.a..a.a']
    rows = [(' ' * (6 if len(r) == 12 else 8) + r) for r in rows]
    if arm == 'out':     # the near hand held out to the fire
        rows[2] = ' ' * 5 + 'aaaaaaaaaaaaa'
    elif arm == 'up':    # the near hand up by his face
        rows[1] = ' ' * 6 + 'aaabaaaaba'
        rows[2] = ' ' * 8 + 'aaaaaaaaaa'
    if dy:               # squashed a pixel: the body loses a row, the arms widen
        rows = [' ' * 22, rows[0], rows[1], ' ' * 5 + 'a' * 14, rows[4], rows[5]]
    return [r.replace(' ', '.').ljust(22, '.') for r in rows]


def over(base, prop, x0=0):
    out_rows = []
    for y, row in enumerate(base):
        line = list(row)
        for i, ch in enumerate(prop[y] if y < len(prop) else ''):
            if ch != '.':
                line[x0 + i] = ch
        out_rows.append(''.join(line))
    return out_rows


# Warming: Clawd sits at a campfire, warms his hands and now and then tosses a log in.
# Drawn in tools/campfire (a 17x12 grid, one cell a pixel here); squashed to six rows by
# dropping the rows a pose can spare, so the head, the eyes and the hands stay.
sys.path.insert(0, str(Path(__file__).resolve().parent / 'campfire'))
import make as fire_art      # noqa: E402
import make_v2 as fire_v2    # noqa: E402

# Art rows each pose keeps (of 12), top to bottom: sitting drops a body row, standing
# keeps the shape of the band's standing Clawd, crouching keeps one leg row.
ROWS = {'sit': [5, 6, 7, 8, 9, 11], 'stand': [4, 5, 6, 8, 10, 11], 'crouch': [5, 6, 7, 9, 10, 11]}
FIRE_DX = 1  # art column 7 (Clawd's head) lands on the band's column 8


def from_art(f, pose='sit'):
    rows = []
    for y in ROWS[pose]:
        line = ['.'] * (CW // 2)
        for x, c in enumerate(f[y]):
            if c != '.':
                color = fire_art.PAL[c].lower()
                if color not in palette:
                    palette.append(color)
                line[x + FIRE_DX] = 'abcdefghijklmnopqrstuvwxyz'[palette.index(color)]
        rows.append(''.join(line))
    return rows


def held(frames, ms):
    """Repeats each (frame, pose) for its duration in loop ticks, so one fps plays it."""
    return [from_art(f, pose) for (f, pose), d in zip(frames, ms) for _ in range(max(1, round(d / fire_art.TICK)))]


INTRO_POSES = ['stand', 'crouch', 'sit', 'sit']
OUTRO_POSES = ['sit', 'sit', 'crouch', 'stand']
intro = held([(f, p) for (f, _), p in zip(fire_art.INTRO, INTRO_POSES)], [d for _, d in fire_art.INTRO])
# Sitting by the fire warming his hands loops; tossing a log in is its own sprite, which
# the band plays between those loops now and then.
out['Campfire'] = intro + [from_art(f) for f in fire_v2.IDLE]
out['CampfireLog'] = [from_art(f) for f in fire_v2.LOG]
out['CampfireOut'] = held([(f, p) for (f, _), p in zip(fire_art.OUTRO, OUTRO_POSES)], [d for _, d in fire_art.OUTRO])
print('campfire: intro', len(intro), 'loop', len(fire_v2.IDLE), 'log', len(fire_v2.LOG), 'out', len(out['CampfireOut']))


# Compaction: sheets of context drop onto a pile, a press slams it into a block and lifts.
# The pile is 6 wide, bottom-aligned; `press` is the plate's row (-1: lifted out of view).
SHEETS = ['wwwww.', '.ggggg']
def pile(n_sheets, packed, press=-1, falling=-1):
    rows = ['......'] * 6
    for i in range(n_sheets):
        rows[5 - packed - i] = SHEETS[i % 2]
    for i in range(packed):
        rows[5 - i] = 'mmmmmm' if i % 2 == 0 else 'gmgmgm'
    if falling >= 0:
        rows[falling] = 'wwwww.' if rows[falling] == '......' else rows[falling]
    if press >= 0:
        rows[press] = 'kkkkkk'
        for y in range(press):
            rows[y] = '..hh..'
    return rows


def compact_cycle(packed):
    """One press: three sheets fall in, the press comes down, squeezes them into one
    packed row, and lifts."""
    f = []
    for n in range(3):
        for y in range(0, 5 - packed - n, 2):
            f.append(ink(over(clawd(), pile(n, packed, falling=y))))
        f.append(ink(over(clawd('up' if n == 2 else 'down'), pile(n + 1, packed))))
    for y in range(0, 5 - packed - 3 + 1):          # the plate comes down onto the pile
        f.append(ink(over(clawd('up'), pile(3, packed, press=y))))
    top = 5 - packed - 3
    f.append(ink(over(clawd('up', dy=1), pile(2, packed, press=top + 1))))
    f.append(ink(over(clawd('up', dy=1), pile(1, packed + 1, press=top + 2))))
    f.append(ink(over(clawd('up', dy=1), pile(0, packed + 1, press=top + 3))))
    for y in range(top + 2, -1, -1):                 # and lifts
        f.append(ink(over(clawd(), pile(0, packed + 1, press=y))))
    return f

compact = [ink(over(clawd(), pile(0, 0)))]
compact += compact_cycle(0)
out['Compact'] = compact + compact_cycle(1)       # loops on the second press, from a packed row
out['CompactOut'] = [ink(over(clawd(a, dy=d), p)) for a, d, p in [
    ('down', 0, pile(0, 2)), ('down', 0, ['......'] * 3 + ['......', '.mmmm.', '.gmgm.']),
    ('down', 0, ['......'] * 4 + ['..mm..', '..mm..']), ('up', 0, ['......'] * 4 + ['..mm..', '..mm..']),
    ('up', 1, ['......'] * 4 + ['..mm..', '..mm..']), ('up', 0, ['......'] * 4 + ['..mm..', '..mm..']),
    ('down', 0, ['......'] * 4 + ['..mm..', '..mm..']), ('down', 0, ['......'] * 6)]]


lines = [
    '// Clawd\'s animations from Claude Desktop (clawdQuestEngine), © Anthropic: mirrored and',
    '// halved and squashed to three rows by gen_anims.py. Rows of palette letters, \'.\' clear.',
    '// Generated; edit the generator, not this file.',
    '',
    f'export const PALETTE = {json.dumps(palette)}',
    '',
    f'export const COLS = {CW // 2}',
    'export const ROWS = 3',
    '',
    'export const SPRITES: Record<string, string[][]> = {',
]
for name, frames in out.items():
    lines.append(f'  {name}: [')
    for f in frames:
        lines.append('    ' + json.dumps(f) + ',')
    lines.append('  ],')
lines.append('}')
open(sys.argv[2], 'w').write('\n'.join(lines) + '\n')
print('palette', palette, 'frames', sum(len(v) for v in out.values()))
