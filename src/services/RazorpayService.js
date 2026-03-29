// RazorpayService.js — Razorpay payment flow for React Native
//
// Flow:
//   1. Call Firebase Function to create Razorpay order
//   2. Open Firebase Function HTML checkout page in the device's default browser
//   3. User completes payment → page redirects to vitalnoteai://payment/success?...
//   4. Android deep-link handling brings the app back to foreground with the URL
//   5. Call Firebase Function to verify signature and upgrade plan in Firestore
//
// Uses React Native's built-in Linking API — no extra native module required.

import { Linking, AppState } from 'react-native';
import { CONFIG } from '../config';

const BASE = CONFIG.FIREBASE_FUNCTIONS_URL;

// ─────────────────────────────────────────────────────────────────────────────
// _openAndWaitForRedirect(url, prefix)
// Opens a URL in the device browser and resolves when a matching deep-link
// redirect arrives (returns the URL string), or null if the user cancels.
// ─────────────────────────────────────────────────────────────────────────────
function _openAndWaitForRedirect(url, prefix) {
    return new Promise((resolve, reject) => {
        let settled = false;

        const settle = (value) => {
            if (settled) return;
            settled = true;
            urlSub.remove();
            stateSub.remove();
            clearTimeout(timer);
            resolve(value);
        };

        // Resolve when the payment deep-link redirect arrives
        const urlSub = Linking.addEventListener('url', ({ url: incoming }) => {
            if (incoming.startsWith(prefix)) settle(incoming);
        });

        // When app returns to foreground without a deep-link → user cancelled
        let wentBackground = false;
        const stateSub = AppState.addEventListener('change', (state) => {
            if (state === 'background' || state === 'inactive') {
                wentBackground = true;
            } else if (state === 'active' && wentBackground) {
                // 1 s grace period — let the URL event arrive first if it's coming
                setTimeout(() => settle(null), 1000);
            }
        });

        // 5-minute absolute timeout (safety net)
        const timer = setTimeout(() => settle(null), 5 * 60 * 1000);

        // Open the checkout page
        Linking.openURL(url).catch((err) => {
            if (!settled) {
                settled = true;
                urlSub.remove();
                stateSub.remove();
                clearTimeout(timer);
                reject(err);
            }
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// initiateRazorpayCheckout(plan, userId, userEmail)
// Returns: { success, mock, cancelled, paymentId, orderId, plan, expiry }
// ─────────────────────────────────────────────────────────────────────────────
export async function initiateRazorpayCheckout(plan, userId, userEmail) {
    // 1. Create order via Firebase Function (keeps secret key server-side)
    let orderData;
    try {
        const res = await fetch(`${BASE}/createRazorpayCheckout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan, userId, userEmail }),
        });
        orderData = await res.json();
    } catch (err) {
        throw new Error('Could not reach payment server. Check your internet connection.');
    }

    if (orderData.error) {
        throw new Error(orderData.error);
    }

    if (orderData.mock) {
        // Gateway not configured — return mock for test UI validation
        return { mock: true };
    }

    // 2. Build checkout page URL (served by Firebase Function)
    const params = new URLSearchParams({
        orderId:  orderData.orderId,
        amount:   String(orderData.amount),
        currency: orderData.currency || 'INR',
        keyId:    orderData.keyId,
        planName: orderData.planName || plan,
        email:    userEmail || '',
        plan:     plan,
    });
    const checkoutUrl = `${BASE}/razorpayCheckoutPage?${params.toString()}`;

    // 3. Open in device browser and wait for deep-link redirect
    const url = await _openAndWaitForRedirect(checkoutUrl, 'vitalnoteai://payment');
    if (!url) return { cancelled: true };

    // 4. Parse the deep link URL
    if (url.includes('/payment/cancelled')) {
        return { cancelled: true };
    }

    try {
        const parsed = new URL(url);
        const paymentId = parsed.searchParams.get('payment_id');
        const orderId   = parsed.searchParams.get('order_id');
        const signature = parsed.searchParams.get('signature');

        if (!paymentId || !orderId || !signature) {
            throw new Error('Incomplete payment params in redirect URL');
        }

        // 5. Verify signature via Firebase Function (server-side HMAC check)
        const verifyRes = await fetch(`${BASE}/verifyRazorpayPayment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, paymentId, signature, userId, plan }),
        });
        const verifyData = await verifyRes.json();

        if (!verifyData.valid) {
            throw new Error(verifyData.error || 'Payment verification failed');
        }

        return {
            success: true,
            plan:      verifyData.plan || plan,
            expiry:    verifyData.expiry || null,
            paymentId,
            orderId,
        };
    } catch (err) {
        throw new Error(`Payment verification error: ${err.message}`);
    }
}
