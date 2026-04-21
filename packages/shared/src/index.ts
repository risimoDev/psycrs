/** Subscription statuses */
export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  GRACE_PERIOD: 'grace_period',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

/** Payment statuses */
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  CANCELED: 'canceled',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

/** Video provider types */
export const VIDEO_PROVIDER = {
  LOCAL: 'local',
  KINESCOPE: 'kinescope',
} as const;

export type VideoProviderType = (typeof VIDEO_PROVIDER)[keyof typeof VIDEO_PROVIDER];
