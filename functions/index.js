'use strict';

// Firebase Cloud Functions — VitalNoteAI Payment Processing
// Deploy: firebase deploy --only functions
// Environment: copy functions/.env.example → functions/.env and fill in credentials

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

// ─── Helpers: lazy-load SDKs only when credentials are present ────────────
function getRazorpay() {
    const key_id = process.env.RAZORPAY_KEY_ID || '';
    const key_secret = process.env.RAZORPAY_KEY_SECRET || '';
    if (!key_id || key_id.includes('REPLACE') || !key_secret || key_secret.includes('REPLACE')) {
        return null;
    }
    const Razorpay = require('razorpay');
    return new Razorpay({ key_id, key_secret });
}

function getStripe() {
    const key = process.env.STRIPE_SECRET_KEY || '';
    if (!key || key.includes('REPLACE')) return null;
    const Stripe = require('stripe');
    return Stripe(key);
}

function _cors(res, req) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return true; }
    return false;
}

// Plan amounts in paise (INR) — edit here to change pricing
const PLAN_AMOUNTS_INR = {
    monthly:   159900,   // ₹1,599
    quarterly: 499900,   // ₹4,999
    annual:    1249900,  // ₹12,499
    lifetime:  5499900,  // ₹54,999
};

const PLAN_NAMES = {
    monthly:   'VitalNoteAI Monthly Plan',
    quarterly: 'VitalNoteAI Quarterly Plan',
    annual:    'VitalNoteAI Annual Plan',
    lifetime:  'VitalNoteAI Lifetime Access',
};

// ─────────────────────────────────────────────────────────────────────────────
// RAZORPAY: Create order
// Called by: RazorpayService.js → initiateRazorpayCheckout()
// ─────────────────────────────────────────────────────────────────────────────
exports.createRazorpayCheckout = functions.https.onRequest(async (req, res) => {
    if (_cors(res, req)) return;

    const { plan, userId, userEmail } = req.body || {};

    if (!plan || !userId) {
        res.status(400).json({ error: 'plan and userId are required' });
        return;
    }

    const razorpay = getRazorpay();
    const keyId = process.env.RAZORPAY_KEY_ID || '';

    if (!razorpay || !keyId) {
        // Gateway not configured — return mock so test UI still renders
        res.status(200).json({
            mock: true,
            orderId: 'order_mock_test_00000',
            amount: PLAN_AMOUNTS_INR[plan] || 159900,
            keyId: 'rzp_test_mock',
        });
        return;
    }

    try {
        const order = await razorpay.orders.create({
            amount: PLAN_AMOUNTS_INR[plan] || 159900,
            currency: 'INR',
            notes: { userId, plan },
        });

        res.status(200).json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId,
            plan,
            planName: PLAN_NAMES[plan] || plan,
            userEmail: userEmail || '',
        });
    } catch (err) {
        console.error('[createRazorpayCheckout] Order creation failed:', err.message);
        res.status(500).json({ error: 'Failed to create payment order' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// RAZORPAY: Serve checkout HTML page
// This page is opened in expo-web-browser (Chrome Custom Tab).
// It loads Razorpay checkout.js and redirects to the deep link after payment.
// ─────────────────────────────────────────────────────────────────────────────
exports.razorpayCheckoutPage = functions.https.onRequest(async (req, res) => {
    const { orderId, amount, currency, keyId, planName, email, plan } = req.query;
    const scheme = process.env.APP_SCHEME || 'vitalnoteai';

    const amountDisplay = amount
        ? `₹${(parseInt(amount, 10) / 100).toLocaleString('en-IN')}`
        : '...';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VitalNoteAI — Secure Payment</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         background:#f0f4f8;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .card{background:#fff;border-radius:16px;padding:32px;max-width:420px;width:90%;
          box-shadow:0 4px 24px rgba(0,0,0,.12);text-align:center}
    .logo{font-size:48px;margin-bottom:8px}
    h1{color:#1565C0;font-size:22px;margin-bottom:4px}
    .plan{color:#666;font-size:14px;margin-bottom:24px}
    .amount{font-size:32px;font-weight:700;color:#1565C0;margin:16px 0}
    .btn{background:#1565C0;color:#fff;border:none;padding:16px;border-radius:10px;
         font-size:16px;font-weight:600;cursor:pointer;width:100%;margin-top:8px;
         display:flex;align-items:center;justify-content:center;gap:8px}
    .btn:disabled{background:#999;cursor:not-allowed}
    .btn:hover:not(:disabled){background:#0d47a1}
    .secure{font-size:12px;color:#aaa;margin-top:16px}
    .spinner{display:none;width:20px;height:20px;border:3px solid rgba(255,255,255,.3);
             border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    #status{margin-top:16px;font-size:14px;color:#1565C0;min-height:20px}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🏥</div>
    <h1>VitalNoteAI</h1>
    <div class="plan">${planName || 'Subscription'}</div>
    <div class="amount">${amountDisplay}</div>
    <button class="btn" id="payBtn" onclick="startPayment()">
      <span id="btnText">Pay Securely with Razorpay</span>
      <span class="spinner" id="spinner"></span>
    </button>
    <div class="secure">🔒 Secured by Razorpay · 256-bit encryption</div>
    <div id="status"></div>
  </div>

  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    function setLoading(on) {
      document.getElementById('payBtn').disabled = on;
      document.getElementById('btnText').textContent = on ? 'Processing…' : 'Pay Securely with Razorpay';
      document.getElementById('spinner').style.display = on ? 'inline-block' : 'none';
    }

    function startPayment() {
      setLoading(true);
      var options = {
        key: "${keyId}",
        amount: "${amount}",
        currency: "${currency || 'INR'}",
        order_id: "${orderId}",
        name: "VitalNoteAI",
        description: "${planName || 'Subscription'}",
        prefill: { email: "${email || ''}" },
        theme: { color: "#1565C0" },
        handler: function(response) {
          document.getElementById('status').textContent = '✓ Payment successful! Returning to app…';
          var params = [
            'payment_id=' + encodeURIComponent(response.razorpay_payment_id),
            'order_id='   + encodeURIComponent(response.razorpay_order_id),
            'signature='  + encodeURIComponent(response.razorpay_signature),
            'gateway=razorpay',
            'plan=${plan || ''}'
          ].join('&');
          // Redirect to deep link — Chrome Custom Tab intercepts and returns to app
          setTimeout(function() {
            window.location.href = '${scheme}://payment/success?' + params;
          }, 600);
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
            document.getElementById('status').textContent = 'Payment cancelled.';
            setTimeout(function() {
              window.location.href = '${scheme}://payment/cancelled';
            }, 800);
          }
        }
      };
      try {
        var rzp = new Razorpay(options);
        rzp.open();
      } catch(e) {
        setLoading(false);
        document.getElementById('status').textContent = 'Error: ' + e.message;
      }
    }

    // Auto-open checkout on page load for smoother UX
    window.addEventListener('load', function() {
      setTimeout(startPayment, 500);
    });
  </script>
</body>
</html>`;

    res.set('Content-Type', 'text/html');
    res.send(html);
});

// ─────────────────────────────────────────────────────────────────────────────
// RAZORPAY: Verify payment signature + upgrade plan
// Called by: RazorpayService.js → verifyAndUpgrade()
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyRazorpayPayment = functions.https.onRequest(async (req, res) => {
    if (_cors(res, req)) return;

    const { orderId, paymentId, signature, userId, plan } = req.body || {};
    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

    if (!keySecret || keySecret.includes('REPLACE')) {
        res.status(400).json({ valid: false, error: 'Gateway not configured' });
        return;
    }

    if (!orderId || !paymentId || !signature || !userId) {
        res.status(400).json({ valid: false, error: 'Missing required fields' });
        return;
    }

    const expectedSig = crypto
        .createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

    if (expectedSig !== signature) {
        res.status(400).json({ valid: false, error: 'Invalid payment signature' });
        return;
    }

    try {
        const expiry = _calculateExpiry(plan);
        await _upgradePlan(userId, plan, 'razorpay', paymentId, expiry);
        res.status(200).json({
            valid: true,
            plan,
            expiry: expiry ? expiry.toISOString() : null,
        });
    } catch (err) {
        console.error('[verifyRazorpayPayment] Plan upgrade failed:', err.message);
        // Payment WAS valid — return success so client shows success screen
        // Manual recovery: check Firestore and upgrade manually if needed
        res.status(200).json({
            valid: true,
            plan,
            upgradeError: 'Plan upgrade queued — contact support if not reflected in 5 min',
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// RAZORPAY: Webhook
// Backup confirmation for all payment events.
// Always returns 200 to prevent Razorpay retry loops.
// ─────────────────────────────────────────────────────────────────────────────
exports.razorpayWebhook = functions.https.onRequest(async (req, res) => {
    // Acknowledge FIRST — Razorpay needs a 200 within 5 seconds
    res.status(200).send('OK');

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    if (webhookSecret && !webhookSecret.includes('REPLACE')) {
        const sig = req.headers['x-razorpay-signature'] || '';
        const expected = crypto
            .createHmac('sha256', webhookSecret)
            .update(JSON.stringify(req.body))
            .digest('hex');
        if (sig !== expected) {
            console.warn('[razorpayWebhook] Invalid signature — ignoring event');
            return;
        }
    }

    const event = req.body.event;
    const payload = req.body.payload;

    try {
        if (event === 'payment.captured') {
            const payment = payload?.payment?.entity;
            const userId = payment?.notes?.userId;
            const plan = payment?.notes?.plan;
            if (userId && plan) {
                const expiry = _calculateExpiry(plan);
                await _upgradePlan(userId, plan, 'razorpay', payment.id, expiry);
                console.log(`[razorpayWebhook] payment.captured: userId=${userId} plan=${plan}`);
            }

        } else if (event === 'subscription.activated') {
            const sub = payload?.subscription?.entity;
            const userId = sub?.notes?.userId;
            const plan = sub?.notes?.plan;
            if (userId && plan) {
                const expiry = new Date(sub.current_end * 1000);
                await _upgradePlan(userId, plan, 'razorpay', sub.id, expiry);
            }

        } else if (event === 'subscription.cancelled' || event === 'subscription.expired') {
            const sub = payload?.subscription?.entity;
            const userId = sub?.notes?.userId;
            if (userId) await _downgradePlan(userId);
        }
    } catch (err) {
        // Never crash the webhook handler — log and move on
        console.error('[razorpayWebhook] Processing error:', err.message);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// STRIPE: Create Checkout Session
// Called by: StripeService.js → initiateStripeCheckout()
// ─────────────────────────────────────────────────────────────────────────────
exports.createStripeSession = functions.https.onRequest(async (req, res) => {
    if (_cors(res, req)) return;

    const { plan, userId, userEmail } = req.body || {};
    const stripe = getStripe();
    const scheme = process.env.APP_SCHEME || 'vitalnoteai';

    if (!stripe) {
        res.status(200).json({ mock: true, sessionId: 'cs_test_mock_00000', sessionUrl: null });
        return;
    }

    const PRICE_IDS = {
        monthly:   process.env.STRIPE_PRICE_MONTHLY   || '',
        quarterly: process.env.STRIPE_PRICE_QUARTERLY || '',
        annual:    process.env.STRIPE_PRICE_ANNUAL    || '',
        lifetime:  process.env.STRIPE_PRICE_LIFETIME  || '',
    };

    const priceId = PRICE_IDS[plan];
    if (!priceId || priceId.includes('REPLACE')) {
        res.status(400).json({ error: `No Stripe price ID configured for plan: ${plan}. Add STRIPE_PRICE_${plan.toUpperCase()} to functions/.env` });
        return;
    }

    try {
        const isRecurring = plan !== 'lifetime';
        const params = {
            mode: isRecurring ? 'subscription' : 'payment',
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${scheme}://payment/success?gateway=stripe&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url:  `${scheme}://payment/cancelled`,
            metadata: { userId, plan },
        };
        if (userEmail) params.customer_email = userEmail;

        const session = await stripe.checkout.sessions.create(params);
        res.status(200).json({ sessionId: session.id, sessionUrl: session.url });
    } catch (err) {
        console.error('[createStripeSession] Session creation failed:', err.message);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// STRIPE: Verify checkout session (called client-side after success redirect)
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyStripeSession = functions.https.onRequest(async (req, res) => {
    if (_cors(res, req)) return;

    const { sessionId, userId } = req.body || {};
    const stripe = getStripe();

    if (!stripe) {
        res.status(400).json({ valid: false, error: 'Gateway not configured' });
        return;
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid' && session.status !== 'complete') {
            res.status(400).json({ valid: false, error: 'Payment not completed' });
            return;
        }

        const plan = session.metadata?.plan;
        const sessionUserId = session.metadata?.userId;

        // Security: userId in request must match metadata
        if (userId && sessionUserId && userId !== sessionUserId) {
            res.status(403).json({ valid: false, error: 'User mismatch' });
            return;
        }

        const expiry = _calculateExpiry(plan);
        await _upgradePlan(sessionUserId || userId, plan, 'stripe', session.subscription || session.id, expiry);

        res.status(200).json({
            valid: true,
            plan,
            expiry: expiry ? expiry.toISOString() : null,
        });
    } catch (err) {
        console.error('[verifyStripeSession] Error:', err.message);
        res.status(500).json({ valid: false, error: 'Verification failed' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// STRIPE: Webhook
// Handles subscription lifecycle events.
// Returns 400 on invalid signature, 200 otherwise.
// ─────────────────────────────────────────────────────────────────────────────
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    const stripe = getStripe();

    if (!stripe || !webhookSecret || webhookSecret.includes('REPLACE')) {
        res.status(200).send('Gateway not configured');
        return;
    }

    let event;
    try {
        // req.rawBody is the raw Buffer — required for signature verification
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
        console.warn('[stripeWebhook] Signature verification failed:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Acknowledge receipt immediately — process async
    res.status(200).send('OK');

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const userId = session.metadata?.userId;
            const plan = session.metadata?.plan;
            if (userId && plan) {
                const expiry = _calculateExpiry(plan);
                await _upgradePlan(userId, plan, 'stripe', session.subscription || session.id, expiry);
            }

        } else if (event.type === 'customer.subscription.deleted') {
            const sub = event.data.object;
            const snap = await db.collection('users')
                .where('subscriptionId', '==', sub.id)
                .limit(1).get();
            if (!snap.empty) await _downgradePlan(snap.docs[0].id);

        } else if (event.type === 'customer.subscription.updated') {
            const sub = event.data.object;
            if (sub.status === 'active') {
                const expiry = new Date(sub.current_period_end * 1000);
                const snap = await db.collection('users')
                    .where('subscriptionId', '==', sub.id)
                    .limit(1).get();
                if (!snap.empty) {
                    await db.collection('users').doc(snap.docs[0].id).update({
                        subscriptionExpiry: admin.firestore.Timestamp.fromDate(expiry),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
            }

        } else if (event.type === 'invoice.payment_failed') {
            // Grace period: do NOT downgrade immediately.
            // If payment fails 3× (Stripe default retry window), subscription.deleted fires.
            const invoice = event.data.object;
            console.warn('[stripeWebhook] invoice.payment_failed for customer:', invoice.customer,
                '— grace period active, not downgrading yet');
        }
    } catch (err) {
        console.error('[stripeWebhook] Processing error:', err.message);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────
function _calculateExpiry(plan) {
    if (!plan || plan === 'lifetime') return null;
    const d = new Date();
    if (plan === 'monthly')   { d.setMonth(d.getMonth() + 1);        return d; }
    if (plan === 'quarterly') { d.setMonth(d.getMonth() + 3);        return d; }
    if (plan === 'annual')    { d.setFullYear(d.getFullYear() + 1);  return d; }
    return null;
}

async function _upgradePlan(userId, plan, gateway, subscriptionId, expiryDate) {
    if (!userId) { console.warn('[_upgradePlan] No userId — skipping'); return; }
    await db.collection('users').doc(userId).set({
        plan:               plan,
        paymentGateway:     gateway,
        subscriptionId:     subscriptionId || null,
        subscriptionExpiry: expiryDate
            ? admin.firestore.Timestamp.fromDate(expiryDate)
            : null,
        lifetimeAccess:     plan === 'lifetime',
        updatedAt:          admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`[_upgradePlan] userId=${userId} plan=${plan} gateway=${gateway}`);
}

async function _downgradePlan(userId) {
    if (!userId) return;
    await db.collection('users').doc(userId).set({
        plan:               'free',
        subscriptionId:     null,
        subscriptionExpiry: null,
        paymentGateway:     null,
        lifetimeAccess:     false,
        updatedAt:          admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`[_downgradePlan] userId=${userId} → free`);
}
