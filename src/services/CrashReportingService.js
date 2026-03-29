/**
 * CrashReportingService — B7 (Play Store Readiness)
 *
 * Zero-package crash reporter built on the existing Firebase Firestore instance.
 * Captures two categories of failures:
 *
 *   1. Unhandled JS errors  — via ErrorUtils.setGlobalHandler()
 *   2. React render crashes — via ErrorBoundary.componentDidCatch() in App.js
 *
 * Design principles:
 *   - FAIL SILENT: every code path is try/caught; this service must NEVER cause a crash.
 *   - DEV EXCLUDED: logs are skipped in __DEV__ (Metro console already shows errors).
 *   - NO PATIENT DATA: stack traces contain only code paths; no transcripts, no SOAP content.
 *   - IDEMPOTENT INIT: calling initialize() multiple times is safe (guarded by _initialized flag).
 *
 * Firestore collection: crash_logs
 *   Each document contains: message, name, stack, appVersion, buildNumber,
 *   platform, platformVersion, userId (UID only, no PII), timestamp, source.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const CrashReportingService = {
  _initialized: false,

  /**
   * Call once at app startup (module level in App.js).
   * Installs a global handler for unhandled JS errors that happen outside the React tree
   * (e.g. in setTimeout callbacks, event listeners, or raw Promise rejections).
   */
  initialize() {
    if (this._initialized) return;
    this._initialized = true;

    try {
      // Preserve any handler that was already installed (e.g. by Expo internals)
      const existingHandler = ErrorUtils.getGlobalHandler();

      ErrorUtils.setGlobalHandler((error, isFatal) => {
        // Log to Firestore first (non-blocking), then let RN handle it normally
        this._log(error, { source: 'global_error_handler', isFatal: !!isFatal });
        if (typeof existingHandler === 'function') {
          existingHandler(error, isFatal);
        }
      });
    } catch (_) {
      // ErrorUtils unavailable — silently skip (e.g. web/test environment)
    }
  },

  /**
   * Called from ErrorBoundary.componentDidCatch() in App.js.
   * Captures React render errors with their component stack.
   *
   * @param {Error}  error     — the thrown error object
   * @param {Object} errorInfo — React errorInfo (contains componentStack)
   */
  reportBoundaryError(error, errorInfo) {
    this._log(error, {
      source: 'error_boundary',
      componentStack: errorInfo?.componentStack?.slice(0, 1000) || null,
    });
  },

  /**
   * Core log writer — sends a structured document to Firestore.
   * All errors are caught internally; failure here must never propagate.
   *
   * @param {Error|*} error    — the error to report
   * @param {Object}  context  — additional metadata (source, isFatal, etc.)
   */
  async _log(error, context = {}) {
    // Never send crash data in development — Metro console already has full details
    if (__DEV__) return;

    try {
      const user = auth.currentUser;

      await addDoc(collection(db, 'crash_logs'), {
        // ── Error fingerprint ──────────────────────────────────────────────────
        message:   error?.message   || String(error) || 'Unknown error',
        name:      error?.name      || 'Error',
        // Truncate stack to 2000 chars — stacks are code paths only, no patient data
        stack:     error?.stack?.slice(0, 2000) || null,

        // ── App context ────────────────────────────────────────────────────────
        appVersion:    Constants.expoConfig?.version                      || 'unknown',
        buildNumber:   Constants.expoConfig?.android?.versionCode         || null,
        platform:      Platform.OS,
        platformVersion: String(Platform.Version),

        // ── User context (UID only — no email, name, or any PII) ──────────────
        userId:    user?.uid || 'anonymous',

        // ── Timing ────────────────────────────────────────────────────────────
        timestamp: serverTimestamp(),

        // ── Call-site context (source, isFatal, componentStack, etc.) ─────────
        ...context,
      });
    } catch (_) {
      // Silently swallow — the crash reporter must NEVER cause another crash
    }
  },
};

export default CrashReportingService;
