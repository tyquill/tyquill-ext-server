export const EVENT_NAMES = {
  // Acquisition
  ACQUISITION_SIGNUP_COMPLETED: 'acquisition_signup_completed',
  // Activity (for retention & funnels)
  ACTIVITY_SCRAP_CREATED: 'activity_scrap_created',
  ACTIVITY_AI_DRAFT_COMPLETED: 'activity_ai_draft_completed',
} as const;

export type EventName = typeof EVENT_NAMES[keyof typeof EVENT_NAMES];
