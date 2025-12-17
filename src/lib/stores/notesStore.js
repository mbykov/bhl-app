// src/lib/stores/notesStore.js - добавляем метод getNote
export class NotesStore {
    constructor() {
        this.db = null;
        this.dbName = 'VoiceDiaryDB';
        this.storeName = 'notes';
        this.dbVersion = 1;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, {
                        keyPath: 'id'
                    });

                    store.createIndex('createdAt', 'createdAt', { unique: false });
                    store.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
            };
        });
    }

    // Добавляем метод getNote
    async getNote(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            const request = store.get(id);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async addNote(content) {
        const firstWords = content.split(/\s+/).slice(0, 5).join(' ');
        const title = firstWords.length > 0 ? firstWords : 'Новая заметка';

        const note = {
            id: 'note_' + Date.now(),
            title: title,
            content: content,
            createdAt: new Date(),
            updatedAt: new Date(),
            wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
            draft: false
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const request = store.add(note);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(note);
        });
    }

    async saveDraft(content) {
        const draft = {
            id: 'draft_current',
            title: 'Черновик',
            content: content,
            createdAt: new Date(),
            updatedAt: new Date(),
            wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
            draft: true
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const getRequest = store.get('draft_current');

            getRequest.onsuccess = () => {
                const request = getRequest.result
                    ? store.put(draft)
                    : store.add(draft);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(draft);
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async getNotes() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('createdAt');

            const request = index.getAll();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const notes = request.result
                    .filter(note => !note.draft)
                    .sort((a, b) => b.createdAt - a.createdAt);
                resolve(notes);
            };
        });
    }

    async getDraft() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);

            const request = store.get('draft_current');

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async updateNote(id, updates) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const note = getRequest.result;
                if (!note) {
                    reject(new Error('Note not found'));
                    return;
                }

                const updatedNote = {
                    ...note,
                    ...updates,
                    updatedAt: new Date()
                };

                if (updates.content && !updates.title) {
                    const firstWords = updates.content.split(/\s+/).slice(0, 5).join(' ');
                    if (firstWords.length > 0) {
                        updatedNote.title = firstWords;
                    }
                }

                const putRequest = store.put(updatedNote);

                putRequest.onerror = () => reject(putRequest.error);
                putRequest.onsuccess = () => resolve(updatedNote);
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async deleteNote(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const request = store.delete(id);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async clearDraft() {
        return this.deleteNote('draft_current');
    }
}
