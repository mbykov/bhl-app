// import { writable } from 'svelte/store';
// export const searchTerm = writable('');
// export const componentID = writable(0);
// export const recordItem = writable({});
// const wsURL = 'ws://localhost:2700/';

// src/lib/store.js
import { writable } from 'svelte/store';

export const componentName = writable('');
export const currentComponent = writable('list');
export const currentNoteId = writable(null);

export const navigateTo = {
  list: () => {
    currentNoteId.set(null);
    currentComponent.set('list');
  },
  asr: (noteId = null) => {
    currentNoteId.set(noteId);
    currentComponent.set('asr');
  },
  settings: () => currentComponent.set('settings'),
  about: () => currentComponent.set('about')
};
