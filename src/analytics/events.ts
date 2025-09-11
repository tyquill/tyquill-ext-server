export const EVENT_NAMES = {
  // Activation
  ACTIVATION_FIRST_SCRAP: 'activation_first_scrap',
  ACTIVATION_FIRST_AI_DRAFT_COMPLETED: 'activation_first_ai_draft_completed',
} as const;

export type EventName = typeof EVENT_NAMES[keyof typeof EVENT_NAMES];
