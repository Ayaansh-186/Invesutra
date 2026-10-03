export const DETAILED_AI_CONSENT_VERSION = "portfolio-details-v1";

export function hasDetailedAIConsent(body: { allowPrivateAI?: unknown; privateAIConsentVersion?: unknown }): boolean {
  return body.allowPrivateAI === true && body.privateAIConsentVersion === DETAILED_AI_CONSENT_VERSION;
}

type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const preferenceKey = (userId: string, portfolioId: string) => `invesutra:ai-privacy:${encodeURIComponent(userId)}:${encodeURIComponent(portfolioId)}`;

export function readAIPrivacyPreference(storage: PreferenceStorage, userId: string, portfolioId: string): boolean | null {
  if (!userId || !portfolioId) return null;
  try {
    const saved = JSON.parse(storage.getItem(preferenceKey(userId, portfolioId)) || "null");
    return saved?.version === DETAILED_AI_CONSENT_VERSION && typeof saved.online === "boolean" ? saved.online : null;
  } catch { return null; }
}

export function saveAIPrivacyPreference(storage: PreferenceStorage, userId: string, portfolioId: string, online: boolean | null): boolean {
  if (!userId || !portfolioId) return false;
  try {
    const key = preferenceKey(userId, portfolioId);
    if (online === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify({ version: DETAILED_AI_CONSENT_VERSION, online }));
    return true;
  } catch { return false; }
}
