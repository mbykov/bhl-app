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

    import Meter from './Meter.svelte'
    let meterComponent;

    const log = console.log

    // Текущая заметка
    let currentNote = $state(null);
    let currentNoteN = $state([]);
    let currentPar = $state(null);

    let editDiv = $state(null);
    let isRecording = $state(false);
    let isWriting = $state(true);
    let isConnecting = $state(false);
    let isChanged = false
    let error = $state(null);
    let connectionStatus = $state('disconnected');

    // Состояния для обработки сегментов
    let lastProcessedSegment = '' // $state(1);
    let temporaryText = $state('');
    let isProcessing = $state(false);
    let lastCommand = ''
    let commandDiv

    let oredactor
    let ocurpar

    // ASR клиент
    let asrClient = $state(null);

    let records = createPersistedArray('voice-notes', []);

    let noteId = $state(null);
    const unsubscribeNoteId = currentNoteId.subscribe(value => {
      noteId = value;
    });

    // Инициализация
    onMount(async () => {
        oredactor = document.querySelector('#redactor');
        ocurpar = oredactor.lastElementChild
        await loadNote();
        asrClient = new SherpaASRClient();
        asrClient.on('transcript', handleTranscript);
        asrClient.on('status', handleStatusChange);
        asrClient.on('error', handleError);
        asrClient.on('vumeter', handleVuMeter);
        commandDiv = document.getElementById('commandDiv');
        await startRecording();
    });

    async function handleVuMeter(vudata) {
        if (meterComponent) meterComponent.showLeds(vudata)
    }

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
                // непонятно. Если есть noteId, но запись не найдена, то это ошибка должна быть
            }
        } else {
            // $inspect(records)
            createOrLoadDraft();
        }
    }

    async function handleCommand(data) {
        switch (data.command) {
        case 'saveNote':
            await saveNote();
            break;
        case 'getTime':
            log('_getTime', data)
            editDiv.textContent += ' kuku'
            break;
        case 'cleanNote': // удали текст
            currentNote.content = ''
            editDiv.textContent = ''

            cleanCurrentNote()
            break;
        case 'addParagraph': // новый абзац, новая строка
            currentNote.content += '\n\n'
            createNewParagraph()
            break;
        case 'undoWord':
            let relast = new RegExp(lastProcessedSegment + '$')
            currentNote.content = currentNote.content.replace(relast, '')
            break;
        case 'recordStart': // начать запись
            if (!isRecording) {
                await startRecording();
            }
            log('_______REC START')
            isWriting = true
            break;
        case 'recordStop': // стоп запись
            // log('_command STOP', currentNote)
            editDiv.textContent = currentNote.content // повторение, потому что запись блокируется
            // if (isRecording) {
            //     await stopRecording();
            // }
            isWriting = false
            break;
        case 'recordNew': // стоп запись + goto List + title
            editDiv.textContent = currentNote.content
            if (isRecording) {
                await stopRecording();
            }
            isWriting = false
            currentNote.title = generateTitle(currentNote.content)
            navigateTo.list()
            break;
        }

        // editDiv.textContent = currentNote.content.trim()
        toggleCommandDiv(data.command)
    }

    async function toggleCommandDiv(command) {
        let cname = document.querySelector('#commandName')
        cname.textContent = command
        commandDiv.classList.remove('hidden');
        setTimeout(() => {
            commandDiv.classList.add('hidden');
        }, 3000);
    }

    // Обработчик транскриптов
    async function handleTranscript(data) {
        if (!editDiv) return;
        const now = new Date()
        let localTime = now.toLocaleString('ru-RU')
        // console.log('⏭️ START data_______________________:', localTime, data);

        if (!ocurpar) createNewParagraph()

        if (data.command == 'recordStart' && data.text === '') isWriting = true
        if (!isWriting) return;

        if (data.command) {
            log('__handleCommand_', data)
            handleCommand(data)
        } else if (data.type == 'final') {
            handleCompletedSegment(data)
        } else if (data.type == 'intermediate') {
            // console.log('⏭ tmp_____:', data);
            updateEditorWithTemporaryText(data)
        }
        placeCaretAtEnd(editDiv);
    }

    // mmm
    function createNewParagraph() {
        currentPar = ''
        let otmpl = document.querySelector('#par-template');
        ocurpar = otmpl.cloneNode()
        ocurpar.id = ''
        ocurpar.classList.remove('hidden')
        ocurpar.textContent = currentPar
        oredactor.appendChild(ocurpar)
    }

    function cleanCurrentNote() {
        currentNote.content = ''
        currentNoteN.content = []
        oredactor.replaceChildren();
        createNewParagraph()
    }

    /**
     * Обрабатывает завершенный сегмент
     */
    function handleCompletedSegment(data) {
        data.text = data.text.trim()
        //
        lastProcessedSegment = data.text
        currentNote.content += ' ' + data.text
        currentNote.content = currentNote.content.trim()
        editDiv.textContent = currentNote.content.trim()
        // mmm
        // log('_final dtata', data.text)
        if (!currentPar) currentPar = ''
        let space = currentPar ? ' ' : ''
        currentPar += space + data.text
        log('_currentPar.content_2', currentPar.content)
        ocurpar.textContent = currentPar
    }

    function updateEditorWithTemporaryText(data) {
        const baseText = currentNote?.content || '';
        let displayText = baseText;

        if (data.text.trim()) {
            if (baseText && !baseText.endsWith(' ') && !baseText.endsWith('\n')) {
                displayText += ' ';
            }
            displayText += data.text;
        }

        // console.log('_____________________________________displayText', displayText)
        editDiv.textContent = displayText;
        editDiv.scrollTop = editDiv.scrollHeight;

        if (ocurpar && data.type == 'intermediate') { // *почему может не быть ocurpar ??*
            // log('_+interm', data.text)

            if (!currentPar) currentPar = ''
            let space = currentPar ? ' ' : ''
            ocurpar.textContent = currentPar + space + data.text
            oredactor.scrollTop = oredactor.scrollHeight;
        }
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
    // async function toggleRecording() {
    //   if (isRecording) {
    //     await stopRecording();
    //   } else {
    //     await startRecording();
    //   }
    // }

    async function toggleWriting() {
        isWriting = !isWriting
        // if (!isWriting) isConnecting = true
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
            isWriting = true;
            // console.log('✅ Запись начата');
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
            // currentNote.content = editDiv.textContent
            // editDiv.textContent = currentNote.content
            await asrClient.stop();
            isRecording = false;
            // console.log('⏹️ Запись остановлена');
        } catch (err) {
            console.error('Ошибка остановки записи:', err);
            error = err.message || 'Не удалось остановить запись';
        }
    }

    // Сохранение заметки
    async function saveNote() {
        // if (!currentNote?.content?.trim()) {
        //     console.warn('Пустая заметка, сохраняем');
        // }

        if (isChanged) {
            currentNote.content = editDiv.textContent.trim();
            isChanged = false
        }
        // editDiv.textContent = currentNote.content
        currentNote.draft = false
        currentNote.title = generateTitle(currentNote.content)
        // const draft = records.find(n => n.id === 'draft_current');

        if (currentNote.id == 'draft_current') currentNote.id = crypto.randomUUID()
        toggleCommandDiv('saveNote')
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

    function handleEditorInput() {
        if (!editDiv) return;
        isChanged = true
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

<div id="commandDiv" class="hidden absolute top-30 right-0 h-8 w-64 bg-green-100 z-100 p-1 px-4 mx-4 border shadow-md rounded-md">
    команда: <span id="commandName"></span>
</div>

<div class="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <!-- Верхняя панель -->
    <div class="flex justify-between sticky top-0 z-10 bg-white border-b border-gray-200 px-3 py-3">
        <Meter bind:this={meterComponent} class=""/>

        <div class="flex items-center gap-2">
          <button
            onclick={saveNote}
            class="p-2 text-green-600 hover:text-green-800 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Сохранить"
            >
            <CheckOutline class="h-6 w-6" />
          </button>

          {@html icons.delete}

          <!-- toggleRecording -->
          <button
            onclick={toggleWriting}
            class={`p-2 rounded-full ${isWriting ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
            title={isRecording ? 'Остановить запись' : 'Начать запись'}
            disabled={isConnecting}
            >
            {#if isConnecting}
              <div class="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            {:else if isWriting}
              <div class="h-6 w-6 flex items-center justify-center">
                <div class="h-3 w-3 bg-red-600 rounded-sm"></div>
              </div>
            {:else}
              <MicrophoneOutline class="h-6 w-6" />
            {/if}
          </button>
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
      <div id="redactor" class="flex-1 p-4_ overflow-auto border">
      </div>
      <div id="par-template" class="px-4 pt-2 hidden"></div>

      <div class="flex-1 p-4 overflow-auto border hidden_">
        <div
            bind:this={editDiv}
            oninput={handleEditorInput}
            onchange={handleEditorInput}
            contenteditable="true"
            class="h-full min-h-[280px] text-gray-800 text-base focus:outline-none whitespace-pre-wrap caret-blue-600"
            placeholder="Говорите - текст будет появляться здесь. Команды: абзац, отменить, сохранить, запись, стоп запись"
        >
            {currentNote?.content || ''}
        </div>
    </div>

    <!-- Статус ( + обработка) -->
    <div class="p-3 border-t border-gray-200 bg-gray-50">-------------------------------
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
