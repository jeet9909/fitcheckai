import type { TryOnInput } from './fitcartApi';

let draft: TryOnInput | null = null;

export function setTryOnDraft(value: TryOnInput): void {
  draft = value;
}

export function getTryOnDraft(): TryOnInput | null {
  return draft;
}

export function clearTryOnDraft(): void {
  draft = null;
}
