// src/lib/stores/sessionStore.js
import { writable } from 'svelte/store';

const initialState = {
    sessionId: null,
    currentNoteId: null,
    isRecording: false,
    currentText: '',
    lastWords: [],
    isDraft: true
};

function createSessionStore() {
    const { subscribe, set, update } = writable(initialState);

    return {
        subscribe,

        startRecording: () => {
            set({
                sessionId: 'session_' + Date.now(),
                currentNoteId: 'draft_current',
                isRecording: true,
                currentText: '',
                lastWords: [],
                isDraft: true
            });
        },

        stopRecording: () => {
            update(state => ({
                ...state,
                isRecording: false
            }));
        },

        addTranscript: (text) => {
            update(state => {
                const words = text.trim().split(/\s+/);
                const newLastWords = [...state.lastWords, ...words].slice(-10);

                return {
                    ...state,
                    currentText: state.currentText + (state.currentText ? ' ' : '') + text,
                    lastWords: newLastWords
                };
            });
        },

        // Новый метод для установки полного текста
        setText: (text) => {
            update(state => {
                const words = text.trim().split(/\s+/);
                const lastWords = words.slice(-10);

                return {
                    ...state,
                    currentText: text,
                    lastWords
                };
            });
        },

        undoLastWord: () => {
            update(state => {
                if (state.lastWords.length === 0) return state;

                const words = state.currentText.trim().split(/\s+/);
                words.pop();

                return {
                    ...state,
                    currentText: words.join(' ') + (words.length > 0 ? ' ' : ''),
                    lastWords: state.lastWords.slice(0, -1)
                };
            });
        },

        addParagraph: () => {
            update(state => ({
                ...state,
                currentText: state.currentText + '\n\n'
            }));
        },

        clear: () => {
            set(initialState);
        }
    };
}

export const sessionStore = createSessionStore();
