<!-- src/routes/Asr.svelte -->
<script>
    import { onMount, onDestroy } from 'svelte';
    import { navigateTo, currentNoteId } from '$lib/store.js';
    // import { processSegment, executeCommand } from '$lib/command-processor.js';
    import { processSegment } from '$lib/command-processor.js';
    import { SherpaASRClient } from '$lib/asr-client.js';

    import { icons } from '$lib/images/icons.js';
    import { MicrophoneOutline, CheckOutline } from "flowbite-svelte-icons";
    import { createPersistedArray } from '$lib/stores/persisted-store.svelte.js';

    import Debug from 'debug';
    const dc = Debug('command');
    const dapp = Debug('app');
    const dtr = Debug('transcript');

    dapp('___________________KUKU APP')

    // Текущая заметка
    let currentNote = $state(null);
    let editDiv = $state(null);
    let isRecording = $state(false);
    let isConnecting = $state(false);
    let error = $state(null);
    let connectionStatus = $state('disconnected');

    // Состояния для обработки сегментов
    // let lastProcessedSegment = $state(1);
    let temporaryText = $state('');
    let isProcessing = $state(false);
    let lastSegment = 1
    let lastText = ''
    let lastCommand = ''

    // прошлый сегмент
    let completedSegment; // = {} //$state({});
    let completedSegmentAfterCommand;

    // ASR клиент
    let asrClient = $state(null);

    let records = createPersistedArray('voice-notes', []);

    let noteId = $state(null);
    const unsubscribeNoteId = currentNoteId.subscribe(value => {
      noteId = value;
    });

    // let oldtranscript = ''
    // let stopTranscriptProc = false
    // Инициализация
    onMount(async () => {
        await loadNote();

        asrClient = new SherpaASRClient();
        asrClient.on('transcript', handleTranscript);
        asrClient.on('status', handleStatusChange);
        asrClient.on('error', handleError);

        // ++console.log('✅ ASR клиент инициализирован с event emitter');
    });

  // Загрузка заметки
    async function loadNote() {
        if (noteId) {
            const found = records.find(n => n.id === noteId);
            if (found) {
                currentNote = found;
                // ++console.log('📝 Загружена заметка:', found.title);
            } else {
                noteId = null;
                currentNote = null;
                createOrLoadDraft();
            }
        } else {
            // ++console.log('📝 createOrLoadDraft records:');
            $inspect(records)
            createOrLoadDraft();
        }
    }

    //
    // если в сегменте есть команда, то вызвать обработчик и ждать сл. сегмента
    // если нет, добавить сегмент
    // новый сегмент

    // Обработчик транскриптов
    async function handleTranscript(data) {
        // // ++console.log('🎯 Обработчик transcript :', data);
        dtr('___________________TR DATA', data)
        dapp('___________________APP DATA', data)
        let temporaryText = data.text?.trim() || ''

        if (!currentNote || !temporaryText) {
            // ++console.log('⏭️ нет заметки или текста');
            return;
        }

        if (!completedSegment) completedSegment = data

        if (!completedSegment.text) {
            // ++console.log('⏭️ повторение команды', completedSegment);
            // return
        }

        // ++console.log('⏭️ STARTcompletedSegment____________:', completedSegment.text, completedSegment.segment);
        if (data.segment == completedSegment.segment && data.text == completedSegment.text) {
            // ++console.log('⏭️ Пропуск: полное повторение', data.text, data.segment);
            return;
        }
        console.log('⏭️ START data_______________________:', data);
        console.log('⏭️ STARTcompletedSegment____________:', completedSegment);

        const final = completedSegment.segment != data.segment
        const command = processSegment(temporaryText);

        // // ++console.log('🔧 lastSegment:', lastSegment);
        // // ++console.log('🔧 сегмент data:', data, 'final:', final);
        // // ++console.log('🔧 temporaryText:', temporaryText);
        // lastSegment = data.segment
        // lastText = temporaryText

        // ddd
        if (final) {
            // // ++console.log('🔧 =========================== final seg:', data);
            console.log('🔧 === FINAL === completedSegment:', completedSegment);
            // currentNote.content += completedSegment.text + ' '
            handleCompletedSegment(completedSegmentAfterCommand)
            // completedSegment = data
        // } else {
            // completedSegment = data
        }

        completedSegment = {text: data.text, segment: data.segment}
        completedSegmentAfterCommand = {text: data.text, segment: data.segment}
        // completedSegment = data
        if (command) {
        // if (command && command.name != lastCommand) {
            console.log('🔧 command:', 1, command.name, 2, lastCommand, data);
            await handleCommandAction(command.name);
            lastCommand = command.name // не повторять случайно
            // console.log('_before:', currentNote.content);
            // console.log('_before:', data.text);
            data.text = data.text.replace(command.pattern, '').trim();
            // console.log('_after:', currentNote.content);
            console.log('_after:', data.text);
            // completedSegment = data
            completedSegmentAfterCommand = data
        } else {
            lastCommand = ''
        }
        // completedSegment = data

        console.log('_update 1:', currentNote.content);
        console.log('_update 2:', data);
        console.log('_update 3:', completedSegment);
        // editDiv.textContent += data.text
        updateEditorWithTemporaryText(data)
    }

    /**
     * Обрабатывает завершенный сегмент
     */
    async function handleCompletedSegment(completedSegment) {
        if (isProcessing) return;
        isProcessing = true;
        try {
            // ++console.log('_handleCompletedSegment::::')
            currentNote.content += completedSegment.text + ' ' // + '<COMPLETED>'
        } catch (err) {
            // ++console.log('ERR_', err)
        } finally {
            isProcessing = false;
        }
        // ddd
    }

    function updateEditorWithTemporaryText(data) {
        if (!editDiv) return;

        const baseText = currentNote?.content || '';
        let displayText = baseText;

        if (data.text.trim()) {
            if (baseText && !baseText.endsWith(' ') && !baseText.endsWith('\n')) {
                displayText += ' ';
            }
            displayText += data.text;
        }

        // ++console.log('_____________________________________displayText', displayText)
        editDiv.textContent = displayText;
        editDiv.scrollTop = editDiv.scrollHeight;
        // placeCaretAtEnd( document.querySelector('p') );
        placeCaretAtEnd(editDiv);
    }

    function placeCaretAtEnd(el) {
        el.focus();
        if (typeof window.getSelection != "undefined"
            && typeof document.createRange != "undefined") {
            var range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    function updateEditor() {
        // ++console.log('_updateEditor::::::::::')
        if (!editDiv) return;
        editDiv.textContent = currentNote?.content || '';
        if (editDiv.scrollHeight > editDiv.clientHeight) {
            editDiv.scrollTop = editDiv.scrollHeight;
        }
    }

    /**
     * Обрабатывает дополнительные действия команд
     */
    async function handleCommandAction(action) {
        // ++console.log('handleCommandAction', action)

        switch (action) {
        case 'saveNote':
            await saveNote();
            break;
        case 'cleanNote':
            await cleanNote();
            break;
        case 'addParagraph':
            await addParagraph();
            break;
        case 'undo':
            await undoWord();
            break;
        case 'recordStart':
            if (!isRecording) {
                await startRecording();
            }
            break;
        case 'recordStop':
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
        // ++console.log('📡 Статус ASR:', status);
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
        // ++console.log('_____________________________START')
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
            // ++console.log('✅ Запись начата');

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
            // ++console.log('Запись не активна');
            return;
        }

        try {
            currentNote.content = editDiv.textContent

            // Обрабатываем последний сегмент перед остановкой
            // if (temporaryText.trim()) {
            //     await handleCompletedSegment(temporaryText);
            // }

            await asrClient.stop();
            isRecording = false;
            // ++console.log('⏹️ Запись остановлена');

            // Сбрасываем состояния сегментов
            // temporaryText = '';
            // lastSegment = 1;
            // updateEditor();

            // ddd
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
        // temporaryText = '';
        // lastSegment = 1;

        currentNote.draft = false
        currentNote.title = generateTitle(currentNote.content)
        // const draft = records.find(n => n.id === 'draft_current');

        if (currentNote.id == 'draft_current') currentNote.id = crypto.randomUUID()
        // ++console.log('__________SAVED:')
        // $inspect(currentNote)
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

    function cleanNote() {
        if (!editDiv) return;
        currentNote.content = '';
        // editDiv.textContent = '';
        if (editDiv.scrollHeight > editDiv.clientHeight) {
            editDiv.scrollTop = editDiv.scrollHeight;
        }
    }

    function addParagraph() {
        // ++console.log('______________________________________________________________adding par')
        if (!editDiv) return;
        currentNote.content += '\n';
        // currentNote.content += 'PAR';
        // editDiv.textContent = '';
        if (editDiv.scrollHeight > editDiv.clientHeight) {
            editDiv.scrollTop = editDiv.scrollHeight;
        }
    }

    function undoWord() {
        if (!editDiv) return;
        // editDiv.textContent = currentNote?.content.split(' ').slice(0, -1).join(' ')
        // ++console.log('_undoWord :', editDiv.textContent)
        // ++console.log('_undoWord  tmp:', temporaryText)
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
        // ++console.log('📝 Загружен черновик:', draft.content?.length || 0, 'символов');
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
        // ++console.log('📝 Создан новый черновик');
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
