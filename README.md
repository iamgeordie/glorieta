# Glorieta

*Guiri al Volante* (Foreigner at the Wheel)

A study app for the Spanish driving theory test (permiso B), built for an English speaker who is studying in Spanish. **Unofficial.** The questions are original, written from the regulations. They are not the DGT's question bank.

The one design rule: **every piece of text can flip between Spanish and English instantly.** Spanish is the default.

- **ES / ES+EN / EN** switch in the header, remembered between visits. Press `E` to flip between Spanish and English.
- A small **EN** chip on each question card reveals English for that card only, so you can check one question without flipping the app.
- Questions, options, explanations, vocabulary, examiner phrases and the interface itself all carry both languages. Identical strings (numbers, "STOP") are shown once.

## What is in it

| Screen | What it does |
|---|---|
| Learn | A guided course: 13 modules, 63 short lessons, 315 check questions and 43 diagrams (many animated). Each lesson has key words, an ungraded guess, one idea per step with a retrieval check, and a recap. Each module ends in a quiz; 80% counts as mastered. See [How the course teaches](#learn-the-course). |
| Practice | The 70 original questions, the 315 lesson checks, and a "what does this sign mean?" question for each sign, in 13 categories. Spaced repetition ([FSRS](https://github.com/open-spaced-repetition/ts-fsrs)) brings the ones you miss back sooner, whether you missed them in a lesson, a quiz or here. |
| Mock exam | 30 questions (4 of them signs), countdown, up to 3 mistakes, with a review of what you missed. |
| Traffic signs | A gallery of Spanish traffic signs with the official meaning in both languages, and practice questions built from the same data. |
| Vocabulary | Flashcards for road terms, scheduled with the same FSRS engine. |
| Examiner phrases | What you will hear in the practical test, and what to do. |
| Exam & US differences | Format, language options, license validity, and what changes from the US. Each fact is labeled official, secondary, or verify. |

Progress lives in the browser's `localStorage`. There is no account and no server-side user data. With an account, everything syncs across devices: question progress, mock exam results, and the course (finished lessons, where you stopped, quiz results). Merging never loses progress: a finished lesson stays finished and a best quiz score never shrinks.

## Learn: the course

Thirteen modules in the order a newcomer should take them: roads and lanes, signs and markings, speed, right of way, roundabouts, overtaking and maneuvers, stopping and motorways, safety, alcohol and fatigue, hazards and vulnerable users, collisions and first aid, the vehicle, and licenses and points. The topics follow the DGT's official syllabus for the theory course; every lesson is written from the law, in our own words.

How it teaches, and the research behind each choice:

| Technique | Where you see it |
|---|---|
| Retrieval practice and spaced review (Dunlosky et al. 2013: both rated "high utility") | Inline checks that gate "Next"; every check joins the question bank and is rescheduled by FSRS |
| Pretesting (Kornell; Richland et al.) | An ungraded "guess first" question before each lesson |
| Pretraining, segmenting, signaling, coherence, words and pictures (Mayer) | Key words up front, one idea per step, bold on the one key term, no decoration, a diagram where space or motion is the point |
| Mastery learning (Bloom; Khan Academy-style levels) | A module quiz with an 80% pass mark and a "review these lessons" list that links each missed question to the step that teaches it |
| Interleaving | The quiz mixes in review items from modules you have already started |
| Worked examples (Sweller) | "Situation, what to do, why" blocks |

Diagrams are word-free inline SVG with bilingual HTML legends, so they follow the ES/EN switch and dark mode. Animated ones are choreographed in a small `<name>.anim.json` and played by the [Remotion](https://www.remotion.dev) Player (loaded only when a lesson shows one), with bilingual controls under the picture. Remotion is source-available, not open source: it is free for individuals and for-profit companies of up to three people, so check [its license](https://www.remotion.dev/docs/license/faq) if the team grows.

### Where the lessons come from

Only from the law. The DGT's manuals are copyrighted and its legal notice reserves reproduction, so none of their text or structure is copied; they are used only as a topic outline. Every legal rule cites the article it comes from, `rule` blocks are law and `tip` blocks are practice, and every number was read from a primary text. Signs and markings are cited to RGC Anexo I, ap. 5 (the Catalogue).

```bash
node scripts/boe.mjs laws                                 # the laws used and their BOE ids
node scripts/boe.mjs BOE-A-2003-23514 art 57              # the in-force wording of an RGC article
node scripts/boe.mjs BOE-A-2003-23514 grep "glorieta"     # in-force articles that mention a word
node scripts/boe.mjs catalogue "R-305"                    # the in-force definition of a sign or marking
node scripts/preview-figures.mjs /tmp/figs <name> --at 0,2.5   # screenshot a diagram (needs the dev server and Chrome)
```

The tool prints only the wording in force today and flags repealed text, because text that looks right can be repealed: the RGC's old sign and marking articles (151 to 173) were repealed on 2025-06-17, and articles 151 to 158 now mean something else. `npm run check` rejects citations of repealed articles. To write or change a lesson, read [`docs/learn-authoring.md`](docs/learn-authoring.md) (the standard) and [`docs/learn-curriculum.md`](docs/learn-curriculum.md) (what each module covers).

## Accounts (optional)

People can sign in to sync progress across devices: email and password, email confirmation, password reset, and a Google button that is disabled until a Google OAuth client exists. It is off unless the app is built with a Supabase project configured; with no configuration the app is exactly the local-only version. Joining a mailing list is a separate opt-in, unticked by default. Design, configuration and tests are in [`docs/backend/`](docs/backend/README.md).

## Logo and splash page

The logo is the official Spanish roundabout sign (R-402), drawn by Majafego and licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) on [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Spain_traffic_signal_r402.svg). It is used as published: the favicon is a byte-identical copy (`npm run check` fails if it ever differs), and the splash page draws the file unmodified, only rotating it as a whole. It is never recolored, cropped or split, because a modified version would have to be shared under the same license. The credit appears on the splash page and in `public/signs/CREDITS.md`. If you reuse the logo, keep that credit.

The splash page (`#/welcome`) is a full-screen `<canvas>`: cars circling the sign as if it were the island of a roundabout. CSS decides the layout and the canvas reads where the sign sits, so it scales from a phone to a wide monitor. All text, buttons and the credit are real HTML over the canvas, which is hidden from screen readers. With `prefers-reduced-motion` it draws one still frame. It shows once on a first visit; the "Start studying" button marks it seen.

## Stack

Preact + TypeScript + Vite, deployed as static assets on a Cloudflare Worker. No backend. The course text (about a megabyte) and the Remotion player load only inside Learn; the lesson check questions are built into the main bundle by a small Vite plugin so Practice and the mock exam can use them.

```bash
npm install
npm run dev        # local dev server
npm run check      # validate the question bank, the course, the diagrams and every citation
npm run build      # type-check and build to dist/
npm run deploy     # check, build, wrangler deploy
```

`wrangler.jsonc` binds the Worker to a custom domain and turns off `workers.dev` and preview URLs, so the site has one canonical address. The site is public and has no accounts or backend; standard Cloudflare protections (proxy, TLS, bot and DDoS mitigation) apply at the zone level, not in this code.

## Sign images

The SVGs in `public/signs/` are unmodified copies from [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Road_signs_of_Spain): public domain, CC0, or CC BY-SA. Every file's license and author is recorded in `src/data/signs.json`; `npm run credits` generates `public/signs/CREDITS.md` from it, and the credits for the CC BY-SA files are also shown on the signs page. Names and meanings follow the official catalogue (RGC Anexo I, as updated by RD 465/2025). The direction descriptors in parentheses on the R-400, R-401, R-403 and R-407 variants, such as "(straight arrow to the right)", are this app's own clarifications; the official names are bare. A 2025 reform changed some drawings and codes, so where Commons offers the Transport Ministry's own new drawing, that one is used.

To add a sign, put the SVG in `public/signs/` and add an entry to `src/data/signs.json`; the practice questions are generated from that list. `npm run check` fails if a file and an entry get out of step, if a CC BY-SA sign lacks an author or license link, or if `CREDITS.md` is stale.

## Adding or editing questions

Questions live in `src/data/questions.json`. Each has English and Spanish text, three options, one `answer` index, an explanation, optional `terms` (vocabulary shown after answering), an optional US-difference `note`, and a `src` citing the law. `npm run check` rejects a bank with a missing language, a duplicate id, or the wrong number of options.

## Accuracy

Traffic law changes, and so does the exam. Check anything that matters at [dgt.es](https://www.dgt.es).

The Learn course was written from the BOE texts in force on 2026-10-17 and then checked a second time by independent readers who had not seen the author's reasoning. That second pass found real errors in every module (wrong scope of a rule, omitted exceptions, claims taken from repealed articles, unsourced first-aid details, an exam feature the DGT had only announced), which were corrected; it also led to corrections in about twenty existing questions and several Facts entries. Four practical points to know:

- Some rules rest on a plain reading, not on a sentence of the law, and the lessons say so (for example, what crossing a solid line allows for overtaking a cyclist).
- Guidance that is not law (the two-second gap, rest breaks, first aid) comes from DGT and Ministry of Health pages and is labeled as guidance.
- The theory exam's video hazard question was announced for late 2025, but the DGT's current exam page does not mention it; the Facts screen marks it "verify".
- US comparisons are deliberately modest ("most states").

The question bank was fact-checked on 2026-10-16 by an independent read of the BOE consolidated texts (Reglamento General de Circulación, Ley de Tráfico, Código Penal, and others) and dgt.es. That pass corrected two wrong explanations and several imprecise ones, and supplied the article numbers in each question's `src` line. It also caught a rule change: since 1 October 2026 (RD 518/2026), overtaking a cyclist outside town requires slowing at least 20 km/h below the road limit.

What is still not confirmed from a primary source:

- The 3-mistake limit and the 30-minute time limit rest on secondary publications, and the app labels them that way.
- Sign shapes and colors are images in the BOE, so they were not checked against the catalogue text.
- A handful of questions rest on DGT guidance only (the two-second following distance, the 200 km rest recommendation, first aid), with no article to cite.

## License

Three kinds of material, three licenses:

| What | License |
|---|---|
| Source code | [Apache License 2.0](LICENSE) |
| Written learning content (questions, explanations, lessons, vocabulary, sign meanings, interface text) and the original diagrams in `src/learn-figures/` | [CC BY 4.0](LICENSE-CONTENT.md) |
| Traffic sign images in `public/signs/` | Their own licenses from Wikimedia Commons (public domain, CC0, or CC BY-SA), with credits in [`public/signs/CREDITS.md`](public/signs/CREDITS.md) |

The sign images are unmodified copies and keep their original terms. Licensing the code under Apache 2.0 does not relicense them.

The app is unofficial and not affiliated with the DGT. Parts of the code and content were drafted with Claude Code and reviewed and published by the author.
