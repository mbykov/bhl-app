<script>
    import _ from "lodash"
    import { onMount, onDestroy } from 'svelte';
    import { navigateTo, currentNoteId } from '$lib/store.js';
    // import { processSegment, executeCommand } from '$lib/command-processor.js';
    import { processSegment } from '$lib/command-processor.js';
    import { SherpaASRClient } from '$lib/asr-client.js';

    import { icons } from '$lib/images/icons.js';
    import { MicrophoneOutline, CheckOutline } from "flowbite-svelte-icons";
    import { createPersistedArray } from '$lib/stores/persisted-store.svelte.js';

    import { svgtest } from '$lib/svg-text.js'

    import Debug from 'debug';
    const dc = Debug('command');
    const dapp = Debug('app');
    const dtr = Debug('transcript');

    import Meter from './Meter.svelte'
    let meterComponent;

    const log = console.log

    // Текущая заметка
    let currentNote = $state(null);
    let currentPar = $state({ text: '', id: 0 });

    let isRecording = $state(false);
    let isWriting = $state(true);
    let isConnecting = $state(false);
    let isChanged = false
    let error = $state(null);
    let connectionStatus = $state('disconnected');

    // Состояния для обработки сегментов
    let phrases = []
    let temporaryText = $state('');
    let isProcessing = $state(false);

    // Массив всех блоков в редакторе (текст или латекс)
    let segments = $state([]);
    // Состояние для промежуточного текста (то, что произносится прямо сейчас)
    let tempText = $state('');

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

    // qqq
    import SvgFlipper from './SvgFlipper.svelte';


    // Инициализация
    onMount(async () => {
        // log('____ON MOUNT')
        oredactor = document.querySelector('#redactor');
        // ocurpar = oredactor.lastElementChild
        // здесь плохо. BAD
        await loadNote();
        asrClient = new SherpaASRClient();
        asrClient.on('transcript', handleTranscript);
        asrClient.on('status', handleStatusChange);
        asrClient.on('error', handleError);
        asrClient.on('vumeter', handleVuMeter);
        commandDiv = document.getElementById('commandDiv');
        await startRecording();
    });
    // ccc

    async function handleVuMeter(vudata) {
        if (meterComponent) meterComponent.showLeds(vudata)
    }

    // Загрузка заметки
    // xxx
    async function loadNote() {
        // log('______loadNote START noteId', noteId)
        if (noteId) {
            const found = records.find(n => n.id === noteId);
            if (found) {
                currentNote = found;
                // currentNote.content = [] // DDD delete
                // log('_:::loadNote:::', $state.snapshot(currentNote.content));
                // console.log('📝 Загружена заметка:', found.title);
            } else {
                noteId = null;
                currentNote = null;
                await createOrLoadDraft();
                // console.log('📝 LOAD создана новая заметка:', found.title);
                // непонятно. Если есть noteId, но запись не найдена, то это ошибка должна быть
            }
        } else {
            // $inspect(records)
            await createOrLoadDraft();
        }
        // log('_:::before err:::', $state.snapshot(currentNote));

        currentPar = currentNote.content[currentNote.content.length -1] || ''
        await showNoteParagraphs()
        ocurpar = oredactor.lastElementChild
        placeCaretAtEnd(ocurpar);
    }

    async function handleCommand(data) {
        switch (data.command) {
        case 'saveNote':
            await saveNote();
            break;
        case 'getTime':
            log('_getTime', data)
            // showLatex(data)
            data = {
                text: 'икс равняется синус пи пополам',
                latex: 'x = \\sin \\left( \\frac{\\pi}{2} \\right)',
                flipped: false
            };

            segments.push({
                id: crypto.randomUUID(),
                type: 'latex',
                text: data.text,
                latex: data.latex,
                flipped: false
            });


            break;
        case 'clearNote': // удали текст
            await clearCurrentNote()
            break;
        case 'addParagraph': // новый абзац, новая строка
            ocurpar.textContent = currentPar.text // killmiddle
            ocurpar = await createNewParagraph()
            showNewParagraph(ocurpar)
            break;
        case 'undo':
            undoSegment()
            break;
        case 'recordStart': // начать запись
            ocurpar.textContent = currentPar.text // killmiddle
            isWriting = true
            break;
        case 'recordStop': // стоп запись
            ocurpar.textContent = currentPar.text // killmiddle
            isWriting = false
            break;
        case 'recordNew': // стоп запись + goto List + title
            if (isRecording) {
                await stopRecording();
            }
            isWriting = false
            currentNote.title = generateTitle(currentNote.content)
            navigateTo.list()
            break;
        }

        placeCaretAtEnd(ocurpar)
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
        const now = new Date()
        let localTime = now.toLocaleString('ru-RU')
        // console.log('⏭️ START data command_______________________:', localTime, data.text );

        if (data.command == 'recordStart') isWriting = true
        if (!isWriting) return;

        if (data.command === 'latex') {
            // Очищаем временный текст, так как пришла команда
            tempText = '';
            segments.push({
                id: crypto.randomUUID(),
                type: 'latex',
                text: data.text,
                latex: data.latex,
                flipped: false
            });
        } else if (data.command) {
            tempText = '';
            // log('__handleCommand_', data)
            handleCommand(data)
        } else if (data.type == 'final') {
            // Ваша существующая логика для финального текста
            // Чтобы всё было в одном списке, рекомендую тоже пушить в segments:
            tempText = '';
            segments.push({
                type: 'final',
                text: data.text
            });
            // handleCompletedSegment(data)
        } else if (data.type == 'intermediate') {
            // console.log('⏭ tmp_____:', data);
            // updateEditorWithTemporaryText(data)
            // Обновляем временную строку (реактивно отобразится в конце списка)
            tempText = data.text;
        }
    }

    function undoSegment() {
        ocurpar.textContent = currentPar.text // killmiddle
        log('_отменить::: LAST', currentPar.text)
        let last = phrases.pop()
        log('_отменить::: LAST', phrases)
        let relast = new RegExp(last + '$')
        // currentPar.text = currentPar.text.trim().replace(relast, '')
        currentPar.text = phrases.join(' ')
        ocurpar.textContent = currentPar.text // undo
    }

    function handleEditorInput(ev) {
        isChanged = true
        currentPar.text = ev.target.textContent.trim()
        log('_INPUT currentPar', currentPar.text)
        phrases = currentPar.text.match(/[^.!?]+[.!?]?/g).map(s => s.trim());
        log('_INPUT currentPar phrases', phrases)
    }

    async function clearCurrentNote() {
        currentNote.content = [] // ccc
        oredactor.replaceChildren();
        ocurpar = await createNewParagraph()
        showNewParagraph(ocurpar)
    }

    /**
     * Обрабатывает завершенный сегмент
     */
    function handleCompletedSegment(data) {
        data.text = data.text.trim()
        phrases.push(data.text)
        currentPar.text = phrases.join(' ')

        // log('_:::handleCompletedSegment currentPar.text:::', currentPar.text);
        // log('_:::handleCompletedSegment:::', $state.snapshot(currentNote.content));
        ocurpar.textContent = currentPar.text
        placeCaretAtEnd(ocurpar)
    }

    function updateEditorWithTemporaryText(data) {
        if (data.type == 'intermediate') {
            let space = currentPar.text ? ' ' : '' // начало
            ocurpar.textContent = currentPar.text + space + data.text
            oredactor.scrollTop = oredactor.scrollHeight;
            placeCaretAtEnd(ocurpar)
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
        log('________________stop', currentPar.text)
        ocurpar.textContent = currentPar.text // killmiddle
        if (!asrClient || !isRecording) {
            console.log('Запись не активна');
            return;
        }
        try {
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
        if (isChanged) {
            isChanged = false
        }
        currentNote.draft = false
        currentNote.title = generateTitle()
        currentNote.content = _.compact(currentNote.content)
        currentNote.wordCount = currentNote.content.join(' ').length
        // log('_saved note', currentNote)
        // log('_saved note', currentNote.title)
        if (currentNote.id == 'draft_current') currentNote.id = crypto.randomUUID()
        toggleCommandDiv('saveNote')
        navigateTo.list()
    }

    function generateTitle() {
        // console.log('_:::', $state.snapshot(currentNote.content));
        let firstPar = currentNote.content[0]
        // log('_firstPar', firstPar)
        if (!firstPar) return 'Новая заметка';
        const firstLine = firstPar.text.split('\n')[0];
        const words = firstLine.split(' ');
        if (words.length <= 5) {
            return firstLine.slice(0, 50);
        } else {
            return words.slice(0, 5).join(' ') + '...';
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

    async function createOrLoadDraft() {
        const draft = records.find(n => n.id === 'draft_current');
        if (draft) {
            currentNote = draft;
            // log('📝 Загружен draft черновик id:', draft.id);
            // currentPar = currentNote.content[currentNote.content.length -1] || ''
            // currentNote.content = [] // nb nb nb delete
            log('_draft cur par', currentPar)
            // log('_draft currentNote', currentNote)
            // log('_draft currentNote.content', currentNote.content)
        } else {
            currentNote = {
                id: 'draft_current',
                title: 'Черновик',
                content: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                wordCount: 0,
                draft: true
            };
            currentPar = {text: '', id: 0}
            currentNote.content.push(currentPar)
            records.push(currentNote);
            console.log('📝 Создан новый черновик');
        }
    }

    async function showNoteParagraphs() {
        let otmpl = document.querySelector('#par-template');
        currentNote.content.forEach((par, idx)=> {
            if (!par) return
            let onewpar = otmpl.cloneNode()
            onewpar.id = 'id_' + idx
            onewpar.classList.remove('hidden')
            onewpar.textContent = par.text
            oredactor.appendChild(onewpar)
        })
        ocurpar = oredactor.lastElementChild
        if (!ocurpar) {
            ocurpar = await createNewParagraph()
            oredactor.appendChild(ocurpar)
        }
        placeCaretAtEnd(ocurpar);
    }

    async function createNewParagraph() {
        phrases = []
        let size = currentNote.content.length
        currentPar = {text: '', id: size}
        currentNote.content.push(currentPar)

        let otmpl = document.querySelector('#par-template');
        let onewpar = otmpl.cloneNode()
        onewpar.id = size
        onewpar.classList.remove('hidden')
        onewpar.textContent = ''
        ocurpar = onewpar
        return onewpar
    }

    function showNewParagraph(ocurpar) {
        oredactor.appendChild(ocurpar)
        placeCaretAtEnd(ocurpar);
        // log('_создан новый абзац create NewParagraph', ocurpar.id)
    }

    async function showLatex(data) {
        log('_рисуем Латех', data.command)
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
      <div id="redactor_" class="hidden flex-1 p-4_ overflow-auto border"
           oninput={handleEditorInput}
           onchange={handleEditorInput}
           >
      </div>

      <div id="par-template" class="px-4 pt-2 hidden" contenteditable="true"></div>

      // qqqq
      <div id="redactor" class="flex-1 p-4 overflow-auto border min-h-[400px]">
          {#each segments as segment (segment.id || segment.text)}
            {#if segment.type === 'latex'}
              <!-- Наш готовый компонент -->
          <div class="my-4">
              <SvgFlipper bind:data={segments[segments.indexOf(segment)]} />
          </div>
        {:else}
          <!-- Обычный текстовый блок -->
          <p
              class="px-4 pt-2 mb-2 border-b border-transparent hover:border-gray-100"
              contenteditable="true"
              oninput={(e) => segment.text = e.target.innerText}
              >
              {segment.text}
          </p>
        {/if}
      {/each}

<!-- Временный текст (всегда в конце) -->
          {#if tempText}
            <div class="px-4 py-2 text-gray-400 italic transition-all animate-pulse">
                {tempText}...
            </div>
          {/if}
</div>

      <!-- Статус ( + обработка) ???? todo ???-->
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
