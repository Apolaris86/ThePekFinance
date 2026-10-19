import Constants from 'expo-constants';

export function appVersionLabel(): string {
  return `Version ${Constants.expoConfig?.version ?? '?'}`;
}
