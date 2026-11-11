# Articulate

A training app for speaking clearly, concisely and confidently when you have not had time to prepare.

You answer a real question out loud against a clock. The app transcribes you, measures what happened
(pace, fillers, hedges, pauses, structure, vocal variety), marks the exact words in your transcript, tells you
the one thing to fix first, and lets you go again. The second take is where the improvement happens.

It comes as two apps that share one scoring engine:

- a **web app** (React + Vite), in this folder, and
- an **iOS and Android app** (React Native + Expo), in [`mobile/`](mobile/README.md).

Both run entirely on the device. There is no account and no server.

## Run the web app

```bash
npm install
npm run dev
```

Open the printed URL in **Chrome, Edge or Safari** and allow the microphone when asked.

- Live transcription uses the browser's built-in speech recognition, which those three browsers provide.
  In Firefox you still get timing, pauses, vocal variety and the recording, but no word-level feedback.
- The microphone only works on `https://` or `localhost`.

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests for the analysis engine, content and progress logic |
| `npm run typecheck` | TypeScript, strict |
| `npm run build` | Type-check, then build a static site into `dist/` |
| `npm run preview` | Serve the built site locally |

The build is a plain static site with relative paths and hash routing, so `dist/` can be dropped onto any
static host or sub-path. Host it over HTTPS so the microphone works.

## Deploying with GitHub Actions

Two workflows live in `.github/workflows/`:

- **Deploy web app** (`deploy.yml`) runs the unit tests and the build on every push. On the default branch it
  also publishes the site to GitHub Pages, at `https://<owner>.github.io/<repo>/`. One-time setup: in the
  repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
- **Build Android app** (`android.yml`) is started by hand from the Actions tab. It builds an installable APK
  of the mobile app and attaches it to the run as the `articulate-android` artifact. The APK is signed with the
  standard debug key: fine for your own phone, not accepted by Google Play.

An iOS build needs an Apple developer account and signing credentials, so it is not automated here.

## Run the mobile app

```bash
cd mobile
npm install
npx expo run:android   # or: npx expo run:ios
```

It needs a development build, not Expo Go, because it uses the phone's native speech recogniser. See
[`mobile/README.md`](mobile/README.md) for setup, what differs from the web app, and what has been tested.

## What you can practise

**Speak on the spot.** 132 prompts across ten situations: job interviews, meetings and updates, leading
and giving feedback, pitching and persuading, explaining simply, taking a stand, storytelling, small talk,
tough moments, and wildcards. Choose how long you speak and how long you get to think. With no thinking time,
the question stays hidden until the clock starts. You can also type in your own situation or question.

**Frameworks, guided.** Nine shapes for an answer (PREP, STAR, What / So what / Now what, Problem–Solution–Benefit,
Past–Present–Future, Answer first, SBI feedback, Acknowledge–Bridge–Commit, Story arc). You step through the
framework as you speak and the report shows how many words went into each step.

**Drills.** Short exercises that isolate one skill:

| Drill | Trains | What it asks |
| --- | --- | --- |
| Hot Seat | Fluency | Five questions, thirty seconds each, no preparation |
| Filler-Free Minute | Fluency | Sixty seconds on an easy topic with zero fillers |
| Shrink It | Clarity | The same point in 60 seconds, then 30, then one sentence |
| Taboo | Clarity | Describe a word without the obvious words |
| Analogy Sprint | Clarity | Explain an idea through an unrelated world |
| Word Bridge | Fluency | Link two unrelated words into one coherent thought |
| Word Weave | Vocabulary | Work three precise words into a short talk |
| Pace Lock | Pace | Read a passage at a steady speed with a live gauge |
| Power Pause | Delivery | Read a passage and stop fully at every mark |
| Diction Warm-up | Clarity | Three tongue twisters, scored on words heard |

**Daily workout.** Three steps, about five minutes: a warm-up, a drill aimed at your weakest skill, and one
impromptu answer. The same all day, different tomorrow.

**Learn.** Twelve one-minute principles (answer first, pause instead of filling, cut the hedges, land the
ending…) each with a before/after example and a drill, plus a reference for every framework.

## What is measured

Each take is scored out of 100 on up to six skills. The scores are simple, documented curves over standard
speaking metrics, so the same take always scores the same and a better second attempt shows up as a better
number.

| Skill | Signals |
| --- | --- |
| Fluency | Fillers per minute, restarted words, stalls over 2.5 s, time before the first word |
| Pace | Words per minute against your target range (default 130–165), and how steady it was |
| Clarity | Hedges and vague or empty words per 100 words; in read-aloud drills, the share of words heard |
| Structure | Signposts by type (sequence, cause, contrast, example, summary), a clean opening and ending, framework coverage |
| Vocabulary | Variety of wording (moving-average type-token ratio), over-used words, target words used |
| Delivery | Deliberate pauses, silence ratio, pitch variation (from the microphone signal) |

Each drill only scores and coaches the skills it is about. The report also checks the drill's targets,
compares the take with your last attempt at the same prompt, charts pace through the take, and plays back the
recording.

The word rules are deliberately conservative. "Like", "you know" and "kind of" are only flagged where they are
almost certainly padding ("and like…", "it was like, really big"), never as a verb or a comparison. The rules
and their test cases are in `src/lib/analysis/flags.ts` and `flags.test.ts`.

## Optional: AI coach

The numbers cannot judge whether your answer was any good. If you add an Anthropic API key in Settings, the
report gains a "Review my answer" button. Claude reads the transcript and returns what worked, what to change,
a tighter version of your answer in your own words, and a follow-up question to practise next. On the Practice
page it can also turn any situation you describe into a five-question rehearsal.

- Model: `claude-opus-5-5`, with structured output, called through the official `@anthropic-ai/sdk`.
- Requests enable the API's server-side refusal fallback, so a declined request is retried on a fallback model.
- The key is stored in this browser's `localStorage` and sent only to the Anthropic API, directly from the
  page. That is convenient for a personal tool and inappropriate for a shared computer. If you deploy this for
  other people, put the API call behind your own server instead.
- The SDK is loaded on demand, so the app carries no cost for it until the coach is used.

Everything else works without a key.

## Privacy

- Takes, transcripts, scores and settings are kept in `localStorage`; recordings in IndexedDB (the newest 40).
  Nothing is uploaded by this app. Settings has export, restore and delete.
- Transcription is done by your browser's speech service. In Chrome that means audio is sent to Google's
  servers for recognition, as with any use of the Web Speech API.
- With the AI coach on, the transcript, the prompt and the measured numbers for that take are sent to Anthropic.

## Known limits

- **English only.** The filler, hedge and signpost rules are written for English. Settings lets you pick an
  accent (US, UK, India, Australia and others) for the recogniser.
- **Speech recognition tidies what it hears.** It often drops a quiet "um" or "uh", so the filler count can
  read low. Stalls and pauses come from the audio signal and are not affected; the recording lets you check.
- **Some mobile browsers cannot record and transcribe at once.** If transcription stops working on a phone,
  turn off "Record and analyse my voice" in Settings. You keep word-level feedback and lose playback, pauses
  and vocal variety.
- **Recognition sessions restart.** Chrome ends a recognition session after a stretch of silence or about a
  minute. The app restarts it at once, but a word spoken in that instant can be lost.
- **Pitch variation is an estimate** from autocorrelation on the microphone signal and depends on the mic.

## How it is tested

- `npm test` runs 85 unit tests: tokenising, every word rule, pace and pause metrics, read-aloud alignment,
  the voice analyser on synthetic audio, scoring on realistic strong and weak answers, goals, drill builders,
  the daily workout, streaks and levels.
- Every practice mode has been run end to end in headless Chromium with a scripted stand-in for the speech
  recogniser and a synthetic audio file as the microphone, on desktop and phone-sized screens, in light and
  dark mode, including the failure paths (no transcription, no microphone access, too little speech).
- It has not been run against a real microphone and the real speech service in this environment, and the AI
  coach has only been exercised against a mocked API response.
- The mobile app has been run the same way in a browser build, but not on a phone. Details in
  [`mobile/README.md`](mobile/README.md).

## Project layout

```
src/
  lib/                                                        shared by web and mobile (pure TypeScript)
    analysis/     text.ts, flags.ts, metrics.ts, analyze.ts   transcript + timing -> scores and notes
    content/      prompts.ts, frameworks.ts, drills.ts, lessons.ts
    speech/       voice.ts        loudness, pauses and pitch from raw samples or volume levels
    ai/           prompt.ts       the coach's instructions and what it is shown
    progress.ts   streaks, levels, skill ratings
    types.ts, format.ts, ticks.ts

    speech/       transcriber.ts  Web Speech API wrapper (restarts, timestamps)      web only
                  capture.ts      one take: mic, recorder, transcriber, live state
    ai/           coach.ts        Claude calls through the SDK; index.ts loads it lazily
    store.ts      settings + history in localStorage
    audioStore.ts recordings in IndexedDB
  components/     charts, transcript, take report, shell                             web only
  pages/          Home, Practice, Session, Review, Progress, Learn, Settings
mobile/           the React Native app; imports the shared files above as `@core`
```

The analysis engine is pure functions over plain data, with no browser APIs, which is why it can be tested
directly. `analyze(capture, exercise, settings)` is the entry point.

## Design notes

Ink on paper with one blue for data. Chart and highlight colours come from a categorical palette validated for
colour-vision deficiency in light and dark mode. Transcript marks differ by underline style as well as colour
and carry tooltips, status is always an icon plus a word, and every chart has a table view and keyboard access.
