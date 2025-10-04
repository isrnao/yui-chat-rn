export type PushPreferences = {
  enabled: boolean;
  lastUpdated: number;
};

const DEFAULT_PREFERENCES: PushPreferences = {
  enabled: false,
  lastUpdated: Date.now(),
};

export function shouldEnablePushNotifications(): boolean {
  // TODO: enable platform-specific push notification check once backend is ready.
  return false;
}

export async function registerPushNotifications(): Promise<PushPreferences> {
  // Placeholder: integrate FCM/APNs as follow-up if the product requires push notifications.
  return DEFAULT_PREFERENCES;
}
