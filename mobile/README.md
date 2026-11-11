# Articulate for iOS and Android

The React Native version of Articulate, built with Expo (SDK 58) and Expo Router. It has the same practice
modes, scoring, coaching notes, progress tracking and optional AI coach as the web app, with a phone layout
and the device's own speech recogniser.

The scoring engine, prompts, frameworks, drills and lessons are not duplicated: this app imports them from
`../src/lib` (aliased as `@core`), the same files the web app uses and the unit tests cover.

## Run it

This app uses native speech recognition, which is not part of Expo Go. You need a development build, which
Expo creates for you:

```bash
cd mobile
npm install

npx expo run:android   # needs Android Studio and an emulator or a connected phone
npx expo run:ios       # needs a Mac with Xcode
```

Either command generates the native project, builds it, installs it and starts the dev server. After the
first build, `npx expo start` is enough for day-to-day work.

No Mac or Android Studio? Build in the cloud with EAS instead:

```bash
npx eas-cli@latest build --profile development --platform android
```

Speech recognition wants a real device. Simulators and emulators can run the app, but microphone input and
the recogniser are unreliable there.

### In a browser

```bash
npx expo start --web
```

This runs the same React Native code in Chrome, Edge or Safari using the browser's speech recognition. It is
handy for working on screens. Pauses, the level meter and recordings are phone-only, because browsers do not
report a volume level through this API.

### Checks

```bash
npm run typecheck          # TypeScript, strict
npx expo export -p web     # bundle check
npm test                   # from the repo root: 85 unit tests for the shared engine
```

## How it differs from the web app

| | Web | Mobile |
| --- | --- | --- |
| Transcription | Browser speech service | iOS Speech framework / Android SpeechRecognizer, via `expo-speech-recognition` |
| Pauses and stalls | From raw microphone audio | From the recogniser's volume level |
| Vocal variety (pitch) | Measured | Not measured: the recogniser does not expose raw audio |
| Recording | In the browser (IndexedDB) | WAV files in the app's documents, on iOS and Android 13+ |
| Storage | localStorage | AsyncStorage; the API key is kept in the keychain (`expo-secure-store`) |
| AI coach | Official Anthropic SDK | Plain HTTPS to the Messages API, because the SDK does not support React Native |
| Screen | Wake lock while speaking | Kept awake for the whole session |

Delivery is scored from pauses alone on mobile, since pitch is not available.

## Before you ship it

- **App identifiers.** `app.json` uses the placeholder `com.articulate.app` for the iOS bundle identifier
  and Android package. Change both to your own.
- **Android 12 and below** has no continuous recognition and no recording. The app restarts the recogniser
  whenever it stops, which works, but the system plays its start sound each time.
- **iOS** returns the final transcript when recognition stops, and limits a single server-based recognition
  session to about a minute. The app restarts the session and keeps the text; a long take's recording may be
  saved in more than one part, which the report plays separately.
- **The AI coach key** is the user's own. If you publish this for other people, route the request through
  your own server instead of shipping keys to devices.

## What has and has not been tested

- Every screen and every practice mode has been run end to end from this codebase in a browser build
  (`expo export -p web`) at phone size, in light and dark mode, with a scripted speech recogniser: on-the-spot
  questions, guided frameworks, Hot Seat, tongue twisters, Power Pause, history, review, delete, settings, and
  the AI coach against a mocked API.
- The Android project generates cleanly (`expo prebuild`) with the microphone permission and the speech
  service query in the manifest, and the iOS usage descriptions resolve in the config.
- **It has not been run on a physical iPhone or Android phone, or in a simulator.** The native-only paths are
  therefore untested: the permission prompts, recogniser behaviour on each OS version, volume-based pause
  detection, saving and playing recordings, the keychain, and keep-awake. They are written against the
  installed modules' documented APIs and type definitions, and the first run on a device is the real test.

## Layout

```
mobile/
  app.json            name, icons, permissions text, plugins
  metro.config.js     lets Metro read ../src/lib (the shared core)
  src/
    app/              Expo Router routes: tabs (Today, Practice, Progress, Learn, Settings),
                      session, review/[id]
    features/         Session, TakeReport, Transcript, TakeList
    lib/              capture.ts (speech + volume + recording), store.ts, coach.ts, session.ts
    ui/               theme, primitives, icons, charts (react-native-svg)
```
