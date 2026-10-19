import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/** e.g. "Version 1.0.0 · update of 20 Oct, 14:05", so you can tell whether an EAS Update has arrived. */
export function appVersionLabel(): string {
  const version = `Version ${Constants.expoConfig?.version ?? '?'}`;
  if (!Updates.isEnabled || Updates.isEmbeddedLaunch || !Updates.createdAt) return `${version} · built-in code`;
  const when = Updates.createdAt.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${version} · update of ${when}`;
}
