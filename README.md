# Carnet

A study app for the Spanish driving theory test (permiso B), built for an English speaker who is studying in Spanish. **Unofficial.** The questions are original, written from the regulations. They are not the DGT's question bank.

The one design rule: **every piece of text can flip between Spanish and English instantly.** Spanish is the default.

- **ES / ES+EN / EN** switch in the header, remembered between visits. Press `E` to flip between Spanish and English.
- A small **EN** chip on each question card reveals English for that card only, so you can check one question without flipping the app.
- Questions, options, explanations, vocabulary, examiner phrases and the interface itself all carry both languages. Identical strings (numbers, "STOP") are shown once.

## What is in it

| Screen | What it does |
|---|---|
| Practice | 70 written questions plus 29 "what does this sign mean?" questions, in 11 categories. Spaced repetition ([FSRS](https://github.com/open-spaced-repetition/ts-fsrs)) brings the ones you miss back sooner. |
| Mock exam | 30 questions (4 of them signs), countdown, up to 3 mistakes, with a review of what you missed. |
| Traffic signs | A gallery of 29 Spanish signs with the meaning in both languages, and practice questions built from the same data. |
| Vocabulary | Flashcards for road terms, scheduled with the same FSRS engine. |
| Examiner phrases | What you will hear in the practical test, and what to do. |
| Exam & US differences | Format, language options, license validity, and what changes from the US. Each fact is labeled official, secondary, or verify. |

Progress lives in the browser's `localStorage`. There is no account and no server-side user data.

## Stack

Preact + TypeScript + Vite, deployed as static assets on a Cloudflare Worker. No backend.

```bash
npm install
npm run dev        # local dev server
npm run check      # validate the question bank
npm run build      # type-check and build to dist/
npm run deploy     # check, build, wrangler deploy
```

`wrangler.jsonc` binds the Worker to a custom domain and turns off `workers.dev` and preview URLs. The site is meant to sit behind Cloudflare Access, and those other URLs would bypass it. Access is configured in Cloudflare, not in this code, so making the site public later means removing the Access application and nothing else.

## Sign images

The 29 SVGs in `public/signs/` come from [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Road_signs_of_Spain). All but two are public domain; the other two (CC BY-SA) are credited in `public/signs/CREDITS.md` and on the signs page. To add a sign, drop the SVG in `public/signs/` and add an entry to `src/data/signs.ts` with its meaning in both languages; the practice questions are generated from that list, and `npm run check` fails if a file and an entry get out of step.

## Adding or editing questions

Questions live in `src/data/questions.json`. Each has English and Spanish text, three options, one `answer` index, an explanation, optional `terms` (vocabulary shown after answering), an optional US-difference `note`, and a `src` citing the law. `npm run check` rejects a bank with a missing language, a duplicate id, or the wrong number of options.

## Accuracy

Traffic law changes, and so does the exam. Check anything that matters at [dgt.es](https://www.dgt.es).

The question bank was fact-checked on 2026-10-16 by an independent read of the BOE consolidated texts (Reglamento General de Circulación, Ley de Tráfico, Código Penal, and others) and dgt.es. That pass corrected two wrong explanations and several imprecise ones, and supplied the article numbers in each question's `src` line. It also caught a rule change: since 1 October 2026 (RD 518/2026), overtaking a cyclist outside town requires slowing at least 20 km/h below the road limit.

What is still not confirmed from a primary source:

- The 3-mistake limit and the 30-minute time limit rest on secondary publications, and the app labels them that way.
- Sign shapes and colors are images in the BOE, so they were not checked against the catalogue text.
- A handful of questions rest on DGT guidance only (the two-second following distance, the 200 km rest recommendation, first aid), with no article to cite.
