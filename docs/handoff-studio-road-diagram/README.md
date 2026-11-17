# Handoff to LinguaMama Studio: an animated road-diagram template, piloted on right of way

**Run in:** the `appliedrelevance/linguamama` checkout (`/Volumes/Berthold/Landru/code/appliedrelevance/linguamama`),
on the branch that checkout is on (`main` on 2026-11-17). Run `git status` first; if it shows changes you did
not make, stop and ask Geordie. Do not create branches or worktrees.

**Read first:** `.kiro/specs/motion-graphic-scenes/` (`brief.md`, `requirements.md`, `design.md`, `tasks.md`).
This work is that spec's release 1b, reordered. Follow the repo's spec workflow: amend requirements and design,
get Geordie's approval, then tasks, then code.

## Why

Glorieta's next Guiri al Volante episode is right of way (who goes first at a junction). Every scene in it is a
spatial relationship, and diffusion images cannot show those reliably. Geordie's rule, decided 2026-11-17:

- Anything that shows a spatial relationship (junctions, lanes, positions, who goes first) is drawn in SVG.
- Most illustration is vector animation, used liberally.
- Generated images are flourishes, used sparingly (bookends, an occasional mood beat). Never the carrier of a rule.
- LinguaMama Studio is the one video pipeline for every Applied Relevance property. Gaps are filled by extending
  Studio, not by building tools elsewhere.

Release 1a shipped six icon templates plus `bookend`. Release 1b (not started) lists road sign, roundabout and
route, counting, asset callouts and image slots as equals. Under the rule above, the animated road diagram comes
first, sign artwork second, and image slots in non-bookend templates last.

## What to build

### 1. A `road-diagram` template (first)

A plan-view road scene in which vehicles and people move along SVG paths, base-layer elements fade or draw in,
and every motion is paced to the narration.

**Use Glorieta's choreography format as the parameter shape.** Glorieta already has 30 such animations, authored
as plain data and played in its app. The type is `Scene` in Glorieta's `src/lib/scene-core.ts`:

- `actors[]`: `id`, `kind` (`car | truck | moto | bike | ped`), `tone` (`me | other | danger | ok | neutral`),
  `path` (SVG path data) or `at` ([x, y, rotation]), `from`/`to` (when it moves), `ease` (`linear | inOut`),
  `show` (visible window), `badge` ({ mark, dx, dy }, a letter that follows the actor).
- `reveals[]`: `id` of an element in the base SVG, `from`, optional `to`, optional `draw` (stroke draw-on).
- Heading follows the path tangent (`headingDeg`, `shortestTurn` in the same file); progress is `progressAt`.

**The one change: time comes from the narration, not from seconds.** Glorieta's `from`/`to` are seconds. In
Studio every beat must resolve against the variant's narration with the existing cue convention (`CueSchema` in
`packages/studio-core/src/graphics/schema.ts`: keyed by `LEVEL_locale` or `locale`, a string is a phrase, a number
is a 1-based sentence; `cues.ts` resolves them). Recommended shape: each actor move and each reveal takes a `cue`
for its start plus a `seconds` duration, and the render fails loudly when a cue phrase is not spoken in that
variant, as the existing templates do.

**Base diagrams.** The 46 base SVGs in Glorieta's `src/learn-figures/*.svg` (viewBox `0 0 360 360`, word-free, styled
by `.f-*` classes) are the road layers. Their colours are CSS variables in Glorieta's `src/styles.css`
(`--fig-*`, light and dark sets). For video, map them to Studio's theme palette.

**Vehicle drawings.** Use Glorieta's `src/learn/figure-defs.svg` as of commit `18226f5`: the car has a forward
windscreen, headlights, tail lights, mirrors and a tapered nose so its heading reads at a glance, and a
`#v-beam` headlight cone. **The beam is lit only while a vehicle moves**: Glorieta's `beamOpacity(t, from, to)`
in `scene-core.ts` (eases in and out over 0.25 s; front offsets in `BEAM_FRONT`: car −20, truck −36, moto −16;
none for bike or pedestrian). Keep that behaviour.

**Getting Glorieta's files into a render.** HyperFrames forbids fetches at render time, and studio-core already
inlines generated data (`brand.generated.ts`, `icons.generated.ts`). Follow that pattern: a generator script in
this repo that reads Glorieta's files from its checkout path and writes a `*.generated.ts` module. Glorieta's
diagrams and source are the operator's own (CC BY 4.0 content, Apache-2.0 code); see the brief's licence notes.

**Layout.** Frame 1280×720 (horizontal) and 720×1280 (vertical), 25 fps (`GRAPHIC_FPS`). Keep everything above
`caption_zone_top` 0.8. The square diagram sits left in horizontal frames with cards or labels to its right, and
on top in vertical frames. Legibility limits from `graphics_settings` (text ≥ 4% of frame height, contrast ≥ 4.5).
Traffic drives on the right in every locale (operator decision Q16).

### 2. Sign artwork (second)

Requirement 18 as written: a sign by its code draws Glorieta's artwork unaltered, with the held Spanish and
English names as default labels. Source: Glorieta's `public/signs/*.svg` (128 files) and `src/data/signs.json`
(`code`, `es.name`, `en.name`, meanings). Provenance is recorded, credit is not surfaced (Q14). Signs must be
usable both inside a `road-diagram` (placed at an approach) and as a card or callout.

### 3. Image slots in other templates (last)

Requirement 5.1 to 5.8 already describes it. Lowest priority under the rule above.

## Reference mock

`reference-mock.html` beside this file is a single-scene HyperFrames composition of the first right-of-way
scene, approved in direction by Geordie on 2026-11-17. It is a hand-written mock, not a template, but it shows
the target: junction builds, P-2 sign pops in at the approach, "you" stop at the line and a sightline cone looks
right, the car from the right gets a check and crosses, your cross clears, you go. Beams light only while each car
moves. It uses Studio's `road` theme tokens. To view it, copy it to a scratch folder as `index.html`, put
Glorieta's `public/signs/p-2.svg` at `assets/p-2.svg`, and run `npx hyperframes render --fps 25`.

## Pilot episode draft

`right-of-way-at-junctions.json` beside this file is the drafted master script for the pilot episode
(`right-of-way-at-junctions`, 26 scenes), written against Studio's live `episode_create_system` rules on 2026-11-17:
bookends with Jordi on a town square, then 13 `road-diagram` scenes (one per Glorieta figure), 3 `sign` scenes
(R-1, R-2, R-3 with R-4), and `cards`, `timeline` and `readout` scenes for rules that are lists or numbers. Every
fact comes from Glorieta's `priority.json` lessons. A1 and A2 sentence lengths and key-word repetition were checked
by script.

What it assumes, which the design should settle:

- **`road-diagram` parameters** are written minimally as `figure` (a Glorieta figure name), `heading`, and `start`
  (the 1-based master sentence, per level, on which the choreography begins). Replace `start` with whatever beat
  and cue shape the design settles on.
- **`sign` parameters** are written as `signs` (codes) plus a `cue` phrase per locale.
- **Four new icons** are used: `traffic-light`, `tram`, `bike`, `road-marking`. Add them to the icon set, or switch
  those scenes to signs or diagrams.
- Only masters are written. Per-locale scripts come from the translation stage, as usual. On-screen labels are
  authored for es-ES and en-GB.

Create the episode only once both templates exist and validate, with `create_episode` and then `update_scene`, and
add it to the `guiri-al-volante` series. Do not run the pipeline.

## Pilot and acceptance

The pilot is the right-of-way module: Glorieta's 10 `src/learn-figures/priority-*.anim.json` (agent, dont-block,
emergency, narrow-pass, paved-road, pedestrian-turn, red-light, stop-line, unsigned-junction, zebra) and their base
SVGs, plus the lesson text in Glorieta's `src/data/learn/modules/priority.json` (rules cite their RGC articles).

Done when:

1. `list_graphic_templates` lists `road-diagram` with its parameters, and invalid declarations are rejected on save
   (unknown key, missing base, a cue phrase not in the narration).
2. A draft episode in the Guiri al Volante series (`guiri-al-volante`) has at least the unsigned-junction scene
   declared with `road-diagram`, and `preview_scene_graphic` renders it for es-ES and en-GB, A1 and A2, both
   orientations.
3. `get_graphics_status` reports those cells `current`, and a second preview reuses the render.
4. Frames sampled at each beat show the motion landing on its cue, nothing in the bottom 20%, and the beam only on
   moving vehicles.
5. Re-running the graphics stage for `alcohol-drugs-and-tiredness-at-the-wheel` re-renders nothing: release 1a
   render keys are unchanged.

## Do not

- Edit the Glorieta repo from this session. Read its files; if Glorieta needs a change, write it down for Geordie.
- Call `trigger_pipeline` unless Geordie asks for a run in that turn. Use `preview_scene_graphic` to verify.
- Publish, promote or YouTube-sync any episode.
- Fall back to a generated image, a placeholder or an approximate sign when an asset or cue is missing: fail the
  render naming the scene and the cause (Requirement 5.5, 14.5).
- Touch shared Supabase migrations or another property's schema.

## Facts already established (2026-11-17)

- Studio renders graphics with HyperFrames + GSAP in the worker container (`apps/studio-worker/container/app/graphics.py`);
  compositions are built by `packages/studio-core/src/graphics/compose.ts`; the catalogue is `catalogue.ts`.
- The published alcohol episode (`alcohol-drugs-and-tiredness-at-the-wheel`, YouTube `AtAOKFTuLHA`, unlisted) uses
  only release 1a templates; its middle scenes are icons on a plain backdrop.
- The older studio-only `alcohol-drugs-and-fatigue` was deleted from studio and production on 2026-11-17; the
  Guiri al Volante series now lists `the-examiners-instructions`, `roundabouts`, `road-warning-signs`,
  `alcohol-drugs-and-tiredness-at-the-wheel`.
- Glorieta's animation player is Remotion at 30 fps; that is the app's player only. Studio stays on 25 fps.
