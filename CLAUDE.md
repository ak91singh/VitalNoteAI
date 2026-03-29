# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Local development (reads .env for API keys)
npx expo start

# Run on Android device/emulator
npx expo run:android

# EAS cloud builds
eas build --profile preview --platform android   # APK for testing
eas build --profile production --platform android # Production build

# Upload EAS secrets (required for cloud builds)
eas secret:create --scope project --name GROQ_API_KEY --value <key>
eas secret:create --scope project --name HF_API_TOKEN --value <token>
```

There is no test runner configured. Manual testing is done via `expo start` and the device/emulator.

## Environment Setup

API keys flow through two mechanisms:
- **Local dev**: Create a `.env` file at project root with `GROQ_API_KEY=` and `HF_API_TOKEN=`. `app.config.js` loads this via `dotenv` and passes values into `expo.extra`.
- **EAS builds**: Keys are stored as EAS secrets and injected via `eas.json → build.[profile].env`.

Both paths land in `src/config.js` via `Constants.expoConfig.extra`.

**`newArchEnabled` is set to `false`** in `app.config.js` — do not enable the New Architecture without testing all native modules.

## Architecture

### Navigation & Auth Flow

`RootNavigator` (`src/navigation/RootNavigator.js`) owns the entire navigation tree. It listens to Firebase `onAuthStateChanged` and conditionally renders one of two stacks:
- **Unauthenticated**: Welcome → Login → Signup → ForgotPassword
- **Authenticated**: Dashboard → NewConsultation → Consultation → Profile

A first-launch `DisclaimerModal` (backed by AsyncStorage key `vitalnote_disclaimer_accepted`) blocks the UI until the user accepts the medical disclaimer.

### Consultation Flow (Core Feature)

`NewConsultationScreen` collects patient info and template, then navigates to `ConsultationScreen` passing `{ patientName, patientId, template }` as route params.

`ConsultationScreen` orchestrates the full pipeline:
1. **Record** audio via `expo-av` with live metering → `AudioVisualizer`
2. **Transcribe** via `AIService.transcribeAudio()` (Groq Whisper primary, HF fallback)
3. **Generate SOAP** via `AgenticSOAPService.generateSOAP()` (5-agent Groq workflow)
4. **Linkify** medications via `SmartLinkService.linkify()`
5. **Display** in `MedicalMarkdownView` (inline custom renderer — not a library)
6. **Export** via `PDFService.generateAndShare()` (expo-print + expo-sharing)

### AI Services

Two separate services handle SOAP generation:

**`AgenticSOAPService`** (primary, used by `ConsultationScreen`):
- 5-agent pipeline: Extract → Validate → Build → Reflect → (Revision loop up to 2×)
- All agents call Groq (`llama-3.1-8b-instant`) via the OpenAI-compatible endpoint
- Each agent returns structured JSON; `_parseJSON` strips markdown fences before parsing
- Quality threshold: 0.8. Below threshold triggers a revision pass up to `maxRevisions = 2`

**`AIService`** (legacy, still imported inside `processConsultation` for transcription):
- `transcribeAudio()`: Groq Whisper → HF Legacy API → HF Router (three-tier fallback)
- `generateSOAP()`: Dedicated endpoint → HF Router (primary model) → HF Router (fallback model) → `generateLocalSOAP()` (offline rule-based)
- The dedicated endpoint uses a two-shot `[INST]...[/INST]` Llama prompt format; the router path uses OpenAI chat completions format

### Data Persistence

No backend database stores consultation data. All persistence is local:
- **`SecureStorageService`**: Wraps `expo-secure-store` (native) / `localStorage` (web) for metrics (`TOTAL_SESSIONS`, `TOTAL_DURATION`) and settings (`AUTO_DELETE_AUDIO`)
- **Firebase Firestore** (`db`) is initialized but not actively used for consultation storage — Firebase is used exclusively for authentication
- Session metrics feed the Dashboard's "time saved" calculation (4× multiplier on recording duration)

### Screens Summary

| Screen | Purpose |
|---|---|
| `WelcomeScreen` | Landing with logo + auth CTAs |
| `LoginScreen` / `SignupScreen` | Firebase Email/Password + Google Sign-In |
| `ForgotPasswordScreen` | Firebase password reset |
| `DashboardScreen` | Stats (sessions, time saved) + template selection |
| `NewConsultationScreen` | Patient info entry form |
| `ConsultationScreen` | Full recording → SOAP pipeline |
| `ProfileScreen` | User info, settings (auto-delete audio toggle), legal links |
| `src/screens/templates.js` | SOAP template definitions (General, Pediatric, etc.) |

### Key Architectural Constraints

- **No Redux used in practice** — `@reduxjs/toolkit` and `react-redux` are installed but no store is wired up. All state is local `useState`/`useEffect`.
- **`react-native-gesture-handler` must be imported first** in `index.js` and `App.js` (already enforced).
- **Firebase auth double-init guard**: `initializeAuth` is wrapped in try/catch to handle hot reload — do not change this pattern.
- **`expo-file-system/legacy`** import path is required for `FileSystem.uploadAsync` (MULTIPART); the non-legacy path doesn't expose this API.
- The SOAP note is stored as a single Markdown string throughout the pipeline. `PDFService` converts it to HTML via regex (not a parser) — maintain the `# Header` markdown format for all AI outputs.
