<div align="center">

<img src="assets/clawd-wave.svg" height="60" alt="Clawd машет">

# cozy-clawd

**Контекст, кеш и лимиты одним взглядом, прямо над полем ввода Claude Code.<br>И маленький Clawd, который не даёт кешу остыть.**

[English](README.md) · Русский

<img src="assets/hero.svg" alt="Панель cozy-clawd: полосы контекста, кеша и лимитов, рядом танцует Clawd">

![version](https://img.shields.io/badge/version-0.1.0--beta-d97757)
![claude code](https://img.shields.io/badge/Claude%20Code-2.1.275%2B-1f2125)
![license](https://img.shields.io/badge/license-MIT-5ad19a)

</div>

## Установка

Нужен [Claude Code](https://docs.claude.com/en/docs/claude-code) версии 2.1.275 или новее (`claude --version`).

**1. Установи.** В сессии Claude Code выполни:

```
/plugin install cozy-clawd --marketplace evrytests-maker/cozy-clawd
```

Или из терминала:

```bash
claude plugin install cozy-clawd --marketplace evrytests-maker/cozy-clawd
```

**2. Перезапусти Claude Code** (или выполни `/reload-plugins`). Над полем ввода появится панель. Всё уже лежит в репозитории: ничего настраивать и докачивать не надо.

**3. Кликни по Clawd**, если хочешь, чтобы он грел кеш.

<details>
<summary>Старый Claude Code или по-длинному</summary>

```
/plugin marketplace add evrytests-maker/cozy-clawd
/plugin install cozy-clawd@cozy-clawd
```

</details>

<details>
<summary>Попробовать без установки</summary>

```bash
git clone https://github.com/evrytests-maker/cozy-clawd
claude --plugin-dir ./cozy-clawd
```

</details>

<details>
<summary>Обновить, выключить, удалить</summary>

```bash
claude plugin marketplace update cozy-clawd   # подтянуть свежую версию
claude plugin update cozy-clawd@cozy-clawd    # потом перезапустить Claude Code
claude plugin disable cozy-clawd@cozy-clawd   # временно спрятать панель
claude plugin uninstall cozy-clawd@cozy-clawd # удалить совсем
```

</details>

## Что на панели

```
  ctx ━━━─────── 23%  cache ━━━━━━━━━─ 92%
   5h ━━━━────── 37%  7d ━━──────── 17%
  Opus 5.5 high · cache 52m left · $0.42 · Clawd: warm
```

| Строка | Что показывает |
| --- | --- |
| 1 | **ctx** — насколько заполнен контекст, считая от окна автосжатия. Клик по проценту покажет токены (`48k/1M`), ещё один вернёт процент. **cache** — какая доля последнего запроса прочитана из кеша. |
| 2 | Лимиты подписки **5h** и **7d**. Клик по проценту покажет, когда лимит сбросится (`3h23m`), ещё один вернёт процент. С API-ключом строки нет. |
| 3 | Модель и уровень рассуждения, сколько ещё проживёт кеш (на подписке он живёт час), сколько потрачено и `Clawd: warm`, если Clawd следит за кешем. |

Полосы зеленеют, желтеют и краснеют по мере заполнения, у кеша наоборот. Значения плавно доезжают до новых, а пока Claude отвечает, по полосам бежит блик.

Интерфейс панели на английском.

## Знакомься, Clawd

<img src="assets/clawd-dance.svg" height="50" align="right" alt="Clawd танцует">

Clawd сидит справа от полос и реагирует на то, что происходит в сессии.

| | Когда | Что делает |
| --- | --- | --- |
| <img src="assets/clawd-laptop.svg" height="30"> | Claude отвечает | стучит по ноутбуку |
| <img src="assets/clawd-dance.svg" height="30"> | ответ готов, из кеша ≥ 80% | танцует, летят сердечки |
| <img src="assets/clawd-facepalm.svg" height="30"> | упал вызов инструмента | фейспалм |
| <img src="assets/clawd-compact.svg" height="30"> | `/compact` или автосжатие | пресс уминает листы контекста в маленький кубик |
| <img src="assets/clawd-campfire.svg" height="30"> | прогревает кеш | сидит у костра, греет руки, иногда подкидывает полено |
| <img src="assets/clawd-meditate.svg" height="30"> | кеш протух | медитирует, над ним летят `z` |
| <img src="assets/clawd-crab.svg" height="30"> | ничего не происходит | оглядывается, машет, ходит крабом, танцует хулу… |

## Тёплый кеш

<img src="assets/clawd-campfire.svg" height="50" align="right" alt="Clawd греется у костра">

На подписке кеш промпта живёт час. Если вернуться позже, следующее сообщение заново прочитает весь контекст по полной цене.

**Кликни по Clawd**, и он будет следить за кешем. За 5 минут до конца часа Clawd повторит последний запрос сессии с ответом в один символ. Это чтение из кеша, и час начнётся заново. Подряд он делает так не больше 3 раз, то есть держит кеш около 4 часов простоя, а потом отпускает. Ещё один клик выключает слежку.

Пока он следит, Clawd всё время сидит у костра: греет руки и каждые несколько секунд подкидывает полено, огонь вспыхивает. Отходит он только к ноутбуку, пока Claude отвечает. Ещё один клик, и костёр гаснет.

Каждый прогрев немного тратит лимиты на чтение кеша. С API-ключом кеш живёт 5 минут, и прогрев там не нужен.

## Полезно знать

- Пустая строка между панелью и линией ввода принадлежит Claude Code: там появляются уведомления вроде `● high · /effort`. Плагин не может в ней рисовать.
- Кеш считается по основному разговору: у сабагентов кеш свой.
- Если вместе с ним включён старый плагин `session-meter`, панель рисует он.
- В приложении Claude Desktop Clawd рисуется картинкой, по ней не кликнуть. Слежку за кешем там включает кнопка `Clawd: off` / `Clawd: warm` в конце третьей строки.

## Разработка

<img src="assets/clawd-hula.svg" height="50" align="right" alt="Clawd танцует хулу">

```bash
git clone https://github.com/evrytests-maker/cozy-clawd
claude --plugin-dir ./cozy-clawd       # попробовать в сессии
claude plugin validate ./cozy-clawd
claude plugin test ./cozy-clawd
```

| Путь | Что там |
| --- | --- |
| `hooks/register.tsx` | панель, слежка за кешем, цикл анимации |
| `hooks/clawd.ts` | какая анимация когда, сердечки, отрисовка полублоками |
| `hooks/clawd-anims.ts` | все кадры, генерируется |
| `tools/extract_sprites.py` | достаёт исходные спрайты в `sprites.json` |
| `tools/gen_anims.py` | собирает `clawd-anims.ts`; здесь нарисован пресс, костёр берётся из `tools/campfire/` |
| `tools/gen_svgs.py` | рисует картинки в `assets/` из кадров |

После изменения анимаций:

```bash
python3 tools/gen_anims.py sprites.json hooks/clawd-anims.ts
python3 tools/gen_svgs.py hooks/clawd-anims.ts assets
```

## Лицензия

[MIT](LICENSE)

<div align="center"><img src="assets/clawd-meditate.svg" height="40" alt="Clawd медитирует"></div>
