import { randomUUID } from 'expo-crypto';

/** UUID v4. Envuelve expo-crypto en vez de `crypto.randomUUID()` global — soporte garantizado en Expo Go. */
export function newId(): string {
  return randomUUID();
}
