// import { writable } from 'svelte/store';
// export const searchTerm = writable('');
// export const componentID = writable(0);
// export const recordItem = writable({});
// const wsURL = 'ws://localhost:2700/';

// src/lib/store.js
import { writable, derived } from 'svelte/store';

export const componentName = writable('');

// Создаем обычные Svelte stores
export const currentComponent = writable('list'); // 'list', 'asr', 'settings', 'about'
export const currentNoteId = writable(null);
export const isRecording = writable(false);

// Навигация
export const navigateTo = {
  list: () => currentComponent.set('list'),
  asr: (noteId = null) => {
    currentNoteId.set(noteId);
    currentComponent.set('asr');
  },
  settings: () => currentComponent.set('settings'),
  about: () => currentComponent.set('about')
};

// Для удобства можно создать derived store для общей информации
export const appState = derived(
  [currentComponent, currentNoteId, isRecording],
  ([$component, $noteId, $recording]) => ({
    component: $component,
    noteId: $noteId,
    isRecording: $recording
  })
);
