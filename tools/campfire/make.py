# Clawd warming his hands at a campfire: pixel-art sprite sheets + preview GIFs.
# Art is drawn on a 17x12 grid and doubled to 34x23 (top grid row keeps 1px),
# which is the grid the laptop reference uses, so every detail is >= 2px and halving is lossless.
from pathlib import Path
from PIL import Image, ImageColor

OUT = Path(__file__).parent
W, H = 34, 23
PAL = {
    'B': '#d97757', 's': '#be684d', 'e': '#141413',              # Clawd
    'y': '#dad45e', 'o': '#d27d2c', 'r': '#d04648',              # flame (campfire reference)
    'w': '#854c30', 'd': '#442434', 'k': '#4e4a4e',              # logs, stones / smoke
}
TICK = 90  # ms per loop frame, ~11 fps (GIF delays are whole 10 ms)

def grid(rows):
    return [r.ljust(17, '.') for r in [''] * (12 - len(rows)) + rows]

def put(base, layer, dx=0, dy=0):
    out = [list(r) for r in base]
    for y, row in enumerate(layer):
        for x, c in enumerate(row):
            if c != '.' and 0 <= y + dy < 12 and 0 <= x + dx < 17:
                out[y + dy][x + dx] = c
    return [''.join(r) for r in out]

BLANK = ['.' * 17] * 12

STAND = grid([
    '.......BBBBBBBB',
    '.......BeBBBBeB',
    '.....BBBBBBBBBBBB',
    '.....BBBBBBBBBBBB',
    '.......BBBBBBBB',
    '.......BBBBBBBB',
    '.......B.B..B.B',
    '.......B.B..B.B',
])
CROUCH = grid([
    '.......BBBBBBBB',
    '.......BeBBBBeB',
    '.....BBBBBBBBBBBB',
    '.....BBBBBBBBBBBB',
    '.......BBBBBBBB',
    '.......BBBBBBBB',
    '.......B.B..B.B',
])
SIT = grid([
    '......BBBBBBss',
    '......eBBBeBss',
    '......BBBBBBss',
    '......BBBBBBss',
    '......BBBBBBss',
    '......BBBBBBss',
    '......B.B..B.s',
])

# hands in front of the body: near hand B, far hand s (as in the typing frames)
def hands(near, far, x=4):
    out = BLANK
    for rows, c in ((far, 's'), (near, 'B')):  # near hand drawn on top
        out = put(out, [('.' * x + c * (6 - x)) if y in rows else '' for y in range(12)])
    return out

HANDS = [
    hands(near=[8], far=[9]),     # near up, far down
    hands(near=[8, 9], far=[]),   # palms together
    hands(near=[9], far=[8]),     # near down, far up
    hands(near=[8, 9], far=[]),
]

LOGS = grid(['kwdwk'])
FIRE = [grid(r + ['kwdwk']) for r in (
    ['..r..', '.rr..', '.ror.', '.ryr.'],
    ['.....', '..r..', '.ryr.', '.ryr.'],
    ['..r..', '..rr.', '.ror.', '.ryr.'],
    ['.....', '.rr..', '.ror.', 'rryr.'],
)]
FIRE_MED = grid(['..r..', '.ror.', '.ryr.', 'kwdwk'])
FIRE_LOW = grid(['..r..', '.ryr.', 'kwdwk'])
EMBERS = grid(['kwowk'])

def layers(*ls):
    f = BLANK
    for l in ls:
        f = put(f, l)
    return f

# loop: hands rub every tick, fire flickers every 2 ticks -> 16 frames, seamless
LOOP = [layers(FIRE[(t // 2) % 4], SIT, HANDS[t % 4]) for t in range(16)]

SMOKE1 = grid(['.k...', '..k..', '', '', ''])
SMOKE2 = grid(['..k..', '.k...', '', '', '', '', ''])
INTRO = [
    (layers(LOGS, STAND), 300),
    (layers(LOGS, grid(['..y..', '']), CROUCH), 200),
    (layers(FIRE_LOW, SIT, hands(near=[10], far=[])), 200),
    (layers(FIRE_MED, SIT, hands(near=[9], far=[])), 200),
]
OUTRO = [
    (layers(FIRE_MED, SIT, hands(near=[8, 9], far=[])), 200),
    (layers(FIRE_LOW, SIT, hands(near=[10], far=[])), 250),
    (layers(EMBERS, SMOKE1, CROUCH), 250),
    (layers(LOGS, SMOKE2, STAND), 400),
]

def render(f):
    assert len(f) == 12 and all(len(r) == 17 for r in f)
    img = Image.new('RGBA', (W, H))
    for y in range(H):
        for x in range(W):
            c = f[(y + 1) // 2][x // 2]
            if c != '.':
                img.putpixel((x, y), ImageColor.getrgb(PAL[c]) + (255,))
    return img

def save(name, frames, durations, zoom=12):
    imgs = [render(f) for f in frames]
    sheet = Image.new('RGBA', (W * len(imgs), H))
    for i, im in enumerate(imgs):
        sheet.paste(im, (i * W, 0))
    sheet.save(OUT / f'{name}-sheet.png')
    pal = [0, 0, 0] + [v for c in PAL.values() for v in ImageColor.getrgb(c)]
    idx = {ImageColor.getrgb(c): i + 1 for i, c in enumerate(PAL.values())}
    gif = []
    for im in imgs:
        p = Image.new('P', im.size)
        p.putpalette(pal)
        p.putdata([idx[px[:3]] if px[3] else 0 for px in im.get_flattened_data()])
        gif.append(p.resize((W * zoom, H * zoom), Image.NEAREST))
    gif[0].save(OUT / f'{name}.gif', save_all=True, append_images=gif[1:], duration=durations,
                loop=0, transparency=0, disposal=2, optimize=False)
    return sheet

def check(sheet, n):
    assert sheet.size == (W * n, H)
    clawd = {PAL[c] for c in 'Bse'}
    fire = {PAL[c] for c in 'yorwdk'}
    assert len(fire) <= 6
    allowed = {ImageColor.getrgb(c) for c in clawd | fire}
    for px in sheet.get_flattened_data():
        assert px[3] in (0, 255) and (px[3] == 0 or px[:3] in allowed), px
    # halving and doubling back on the art grid must reproduce the sheet exactly
    half = Image.new('RGBA', (sheet.width // 2, 12))
    for y in range(12):
        for x in range(sheet.width // 2):
            half.putpixel((x, y), sheet.getpixel((2 * x, max(2 * y - 1, 0))))
    for y in range(H):
        for x in range(sheet.width):
            assert sheet.getpixel((x, y)) == half.getpixel((x // 2, (y + 1) // 2))

if __name__ == '__main__':
    check(save('clawd-campfire', LOOP, [TICK] * len(LOOP)), len(LOOP))
    check(save('clawd-campfire-intro', [f for f, _ in INTRO], [d for _, d in INTRO]), len(INTRO))
    check(save('clawd-campfire-outro', [f for f, _ in OUTRO], [d for _, d in OUTRO]), len(OUTRO))
    print('ok')
