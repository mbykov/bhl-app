<!-- src/routes/Asr.svelte -->
<script>
    import { onMount, onDestroy } from 'svelte';
    import { navigateTo, currentNoteId } from '$lib/store.js';
    import { createPersistedArray } from '$lib/stores/persisted-store.svelte.js';
    import { SherpaASRClient } from '$lib/asr-client.js';
    import { createTranscriptProcessor } from '$lib/transcript-processor.js';
    import { createCommandProcessor } from '$lib/command-processor.js';
    import { MicrophoneOutline, CheckOutline } from "flowbite-svelte-icons";

    // Подключаемся к тому же хранилищу
    let records = createPersistedArray('voice-notes', []);

    // ASR клиент
    let asrClient = null;

    // Независимые процессоры
    let transcriptProcessor = null;
    let commandProcessor = null;

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
    let connectionStatus = $state('disconnected');

    let oldtranscript = ''
    // Инициализация
    onMount(() => {
        // Инициализируем независимые процессоры
        transcriptProcessor = createTranscriptProcessor();
        commandProcessor = createCommandProcessor();

        console.log('🔄 Инициализированы процессоры:');
        console.log('📝 Transcript Processor:', transcriptProcessor.getCommandsInfo ? 'available' : 'ready');
        console.log('🔧 Command Processor:', commandProcessor.getCommandsInfo?.()?.length || 0, 'команд');

        // Инициализируем ASR клиент
        asrClient = new SherpaASRClient();

        // Подписываемся на события ASR
        asrClient.on('transcript', (data) => {
            if (oldtranscript == data.text) return // NB:
            oldtranscript = data.text
            console.log('______________________________________DATA', data.text)
            handleASRTranscript(data);
        });

        asrClient.on('status', (status) => {
            connectionStatus = status.connected ? 'connected' : 'disconnected';
            console.log('📡 Статус ASR:', connectionStatus);
        });

        asrClient.on('error', (err) => {
            console.error('ASR Error:', err);
            error = err.message || 'Ошибка распознавания речи';
            isRecording = false;
            isConnecting = false;
        });

        // Находим или создаем заметку
        if (noteId) {
            const found = records.find(n => n.id === noteId);
            if (found) {
                currentNote = found;
                console.log('📝 Загружена заметка:', found.title);
            } else {
                noteId = null;
                currentNote = null;
                createOrLoadDraft();
            }
        } else {
            createOrLoadDraft();
        }
    });

    // Обработчик транскрипции от ASR
    function handleASRTranscript(data) {
        if (!currentNote || !data.text?.trim()) {
            console.log('⏭️ Пропуск: нет заметки или текста');
            return;
        }

        const transcript = data.text.trim();
        console.log('🎤 ASR ->', transcript, 'сегмент:', data.segment);

        // ШАГ 1: Анализ команд (независимо)
        const commandAnalysis = commandProcessor.analyze(transcript);
        console.log('📊 Анализ команд:', {
            оригинал: commandAnalysis.originalText,
            обработанный: commandAnalysis.processedText,
            команды: commandAnalysis.commands.map(c => c.name)
        });

        // ШАГ 2: Обработка текста (независимо)
        const textToProcess = commandAnalysis.processedText;
        if (textToProcess.trim()) {
            const transcriptResult = transcriptProcessor.process(
                { text: textToProcess, segment: data.segment },
                currentNote,
                editDiv
            );

            if (transcriptResult) {
                console.log('📝 Результат обработки текста:', {
                    сегмент: transcriptResult.segment,
                    текстСегмента: transcriptResult.segmentText,
                    отображаемыйТекст: transcriptResult.displayText
                });
            }
        }

        console.log('______________commandAnalysis.commands:', commandAnalysis.commands);
        // ШАГ 3: Выполнение команд (после обновления текста)
        if (commandAnalysis.commands.length > 0) {
            console.log('▶️ Выполнение команд:', commandAnalysis.commands.map(c => c.name));

            // ОСОБАЯ ОБРАБОТКА ДЛЯ КОМАНДЫ UNDO
            const undoCommands = commandAnalysis.commands.filter(cmd => cmd.name === 'undo');
            if (undoCommands.length > 0) {
                // Для команды undo сначала обрабатываем текст, потом выполняем
                undoCommands.forEach(cmd => {
                    executeCommand(cmd);
                });

                // Другие команды выполняем как обычно
                const otherCommands = commandAnalysis.commands.filter(cmd => cmd.name !== 'undo');
                otherCommands.forEach(cmd => {
                    executeCommand(cmd);
                });
            } else {
                // Все команды кроме undo
                commandAnalysis.commands.forEach(cmd => {
                    executeCommand(cmd);
                });
            }
        }


        // Проверка что команды работают
        console.log('🧪 Тест команд:');
        console.log('  "отменить" ->', commandProcessor.testCommand('отменить', 'undo'));
        console.log('  "отмена" ->', commandProcessor.testCommand('отмена', 'undo'));
        console.log('  "абзац" ->', commandProcessor.testCommand('абзац', 'paragraph'));
    }

    // Выполнение конкретной команды
    function executeCommand(cmd) {
        console.log(`▶️ Выполняю: ${cmd.name} (${cmd.action})`);

        switch(cmd.action) {
            case 'addParagraph':
                handleCommandParagraph();
                break;

            case 'undoLastWord':
                handleCommandUndo();
                break;

            case 'saveNote':
                handleCommandSave();
                break;

            case 'startRecording':
                handleCommandStartRecording();
                break;

            case 'stopRecording':
                handleCommandStopRecording();
                break;

            default:
                console.warn(`⚠️ Неизвестное действие: ${cmd.action}`);
        }
    }

    // Обработчики команд
    function handleCommandParagraph() {
        console.log('📝 Команда: добавить абзац');
        if (!currentNote) return;

        // Сохраняем текущий сегмент
        if (transcriptProcessor?.commitSegment) {
            transcriptProcessor.commitSegment(currentNote);
        }

        // Добавляем абзац
        currentNote.content += '\n\n';
        currentNote.updatedAt = new Date();

        if (editDiv) {
            editDiv.textContent = currentNote.content;
        }

        console.log('✅ Абзац добавлен');
    }

    function handleCommandUndo() {
        console.log('↩️ Команда: отменить последнее слово');
        if (!currentNote) return;

        // Получаем полный текущий текст (сохраненный + текущий сегмент)
        let fullText = currentNote.content || '';

        // Добавляем текущий сегмент если есть
        if (transcriptProcessor?.getSegmentText) {
            const segmentText = transcriptProcessor.getSegmentText();
            if (segmentText) {
                const separator = fullText && !fullText.endsWith(' ') ? ' ' : '';
                fullText += separator + segmentText;

                // Очищаем текущий сегмент
                transcriptProcessor.clearSegment();
            }
        }

        console.log('📝 Полный текст перед удалением:', fullText);

        // Удаляем последнее слово
        if (fullText.trim()) {
            const words = fullText.trim().split(/\s+/);

            // Находим и удаляем команду "отменить" или "отмена" если она есть
            const lastWordIndex = words.length - 1;
            const undoWords = ['отменить', 'отмена'];

            let wordsToRemove = 1; // По умолчанию удаляем одно слово

            // Если последнее слово - команда undo, удаляем ее И слово перед ней
            if (lastWordIndex >= 0 && undoWords.includes(words[lastWordIndex].toLowerCase())) {
                wordsToRemove = 2; // Удаляем команду И слово перед ней
                console.log('🗑️ Удаляю команду и слово перед ней');
            }

            // Удаляем нужное количество слов с конца
            for (let i = 0; i < wordsToRemove && words.length > 0; i++) {
                words.pop();
            }

            // Обновляем текст
            fullText = words.join(' ') + (words.length > 0 ? ' ' : '');

            console.log(`🗑️ Удалено ${wordsToRemove} слов. Осталось:`, words.length);
        }

        // Обновляем заметку
        currentNote.content = fullText;
        currentNote.updatedAt = new Date();
        currentNote.wordCount = fullText.split(/\s+/).filter(w => w.length > 0).length;

        // Обновляем редактор
        if (editDiv) {
            editDiv.textContent = fullText;
        }

        console.log('✅ Результат:', fullText);
    }

    function handleCommandSave() {
        console.log('💾 Команда: сохранить');
        saveNote();
    }

    function handleCommandStartRecording() {
        console.log('🎙️ Команда: начать запись');
        if (!isRecording) {
            startRecording();
        }
    }

    function handleCommandStopRecording() {
        console.log('⏹️ Команда: остановить запись');
        if (isRecording) {
            stopRecording();
        }
    }

    function createOrLoadDraft() {
        const draft = records.find(n => n.id === 'draft_current');
        if (draft) {
            currentNote = draft;
            console.log('📝 Загружен черновик:', draft.content?.length || 0, 'символов');
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
            console.log('📝 Создан новый черновик');
        }
    }

    // Очистка
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

        // Сбрасываем процессоры
        if (transcriptProcessor?.reset) {
            transcriptProcessor.reset();
        }
    }

    // Обработчик ввода в редакторе
    function handleEditorInput() {
        if (!editDiv || !currentNote) return;
        const text = editDiv.textContent || '';

        // При ручном редактировании сохраняем текущий сегмент
        if (transcriptProcessor?.commitSegment) {
            transcriptProcessor.commitSegment(currentNote);
        }

        if (text !== currentNote.content) {
            currentNote.content = text;
            currentNote.updatedAt = new Date();
            currentNote.wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

            // Автогенерация заголовка
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
            if (!asrClient.isSupported()) {
                throw new Error('Браузер не поддерживает запись аудио');
            }

            await asrClient.start();
            isRecording = true;
            isConnecting = false;
            console.log('✅ Запись начата');

        } catch (err) {
            console.error('Ошибка запуска записи:', err);
            error = err.message || 'Не удалось начать запись';
            isConnecting = false;
            isRecording = false;
        }
    }

    // Остановка записи
    async function stopRecording() {
        // Сохраняем текущий сегмент перед остановкой
        if (transcriptProcessor?.commitSegment && currentNote) {
            transcriptProcessor.commitSegment(currentNote);
        }

        await stopASR();
        console.log('⏹️ Запись остановлена');
    }

    // Сохранение заметки
    function saveNote() {
        if (!currentNote) {
            createOrLoadDraft();
        }

        // Сохраняем текущий сегмент перед сохранением
        if (transcriptProcessor?.commitSegment) {
            transcriptProcessor.commitSegment(currentNote);
        }

        // Синхронизируем содержимое из редактора
        if (editDiv) {
            currentNote.content = editDiv.textContent || '';
        }

        if (isRecording) {
            stopRecording();
        }

        if (currentNote.draft) {
            const firstWords = currentNote.content.split(/\s+/).slice(0, 5).join(' ');
            const newNote = {
                ...currentNote,
                id: 'note_' + Date.now(),
                title: firstWords || 'Новая заметка',
                draft: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const draftIndex = records.findIndex(n => n.id === 'draft_current');
            if (draftIndex > -1) {
                records.splice(draftIndex, 1);
            }

            records.push(newNote);
            console.log('💾 Сохранена новая заметка:', newNote.title);
        } else {
            currentNote.updatedAt = new Date();
            currentNote.wordCount = currentNote.content.split(/\s+/).filter(w => w.length > 0).length;

            if (!currentNote.title && currentNote.content.trim()) {
                const firstWords = currentNote.content.split(/\s+/).slice(0, 5).join(' ');
                currentNote.title = firstWords || 'Новая заметка';
            }

            console.log('💾 Обновлена заметка:', currentNote.title);
        }

        navigateTo.list();
    }
</script>

<div class="min-h-screen bg-gray-50 pb-16">
    <!-- Верхняя панель -->
    <div class="flex justify-between sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div class="flex items-center gap-3">
            <!-- Индикатор статуса -->
            <div class={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : connectionStatus === 'connected' ? 'bg-green-500' : 'bg-gray-400'}`}
                 title="{isRecording ? 'Идет запись' : connectionStatus === 'connected' ? 'Подключено' : 'Отключено'}">
            </div>
            <div class="text-sm text-gray-600">
                {#if isRecording}
                    <span class="text-red-600 font-medium">Идет запись</span>
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
                    title="Сохранить"
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
                placeholder="Говорите - текст будет появляться здесь. Команды: абзац, отменить, сохранить, запись, стоп запись"
            >
                {currentNote?.content || ''}
            </div>
        </div>

        <!-- Ошибки -->
        {#if error}
            <div class="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                <div class="font-medium mb-1">Ошибка:</div>
                {error}
            </div>
        {/if}

        <!-- Отладочная информация (можно убрать в продакшене) -->
        <div class="mt-4 p-3 bg-gray-50 text-gray-600 text-xs rounded-lg border border-gray-200">
            <div class="font-medium mb-1">Отладка:</div>
            <div>Статус: {connectionStatus} | Запись: {isRecording ? 'да' : 'нет'}</div>
            <div>Заметка: {currentNote?.title || 'черновик'} ({currentNote?.wordCount || 0} слов)</div>
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

    .animate-spin {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>
