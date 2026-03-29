# VitalNoteAI Payments — Setup & Going Live

## Architecture Overview

| Layer | Technology | Role |
|-------|-----------|------|
| Payment backend | Firebase Cloud Functions | Order creation, signature verification, webhooks |
| Subscription data | Firebase Firestore | Stores plan, expiry, daily note count per user |
| Razorpay checkout | Chrome Custom Tab (expo-web-browser) | HTML page served by Firebase Function |
| Stripe checkout | Stripe Hosted Checkout (Chrome Custom Tab) | Stripe-hosted page, redirects via deep link |
| Business logic | `src/services/PlanManager.js` | canGenerateNote, incrementNoteCount, etc. |

**No native Razorpay/Stripe SDK required.** The checkout opens in the system browser.

---

## One-Time Setup (do this once, before going live)

### 0. Prerequisites
```bash
npm install -g firebase-tools
firebase login
firebase use vitalnoteai-19c6d
```

### 1. Install dependencies for Firebase Functions
```bash
cd functions
npm install
cd ..
```

### 2. Install expo-web-browser (if not already installed)
```bash
npx expo install expo-web-browser
```

### 3. Deploy Firestore security rules
```bash
firebase deploy --only firestore:rules
```

### 4. Deploy Firebase Functions (with test credentials)
```bash
# Copy example env and fill in test credentials
cp functions/.env.example functions/.env
# Edit functions/.env with your test Razorpay & Stripe keys, then:
firebase deploy --only functions
```

---

## Going Live — 4 Steps, Nothing Else

### Step 1: Razorpay (Indian payments)

Replace in `.env` (app-level):
```
RAZORPAY_KEY_ID=rzp_live_YOUR_LIVE_KEY_ID
```

Replace in `functions/.env`:
```
RAZORPAY_KEY_ID=rzp_live_YOUR_LIVE_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_LIVE_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
```

**Create subscription plans** in Razorpay Dashboard → Products → Plans:
| Plan | Interval | Amount |
|------|----------|--------|
| Monthly | monthly / count=1 | ₹1,599 |
| Quarterly | monthly / count=3 | ₹4,999 |
| Annual | yearly / count=1 | ₹12,499 |

Then copy the generated Plan IDs into `functions/.env`:
```
RAZORPAY_PLAN_MONTHLY=plan_XXXXXXXXXXXXXX
RAZORPAY_PLAN_QUARTERLY=plan_XXXXXXXXXXXXXX
RAZORPAY_PLAN_ANNUAL=plan_XXXXXXXXXXXXXX
```

**Set webhook URL** in Razorpay Dashboard → Settings → Webhooks:
```
https://us-central1-vitalnoteai-19c6d.cloudfunctions.net/razorpayWebhook
```
Enable events: `payment.captured`, `subscription.activated`, `subscription.cancelled`, `subscription.expired`

---

### Step 2: Stripe (International payments)

Replace in `.env` (app-level):
```
STRIPE_PUBLIC_KEY=pk_live_YOUR_LIVE_PUBLISHABLE_KEY
```

Replace in `functions/.env`:
```
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SIGNING_SECRET
```

**Create products & prices** in Stripe Dashboard → Products:
| Product | Price | Interval |
|---------|-------|----------|
| VitalNoteAI Monthly | $19.00 | Monthly recurring |
| VitalNoteAI Quarterly | $60.00 | Every 3 months recurring |
| VitalNoteAI Annual | $150.00 | Yearly recurring |
| VitalNoteAI Lifetime | $650.00 | One-time payment |

Copy Price IDs into `functions/.env`:
```
STRIPE_PRICE_MONTHLY=price_XXXXXXXXXXXXXX
STRIPE_PRICE_QUARTERLY=price_XXXXXXXXXXXXXX
STRIPE_PRICE_ANNUAL=price_XXXXXXXXXXXXXX
STRIPE_PRICE_LIFETIME=price_XXXXXXXXXXXXXX
```

**Set webhook URL** in Stripe Dashboard → Developers → Webhooks:
```
https://us-central1-vitalnoteai-19c6d.cloudfunctions.net/stripeWebhook
```
Enable events: `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`, `invoice.payment_failed`

Copy the signing secret into `functions/.env` as `STRIPE_WEBHOOK_SECRET`.

---

### Step 3: Deploy with live credentials
```bash
firebase deploy --only functions
```

No changes to any source code. The functions read from `functions/.env` at deploy time.

---

### Step 4: Rebuild the app
```bash
eas build --profile production --platform android
```

The new `.env` values (RAZORPAY_KEY_ID, STRIPE_PUBLIC_KEY) will be baked into the app bundle. Payment buttons appear automatically.

---

## That's it. The integration is complete.

---

## Database Schema (Firestore)

Collection: `users`
Document ID: Firebase Auth UID

```
users/{uid}:
  plan:               "free" | "monthly" | "quarterly" | "annual" | "lifetime"
  dailyNoteCount:     0         — resets each new day
  lastNoteDate:       "YYYY-MM-DD" | null
  subscriptionId:     string | null   — Razorpay payment ID or Stripe subscription ID
  subscriptionExpiry: Timestamp | null — null for lifetime
  paymentGateway:     "razorpay" | "stripe" | null
  lifetimeAccess:     false | true
  createdAt:          Timestamp
  updatedAt:          Timestamp
```

No migration needed — Firestore is schemaless. Documents are created with defaults on first note generation.

---

## Business Logic Reference

| Rule | Behavior |
|------|---------|
| Free tier | 3 notes/day, resets at midnight local time |
| Paid plan expired | Auto-downgraded to free silently |
| Lifetime | Bypasses all limits forever |
| Billing error | App fails OPEN — doctor always gets their note |
| Invoice payment failed | 3-day grace period (Stripe retries); only downgrades on subscription.deleted |

---

## Local Test Checklist

Before going live, verify all 14 items:

1. `npx expo start` with no payment env vars set → app boots normally
2. `npx expo start` with placeholder test keys → app boots normally
3. Free user can generate 3 notes, blocked on 4th → UpgradeModal appears
4. UpgradeModal dismissal suppresses for 1 hour
5. UsageBanner shows correct count on Dashboard
6. `/Pricing` screen shows "Payments Coming Soon" when no gateway configured
7. `/Pricing` screen shows payment buttons when test keys are set
8. Razorpay test checkout opens (rzp_test_*)
9. Stripe test checkout opens (pk_test_*)
10. Webhook endpoints return 200 for valid test payloads
11. Webhook endpoints return 400 for invalid Stripe signatures
12. After simulated payment, plan upgrades in Firestore
13. Lifetime user bypasses all note limits
14. Expired subscription auto-downgrades to free tier

---

## Troubleshooting

**Payment button shows "Opening…" but nothing happens**
- Check that `FIREBASE_FUNCTIONS_URL` is correct in `.env`
- Verify Functions are deployed: `firebase functions:list`
- Check Chrome Custom Tab is available (requires Android 5+)

**"No Stripe price configured for plan: …" error**
- Add `STRIPE_PRICE_MONTHLY`, etc. to `functions/.env` and redeploy

**Deep link doesn't return to app after payment**
- Ensure `scheme: "vitalnoteai"` is in `app.config.js`
- Rebuild the app after config changes

**Subscription not updating in app after payment**
- Plan is updated in Firestore by both the verify endpoint (immediate) and webhook (backup)
- Check Firebase Functions logs: `firebase functions:log`
- Manual fix: update `users/{uid}` in Firestore console
