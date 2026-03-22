<!-- src/routes/Asr.svelte -->
<script>
    import { onMount, onDestroy } from 'svelte';
    import { navigateTo, currentNoteId } from '$lib/store.js';
    import { SherpaASRClient } from '$lib/asr-client.js';
    import { icons } from '$lib/images/icons.js';
    import { MicrophoneOutline, CheckOutline } from "flowbite-svelte-icons";
    import { createPersistedArray } from '$lib/stores/persisted-store.svelte.js';
    import SvgFlipper from './SvgFlipper.svelte';
    import Meter from './Meter.svelte';
    import { NoteManager } from '$lib/note-manager.svelte.js';

    const log = console.log;

    // Текущая заметка
    let currentNote = $state(null);

    let isRecording = $state(false);
    let isConnecting = $state(false);
    let error = $state(null);
    let connectionStatus = $state('disconnected');

    // DOM элементы
    let commandDiv;
    let oredactor;
    let commandName;
    let meterComponent;

    // ASR клиент
    let asrClient = $state(null);

    // Менеджер заметок
    let noteManager = $state(null);

    // Хранилище заметок
    let records = createPersistedArray('voice-notes', []);

    let noteId = $state(null);
    const unsubscribeNoteId = currentNoteId.subscribe(value => {
        noteId = value;
    });

    onMount(async () => {
        await loadNote();

        // Инициализируем менеджер заметок
        noteManager = new NoteManager(records, currentNote);

        // Устанавливаем DOM элементы
        noteManager.setDomElements(oredactor, commandDiv, commandName);

        // Устанавливаем колбэки
        noteManager.onStopRecording = async () => {
            if (isRecording) {
                await stopRecording();
            }
        };
        noteManager.onNavigateToList = () => {
            navigateTo.list();
        };

        noteManager.onDeleteNote = (noteId) => {
            const index = records.findIndex(n => n.id === noteId);
            if (index > -1) {
                records.splice(index, 1);
            }
            navigateTo.list();
        }

        // Инициализируем ASR
        asrClient = new SherpaASRClient();
        asrClient.on('transcript', (data) => noteManager.handleTranscript(data));
        asrClient.on('status', handleStatusChange);
        asrClient.on('error', handleError);
        asrClient.on('vumeter', handleVuMeter);

        await startRecording();
    });

    async function loadNote() {
        if (noteId) {
            const found = records.find(n => n.id === noteId);
            if (found) {
                currentNote = found;
                console.log('📝 Загружена заметка:', found.title, found.id);
            }
        } else {
            await createOrLoadDraft();
        }
    }

    async function createOrLoadDraft() {
        const draft = records.find(n => n.id === 'draft_current');
        if (draft) {
            currentNote = draft;
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
        if (meterComponent) meterComponent.showLeds(vudata);
    }

    function handleStatusChange(status) {
        connectionStatus = status;
    }

    function handleError(err) {
        console.error('❌ Ошибка ASR:', err);
        error = err.message || 'Ошибка подключения к серверу распознавания';
    }

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
        } catch (err) {
            console.error('Ошибка запуска записи:', err);
            error = err.message || 'Не удалось начать запись';
            isConnecting = false;
            isRecording = false;
        }
    }

    async function stopRecording() {
        log('________________stop rec');
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

    async function toggleWriting() {
        if (noteManager) {
            noteManager.isWriting = !noteManager.isWriting;
        }
    }

    async function saveNote() {
        if (noteManager) {
            await noteManager.saveNote();
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
</script>

<div id="commandDiv" bind:this={commandDiv} class="hidden absolute top-5 right-0 h-8 w-64 bg-green-100 z-100 p-1 px-4 mx-4 border shadow-md rounded-md">
    команда: <span id="commandName" bind:this={commandName}></span>
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

            <button
                onclick={toggleWriting}
                class={`p-2 rounded-full ${noteManager?.isWriting ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                title={isRecording ? 'Остановить запись' : 'Начать запись'}
                disabled={isConnecting}
            >
                {#if isConnecting}
                    <div class="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                {:else if noteManager?.isWriting}
                    <div class="h-6 w-6 flex items-center justify-center">
                        <div class="h-3 w-3 bg-red-600 rounded-sm"></div>
                    </div>
                {:else}
                    <MicrophoneOutline class="h-6 w-6" />
                {/if}
            </button>
        </div>
    </div>

    <!-- Редактор -->
    <div
        id="redactor"
        bind:this={oredactor}
        class="flex-1 p-4 overflow-auto border min-h-[500px] bg-white shadow-inner"
    >
        {#if noteManager}
            {#each noteManager.paragraphs as par, index (par.id)}
                <div
                    data-paragraph-index={index}
                    class="relative mb-2 transition-colors duration-200 rounded-lg group"
                    class:bg-blue-50={noteManager.selectedIndex === index}
                    onclick={() => noteManager.selectParagraph(index)}
                    role="button"
                    tabindex="0"
                >
                    {#if par.type === 'latex'}
                        <div class="py-2 px-4">
                            <SvgFlipper bind:data={noteManager.paragraphs[index]} />
                        </div>
                    {:else}
                        <div
                            class="px-4 py-3 min-h-[1.5em] outline-none text-lg leading-relaxed"
                            contenteditable="true"
                            onblur={(ev) => noteManager.handleEditorChange(ev)}
                            oninput={() => noteManager.markChanged()}
                        >
                            {par.phrases.join(' ')}

                            {#if noteManager.selectedIndex === index && noteManager.tempText}
                                <span class="text-blue-400 opacity-70 italic">
                                    {par.phrases.length > 0 ? ' ' : ''}{noteManager.tempText}
                                </span>
                            {/if}
                        </div>
                    {/if}

                    {#if noteManager.selectedIndex === index}
                        <div class="absolute left-0 top-2 bottom-2 w-1 bg-blue-500 rounded-full"></div>
                    {/if}
                </div>
            {/each}

            {#if noteManager.paragraphs.length === 0 && !noteManager.tempText}
                <div class="flex items-center justify-center h-64 text-gray-300 border-2 border-dashed rounded-xl">
                    Начните говорить...
                </div>
            {/if}
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

    #redactor > div {
        animation: slideIn 0.2s ease-out;
    }

    @keyframes slideIn {
        from { opacity: 0; transform: translateX(-10px); }
        to { opacity: 1; transform: translateX(0); }
    }

    [contenteditable="true"]:focus {
        background: rgba(255, 255, 255, 0.8);
    }
</style>
