# Handoff to LinguaMama Studio: stills and animations for Glorieta, and a link feed

**Run in:** the `appliedrelevance/linguamama` checkout (`/Volumes/Berthold/Landru/code/appliedrelevance/linguamama`),
on the branch that checkout is on. Run `git status` first; if it shows changes you did not make, stop and ask
Geordie. No branches, no worktrees. Studio content changes go through the `linguamama-studio` MCP tools.

**Read first:** `.kiro/specs/scene-composition-templates/` (requirements approved 2026-11-20, design awaiting
approval) and `.kiro/specs/guiri-al-volante/plan.md`. This handoff adds a requirement to the first and a deliverable
to the second; follow the repo's spec workflow (amend requirements and design, get Geordie's approval, then tasks,
then code).

## Why

Geordie wants Glorieta's lessons to carry the stills and animations that Studio's HyperFrames compositions produce
in the Guiri al Volante house style (`poster-litho`), and wants Glorieta to link to the LinguaMama episodes that
teach the same rules. Glorieta cannot build either itself: Studio is the one video and graphics pipeline for every
Applied Relevance property.

## What Glorieta has today (2026-11-20)

- 14 modules, 93 lessons, 47 word-free SVG figures, 31 of them animated with Remotion from `<name>.anim.json`
  (the choreography format `road-diagram` already reads). Every lesson step is bilingual; legends are HTML, so
  figures never carry words.
- A "Watch it on LinguaMama" card on module pages and lesson recaps, fed by `src/data/linguamama.json` (episode
  slug, series, module, lesson ids). It links to
  `https://app.linguamama.ai/es-ES/A1/<episode>/<series>`. Only `alcohol-drugs-and-tiredness-at-the-wheel` is listed,
  because it is the only Guiri al Volante episode in production. A1 is used because a guest opening `/A2/` is sent
  to `/a1/` and the player stalls on that redirect (seen 2026-11-20); the A1 link plays.

## What was found in Studio (2026-11-20)

- Series `guiri-al-volante` (free, style `poster-litho`): `the-examiners-instructions`, `roundabouts`,
  `road-warning-signs` (draft); `alcohol-drugs-and-tiredness-at-the-wheel` (published, production `partial`, 18 of
  23 files); `right-of-way-and-junctions` (new, not in `promote_status` yet).
- Scene graphics render to content-hashed keys, e.g.
  `episodes/<episode>/scenes/<scene>/graphics/h/<hash>.mp4`, in the studio bucket served at `dam.linguamama.ai`.
  Production is `cdn.linguamama.ai`. Neither has a stable, documented address for a Glorieta lesson, so Glorieta
  cannot point at a render.

## What to build

### 1. A Glorieta export (requirement for `scene-composition-templates`)

For a Glorieta lesson, render compositions to **stable public keys in production** (through the promote flow, not
from the studio bucket), plus one manifest:

| Kind | Key | Spec |
|---|---|---|
| Lesson cover still | `glorieta/v1/<module>/<lesson>/cover-h.webp` | 1280×720, `poster-litho`, no words, no captions, no logo |
| Figure animation | `glorieta/v1/<module>/<lesson>/<figure>-h.mp4` and `.webm`, plus `<figure>-h.webp` poster frame | 1280×720, 25 fps, silent, no captions, loops cleanly, from the Glorieta figure's `.anim.json` through `road-diagram` |
| Manifest | `glorieta/v1/manifest.json` | one entry per file (below) |

Manifest entry: `{ module, lesson, figure?, kind: "cover" | "animation", files: { webp?, mp4?, webm? },
width, height, durationSec?, alt: { es, en }, composition, renderedAt, sha256 }`.

Rules, all from decisions already made:
- No words in any frame. Glorieta shows text in both languages in HTML beside the media.
- No spatial fact from a generated image (`scene-composition-templates` R5.6). A cover may be a generated plate in
  `poster-litho`; anything showing lanes, positions or who goes first is a `road-diagram` composition.
- Signs are drawn from Glorieta's catalogue artwork (`public/signs/*.svg`, `src/data/signs.json`), never generated.
- Traffic drives on the right. Vehicle lights follow Glorieta's `beamOpacity` (lit only while moving).
- A render that fails fails loudly; never write a placeholder into the manifest.

**Pilot:** module `alcohol` (its episode is already in production), then `priority` (`right-of-way-and-junctions`,
the composition acceptance episode). `scripts/glorieta-episode/compose.mjs` already maps Glorieta figures to
compositions; reuse it.

### 2. A link feed

Publish `glorieta/v1/episodes.json` in production on every `promote_series guiri-al-volante`: for each episode that
is in production, `{ slug, series, title: { es, en }, levels: ["A1", ...], glorieta: { module, lessons: [...] } }`.
The `glorieta` mapping comes from the link map in `.kiro/specs/guiri-al-volante/plan.md`, filled to lesson level as
each episode is written. Glorieta will read this feed at build time and stop hand-maintaining its list.

### 3. Learner app

- The `/A2/` guest redirect stalls the player; send a guest straight to the level they may watch.
- `alcohol-drugs-and-tiredness-at-the-wheel` is `partial` in production (18 of 23 files); find what is missing.

## What not to do

- Do not edit the Glorieta repo. Glorieta consumes the manifest and feed; its session wires them in.
- Do not serve Glorieta from `dam.linguamama.ai` (the studio bucket) or from content-hashed keys.
- Do not put text, logos or captions into exported frames.

## Done when

- `curl -s https://cdn.linguamama.ai/glorieta/v1/manifest.json` returns entries for every `alcohol` lesson cover and
  every animated `alcohol` figure (it has none today, so covers only), each file returns 200 with the right content
  type, and the `sha256` matches.
- `curl -s https://cdn.linguamama.ai/glorieta/v1/episodes.json` lists `alcohol-drugs-and-tiredness-at-the-wheel`
  with module `alcohol` and its five lessons.
- Tell the Glorieta session the two URLs. It then adds a build step that fetches both, validates them against its
  module and lesson ids, and shows covers on lesson intros and animations beside the matching figure.
