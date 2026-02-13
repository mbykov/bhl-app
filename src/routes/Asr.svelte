<script>
    // import _ from "lodash"
    import { onMount, onDestroy } from 'svelte';
    import { navigateTo, currentNoteId } from '$lib/store.js';
    import { processSegment } from '$lib/command-processor.js';
    import { SherpaASRClient } from '$lib/asr-client.js';

    import { icons } from '$lib/images/icons.js';
    import { MicrophoneOutline, CheckOutline } from "flowbite-svelte-icons";
    import { createPersistedArray } from '$lib/stores/persisted-store.svelte.js';
    import { tick } from 'svelte'

    import { svgtest } from '$lib/svg-text.js'
    import SvgFlipper from './SvgFlipper.svelte';

    import Debug from 'debug';
    // const dc = Debug('command');
    // const dapp = Debug('app');
    // const dtr = Debug('transcript');

    import Meter from './Meter.svelte'
    let meterComponent;

    const log = console.log

    // Текущая заметка
    let currentNote = $state(null);

    let isRecording = $state(false);
    let isWriting = $state(true);
    let isConnecting = $state(false);
    let isChanged = false
    let error = $state(null);
    let connectionStatus = $state('disconnected');

    // Состояния для обработки сегментов
    // let isProcessing = $state(false);

    // Основное состояние редактора
    let paragraphs = $state([]);
    // Состояние для промежуточного текста (то, что произносится прямо сейчас)
    let tempText = $state('');
    let selectedIndex = $state(-1);

    let commandDiv
    let oredactor

    // ASR клиент
    let asrClient = $state(null);

    let records = createPersistedArray('voice-notes', []);

    let noteId = $state(null);
    const unsubscribeNoteId = currentNoteId.subscribe(value => {
      noteId = value;
    });

    onMount(async () => {
        oredactor = document.querySelector('#redactor');

        await loadNote()
        asrClient = new SherpaASRClient();
        asrClient.on('transcript', handleTranscript);
        asrClient.on('status', handleStatusChange);
        asrClient.on('error', handleError);
        asrClient.on('vumeter', handleVuMeter);
        commandDiv = document.getElementById('commandDiv');
        await startRecording();
    });

    async function loadNote() {
        log('______loadNote START noteId', noteId)
        // $inspect(records)
        if (noteId) {
            const found = records.find(n => n.id === noteId);
            if (found) {
                currentNote = found;
                // log('_:::loadNote:::', $state.snapshot(currentNote.paragraphs));
                console.log('📝 Загружена заметка:', found.title, found.id);
            }
        } else {
            await createOrLoadDraft();
        }
        paragraphs = currentNote.paragraphs
        selectedIndex = paragraphs.length - 1;
    }

    async function createOrLoadDraft() {
        const draft = records.find(n => n.id === 'draft_current');
        if (draft) {
            currentNote = draft;
            log('_найден драфт', currentNote)
        } else {
            currentNote = {
                id: 'draft_current',
                title: 'Черновик',
                paragraphs: [{ id: crypto.randomUUID(), type: 'text', phrases: [] }],
                createdAt: new Date(),
                updatedAt: new Date(),
                wordCount: 0,
                draft: true
            };
            records.push(currentNote);
            console.log('📝 Создан новый черновик');
        }
    }

    async function handleVuMeter(vudata) {
        if (meterComponent) meterComponent.showLeds(vudata)
    }

    function handleSelectParagraph(index) {
        selectedIndex = index;
    }

    async function handleTranscript(data) {
        const now = new Date()
        let localTime = now.toLocaleString('ru-RU')
        // console.log('⏭️ START data command_______________________:', localTime, data );

        if (data.text == 'recordStart') isWriting = true
        if (!isWriting) return;

        if (data.type == 'command') {
            tempText = '';
            handleCommand(data)
        } else if (data.type == 'final') {
            tempText = '';
            // 1. Находим параграф, который БЫЛ активен в момент диктовки
            // Если параграфов нет, создаем
            if (selectedIndex === -1) {
                createNewParagraph();
            }

            let target = paragraphs[selectedIndex];

            // 2. Если вдруг выбран блок LaTeX, создаем под ним новый текстовый параграф
            if (target && target.type !== 'text') {
                createNewParagraph();
                target = paragraphs[selectedIndex];
            }

            // 3. Добавляем текст в массив phrases именно этого параграфа
            if (target && target.type === 'text') {
                target.phrases.push(data.text.trim());

                // Важно: Svelte 5 иногда нужно "подтолкнуть", если мы мутируем глубокое свойство массива
                // Хотя в Svelte 5 прокси обычно справляются, для надежности:
                paragraphs[selectedIndex] = target;
            }

            // 4. Прокрутка и фокус
            await tick();
            focusCurrentParagraph();

        } else if (data.type == 'intermediate') {
            tempText = data.text;
        }
        oredactor.scrollTo({ top: oredactor.scrollHeight, behavior: 'smooth' });
    }

    async function handleCommand(data) {
        switch (data.text) {
        case 'saveNote':
            await saveNote();
            break;
        case 'getTime':
            // log('_getTime', data)
            data = {
                text: 'икс равняется синус пи пополам',
                latex: 'x = \\sin \\left( \\frac{\\pi}{2} \\right)',
                flipped: false
            };

            const newLatex = {
                id: crypto.randomUUID(),
                type: 'latex',
                text: data.text,
                latex: data.latex,
                flipped: false
            };

            const insertAt = selectedIndex === -1 ? paragraphs.length : selectedIndex + 1;
            paragraphs.splice(insertAt, 0, newLatex);
            selectedIndex = insertAt; // Фокус остается на вставленной карточке

            oredactor.scrollTo({ top: oredactor.scrollHeight, behavior: 'smooth' });
            break;
        case 'clearText': // удали текст
            await clearCurrentNote()
            break;
        case 'addParagraph': // новый абзац, новая строка
            await createNewParagraph()
            break;
        case 'undoPhrase':
            undoPhrase()
            break;
        case 'killParagraph':
            killParagraph()
        case 'recordStart': // начать запись
            log('___recordStart')
            isWriting = true
            break;
        case 'recordStop': // стоп запись
            isWriting = false
            break;
        case 'recordNew': // стоп запись + goto List + title
            if (isRecording) {
                await stopRecording();
            }
            isWriting = false
            currentNote.title = generateTitle()
            navigateTo.list()
            break;
        default:
            log('_DEFAULT', data.text)
        }

        await tick();
        focusCurrentParagraph();
        toggleCommandDiv(data.text)
    }

    let commandTimer;
    function toggleCommandDiv(command) {
        const cname = document.querySelector('#commandName');
        cname.textContent = command;
        commandDiv.classList.remove('hidden');
        if (commandTimer) clearTimeout(commandTimer);
        commandTimer = setTimeout(() => {
            commandDiv.classList.add('hidden');
        }, 3000);
    }

    function undoPhrase() {
        commitCurrentParagraph();
        let last = paragraphs[selectedIndex].phrases.pop()
    }

    function killParagraph() {
        paragraphs.pop()
        selectedIndex = paragraphs.length - 1;
    }

    // Обработчики статуса и ошибок
    function handleStatusChange(status) {
        connectionStatus = status;
    }

    function handleEditorChange(ev) {
        if (!isChanged) return
        isChanged = false
        let text = ev.target.textContent.trim()
        const matches = text.match(/[^.!?]+[.!?]?/g);
        const newphrases = matches ? matches.map(s => s.trim()) : [];
        paragraphs[selectedIndex].phrases = newphrases
    }

    async function clearCurrentNote() {
        tempText = '';

        // 2. Очищаем массив параграфов и создаем первый пустой текстовый блок
        paragraphs = [
            { id: crypto.randomUUID(), type: 'text', phrases: [] }
        ];

        // 3. Устанавливаем индекс на первый (и единственный) параграф
        selectedIndex = 0;

        // 4. Очищаем объект текущей заметки (если нужно сбросить метаданные)
        currentNote.paragraphs = [];
        currentNote.title = 'Новая заметка';

        // 5. Переводим фокус на новый пустой параграф
        await focusCurrentParagraph();

        // Опционально: показываем уведомление о выполнении команды
        toggleCommandDiv('Очищено');
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
            isWriting = true;
        } catch (err) {
            console.error('Ошибка запуска записи:', err);
            error = err.message || 'Не удалось начать запись';
            isConnecting = false;
            isRecording = false;
        }
    }

    // Остановка записи
    async function stopRecording() {
        log('________________stop rec')
        if (!asrClient || !isRecording) {
            console.log('Запись не активна');
            return;
        }
        try {
            await asrClient.stop();
            isRecording = false;
        } catch (err) {
            console.error('Ошибка остановки записи:', err);
            error = err.message || 'Не удалось остановить запись';
        }
    }

    // Сохранение заметки
    async function saveNote() {
        commitCurrentParagraph(); // фиксируем текущие изменения

        currentNote.paragraphs = paragraphs
        if (currentNote.id === 'draft_current') currentNote.id = crypto.randomUUID();
        currentNote.draft = false;
        currentNote.title = generateTitle();
        currentNote.updatedAt = new Date();

        toggleCommandDiv('saveNote');
        log('_saved note', currentNote)
        navigateTo.list();
    }

    // console.log('_:::', $state.snapshot(currentNote.paragraphs));
    function generateTitle() {
        let firstPar = paragraphs[0]
        if (!firstPar) return 'Новая заметка';
        const firstPhrase = firstPar.phrases[0]
        if (!firstPhrase) return 'Новая заметка';
        let title = firstPhrase.slice(0, 50);
        return title + '...';
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

    async function createNewParagraph() {
        const newPar = {
            id: crypto.randomUUID(),
            type: 'text',
            phrases: []
        };

        paragraphs.push(newPar);
        selectedIndex = paragraphs.length - 1;
        await focusCurrentParagraph();
    }

    /**
     * Вспомогательная функция для перевода фокуса на созданный элемент
     */
    async function focusCurrentParagraph() {
        await tick();
        const targetWrapper = document.querySelector(`[data-paragraph-index="${selectedIndex}"]`);
        if (!targetWrapper) return;
        const targetEl = targetWrapper.querySelector('[contenteditable="true"]');
        if (targetEl) placeCaretAtEnd(targetEl);
    }

    async function focusCurrentParagraph_() {
        await tick(); // Ждем, пока Svelte отрисует изменения в DOM
        // Находим все редактируемые параграфы внутри редактора
        const redactor = document.querySelector('#redactor');
        if (!redactor) return;
        // Находим элементы именно с contenteditable
        const editableElements = redactor.querySelectorAll('[contenteditable="true"]');
        const targetWrapper = redactor.children[selectedIndex];
        if (!targetWrapper) return;
        const targetEl = targetWrapper.querySelector('[contenteditable="true"]');
        if (targetEl) {
            placeCaretAtEnd(targetEl);
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


    function commitCurrentParagraph() {
        if (!isChanged) return;
        const active = document.activeElement;
        if (active && active.isContentEditable) {
            const wrapper = active.closest('[data-paragraph-index]');
            if (wrapper) {
                const index = parseInt(wrapper.dataset.paragraphIndex);
                if (!isNaN(index) && paragraphs[index] && paragraphs[index].type === 'text') {
                    const text = active.textContent.trim();
                    const newphrases = text.match(/[^.!?]+[.!?]?/g)?.map(s => s.trim()) || [];
                    paragraphs[index].phrases = newphrases;
                    isChanged = false;
                }
            }
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

      <!-- Редактор  -->
      <div id="redactor" class="flex-1 p-4 overflow-auto border min-h-[500px] bg-white shadow-inner">

          {#each paragraphs as par, index (par.id)}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
              data-paragraph-index={index}
              class="relative mb-2 transition-colors duration-200 rounded-lg group"
              class:bg-blue-50={selectedIndex === index}
              onclick={() => handleSelectParagraph(index)}
              role="button"
              tabindex="0"
              >
              {#if par.type === 'latex'}
                  <div class="py-2 px-4">
                      <SvgFlipper bind:data={paragraphs[index]} />
                  </div>
              {:else}
                  <div
                      class="px-4 py-3 min-h-[1.5em] outline-none text-lg leading-relaxed"
                      contenteditable="true"
                      onblur={(ev) => {
                        handleEditorChange(ev)
                      }}
                      oninput={(ev) => { isChanged = true }}
                      >

                      <!-- Отрисовка накопленных фраз -->
                      {par.phrases.join(' ')}

                      <!-- Отрисовка tempText внутри этого же блока -->
                      {#if selectedIndex === index && tempText}
                          <span class="text-blue-400 opacity-70 italic">
                              {par.phrases.length > 0 ? ' ' : ''}{tempText}
                          </span>
                      {/if}
                  </div>
              {/if}

              <!-- Визуальный маркер активного параграфа -->
                  {#if selectedIndex === index}
                      <div class="absolute left-0 top-2 bottom-2 w-1 bg-blue-500 rounded-full"></div>
                  {/if}
              </div>
          {/each}

          {#if paragraphs.length === 0 && !tempText}
              <div class="flex items-center justify-center h-64 text-gray-300 border-2 border-dashed rounded-xl">
                  Начните говорить...
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
    }

    /* Плавное появление новых сегментов */
    #redactor > div {
      animation: slideIn 0.2s ease-out;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(-10px); }
      to { opacity: 1; transform: translateX(0); }
    }

    /* Фокус при редактировании */
    [contenteditable="true"]:focus {
      background: rgba(255, 255, 255, 0.8);
    }
</style>
