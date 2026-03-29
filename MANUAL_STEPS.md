# VitalNoteAI — Manual Action Guide

> These are steps **only you can do** — they involve external dashboards, your own accounts,
> and decisions that cannot be automated. Each section is written as numbered baby steps.
> You do not need to be technical to follow them.

---

## ✅ Already Confirmed Done (no action needed)

| Item | Status |
|------|--------|
| M8 — targetSdkVersion = 35 | ✅ Already set in `app.config.js` |
| M3 — Disclaimer on first launch | ✅ Already works in the app |
| L5 — App version shown in Profile | ✅ Already shown using expo-application |

---

## 🔴 B4 — Download & Safely Back Up Your Signing Keystore

**Why this matters:** The keystore is a secret file that proves YOU are the owner of
`com.meditron.vitalnoteai` on the Play Store. If you lose it, Google will never let you
update your app again. You would have to publish as a completely new app.

**Steps:**

1. Open your terminal / WSL and type:
   ```
   eas credentials
   ```
   Press **Enter**.

2. You will see a menu. Use the arrow keys to select:
   ```
   Android
   ```
   Press **Enter**.

3. Select:
   ```
   Keystore: Manage your Android Keystore
   ```
   Press **Enter**.

4. Select:
   ```
   Download existing keystore
   ```
   Press **Enter**.

5. EAS will download a file called something like `vitalnoteai.jks` into your current folder.

6. **Store this file in at least TWO safe places:**
   - Upload it to a password manager that supports file attachments
     (Bitwarden, 1Password, or Dashlane all support this — it's free).
   - Also copy it to a USB drive or Google Drive in a folder only you can access.

7. Also note down these three pieces of information from the EAS output
   (they are shown alongside the keystore download):
   - **Key alias** (something like `your-key-alias`)
   - **Key password**
   - **Keystore password**

   Write these in your password manager alongside the `.jks` file.

---

## 🔴 B2 — Verify google-services.json Is No Longer in Git

**Why this matters:** This file contains your Firebase project ID, API key, and OAuth
client ID. If it was ever committed, it lives in your git history and can be seen by anyone
with access to your repository.

**Steps:**

1. Open your terminal in the project folder and run:
   ```
   git log --all --full-history -- google-services.json
   ```

2. **If you see NO output** → the file was never committed. You are safe. Done. ✅

3. **If you see one or more commit lines** → the file was committed before. Follow these steps:

   a. Install the BFG Repo Cleaner (a tool that scrubs files from git history):
      ```
      # On Ubuntu/WSL:
      sudo apt install bfg
      ```
      Or download the `.jar` from: https://rtyley.github.io/bfg-repo-cleaner/

   b. Make a fresh backup of your repo first:
      ```
      cp -r VitalNoteAI VitalNoteAI_backup
      ```

   c. Run BFG to delete the file from all history:
      ```
      bfg --delete-files google-services.json VitalNoteAI/
      ```

   d. Clean up the git repository:
      ```
      cd VitalNoteAI
      git reflog expire --expire=now --all
      git gc --prune=now --aggressive
      ```

   e. Force-push the cleaned history:
      ```
      git push origin --force --all
      ```

   f. **Important:** After this, go to your Firebase Console → Project Settings →
      **Regenerate your Web API Key** (to invalidate the old committed key).

---

## 🟠 H5 — Audit Your Firebase Security Rules

**Why this matters:** If your Firestore security rules are set to `allow read, write: if true`,
then ANYONE on the internet can read or write any patient data in your database.

**Steps:**

1. Go to: https://console.firebase.google.com
   Log in with your Google account.

2. Click on your project: **vitalnoteai-19c6d**

3. In the left menu, click **Firestore Database**.

4. Click the **Rules** tab at the top.

5. You will see your current rules. If they say anything like:
   ```
   allow read, write: if true;
   ```
   That means your database is wide open. Continue to step 6.

6. Replace your rules with these secure rules
   (they ensure users can only see their own data):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {

       // Users can only access their own profile data
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }

       // Crash logs: only the authenticated user who created it can write
       match /crash_logs/{logId} {
         allow create: if request.auth != null;
         allow read: if false; // admin only — read via Firebase console
       }

       // Block everything else by default
       match /{document=**} {
         allow read, write: if false;
       }
     }
   }
   ```

7. Click **Publish**.

8. Test that your app still works by logging in and generating a SOAP note.

---

## 🟡 M7 — Prepare Your Play Store Listing

**Why this matters:** Without these assets you cannot submit to the Play Store at all.
Google requires all of them.

### What you need to create:

**A) App Icon (already handled by Expo — skip)**

**B) Feature Graphic** (the banner shown at the top of your Play Store page)
- Size: **1024 × 500 pixels**, PNG or JPEG
- Content: Your app logo + a short tagline like "AI-Powered Clinical Notes in Seconds"
- Tool: Use Canva (free) → New Design → Custom Size → 1024 × 500

**C) Screenshots** (minimum 2, recommended 4–8)
- Size: Between **1080 × 1920** and **1080 × 2400** pixels (portrait)
- Take them from your physical Android device or emulator
- Suggested screenshots:
  1. Dashboard screen (shows time saved stats)
  2. New Consultation form
  3. Recording in progress (with the audio visualizer)
  4. Generated SOAP note (with quality metrics visible)
- **Remove any real patient data** before screenshotting. Use a test name like "John Doe".
- Tool: Press Volume Down + Power on your Android device simultaneously.

**D) Short Description** (max 80 characters):
```
AI generates clinical SOAP notes from your voice in seconds.
```

**E) Full Description** (max 4,000 characters) — suggested:
```
VitalNoteAI lets doctors dictate patient consultations and instantly
receive a structured, validated SOAP note — powered by AI.

Stop spending 10–15 minutes per patient on documentation.
Speak naturally, review the note in seconds, export as PDF.

Features:
• Voice-to-SOAP in under 30 seconds
• 5-agent AI validation catches hallucinations before you review
• Quality score on every note
• Multi-language support
• PDF export for EHR integration
• Works offline for recording (transcription requires connection)

VitalNoteAI is a documentation assistant only.
It does not provide medical advice or diagnosis.
Always review AI-generated notes before use.
```

**F) Content Rating Questionnaire**
- Go to Play Console → Your App → Policy → App Content → Content Rating
- Answer all questions (it takes 5 minutes)
- For a medical documentation app, select: **Medical** category
- Answer "No" to violence, sexual content, and user-generated content

### How to upload to Play Console:
1. Go to: https://play.google.com/console
2. Sign in and select your app
3. Click **Store presence → Main store listing**
4. Upload the Feature Graphic and Screenshots
5. Paste the Short and Full descriptions
6. Click **Save**

---

## 🟡 M4 — Set Up In-App Update Prompts (Future)

> Skip this until you have your first published version on the Play Store.
> Once published, come back and ask to implement `expo-updates` + in-app update checks.

---

## ⏳ B3 — Future: Backend Proxy for AI Calls (Advanced)

**What this means:** Right now, your Groq and HuggingFace API keys live on the device
inside the app. Anyone who decompiles the APK with a tool like `apktool` could extract them.

**What the fix looks like (high level):**
1. Create a Firebase Cloud Function (a small piece of server code that runs in Google's cloud)
2. That function receives the audio or text from your app and calls Groq/HF on your behalf
3. The function holds the API keys — the app holds nothing sensitive
4. Your app calls YOUR Firebase function URL instead of Groq directly

**When to do this:** Before you exceed 100 active users or if a key gets abused.
It requires rewriting `aiService.js` and `AgenticSOAPService.js` to call Firebase instead
of Groq directly, and writing Cloud Functions code in Node.js.
Ask for this as a dedicated session when you're ready.

---

*Last updated: 2026-03-11 — Generated by VitalNoteAI development session.*
