<!-- src/routes/Asr.svelte -->
<script>
    import { onMount, onDestroy } from 'svelte';
    import { navigateTo, currentNoteId } from '$lib/store.js';
    import { createPersistedArray } from '$lib/stores/persisted-store.svelte.js';
    import { SherpaASRClient } from '$lib/asr-client.js';
    import { MicrophoneOutline, CheckOutline } from "flowbite-svelte-icons";

    // Подключаемся к тому же хранилищу
    let records = createPersistedArray('voice-notes', []);

    // ASR клиент
    let asrClient = null;

    // Подписка на currentNoteId
    let noteId = $state(null);
    const unsubscribeNoteId = currentNoteId.subscribe(value => {
        noteId = value;
    });

    // Текущая заметка
    let currentNote = $state(null);
    let editDiv = $state(null);
    let isRecording = $state(false);
    let isConnecting = $state(false);
    let error = $state(null);
    let connectionStatus = $state('disconnected'); // disconnected, connecting, connected

    let localUpdate = ''
    // Инициализация ASR клиента
    let segment = -1
    onMount(() => {
        asrClient = new SherpaASRClient();

        // Подписываемся на события ASR
        asrClient.on('transcript', (data) => {
            if (currentNote && data.text && data.text.trim()) {
                let transcript = data.text.trim();
                // console.log('_transcript', data)
                // Добавляем пробел перед новым текстом, если уже есть текст
                // const separator = currentNote.content && !currentNote.content.endsWith(' ') ? ' ' : '';
                const separator = !currentNote.content.endsWith(' ') ? ' ' : '';
                // currentNote.content += separator + transcript;
                // currentNote.content = separator + transcript;
                transcript = separator + transcript
                // =======
                console.log('_segment__________________', segment, data.segment)
                if (data.segment != segment) {
                //     console.log('_segment__________________', data.segment, segment)
                //     console.log('_transcript__________________', transcript)
                //     console.log('_currentNote.content__________________', currentNote.content)
                    segment = data.segment
                    currentNote.content = editDiv.textContent
                //     currentNote.content += ' seg_tr:' + transcript;
                //     editDiv.textContent = currentNote.content;
                //     console.log('_editDiv.textContent__________________', editDiv.textContent)
                    // editDiv.textContent = currentNote.content + transcript;
                } else {
                //     console.log('_segment_', data.segment, segment)
                //     console.log('_transcript_', transcript)
                //     console.log('_currentNote.content_', currentNote.content)
                //     editDiv.textContent = currentNote.content + ' tr:' + transcript;
                //     console.log('_editDiv.textContent_', editDiv.textContent)
                    editDiv.textContent = currentNote.content + transcript;
                }
                // ======
                currentNote.updatedAt = new Date();
                currentNote.wordCount = currentNote.content.split(/\s+/).filter(w => w.length > 0).length;

                console.log(`📝 ${data.is_final ? '[FINAL]' : '[PARTIAL]'}: ${transcript}`);

                // Если это финальный результат, добавляем пробел для следующей фразы
                if (data.is_final) {
                    currentNote.content += ' FINAL!!!!!!!!!!';
                }
            }
        });

        asrClient.on('status', (status) => {
            console.log('ASR Status:', status);
            connectionStatus = status.connected ? 'connected' : 'disconnected';
        });

        asrClient.on('error', (err) => {
            console.error('ASR Error:', err);
            error = err.message || 'Ошибка распознавания речи';
            isRecording = false;
            isConnecting = false;
        });

        // Находим или создаем заметку
        if (noteId) {
            // Ищем существующую заметку
            const found = records.find(n => n.id === noteId);
            if (found) {
                currentNote = found;
            } else {
                // Если не нашли, сбрасываем
                noteId = null;
                currentNote = null;
                createOrLoadDraft();
            }
        } else {
            createOrLoadDraft();
        }
    });

    // Синхронизируем редактор с текстом заметки
    $effect(() => {
        if (editDiv && currentNote && editDiv.textContent !== currentNote.content) {
            // editDiv.textContent = currentNote.content;
        }
    });

    function createOrLoadDraft() {
        // Ищем черновик или создаем новую структуру
        const draft = records.find(n => n.id === 'draft_current');
        if (draft) {
            currentNote = draft;
        } else {
            currentNote = {
                id: 'draft_current',
                title: 'Черновик',
                content: '',
                createdAt: new Date(),
                updatedAt: new Date(),
                wordCount: 0,
                draft: true
            };
            records.push(currentNote);
        }
    }

    // Очистка при размонтировании
    onDestroy(() => {
        unsubscribeNoteId?.();
        stopASR();
    });

    // Остановка ASR
    async function stopASR() {
        if (asrClient) {
            try {
                await asrClient.stop();
            } catch (err) {
                console.error('Ошибка остановки ASR:', err);
            }
        }
        isRecording = false;
        isConnecting = false;
    }

    // Обработчик ввода в редакторе
    function handleEditorInput() {
        // return
        if (!editDiv || !currentNote) return;
        const text = editDiv.textContent || '';
        if (text !== currentNote.content) {
            // currentNote.content = text;
            currentNote.updatedAt = new Date();
            currentNote.wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

            // Автогенерация заголовка для новых заметок
            if (!currentNote.draft && !currentNote.title && text.trim()) {
                const firstWords = text.split(/\s+/).slice(0, 5).join(' ');
                currentNote.title = firstWords || 'Новая заметка';
            }
        }
    }

    // Переключение записи
    async function toggleRecording() {
        if (isRecording) {
            await stopRecording();
        } else {
            await startRecording();
        }
    }

    // Начало записи
    async function startRecording() {
        if (!asrClient) {
            error = 'ASR клиент не инициализирован';
            return;
        }

        isConnecting = true;
        error = null;

        try {
            // Проверяем поддержку браузером
            if (!asrClient.isSupported()) {
                throw new Error('Браузер не поддерживает запись аудио. Используйте Chrome или Edge.');
            }

            await asrClient.start();
            isRecording = true;
            isConnecting = false;
            console.log('✅ Запись начата');

        } catch (err) {
            console.error('Ошибка запуска записи:', err);
            error = err.message || 'Не удалось начать запись. Проверьте разрешения на микрофон.';
            isConnecting = false;
            isRecording = false;

            // Дополнительная информация для пользователя
            if (err.name === 'NotAllowedError') {
                error = 'Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.';
            } else if (err.name === 'NotFoundError') {
                error = 'Микрофон не найден. Подключите микрофон и попробуйте снова.';
            }
        }
    }

    // Остановка записи
    async function stopRecording() {
        await stopASR();
        console.log('⏹️ Запись остановлена');
    }

    // Сохранение заметки
    function saveNote() {
        if (!currentNote || !currentNote.content.trim()) {
            alert('Нечего сохранить');
            return;
        }

        // Останавливаем запись перед сохранением
        if (isRecording) {
            stopRecording();
        }

        if (currentNote.draft) {
            // Преобразуем черновик в полноценную заметку
            const firstWords = currentNote.content.split(/\s+/).slice(0, 5).join(' ');
            const newNote = {
                ...currentNote,
                id: 'note_' + Date.now(),
                title: firstWords || 'Новая заметка',
                draft: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Удаляем черновик
            const draftIndex = records.findIndex(n => n.id === 'draft_current');
            if (draftIndex > -1) {
                records.splice(draftIndex, 1);
            }

            // Добавляем новую заметку
            records.push(newNote);
        } else {
            // Обновляем существующую заметку
            currentNote.updatedAt = new Date();
            currentNote.wordCount = currentNote.content.split(/\s+/).filter(w => w.length > 0).length;

            // SAVE
            const text = editDiv.textContent || '';
            currentNote.content = text;

            if (!currentNote.title && currentNote.content.trim()) {
                const firstWords = currentNote.content.split(/\s+/).slice(0, 5).join(' ');
                currentNote.title = firstWords || 'Новая заметка';
            }
        }

        navigateTo.list();
    }

    // Обработка голосовых команд
    function handleCommand(command) {
        switch(command.toLowerCase()) {
            case 'абзац':
                if (currentNote) {
                    currentNote.content += '\n\n';
                    currentNote.updatedAt = new Date();
                }
                break;
            case 'стоп запись':
            case 'остановить запись':
                stopRecording();
                break;
            case 'сохранить':
                saveNote();
                break;
            case 'удалить последнее слово':
            case 'удали последнее слово':
                if (currentNote) {
                    const words = currentNote.content.trim().split(/\s+/);
                    if (words.length > 0) {
                        words.pop();
                        currentNote.content = words.join(' ');
                        currentNote.updatedAt = new Date();
                        currentNote.wordCount = words.length;
                    }
                }
                break;
            case 'новая строка':
                if (currentNote) {
                    currentNote.content += '\n';
                    currentNote.updatedAt = new Date();
                }
                break;
        }
    }

</script>

<div class="min-h-screen bg-gray-50 pb-16">
    <!-- Верхняя панель -->
    <div class="flex justify-between sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div class="flex items-center gap-3">
            connectionStatus: {connectionStatus}
            <div class="text-sm text-gray-600">
                {#if isRecording}
                    <span class="text-green-600 font-medium">Идет запись...</span>
                {:else if isConnecting}
                    <span class="text-yellow-600 font-medium">Подключение...</span>
                {:else}
                    <span>Готов к записи</span>
                {/if}
            </div>
        </div>

        <div>
            <div class="flex items-center gap-2">
                <button
                    on:click={saveNote}
                    class="p-2 text-green-600 hover:text-green-800 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Сохранить (Ctrl+S)"
                    disabled={!currentNote?.content?.trim()}
                >
                    <CheckOutline class="h-6 w-6" />
                </button>

                <button
                    on:click={toggleRecording}
                    class={`p-2 rounded-full ${isRecording ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                    title={isRecording ? 'Остановить запись' : 'Начать запись'}
                    disabled={isConnecting}
                >
                    {#if isConnecting}
                        <div class="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    {:else if isRecording}
                        <div class="h-6 w-6 flex items-center justify-center">
                            <div class="h-3 w-3 bg-red-600 rounded-sm"></div>
                        </div>
                    {:else}
                        <MicrophoneOutline class="h-6 w-6" />
                    {/if}
                </button>
            </div>
        </div>
    </div>

    <!-- Основной контент -->
    <div class="h-full max-w-4xl mx-auto px-4 py-6">
        <!-- Contenteditable область -->
        <div class="h-full bg-white border border-gray-300 rounded-lg p-4 min-h-[300px]">
            <div
                bind:this={editDiv}
                contenteditable="true"
                on:input={handleEditorInput}
                class="h-full min-h-[280px] text-gray-800 text-base focus:outline-none whitespace-pre-wrap caret-blue-600"
                placeholder="Говорите - текст будет появляться здесь. Также можно редактировать вручную."
            >
                {currentNote?.content || ''}
            </div>
        </div>

        <!-- Ошибки и информация -->
        {#if error}
            <div class="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                <div class="font-medium mb-1">Ошибка:</div>
                {error}
                {#if error.includes('микрофон')}
                    <div class="mt-2 text-xs">
                        Проверьте настройки микрофона в браузере
                    </div>
                {/if}
            </div>
        {/if}

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

    .animate-spin {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>
