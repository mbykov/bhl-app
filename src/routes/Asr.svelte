<!-- src/routes/Asr.svelte -->
<script>
    import { onMount, onDestroy } from 'svelte';
    import { navigateTo, currentNoteId } from '$lib/store.js';
    import { sessionStore } from '$lib/stores/sessionStore';
    import { NotesStore } from '$lib/stores/notesStore';
    import { icons } from '$lib/images/icons.js';

    let notesStore;
    let isConnecting = $state(false);
    let error = $state(null);
    let autoSaveTimer = $state(null);
    let editDiv = $state(null);
    let currentNote = $state(null);

    // Флаги
    let isUpdatingFromSession = $state(false);
    let isUpdatingFromEditor = $state(false);
    let isComponentMounted = $state(true);

    // Подписка на sessionStore
    let session = $state({});
    const unsubscribeSession = sessionStore.subscribe(value => {
        session = value;

        // Обновляем редактор только если компонент смонтирован
        if (isComponentMounted && !isUpdatingFromEditor && editDiv && editDiv.textContent !== value.currentText) {
            isUpdatingFromSession = true;
            editDiv.textContent = value.currentText;
            // Не устанавливаем курсор при очистке
            if (value.currentText !== '') {
                placeCaretAtEnd(editDiv);
            }
            setTimeout(() => {
                isUpdatingFromSession = false;
            }, 0);
        }
    });

    // Подписка на currentNoteId
    let noteId = $state(null);
    const unsubscribeNoteId = currentNoteId.subscribe(value => {
        noteId = value;
    });

    onMount(() => {
        isComponentMounted = true;
        initNotesStore();
    });

    async function initNotesStore() {
        notesStore = new NotesStore();
        await notesStore.init();

        if (noteId) {
            try {
                const note = await notesStore.getNote(noteId);
                if (note) {
                    currentNote = note;
                    sessionStore.setText(note.content);
                } else {
                    console.warn('Заметка не найдена:', noteId);
                    noteId = null;
                    const draft = await notesStore.getDraft();
                    if (draft && draft.content) {
                        sessionStore.setText(draft.content);
                    }
                }
            } catch (error) {
                console.error('Ошибка загрузки заметки:', error);
                noteId = null;
            }
        } else {
            const draft = await notesStore.getDraft();
            if (draft && draft.content) {
                sessionStore.setText(draft.content);
            }
        }

        // Автосохранение черновика
        autoSaveTimer = setInterval(async () => {
            if (session.currentText.trim() && !noteId && isComponentMounted) {
                await notesStore.saveDraft(session.currentText);
            }
        }, 5000);
    }

    onDestroy(() => {
        isComponentMounted = false;

        if (autoSaveTimer) {
            clearInterval(autoSaveTimer);
        }
        unsubscribeSession();
        unsubscribeNoteId();
    });

    function placeCaretAtEnd(element) {
        // Проверяем, что элемент все еще в DOM
        if (!element || !isComponentMounted || !document.body.contains(element) || isUpdatingFromEditor) {
            return;
        }

        requestAnimationFrame(() => {
            try {
                const range = document.createRange();
                const selection = window.getSelection();

                // Дополнительная проверка
                if (!document.body.contains(element)) {
                    return;
                }

                range.selectNodeContents(element);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            } catch (e) {
                // Игнорируем ошибки, если элемент больше не в DOM
                console.debug('Не удалось установить курсор, элемент не в DOM');
            }
        });
    }

    function handleEditorInput() {
        if (!editDiv || isUpdatingFromSession || !isComponentMounted) return;

        isUpdatingFromEditor = true;
        const text = editDiv.textContent || '';

        if (text !== session.currentText) {
            sessionStore.setText(text);
        }

        setTimeout(() => {
            isUpdatingFromEditor = false;
        }, 0);
    }

    function handleEditorKeyDown(event) {
        if (!isComponentMounted) return;
    }

    function handleEditorBlur() {
        if (!isUpdatingFromSession && isComponentMounted) {
            handleEditorInput();
        }
    }

    async function toggleRecording() {
        if (session.isRecording) {
            stopRecording();
        } else {
            await startRecording();
        }
    }

    async function startRecording() {
        isConnecting = true;
        error = null;

        try {
            sessionStore.startRecording();

            // TODO: Заглушка
            setTimeout(() => {
                if (isComponentMounted) {
                    isConnecting = false;
                    simulateTranscript('Тестовая запись голосового помощника.');
                }
            }, 800);

        } catch (err) {
            if (isComponentMounted) {
                console.error('Ошибка запуска записи:', err);
                error = err.message;
                isConnecting = false;
                sessionStore.stopRecording();
            }
        }
    }

    function stopRecording() {
        sessionStore.stopRecording();
    }

    function simulateTranscript(text) {
        if (!session.isRecording || !isComponentMounted) return;

        sessionStore.addTranscript(text);

        if (session.isRecording && isComponentMounted) {
            setTimeout(() => {
                simulateTranscript('Продолжение тестовой записи.');
            }, 1500);
        }
    }

    async function saveNote() {
        const text = session.currentText.trim();
        if (!text) {
            alert('Нечего сохранить');
            return;
        }

        try {
            // Останавливаем автосохранение перед навигацией
            if (autoSaveTimer) {
                clearInterval(autoSaveTimer);
                autoSaveTimer = null;
            }

            if (noteId) {
                try {
                    const existingNote = await notesStore.getNote(noteId);
                    if (existingNote) {
                        await notesStore.updateNote(noteId, { content: text });
                    } else {
                        await notesStore.addNote(text);
                    }
                } catch (error) {
                    console.warn('Не удалось обновить заметку, создаем новую:', error);
                    await notesStore.addNote(text);
                }
            } else {
                await notesStore.addNote(text);
                await notesStore.clearDraft();
            }

            // Не вызываем sessionStore.clear() - это вызывает обновление и ошибку курсора
            // Вместо этого просто навигируем
            navigateTo.list();

        } catch (err) {
            console.error('Ошибка сохранения:', err);
            alert('Не удалось сохранить заметку');

            // Возобновляем автосохранение при ошибке
            if (isComponentMounted && !autoSaveTimer) {
                autoSaveTimer = setInterval(async () => {
                    if (session.currentText.trim() && !noteId) {
                        await notesStore.saveDraft(session.currentText);
                    }
                }, 5000);
            }
        }
    }

    function handleCommand(command) {
        switch(command) {
            case 'абзац':
                sessionStore.addParagraph();
                break;
            case 'стоп запись':
                stopRecording();
                break;
            case 'сохранить':
                saveNote();
                break;
            case 'удалить последнее слово':
                sessionStore.undoLastWord();
                break;
        }
    }
</script>

<div class="min-h-screen bg-gray-50 pb-16">
    <!-- Верхняя панель -->
    <div class="bg-white border-b border-gray-200 px-4 py-3">
        <div class="max-w-4xl mx-auto flex justify-between items-center">
            <button
                on:click={() => {
                    // Останавливаем автосохранение
                    if (autoSaveTimer) {
                        clearInterval(autoSaveTimer);
                        autoSaveTimer = null;
                    }
                    navigateTo.list();
                }}
                class="p-2 text-gray-600 hover:text-gray-900"
                title="Назад"
            >
                {@html icons.back}
            </button>

            <div class="flex items-center gap-2">
                <div class="flex items-center gap-1.5">
                    <div class={`w-2 h-2 rounded-full ${session.isRecording ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    <span class="text-xs text-gray-500">
                        {session.isRecording ? 'запись' : 'пауза'}
                    </span>
                </div>
            </div>

            <button
                on:click={saveNote}
                disabled={!session.currentText.trim()}
                class="p-2 text-green-600 hover:text-green-800 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Сохранить"
            >
                {@html icons.save}
            </button>
        </div>
    </div>

    <!-- Основной контент -->
    <div class="max-w-4xl mx-auto px-4 py-6">
        <!-- Contenteditable область -->
        <div class="bg-white border border-gray-300 rounded-lg p-4 min-h-[300px] mb-6">
            <div
                bind:this={editDiv}
                contenteditable="true"
                on:input={handleEditorInput}
                on:keydown={handleEditorKeyDown}
                on:blur={handleEditorBlur}
                class="min-h-[280px] text-gray-800 text-base focus:outline-none whitespace-pre-wrap caret-blue-600"
                placeholder="Текст будет появляться здесь по мере записи. Редактируйте текст вручную или используйте голосовые команды."
            >
                {session.currentText}
            </div>
        </div>

        {#if error}
            <div class="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                Ошибка: {error}
            </div>
        {/if}
    </div>

    <!-- Нижняя панель -->
    <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4">
        <div class="max-w-4xl mx-auto">
            <div class="flex flex-col items-center">
                <button
                    on:click={toggleRecording}
                    disabled={isConnecting}
                    class={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all ${session.isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}
                    title="{session.isRecording ? 'Остановить запись' : 'Начать запись'}"
                >
                    {#if isConnecting}
                        {@html icons.loading}
                    {:else if session.isRecording}
                        {@html icons.stop}
                    {:else}
                        {@html icons.mic}
                    {/if}
                </button>

                <div class="mt-3 text-xs text-gray-500 text-center">
                    Голосовые команды:
                    <span class="inline-flex items-center gap-1.5 mt-1">
                        <span class="px-2 py-0.5 bg-gray-100 rounded">"абзац"</span>
                        <span class="px-2 py-0.5 bg-gray-100 rounded">"стоп запись"</span>
                        <span class="px-2 py-0.5 bg-gray-100 rounded">"сохранить"</span>
                    </span>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    [contenteditable="true"]:empty:before {
        content: attr(placeholder);
        color: #9ca3af;
        pointer-events: none;
    }

    [contenteditable="true"]:focus {
        outline: none;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }
</style>
