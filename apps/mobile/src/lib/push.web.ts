// Push notifications are native-only; the web preview gets no-ops.
export async function registerForPush(): Promise<void> {}
export async function unregisterPush(): Promise<void> {}
export function listenForNotificationTaps(): () => void {
  return () => {};
}
