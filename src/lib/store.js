import { writable } from 'svelte/store';
export const searchTerm = writable('');
export const componentName = writable('');
export const componentID = writable(0);
export const recordItem = writable({});

const wsURL = 'ws://localhost:2700/';
