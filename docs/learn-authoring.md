# Writing Learn lessons

This is the standard for every lesson in the Learn course. Read it all before writing. The pilot
module, `src/data/learn/modules/roundabouts.json`, is the worked example: match its shape, voice and
density. The curriculum (what each module covers, and the bank questions it must teach) is in
[`learn-curriculum.md`](learn-curriculum.md).

## What the course is

A learner who speaks limited Spanish is preparing for the Spanish permiso B theory test. Each module
is a few short lessons; each lesson is 4 to 6 paged steps with checks; each module ends in a quiz.
Spanish is the language of the exam, so Spanish comes first, with English one tap away. Every string is
`{ "es": "...", "en": "..." }`.

## How the course teaches (and what that asks of you)

| Technique | Evidence | What you do |
|---|---|---|
| **Retrieval practice** (testing effect) | Dunlosky et al. 2013 rate practice testing "high utility" | At least one inline `check` per lesson, usually two or three. They gate "Next". |
| **Spaced review** | Distributed practice, also "high utility" | Nothing extra: every check joins the question bank and is rescheduled by FSRS. |
| **Pretesting** | Kornell, Richland et al.: guessing before learning helps later recall | Give each lesson a `pretest` (an ungraded guess). Its answer **must** be taught in the lesson. |
| **Pretraining of terms** | Mayer, pretraining principle | `terms` (at most 8) are shown before the lesson starts. Pick the words the learner will otherwise stumble on. |
| **Segmenting** | Mayer, segmenting principle | One idea per step. If a step needs two ideas, split it. |
| **Signaling** | Mayer, signaling principle | `**bold**` the one key term or number in a sentence. Do not bold more than that. |
| **Words and pictures** | Mayer, multimedia principle | Use a diagram or sign strip wherever space, movement or a sign is the point. |
| **Coherence** | Mayer, coherence principle | Cut anything decorative. No anecdotes, no filler. |
| **Mastery learning** | Bloom; Khan Academy-style levels | The module quiz needs 80% to count as mastered. Teach so that is achievable. |
| **Interleaving** | Dunlosky: moderate utility | Nothing extra: the quiz mixes in review items from earlier modules. |
| **Worked examples** | Sweller | Use `example` blocks: situation, what to do, why. |
| **Corrective feedback** | Hypercorrection research | Every check's `why` explains the rule, not just "B is correct". Wrong options should be the mistakes people really make. |

## Truth rules (the most important section)

This app tells learners what the law is. A wrong rule is worse than a missing one.

1. **Law first.** Every `rule` block quotes or closely paraphrases a specific article that you have
   read in the BOE text *in this session*, and `src` names it exactly (`RGC art. 57.1.c`). Never cite
   from memory. Never cite an article you have not opened.
2. **Read the wording in force today.** Use `scripts/boe.mjs` (below). It prints only the current
   wording and says which norm it comes from. Many articles changed with RD 970/2020 (urban speed
   limits) and RD 518/2026 (in force from 2026-10-01). If the tool says a later version is not yet in
   force, teach the version in force.
3. **Numbers need a source.** Every speed, distance, age, time, count, point and percentage must be
   read from a primary text in this session. Do not teach fine amounts unless you read them in the Ley.
4. **`rule` is law; `tip` is practice.** Anything that is good teaching but not an article (the
   two-second gap, "go around again", lane choice in a roundabout) is a `tip`, or sits in a `p` that
   says plainly it is the usual practice. Never put it in a `rule` block or give it a BOE `src`.
5. **DGT guidance** may be used only for facts you fetched from a dgt.es page in this session. Say
   "DGT guidance" in `src`. The DGT's own manuals are copyrighted and their legal notice reserves
   reproduction: **do not copy their sentences or structure**. Facts are free; wording is not. Write
   everything in your own words from the law.
6. **If you cannot verify it, leave it out** and say so in your report. Do not guess, round, or
   "remember". An honest gap is fine; a plausible error is not.
7. **Signs and markings are cited to the Catalogue, not to old articles.** Today the meaning of each
   sign is in **RGC Anexo I, ap. 5.1** (Tomo I: code, name and definition of every vertical sign, in
   sections 3.1 to 3.9) and road markings are in **ap. 5.2**. Read them with
   `node scripts/boe.mjs catalogue "R-305"` (it prints the in-force definition from the published text of
   RD 465/2025; the consolidated API only holds the annex's introduction). RGC art.
   134.4 says the Catalogue is part of Anexo I. Cite them as `RGC Anexo I, ap. 5.1, 3.5 (R-305)` or
   `RGC Anexo I, ap. 5.2 (marcas viales)`. Read the definition in the in-force text before you teach it:
   it may differ from what the repealed articles said (and from older sources, books and videos).
   `npm run check` fails any citation of RGC arts. 159 to 173, or of 151 to 158 for a sign.
8. **No local rules.** Teach national law. Municipal and regional variation is a one-line mention
   at most ("councils can set lower limits with signs").
9. **US comparisons** (`us` block) must be true across most of the US, stated modestly ("most US
   states", "usually"). Convert units: 30 km/h is about 19 mph (km/h x 0.62). Leave a `us` block out
   rather than state a comparison you are not sure of.

## Tools

```bash
node scripts/boe.mjs laws                                   # the laws and their BOE ids
node scripts/boe.mjs BOE-A-2003-23514 index                 # every block of the RGC (a57 = article 57, A5 = Anexo I section 5, ...)
node scripts/boe.mjs BOE-A-2003-23514 art 57 58             # SAFEST: every IN-FORCE block titled "Artículo 57" / "Artículo 58"
node scripts/boe.mjs BOE-A-2003-23514 a57                   # one block by id (see the caution below)
node scripts/boe.mjs BOE-A-2003-23514 grep "glorieta"       # in-force blocks that mention a word (repealed ones are left out)
node scripts/boe.mjs BOE-A-2003-23514 repealed              # blocks that are NO LONGER in force, with the date
node scripts/boe.mjs catalogue "R-305"                      # the IN-FORCE sign Catalogue: code, name and definition of a sign, or a marking (RGC Anexo I, ap. 5)
node scripts/boe.mjs original BOE-A-2025-12199 "regex"      # the text as first published (for a decree that amends a law)
```

**Repealed text is not law.** A block printed with `*** REPEALED since ... DO NOT CITE ***` is no longer in
force. Block ids are not article numbers: a new article can reuse a number in a differently named block
(RGC art. 153 today is the bicycle article, block `a1-6`; the old `a153` is repealed). **Cite by article
number only after `art <number>` shows an in-force block with that title**, and never cite a block flagged
REPEALED. In the RGC, the old sign and marking articles **151 to 173 were repealed on 2025-06-17** (RD
465/2025). Articles 151 to 158 are now a *different* set (cyclists, pedestrians, personal mobility vehicles,
parking regime, environmental restrictions, safe school routes); 159 to 173 no longer exist.

Laws: RGC = Reglamento General de Circulación (`BOE-A-2003-23514`); LSV = Ley de Tráfico y Seguridad
Vial (`BOE-A-2015-11722`, its *Anexo I* defines the basic terms and *Anexo II* the points);
RGCond = Reglamento General de Conductores (`BOE-A-2009-9481`); RGV = Reglamento General de
Vehículos (`BOE-A-1999-1826`); Código Penal (`BOE-A-1995-25444`, arts. 379 to 385). The RGC's
annexes hold the signal catalogue. Article ids are `a<number>`; apartados are inside the block.

Other commands:

```bash
npm run check          # validates everything below; run it often
node -e "const q=require('./src/data/questions.json');for(const x of q)console.log(x.id,x.cat,x.es.q)" | grep " roundabouts "   # bank questions of a category
node -e "const s=require('./src/data/signs.json');for(const x of s)console.log(x.id,x.group,x.code,x.es.name)"                   # sign ids
```

## Voice

- **Spanish at about B1.** Sentences of 20 words or fewer, active voice, one idea each, familiar
  words. Address the learner as *tú* ("cedes el paso", "mira a la izquierda"). The official legal word
  goes in **bold** the first time, with its plain explanation next to it ("**ceder el paso** = dejar
  pasar primero"). Avoid long chains of -mente adverbs and subjunctive pile-ups.
- **English plain and American.** Work, color, meter. Not a word-for-word shadow of the Spanish: say it
  the natural way, with the same meaning.
- **Say what to do**, not only what is forbidden. Use "glorieta", "permiso de conducción" ("carnet" is
  colloquial: put it in `terms`, not the prose), "intermitente", "calzada", "arcén".
- Never write "como vimos arriba", "in the previous step", "see the figure": steps are read in order
  but checks must stand alone (see below).
- No emoji, no exclamation marks except in the quiz result strings that already exist.

## Lesson shape

Targets, not quotas. The roundabouts module is the reference.

- **Module:** 2 to 6 lessons. A `title` and a one-sentence `blurb` (the course map shows both).
- **Lesson:** `minutes` 4 to 8 (be honest); 1 to 4 `goals` ("By the end you can ..."); at most 8 `terms`;
  one `pretest`; **3 to 7 steps**; `recap` of 3 to 6 points; `covers` (see curriculum); `src` listing the
  laws the lesson rests on.
- **Step:** a short `title` that names the idea, then blocks. A typical step has a `p`, a `rule` or
  `figure`, and at the end a `check`. Not every step needs a check; every lesson needs at least one.
- **Blocks** (see `src/data/learn/types.ts`): `p`, `rule` (needs `src`), `list`, `table`, `figure`,
  `signs` (official sign ids), `us`, `tip`, `example`, `check`. Use `table` for comparisons (limits by
  road type). Use `signs` whenever a sign is mentioned, so the learner sees it.
- Put the `check` after the content it tests, in the same step.

## Check questions

Checks join the question bank, so Practice and the mock exam draw on them. That makes them exam
questions, not lesson comprehension prompts.

- **Stand-alone.** No "in the figure", "above", "this lesson", "the text". The validator rejects them.
- **Three options, one correct, plausible wrong ones.** Wrong options are the mistakes learners really
  make, often what a US driver would assume. Never "all of the above". Keep options of similar length.
- **The `why` teaches.** One or two sentences that state the rule, so a wrong answer still teaches.
- **`id` is `<module id>-<something>`** and unique across the whole bank (`roundabouts-c1a`). The part
  before the first hyphen is the topic the server groups statistics by.
- **`src`** is the article you read, or `DGT guidance`, or a plain description when it is a teaching
  convention. `terms` lists the Spanish words the question teaches, each with its English.
- **Spread the correct answer across positions.** The validator fails a module where more than half
  the checks put the answer in one slot.
- **Do not duplicate** an existing bank question. Test the same rule from a new angle. The pretest is
  not added to the bank; it needs an `id` but a pretest id must still be unique (use `-pre-1`).

## Figures

A figure is a base SVG in `src/learn-figures/<name>.svg`, drawn by the app inline. A figure may also
have an animation (`<name>.anim.json`) that the Remotion Player plays. Use a figure whenever space,
movement or priority is the point; use `signs` for signs; use neither for pure definitions.
**Name files `<module id>-<what>.svg`.**

### The base SVG

- `viewBox="0 0 360 360"` (or `0 0 360 240` for wide scenes). **No `width`/`height` on the root.**
- **No words.** The only `<text>` allowed holds one or two characters (a letter or number badge).
  Everything else is explained in the lesson's bilingual `legend` (`mark` = the letter or number).
  The validator rejects any text longer than two characters.
- Use only the shared classes (they follow light and dark mode): `f-grass`, `f-island`, `f-road`,
  `f-ring`, `f-curb`, `f-white`, `f-line` (+ `f-dash`), `f-zone`, `f-zone-ok`, `f-path` (arrow, yellow),
  `f-path-plain`, `f-badge`, `f-badge-text`, vehicle tones `f-me` (blue, the learner), `f-other`
  (orange), `f-danger`, `f-ok`, `f-neutral`. Never write a color literal.
- Vehicles are shared shapes, front pointing up, centered on the origin: `<use href="#v-car"
  class="f-me" transform="translate(x y) rotate(deg)"/>` for `v-car`, `v-truck`, `v-moto`, `v-bike`,
  `v-ped`. A car is about 20 x 40, a lane about 28 to 30 wide. Rotation is clockwise degrees (0 up,
  90 right, 180 down). Other `<use>` targets are rejected.
- Draw drive-on-the-right traffic. Keep the road art simple: a lane edge, a dashed centerline, a yield line.
- Give an `id` to any element an animation will fade or draw (`id="route"`).
- **Compute geometry, do not eyeball it.** Write a small throwaway script in the scratchpad that
  emits the SVG (arcs, offsets). See how the roundabout figures were made: a point on a circle is
  `(cx + r cos t, cy - r sin t)`, and a car moving counterclockwise at angle `t` gets `rotate(-t)`.

### Animation (`<name>.anim.json`)

Animate when *movement* teaches the rule (who goes first, how a maneuver unfolds). Skip it when a
still picture is enough. Keep each animation to 4 to 10 seconds and one idea.

```json
{
  "seconds": 7,
  "poster": 2.2,
  "reveals": [{ "id": "route", "from": 0.4, "draw": true }],
  "actors": [
    { "id": "a", "kind": "car", "tone": "other",
      "path": "M96.9 132 A96 96 0 1 0 274.5 163.3", "from": 0.3, "to": 4.3, "ease": "linear",
      "show": [0, 4.6], "badge": { "mark": "A", "dx": -32, "dy": 0 } },
    { "id": "b", "kind": "car", "tone": "me", "at": [195, 336, 0], "badge": { "mark": "B", "dx": 38, "dy": 0 } }
  ]
}
```

- An actor with a `path` (SVG path data) drives along it from `from` to `to`, facing the direction of
  travel; before `from` it waits at the start, after `to` it stays at the end. An actor with no `path`
  is parked at `at: [x, y, rotation]`. `ease` is `inOut` (default) or `linear`. `show: [from, to]`
  limits when it is visible. `badge` pins a letter or number to it.
- `reveals` fade in an element of the base SVG by id (`draw: true` strokes a path on progressively;
  `to` fades it out again).
- **Vehicles that move belong in the JSON, not in the base SVG.** Parked scenery vehicles can stay in
  the SVG. The base SVG alone is shown while the code loads, so it must still make sense.
- `poster` is the second shown before play. Choose the most telling moment, such as the instant of risk.
- Make sure no two vehicles overlap during the run. Check several frames (below).

### Look at your figures

A dev server runs at `http://localhost:5199`. Do **not** start your own. Render frames:

```bash
node scripts/preview-figures.mjs /tmp/figs roundabouts-direction-priority --at 0,2.2,4.4,6
node scripts/preview-figures.mjs /tmp/figs roundabouts-lane-change --at 1.6 --dark
```

Then open the PNGs with the Read tool and look. Check: nothing overlaps; badges are not hidden; the
poster frame is the best frame; dark mode is legible; a car does not leave the picture. Fix what you
see. (`/tmp/figs` is just an example: use the scratchpad directory you were given.)

## What you may touch

Only these, for your module `<id>`:

- `src/data/learn/modules/<id>.json` (create it)
- `src/learn-figures/<id>-*.svg` and `src/learn-figures/<id>-*.anim.json` (create them)

**Do not edit** any other file: not `order.json`, not `categories.ts`, not `questions.json`, not the
components, not the styles. Other writers are working in the same tree at the same time. If you need a
change elsewhere, say so in your report. Do not use git (no commit, stash, checkout); the lead commits.
Do not start servers. Do not download files; read law through `scripts/boe.mjs` and pages through the
fetch tool.

## Finish like this

1. `npm run check` reports **no problem lines mentioning your module or figures**. (Messages about
   other modules or "categories without a module yet" are not yours.) Note that `order.json` will not
   list your module until the lead adds it, so the validator will first say
   `modules/<id>.json is not listed in order.json`: that one is expected.
2. You have rendered and looked at every figure, in light mode, and checked at least one in dark.
3. Every `rule` cites an article you opened, and every number was read from a primary text.
4. Reply with a short report: the lessons (titles and step counts), the figures (and which animate),
   which bank questions each lesson `covers`, **every claim you could not verify and left out**, and
   anything you saw that needs changing outside your files.
