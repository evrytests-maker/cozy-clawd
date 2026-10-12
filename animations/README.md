# Clawd's animations

Every clip Clawd plays on the band, frame by frame as the band draws them. Hearts, sparks and other glyphs drawn over him are left out.

## While Claude answers

| | Clip | When |
|---|---|---|
| <img src="laptop.svg" height="60" alt="laptop"> | `laptop` | sets down the laptop |
| <img src="type0.svg" height="60" alt="type0"> | `type0` | types, the slowest: under 15 characters a second |
| <img src="type1.svg" height="60" alt="type1"> | `type1` | types faster: 15 to 100 a second |
| <img src="type2.svg" height="60" alt="type2"> | `type2` | faster still: 100 to 250 a second, a swing and then two hard clicks, 2 and 3 pixels up |
| <img src="type3.svg" height="60" alt="type3"> | `type3` | flat out: over 250 a second, keys clicking |
| <img src="laptopOut.svg" height="60" alt="laptopOut"> | `laptopOut` | packs the laptop away when the answer is done |

## When an answer is done

| | Clip | When |
|---|---|---|
| <img src="dance.svg" height="60" alt="dance"> | `dance` | 80% or more from the cache, with hearts |
| <img src="excited.svg" height="60" alt="excited"> | `excited` | 50 to 80% from the cache, or no reading yet |
| <img src="disappointed.svg" height="60" alt="disappointed"> | `disappointed` | under 50% from the cache |
| <img src="facepalm.svg" height="60" alt="facepalm"> | `facepalm` | a tool call failed |

## Moods

| | Clip | When |
|---|---|---|
| <img src="meditate.svg" height="60" alt="meditate"> | `meditate` | the cache expired: meditates under drifting z's |
| <img src="dizzy.svg" height="60" alt="dizzy"> | `dizzy` | context or the 5h limit at 85% or more, sweating |

## Warm mode

| | Clip | When |
|---|---|---|
| <img src="campfire.svg" height="60" alt="campfire"> | `campfire` | sits down and lights a fire |
| <img src="campfireSit.svg" height="60" alt="campfireSit"> | `campfireSit` | warms his hands, sparks rise |
| <img src="campfireLog.svg" height="60" alt="campfireLog"> | `campfireLog` | tosses a log in now and then |
| <img src="campfireOut.svg" height="60" alt="campfireOut"> | `campfireOut` | the fire dies down, he stands up |

## Compaction

| | Clip | When |
|---|---|---|
| <img src="compact.svg" height="60" alt="compact"> | `compact` | sheets of context drop onto a pile, a press packs them |
| <img src="compactOut.svg" height="60" alt="compactOut"> | `compactOut` | a little cube is left, Clawd hops |

## Idle, one at random every 5 to 13 seconds

| | Clip | When |
|---|---|---|
| <img src="idle.svg" height="60" alt="idle"> | `idle` | stands |
| <img src="lookAround.svg" height="60" alt="lookAround"> | `lookAround` | looks around |
| <img src="eyes.svg" height="60" alt="eyes"> | `eyes` | glances about |
| <img src="sway.svg" height="60" alt="sway"> | `sway` | sways |
| <img src="turning.svg" height="60" alt="turning"> | `turning` | turns around |
| <img src="wave.svg" height="60" alt="wave"> | `wave` | waves |
| <img src="hula.svg" height="60" alt="hula"> | `hula` | dances the hula |
| <img src="crab.svg" height="60" alt="crab"> | `crab` | crab-walks |
| <img src="walk.svg" height="60" alt="walk"> | `walk` | walks |
| <img src="run.svg" height="60" alt="run"> | `run` | runs on the spot |
| <img src="point.svg" height="60" alt="point"> | `point` | points |
| <img src="breakdance.svg" height="60" alt="breakdance"> | `breakdance` | breakdances |
| <img src="spark.svg" height="60" alt="spark"> | `spark` | sparkles |
| <img src="jump.svg" height="60" alt="jump"> | `jump` | jumps |

Drawn by `python3 -I tools/gen_svgs.py hooks/clawd-anims.ts assets animations`.
