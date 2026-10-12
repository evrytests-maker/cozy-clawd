"""Turn the extracted Claude Desktop sprites into the mod's hooks/clawd-anims.ts.

Every sprite is mirrored (props on Clawd's left, as the desktop draws him sitting on
the composer), placed so its body box (a0, 24x16) lands on one canvas spot, then
halved by taking the top-left pixel of each 2x2 block aligned to that body box.
usage: python3 -I gen_anims.py sprites.json out.ts
"""
import json
import sys

d = json.load(open(sys.argv[1]))
USE = ['LookingAround', 'LookingAroundEyesOnly', 'Swaying', 'Turning', 'Waving', 'DancingHappy',
       'Excited', 'Disappointed', 'Dizzy', 'Facepalm', 'Meditating', 'Laptop', 'Hula',
       'CrabWalking', 'Running', 'Walking', 'Pointing', 'Spark', 'Confetti', 'BreakDancing', 'Jumping']
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
    for fr in s['frames']:
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



# Drawn here, at the band's own scale: props on the 6 free columns left of Clawd. Letters in the art below map to colours.
INK = {
    'a': '#d97757', 'b': '#141413', 'c': '#be684d',                     # Clawd
    'r': '#d04648', 'o': '#d27d2c', 'y': '#dad45e',                     # flame (krial's CC0 campfire)
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


# Warming: a campfire, after krial's CC0 16x16 one (opengameart.org/content/16x16-animated-campfire),
# redrawn 5x6. Lit from embers, flickering while the guard warms the cache, then dying down.
EMBERS = ['lrlrl', 's.e.s']
FLAMES = [
    ['..r..', '.ror.', 'royor', 'royyr'],
    ['.r...', '.rro.', 'rooyr', 'royyr'],
    ['...r.', '..or.', 'royor', 'ryyor'],
    ['..r..', '..r..', '.ror.', 'royyr'],
]
LIT = [['.....'] * 4, ['.....'] * 3 + ['..r..'], ['.....'] * 2 + ['..r..', '.ror.'], ['.....', '..r..', '.ror.', 'royor']]
def fire(flame):
    return flame + EMBERS

campfire = [ink(over(clawd(), fire(f))) for f in LIT]
for i in range(16):                               # hands out, then rubbed by the face
    arm = 'out' if (i // 4) % 2 == 0 else 'up'
    campfire.append(ink(over(clawd(arm), fire(FLAMES[i % 4]))))
out['Campfire'] = campfire
out['CampfireOut'] = [ink(over(clawd(a), fire(f))) for a, f in
                      [('out', FLAMES[3]), ('out', LIT[3]), ('down', LIT[2]), ('down', LIT[1]), ('down', LIT[0]),
                       ('down', ['.....'] * 4), ('down', ['.....'] * 4)]]


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
