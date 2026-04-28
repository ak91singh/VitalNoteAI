import Constants from 'expo-constants';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const APP_VERSION = Constants.expoConfig?.version ?? 'unknown';

/**
 * Fire-and-forget Firestore audit log for every SOAP generation attempt.
 * Logs metadata only — never transcripts, SOAP text, or patient data.
 *
 * Path: auditLogs/{userId}/generations/{autoId}
 */
export async function logGenerationEvent(userId, eventData) {
  if (!userId) return;

  try {
    const docRef = await addDoc(
      collection(db, 'auditLogs', userId, 'generations'),
      {
        timestamp:              serverTimestamp(),
        userId:                 userId,
        success:                eventData.success ?? false,
        modelUsed:              eventData.modelUsed              ?? null,
        qualityScore:           eventData.qualityScore           ?? null,
        confidenceScore:        eventData.confidenceScore        ?? null,
        hallucinationsDetected: eventData.hallucinationsDetected ?? null,
        misattributionsDetected: eventData.misattributionsDetected ?? null,
        generationTimeSeconds:  eventData.generationTimeSeconds  ?? null,
        language:               eventData.language               ?? 'English',
        isMultiSpeaker:         eventData.isMultiSpeaker         ?? true,
        errorMessage:           eventData.errorMessage           ?? null,
        appVersion:             APP_VERSION,
      }
    );
    if (__DEV__) console.log('[AuditLogger] Logged generation event:', docRef.id);
  } catch (err) {
    console.warn('[AuditLogger] Firestore write failed (non-fatal):', err.message);
  }
}
