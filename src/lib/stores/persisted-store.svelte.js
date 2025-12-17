// src/lib/stores/persisted-store.svelte.js
import { browser } from '$app/environment';

export function createPersistedArray(key, initialValue = []) {
  // 1. Initial Load: Parse from storage or use default
  const stored = browser ? localStorage.getItem(key) : null;
  const data = $state(stored ? JSON.parse(stored) : initialValue);

  // 2. Persistence: $effect tracks the array AND its children deeply
  $effect(() => {
    if (browser) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  });

  return data;
}

export function createPersistedObject(key, initialValue = {}) {
  const stored = browser ? localStorage.getItem(key) : null;
  const data = $state(stored ? JSON.parse(stored) : initialValue);

  $effect(() => {
    if (browser) {
      localStorage.setItem(key, JSON.stringify(data));
    }
  });

  return data;
}
