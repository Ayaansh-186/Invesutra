export const DETAILED_AI_CONSENT_VERSION = "portfolio-details-v1";

export function hasDetailedAIConsent(body: { allowPrivateAI?: unknown; privateAIConsentVersion?: unknown }): boolean {
  return body.allowPrivateAI === true && body.privateAIConsentVersion === DETAILED_AI_CONSENT_VERSION;
}
