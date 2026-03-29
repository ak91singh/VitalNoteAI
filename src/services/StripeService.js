// StripeService.js — Stripe Checkout flow for React Native
//
// Flow:
//   1. Call Firebase Function to create Stripe Checkout Session
//   2. Open Stripe-hosted checkout URL in the device's default browser
//   3. User completes payment → Stripe redirects to vitalnoteai://payment/success?...
//   4. Android deep-link handling brings the app back to foreground with the URL
//   5. Call Firebase Function to verify session and confirm plan upgrade
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
// initiateStripeCheckout(plan, userId, userEmail)
// Returns: { success, mock, cancelled, plan, expiry }
// ─────────────────────────────────────────────────────────────────────────────
export async function initiateStripeCheckout(plan, userId, userEmail) {
    // 1. Create Checkout Session via Firebase Function
    let sessionData;
    try {
        const res = await fetch(`${BASE}/createStripeSession`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan, userId, userEmail }),
        });
        sessionData = await res.json();
    } catch (err) {
        throw new Error('Could not reach payment server. Check your internet connection.');
    }

    if (sessionData.error) {
        throw new Error(sessionData.error);
    }

    if (sessionData.mock) {
        return { mock: true };
    }

    if (!sessionData.sessionUrl) {
        throw new Error('Failed to get checkout URL from server.');
    }

    // 2. Open Stripe Checkout in device browser and wait for deep-link redirect
    const url = await _openAndWaitForRedirect(sessionData.sessionUrl, 'vitalnoteai://payment');
    if (!url) return { cancelled: true };

    if (url.includes('/payment/cancelled')) {
        return { cancelled: true };
    }

    // 3. Parse and verify via Firebase Function
    try {
        const parsed = new URL(url);
        const sessionId = parsed.searchParams.get('session_id');
        const returnedPlan = parsed.searchParams.get('plan') || plan;

        if (!sessionId || sessionId.includes('mock')) {
            // Mock session for test mode
            return { success: true, plan: returnedPlan, expiry: null };
        }

        const verifyRes = await fetch(`${BASE}/verifyStripeSession`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, userId }),
        });
        const verifyData = await verifyRes.json();

        if (!verifyData.valid) {
            throw new Error(verifyData.error || 'Session verification failed');
        }

        return {
            success: true,
            plan:   verifyData.plan || returnedPlan,
            expiry: verifyData.expiry || null,
        };
    } catch (err) {
        throw new Error(`Payment verification error: ${err.message}`);
    }
}
