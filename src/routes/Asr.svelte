<!-- src/routes/Asr.svelte -->
<script>
    import { onMount, onDestroy } from 'svelte';
    import { navigateTo, currentNoteId } from '$lib/store.js';
    import { processSegment, executeCommand } from '$lib/command-processor.js';
    import { SherpaASRClient } from '$lib/asr-client.js';

    import { icons } from '$lib/images/icons.js';
    import { MicrophoneOutline, CheckOutline } from "flowbite-svelte-icons";
    import { createPersistedArray } from '$lib/stores/persisted-store.svelte.js';

    // Текущая заметка
    let currentNote = $state(null);
    let editDiv = $state(null);
    let isRecording = $state(false);
    let isConnecting = $state(false);
    let error = $state(null);
    let connectionStatus = $state('disconnected');

    // Состояния для обработки сегментов
    let lastProcessedSegment = $state(-1);
    let temporaryText = $state('');
    let isProcessing = $state(false);

    // ASR клиент
    let asrClient = $state(null);

    let records = createPersistedArray('voice-notes', []);

    let noteId = $state(null);
    const unsubscribeNoteId = currentNoteId.subscribe(value => {
      noteId = value;
    });

    // let oldsegment = -1
    let oldtranscript = ''
    let stopTranscriptProc = false
    // Инициализация
    onMount(async () => {
        await loadNote();

        asrClient = new SherpaASRClient();
        asrClient.on('transcript', handleTranscript);
        asrClient.on('status', handleStatusChange);
        asrClient.on('error', handleError);

        console.log('✅ ASR клиент инициализирован с event emitter');
    });

  // Загрузка заметки
    async function loadNote() {
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
        console.log('📝 createOrLoadDraft records:', records);
        createOrLoadDraft();
      }
    }

    //
    // если в сегменте есть команда, то вызвать обработчик и ждать сл. сегмента
    // если нет, добавить сегмент
    // новый сегмент

    // Обработчик транскриптов
    async function handleTranscript(data) {
        // console.log('🎯 Обработчик transcript :', data);
        let cleantext = data.text?.trim() || ''

        // if (stopTranscriptProc) return

        if (!currentNote || !cleantext) {
            console.log('⏭️ нет заметки или текста');
            return;
        }


        if (lastProcessedSegment == data.segment && oldtranscript == cleantext) {
            console.log('⏭️ Пропуск: полное повторение');
            return;
        }

        let final = lastProcessedSegment == data.segment

        const result = processSegment(cleantext);
        console.log('🔧 сегмент:', data.segment, final);
        console.log('🔧 Результат обработки сегмента:', result);

        lastProcessedSegment = data.segment
        oldtranscript = cleantext
        temporaryText = cleantext // temporaryText - это обработанный cleantext

        console.log('🎯 temporaryText:', temporaryText);

        // новый сегмент, или в текущем есть system-команда
        // tmp обработать, добавить в запись, показать новую запись
        // далее, если тот же сегмент, пропустить?
        // stopTranscriptProc = true
        if (final || (result && result.system)) {
            console.log('________________________________', result)
            temporaryText = final ? cleantext : cleantext.replace(result.pattern, '').trim();
            currentNote.content = addTextWithSpace(currentNote.content, temporaryText);
            temporaryText = ''
            if (result) console.log('______ACTION', result)
            if (result) await handleCommandAction(result.name);
            // updateEditor();
        } else {
            // temporaryText = cleantext
            if (result && result.command) { // а это не system
                console.log('🎯 команда:', result.command);
                // обработать команду, т.е. удалить команду и показать
                temporaryText = cleantext.replace(result.pattern, '').trim();
            }
        }
        updateEditorWithTemporaryText();
    }

    /**
     * Обрабатывает завершенный сегмент
     */
    async function handleCompletedSegment(segmentText, result) {
        if (isProcessing) return;
        isProcessing = true;

        try {
            console.log('_kkk')
            if (result.system) {
                await handleCommandAction(result.command);
            }

            updateEditor();
        } catch (err) {
            console.log('ERR_', err)
        } finally {
            isProcessing = false;
        }
        updateEditor();
    }

    /**
     * Обрабатывает дополнительные действия команд
     */
    async function handleCommandAction(action) {
        switch (action) {
        case 'saveNote':
            await saveNote();
            break;
        case 'cleanNote':
            await cleanNote();
            break;
        case 'startRecording':
            if (!isRecording) {
                await startRecording();
            }
            break;
        case 'stopRecord':
            if (isRecording) {
                await stopRecording();
            }
            break;
        }
    }

    /**
     * Добавляет текст с правильным пробелом
     */
    function addTextWithSpace(existingText, textToAdd) {
        if (!textToAdd) return existingText;
        if (!existingText) return textToAdd;

        if (textToAdd === '\n\n') {
            return existingText + textToAdd;
        }

        const lastChar = existingText[existingText.length - 1];
        const firstChar = textToAdd[0];

        if (lastChar === ' ' || lastChar === '\n' || firstChar === ' ' || firstChar === '\n') {
            return existingText + textToAdd;
        } else {
            return existingText + ' ' + textToAdd;
        }
    }

    // Обработчики статуса и ошибок
    function handleStatusChange(status) {
        console.log('📡 Статус ASR:', status);
        connectionStatus = status;
    }

    function handleError(err) {
        console.error('❌ Ошибка ASR:', err);
        error = err.message || 'Ошибка подключения к серверу распознавания';
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
        console.log('_____________________________START')
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
        if (!asrClient || !isRecording) {
            console.log('Запись не активна');
            return;
        }

        try {
            // Обрабатываем последний сегмент перед остановкой
            if (temporaryText.trim()) {
                await handleCompletedSegment(temporaryText);
            }

            await asrClient.stop();
            isRecording = false;
            console.log('⏹️ Запись остановлена');

            // Сбрасываем состояния сегментов
            temporaryText = '';
            lastProcessedSegment = -1;
            updateEditor();

        } catch (err) {
            console.error('Ошибка остановки записи:', err);
            error = err.message || 'Не удалось остановить запись';
        }
    }

    // Сохранение заметки
    async function saveNote() {
        if (!currentNote?.content?.trim()) {
            console.warn('Пустая заметка, сохраняем');
        }

        // Сбрасываем состояния сегментов перед сохранением
        temporaryText = '';
        lastProcessedSegment = -1;

        currentNote.draft = false
        currentNote.title = generateTitle(currentNote.content)
        // const draft = records.find(n => n.id === 'draft_current');


        if (currentNote.id == 'draft_current') currentNote.id = crypto.randomUUID()
        console.log('__________SAVED', currentNote)

        return

        let key = 'voice-notes'
        const existingItems = JSON.parse(localStorage.getItem(key)) || [];
        // 3. Add the new item to the array
        existingItems.push(currentNote?.content);
        // 4. & 5. Stringify the updated array and save it back to localStorage
        localStorage.setItem(key, JSON.stringify(existingItems));

        // updateEditor();


    }

    function generateTitle(content) {
        if (!content) return 'Новая заметка';
        const firstLine = content.split('\n')[0];
        const words = firstLine.split(' ');
        if (words.length <= 5) {
            return firstLine.slice(0, 50);
        } else {
            return words.slice(0, 5).join(' ') + '...';
        }
    }

    function updateEditorWithTemporaryText() {
        if (!editDiv) return;

        const baseText = currentNote?.content || '';
        let displayText = baseText;

        if (temporaryText.trim()) {
            if (baseText && !baseText.endsWith(' ') && !baseText.endsWith('\n')) {
                displayText += ' ';
            }
            displayText += temporaryText;
        }

        editDiv.textContent = displayText;
        editDiv.scrollTop = editDiv.scrollHeight;
    }

    function cleanNote() {
        if (!editDiv) return;
        currentNote.content = '';
        editDiv.textContent = '';
        if (editDiv.scrollHeight > editDiv.clientHeight) {
            editDiv.scrollTop = editDiv.scrollHeight;
        }
    }

    function updateEditor() {
        if (!editDiv) return;
        editDiv.textContent = currentNote?.content || '';
        if (editDiv.scrollHeight > editDiv.clientHeight) {
            editDiv.scrollTop = editDiv.scrollHeight;
        }
    }

    function handleEditorInput() {
        if (editDiv) {
            currentNote.content = editDiv.textContent;
        }
    }

    // Очистка
    onDestroy(() => {
        unsubscribeNoteId?.();
        if (asrClient) {
            if (isRecording) {
                asrClient.stop().catch(console.error);
            }
            asrClient.stop();
        }
    });

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


</script>

<div class="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
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
                    onclick={saveNote}
                    class="p-2 text-green-600 hover:text-green-800 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Сохранить"
                >
                    <CheckOutline class="h-6 w-6" />
                </button>

                {@html icons.delete}

                <button
                    onclick={toggleRecording}
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


    <!-- Сообщения об ошибках  -->
    {#if error}
        <div class="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div class="flex items-start">
                <svg class="w-5 h-5 text-red-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-red-700 text-sm">{error}</span>
            </div>
        </div>
    {/if}

    <!-- Редактор  -->
    <div class="flex-1 p-4 overflow-auto">
        <div
            bind:this={editDiv}
            contenteditable="true"
            oninput={handleEditorInput}
            class="h-full min-h-[280px] text-gray-800 text-base focus:outline-none whitespace-pre-wrap caret-blue-600"
            placeholder="Говорите - текст будет появляться здесь. Команды: абзац, отменить, сохранить, запись, стоп запись"
        >
            {currentNote?.content || ''}
        </div>
    </div>

    <!-- Статус ( + обработка) -->
    <div class="p-3 border-t border-gray-200 bg-gray-50">
        <div class="flex items-center justify-between">
            <div class="text-xs text-gray-500">
                {#if isProcessing}
                    <span class="flex items-center">
                        <svg class="animate-spin h-3 w-3 mr-2 text-blue-500" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Обработка...
                    </span>
                {:else if temporaryText}
                    <span>Распознается: "{temporaryText}"</span>
                {:else if connectionStatus === 'connected'}
                    <span>Готов к записи</span>
                {:else}
                    <span>Ожидание подключения...</span>
                {/if}
            </div>

            <div class="text-xs text-gray-500">
                {currentNote?.content?.length || 0} знаков
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
    }
</style>
