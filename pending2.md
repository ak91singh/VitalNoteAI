# VitalNoteAI — Remaining Tasks Before Google Play Store

**Current state:** Build compiles, app runs, payment integration in sandbox mode.
**Target:** Production-ready APK/AAB eligible for Play Store submission.

---

## 🔴 HARD BLOCKERS — App will be rejected without these

### 1. Google Play Billing Policy Compliance ⚠️ BIGGEST ISSUE
Google Play policy **requires** all digital subscription/content purchases made *inside* an Android app to go through Google Play's billing system (Play Billing API). Using Razorpay or Stripe directly within the app violates this policy for consumer-facing apps and can cause rejection or removal.

**Your options (pick one):**

| Option | Effort | Notes |
|--------|--------|-------|
| **A. Implement Google Play In-App Purchases** | High | Use `expo-in-app-purchases` or `react-native-iap`. Google takes 15% cut for subscriptions after first year. Fully compliant. |
| **B. Move payment outside the app** | Low | Remove all in-app payment screens. Show a button "Manage Subscription" → opens your website in browser. Users subscribe on your website via Razorpay/Stripe. App reads Firestore for plan status. Zero Play Store cut. |
| **C. B2B exemption (grey area)** | None | Apps sold to businesses for business use may qualify for exemption. Targeting licensed doctors only might work, but this has been inconsistently enforced by Google. Risky. |

**Recommendation:** Option B is the fastest to ship. Keep all payment infra (Firebase Functions, Razorpay, Stripe) exactly as-is — just add a landing page and remove the in-app `PricingScreen` payment buttons. You keep 100% revenue.

---

### 2. Firebase Cloud Functions — Not Deployed
The entire payment backend (`functions/index.js`) is local code only. It has never been deployed to Firebase.

**Steps:**
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```
Also deploy security rules:
```bash
firebase deploy --only firestore:rules
```
Without this, `CONFIG.FIREBASE_FUNCTIONS_URL` calls return 404 on all devices.

---

### 3. Privacy Policy — Must Be a Public Web URL
Google Play **requires** a privacy policy accessible via a public HTTPS URL (not inside the app). You have real Privacy Policy content in `PrivacyPolicyScreen.js` — it just needs to be hosted.

**Fastest fix:** Paste the Privacy Policy text onto any of these (free):
- GitHub Pages (`github.io`)
- Notion (make the page public)
- A simple Firebase Hosting page

Then add the URL in `app.config.js`:
```js
android: {
  privacyPolicyUrl: 'https://your-domain.com/privacy',
}
```
And add the URL in Play Console when filling out the store listing.

---

### 4. Data Safety Form (Play Console)
Google Play requires a **Data Safety** section declaring what personal data the app collects, processes, and shares. This is filled in Play Console (not in code), but you need to decide/document:

- **Audio recordings** → collected temporarily, not stored (confirm this is true)
- **Patient names/IDs** → entered by user, stored locally or in Firestore?
- **Email address** → collected via Firebase Auth
- **Usage data** → sessions, duration stored in SecureStorage
- **Payment data** → processed by Razorpay/Stripe (not stored in app)
- **Is data encrypted in transit?** → Yes (HTTPS/Firebase)
- **Is data encrypted at rest?** → SecureStore = yes; Firestore = Firebase handles it

---

### 5. Release Keystore / App Signing
Production APK/AAB must be signed. Two options:
- **Google Play App Signing (recommended):** Upload your EAS-generated keystore to Play Console. Google re-signs the APK for distribution and holds the "upload key." Most secure.
- **Self-signed:** You manage the keystore. Losing it = can never update the app.

EAS generates a keystore automatically. Download it:
```bash
eas credentials
```
Store it safely (not in git).

---

### 6. Google Play Developer Account
If not already created: one-time $25 fee at [play.google.com/console](https://play.google.com/console).
- Use the same Google account that owns the Firebase project (cleaner)
- Individual or Organization registration

---

## 🟡 IMPORTANT — Needed for Quality Launch

### 7. Content Rating Questionnaire
In Play Console → App content → Content ratings → fill out the IARC questionnaire.
For a medical documentation tool with no violence/adult content: likely "Everyone" or "Everyone 10+".
Without this, the app cannot be published.

---

### 8. Adaptive Icon — Currently Not Configured
`adaptive-icon.png` exists in `/assets/` but is **not referenced** in `app.config.js`.
Android 8.0+ (most devices) uses adaptive icons. Without it, the icon may look bad on home screens.

Add to `app.config.js`:
```js
android: {
  adaptiveIcon: {
    foregroundImage: './assets/adaptive-icon.png',
    backgroundColor: '#FFFFFF',   // match your brand color
  },
}
```

---

### 9. Play Store Listing Assets — All Required
None of these exist yet. Must be created before submission:

| Asset | Size | Required? |
|-------|------|-----------|
| Hi-res icon | 512 × 512 PNG | ✅ Yes |
| Feature graphic | 1024 × 500 PNG/JPG | ✅ Yes |
| Phone screenshots | 2–8 screenshots | ✅ Yes (minimum 2) |
| Short description | max 80 characters | ✅ Yes |
| Full description | max 4000 characters | ✅ Yes |
| Tablet screenshots | optional | ❌ Optional |

---

### 10. Crash Reporting — None Configured
No Sentry, no Firebase Crashlytics. If something crashes in production (on a device you don't own), you will not know about it.

**Fastest fix — Firebase Crashlytics** (Firebase already set up):
```bash
npx expo install @react-native-firebase/app @react-native-firebase/crashlytics
```
Add to `app.config.js` plugins and wrap `index.js` with the crashlytics handler.

---

### 11. Production API Keys — 4 ENV VARS
The design from day 1: going live = filling in 4 variables. Nothing else.

```
# .env (local) and EAS secrets (cloud build)
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXXXX
STRIPE_PUBLIC_KEY=pk_live_XXXXXXXXXXXXXXXX
FIREBASE_FUNCTIONS_URL=https://us-central1-vitalnoteai-19c6d.cloudfunctions.net

# functions/.env (server-side — never in client code)
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXX
STRIPE_SECRET_KEY=sk_live_XXXXXXXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXX
```

Also run this for the EAS cloud build:
```bash
eas secret:create --scope project --name RAZORPAY_KEY_ID --value rzp_live_...
eas secret:create --scope project --name STRIPE_PUBLIC_KEY --value pk_live_...
eas secret:create --scope project --name FIREBASE_FUNCTIONS_URL --value https://...
```

---

### 12. Subscription Self-Service Cancellation
Google Play policy requires that users be able to cancel subscriptions without contacting support. Currently `ProfileScreen` says "contact support to cancel."

**If using Google Play Billing (Option A above):** Cancellation is handled by Google Play automatically — no code needed.
**If using external billing (Option B above):** Cancellation is on your website — acceptable under Play policy.
**If keeping in-app Razorpay/Stripe:** Add a "Cancel Subscription" button in `ProfileScreen` that calls your Firebase Function to cancel the Razorpay/Stripe subscription and downgrades the Firestore plan.

---

### 13. Microphone Permission Rationale (UX)
When users tap "Record" for the first time, Android shows the system permission dialog.
Ensure the app shows **a pre-permission explanation screen/dialog** before triggering the system prompt ("This app uses your microphone to transcribe patient consultations...").
Check `ConsultationScreen.js` — if permission is requested without context, add an `Alert` or modal before `Audio.requestPermissionsAsync()`.

---

### 14. App Version & versionCode
`version` is `1.0.0` in `app.config.js`. The `versionCode` is auto-incremented by EAS on each build (`autoIncrement: true` in production profile). This is correct — no action needed for first submission. Verify after first production build that versionCode is 1.

---

## 🟢 NICE TO HAVE — Post-Launch Improvements

### 15. HIPAA Compliance Verification
Your Privacy Policy mentions HIPAA compliance. To actually be HIPAA-compliant:
- Firebase (Google Cloud) requires signing a **Business Associate Agreement (BAA)**
- Google has a BAA for Google Cloud/Firebase — request it via Google Cloud Console
- Audio files should not be permanently stored (verify `AUTO_DELETE_AUDIO` logic works)
- Firestore patient data should not contain PHI (Protected Health Information) beyond what's necessary

### 16. Analytics
Zero insight into how users interact with the app. Firebase Analytics is free and integrates easily:
```bash
# No extra package needed — firebase/analytics is in the firebase package
import { getAnalytics, logEvent } from 'firebase/analytics';
```
Key events to track: `consultation_started`, `soap_generated`, `pdf_exported`, `upgrade_prompted`, `payment_initiated`.

### 17. Offline/No-Internet Handling
What happens when a user starts a consultation with no internet?
- `expo-av` records fine offline
- Transcription (`Groq Whisper`) will fail
- SOAP generation will fail
Add a connectivity check before starting a consultation and show a clear error, not a spinner that hangs.

### 18. CDSCO Regulatory Check (India)
In India, software that aids in clinical diagnosis/documentation may fall under the Central Drugs Standard Control Organisation (CDSCO) medical device regulations (Software as a Medical Device, SaMD). The app generates SOAP notes which are clinical documents.
Recommended: consult a medical regulatory advisor before large-scale commercial launch.

### 19. Internal Testing Track → Closed Beta → Production
Do NOT publish straight to production on first submission. Use Play Console's tracks:
1. **Internal testing** → install on your own devices via Play Console
2. **Closed testing (alpha/beta)** → ~10-50 real doctors test it
3. **Production** → public release

This lets you catch issues before millions of users see them.

### 20. Onboarding Flow
No onboarding after signup. New users land directly on Dashboard with no explanation of what the app does. Consider a 3-screen onboarding that explains: Record → Transcribe → SOAP note.

---

## Summary Checklist

```
HARD BLOCKERS
[ ] Resolve Google Play Billing policy (Option A, B, or C)
[ ] Deploy Firebase Cloud Functions
[ ] Deploy Firestore rules
[ ] Host Privacy Policy at a public HTTPS URL
[ ] Fill out Data Safety form in Play Console
[ ] Obtain/upload release keystore
[ ] Create Google Play Developer account ($25)

IMPORTANT
[ ] Content rating questionnaire (in Play Console)
[ ] Add adaptiveIcon to app.config.js
[ ] Create store listing assets (icon 512px, feature graphic, 2+ screenshots)
[ ] Write short + full app description
[ ] Set up crash reporting (Firebase Crashlytics)
[ ] Fill in 4 production env vars (go-live step)
[ ] Subscription cancellation flow (depends on billing decision)
[ ] Microphone permission pre-explanation UX

NICE TO HAVE
[ ] Firebase Analytics events
[ ] BAA with Google Cloud for HIPAA
[ ] Offline/no-internet error handling
[ ] CDSCO regulatory review
[ ] 3-screen onboarding flow
[ ] Internal testing → closed beta → production track progression
```

---

*Last updated: 2026-03-21*
