// PlanManager.js — Core billing logic for VitalNoteAI
//
// Reads/writes the 'users/{uid}' Firestore document.
// All functions handle their own errors internally — the calling code
// (ConsultationScreen, etc.) never needs to handle billing logic.
//
// FAIL-OPEN POLICY: If any billing check throws, the app allows the
// doctor to proceed. A billing error must never block patient care.

import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// ISO date string for "today" in local timezone — used for daily reset logic
function _todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Initialize user doc with defaults on first access
async function _getOrInitUserDoc(userId) {
    const ref = doc(db, 'users', userId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        const defaults = {
            plan: 'free',
            dailyNoteCount: 0,
            lastNoteDate: null,
            subscriptionId: null,
            subscriptionExpiry: null,
            paymentGateway: null,
            lifetimeAccess: false,
            createdAt: serverTimestamp(),
        };
        // setDoc with merge:false to avoid race conditions on first init
        await setDoc(ref, defaults);
        return defaults;
    }
    return snap.data();
}

// ─────────────────────────────────────────────────────────────────────────────
// canGenerateNote(userId)
// Returns: { allowed: boolean, reason: string, notesRemaining: number }
// ─────────────────────────────────────────────────────────────────────────────
export async function canGenerateNote(userId) {
    const data = await _getOrInitUserDoc(userId);
    const now = new Date();

    // 1. Lifetime access — always allowed
    if (data.lifetimeAccess === true) {
        return { allowed: true, reason: 'lifetime', notesRemaining: Infinity };
    }

    // 2. Check paid plan expiry and auto-downgrade if expired
    const expiry = data.subscriptionExpiry?.toDate?.() ?? null;
    const isPaid = data.plan && data.plan !== 'free';

    if (isPaid && expiry && expiry < now) {
        // Subscription expired — silently downgrade, then apply free tier logic below
        await _silentDowngrade(userId);
        data.plan = 'free';
    }

    // 3. Active paid plan with valid expiry (or no-expiry for grandfathered cases)
    if (isPaid && (!expiry || expiry >= now)) {
        return { allowed: true, reason: 'paid_plan', notesRemaining: Infinity };
    }

    // 4. Free tier: 3 notes per day, resets at midnight local time
    const today = _todayStr();
    const lastDate = data.lastNoteDate ?? null;
    const count = lastDate === today ? (data.dailyNoteCount ?? 0) : 0;
    const FREE_LIMIT = 3;

    if (count < FREE_LIMIT) {
        return { allowed: true, reason: 'free_tier', notesRemaining: FREE_LIMIT - count };
    }

    return { allowed: false, reason: 'daily_limit', notesRemaining: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// incrementNoteCount(userId)
// Call AFTER a note is successfully generated. Never throws.
// ─────────────────────────────────────────────────────────────────────────────
export async function incrementNoteCount(userId) {
    try {
        const ref = doc(db, 'users', userId);
        const snap = await getDoc(ref);
        const today = _todayStr();

        if (!snap.exists()) {
            await setDoc(ref, {
                dailyNoteCount: 1,
                lastNoteDate: today,
                plan: 'free',
                lifetimeAccess: false,
            }, { merge: true });
            return;
        }

        const data = snap.data();
        const lastDate = data.lastNoteDate ?? null;
        const currentCount = lastDate === today ? (data.dailyNoteCount ?? 0) : 0;

        await updateDoc(ref, {
            dailyNoteCount: currentCount + 1,
            lastNoteDate: today,
        });
    } catch (err) {
        // Never throw — billing errors must not block doctors
        console.warn('[PlanManager] incrementNoteCount error (non-fatal):', err?.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// getPlanStatus(userId)
// Returns: { plan, notesUsed, notesRemaining, expiry, isLifetime, gateway, daysUntilExpiry }
// ─────────────────────────────────────────────────────────────────────────────
export async function getPlanStatus(userId) {
    try {
        const data = await _getOrInitUserDoc(userId);
        const now = new Date();
        const expiry = data.subscriptionExpiry?.toDate?.() ?? null;
        const today = _todayStr();
        const lastDate = data.lastNoteDate ?? null;
        const dailyUsed = lastDate === today ? (data.dailyNoteCount ?? 0) : 0;

        const isPaidActive = data.lifetimeAccess
            || (data.plan !== 'free' && (!expiry || expiry > now));

        const notesRemaining = isPaidActive ? Infinity : Math.max(0, 3 - dailyUsed);

        let daysUntilExpiry = null;
        if (expiry) {
            daysUntilExpiry = Math.max(0, Math.ceil((expiry - now) / 86400000));
        }

        return {
            plan: data.plan || 'free',
            notesUsed: dailyUsed,
            notesRemaining,
            expiry,
            isLifetime: data.lifetimeAccess === true,
            gateway: data.paymentGateway || null,
            daysUntilExpiry,
        };
    } catch (err) {
        console.warn('[PlanManager] getPlanStatus error:', err?.message);
        // Return safe defaults on error — free tier
        return {
            plan: 'free',
            notesUsed: 0,
            notesRemaining: 3,
            expiry: null,
            isLifetime: false,
            gateway: null,
            daysUntilExpiry: null,
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// upgradePlan(userId, plan, gateway, subscriptionId, expiryDate)
// Called locally after client-side payment verification succeeds.
// Firestore is also updated server-side via Firebase Functions webhook.
// ─────────────────────────────────────────────────────────────────────────────
export async function upgradePlan(userId, plan, gateway, subscriptionId, expiryDate) {
    await setDoc(doc(db, 'users', userId), {
        plan,
        paymentGateway: gateway,
        subscriptionId: subscriptionId || null,
        subscriptionExpiry: expiryDate || null,
        lifetimeAccess: plan === 'lifetime',
        updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log(`[PlanManager] Plan upgraded: ${userId} → ${plan}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// downgradePlan(userId)
// Resets to free. Preserves dailyNoteCount and lastNoteDate (usage history).
// ─────────────────────────────────────────────────────────────────────────────
export async function downgradePlan(userId) {
    await setDoc(doc(db, 'users', userId), {
        plan: 'free',
        subscriptionId: null,
        subscriptionExpiry: null,
        paymentGateway: null,
        lifetimeAccess: false,
        updatedAt: serverTimestamp(),
    }, { merge: true });
}

// Internal: silent downgrade without throwing
async function _silentDowngrade(userId) {
    try {
        await downgradePlan(userId);
    } catch (err) {
        console.warn('[PlanManager] Silent downgrade error (non-fatal):', err?.message);
    }
}
