# v2: livelier hands, poking the fire with a stick, tossing a log in.
# Same grid, palette and checks as make.py; every sheet starts and ends in the rest pose,
# so idle, poke and log can be chained in any order (and with the v1 intro/outro).
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import make
from make import grid, layers, render, save, check, hands, SIT, FIRE, FIRE_MED, BLANK, TICK
make.OUT = Path(__file__).resolve().parent  # save() writes next to this script

def cells(pts):
    f = [list(r) for r in BLANK]
    for x, y, c in pts:
        f[y][x] = c
    return [''.join(r) for r in f]

def frame(t, near=(8, 9), far=(), x=4, fire=None, props=(), blink=False):
    body = SIT if not blink else layers(SIT, cells([(6, 6, 'B'), (10, 6, 'B')]))
    return layers(fire or FIRE[(t // 2) % 4], cells(props), body, hands(list(near), list(far), x))

BASE = 'kwdwk'
BIG = [grid(r + [BASE]) for r in (
    ['..r..', '.rr..', '.ror.', '.ryr.', 'royor', 'ryyyr'],
    ['..r..', '..rr.', '.ror.', 'rryr.', 'ryyor', 'royyr'],
)]
NEW_LOG = grid(['.www.', BASE])                    # fresh log lying across the fire
DIP = layers(NEW_LOG, grid(['..r..', '', '']))     # flame smothered by the log
DIP2 = layers(NEW_LOG, grid(['.r.r.', '', '']))

# hand poses: (near rows, far rows)
A, R, C = ([8], [9]), ([8, 9], []), ([9], [8])     # rubbing, as in v1
O, WIDE = ([9], [7]), ([10], [7])                  # palms opened to the fire

IDLE = [frame(t, *h, blink=t == 13) for t, h in enumerate([A, R, C, R, A, R, C, R, O, WIDE, O, WIDE, O, R, C, R])]

UP = [(3, 7, 'w'), (2, 6, 'w'), (1, 5, 'o')]   # stick raised, its tip glowing
IN = [(3, 9, 'w'), (2, 10, 'd')]               # charred tip pushed into the embers
MID = [(3, 8, 'w'), (2, 8, 'w'), (1, 8, 'd')]
POKE = [frame(t, near, (), props=p) for t, (near, p) in enumerate([
    ([10], []),                                          # reach for the stick
    ([8], MID),
    ([8], UP),
    ([9], IN + [(2, 6, 'y')]),
    ([9], IN + [(1, 5, 'y'), (3, 6, 'o')]),
    ([8], UP + [(1, 3, 'o'), (3, 4, 'y')]),
    ([9], IN + [(2, 6, 'y'), (3, 2, 'o')]),
    ([9], IN + [(1, 5, 'o'), (3, 4, 'y')]),
    ([8], UP + [(2, 3, 'y')]),
    ([8], MID + [(1, 2, 'o')]),
    ([9], IN + [(3, 5, 'y')]),
    ([8], MID + [(2, 3, 'o')]),
    ([8], UP),
    ([8], MID),
    ([10], []),                                          # put it down
])] + [frame(15, *R)]

def log(y, x0=1):
    return [(x, y, 'w') for x in range(x0, x0 + 3)]

SPARKS = [[(1, 4, 'y'), (3, 2, 'o')], [(3, 3, 'y'), (1, 1, 'o')], [(2, 2, 'y'), (4, 4, 'o')]]
LOG = [
    frame(0, [10]),                                          # reach for a log
    frame(1, [8], x=5, props=log(8, 2)),                     # grab it
    frame(2, [7], x=5, props=log(6, 2)),                     # lift
    frame(3, [6], x=5, props=log(5, 2)),                     # aim over the fire
    frame(4, [7], props=log(6)),                             # toss
    frame(5, [8], props=log(8)),
    frame(6, [8], fire=DIP, props=[(2, 7, 'k')]),            # lands, smothers the flame
    frame(7, *R, fire=DIP2, props=[(1, 6, 'k'), (3, 7, 'k')]),
    frame(8, *R, fire=FIRE_MED, props=[(2, 4, 'k'), (1, 5, 'k')]),
    frame(9, [8], [7], x=5, fire=BIG[0], props=SPARKS[0]),   # flares up, hands pulled back
    frame(10, [8], [7], x=5, fire=BIG[1], props=SPARKS[1]),
    frame(11, [8], [7], x=5, fire=BIG[0], props=SPARKS[2]),
    frame(12, *A, x=5, fire=BIG[1]),
    frame(13, *R),
    frame(14, *C),
    frame(15, *R),
]

if __name__ == '__main__':
    for name, fr in (('', IDLE), ('-poke', POKE), ('-log', LOG), ('-all', IDLE + POKE + IDLE + LOG)):
        check(save(f'clawd-campfire-v2{name}', fr, [TICK] * len(fr)), len(fr))
    print('ok')
