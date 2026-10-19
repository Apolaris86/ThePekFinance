import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Same id as `defaultChannel` in app.json, so pushes sent by check-alerts land here.
const CHANNEL_ID = 'alerts';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

/**
 * Ask for notification permission and store this device's Expo push token in `push_tokens`.
 * Called after sign-in; never throws, since push is optional.
 */
export async function registerForPush(): Promise<void> {
  if (!supabase || !Device.isDevice) return;
  try {
    if (Platform.OS === 'android') {
      // Android 13+ only shows the permission prompt once a channel exists.
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Price alerts',
        importance: AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1A73E8',
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const { error } = await supabase
      .from('push_tokens')
      .upsert({ token, platform: Platform.OS, updated_at: new Date().toISOString() }, { onConflict: 'token' });
    if (error) throw error;
    registeredToken = token;
  } catch (err) {
    console.warn('Push registration failed', err);
  }
}

/** Forget this device's token before signing out, so alerts stop arriving here. */
export async function unregisterPush(): Promise<void> {
  if (!supabase || !registeredToken) return;
  await supabase.from('push_tokens').delete().eq('token', registeredToken);
  registeredToken = null;
}

/** Open the quote screen when an alert notification is tapped (cold start included). */
export function listenForNotificationTaps(): () => void {
  function open(notification: Notifications.Notification) {
    const symbol = notification.request.content.data?.symbol;
    if (typeof symbol === 'string') router.push(`/quote/${encodeURIComponent(symbol)}`);
    Notifications.clearLastNotificationResponse();
  }

  const last = Notifications.getLastNotificationResponse();
  if (last?.notification) open(last.notification);
  const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification));
  return () => sub.remove();
}
