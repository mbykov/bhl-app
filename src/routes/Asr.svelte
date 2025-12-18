<!-- src/routes/Asr.svelte -->
<script>
    import { onMount, onDestroy } from 'svelte';
    import { navigateTo } from '$lib/store.js';
    import { processSegment, executeCommand } from '$lib/command-processor.js';
    import { SherpaASRClient } from '$lib/asr-client.js';

    import { MicrophoneOutline, CheckOutline } from "flowbite-svelte-icons";

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

    // Инициализация (как в старом варианте)
    onMount(async () => {
        await loadNote();

        // Создаем ASR клиент (как в старом варианте)
        // asrClient = new SherpaASRClient({
        //     onTranscript: handleTranscript,
        //     onStatusChange: handleStatusChange,
        //     onError: handleError
        // });

        asrClient = new SherpaASRClient();
        asrClient.on('transcript', handleTranscript);
        asrClient.on('status', handleStatusChange);
        asrClient.on('error', handleError);

        console.log('✅ ASR клиент инициализирован с event emitter');
    });

    // Загрузка заметки (как в старом варианте)
    async function loadNote() {
        const noteId = new URLSearchParams(window.location.search).get('id');

        if (noteId) {
            try {
                const response = await fetch(`/api/notes/${noteId}`);
                if (response.ok) {
                    currentNote = await response.json();
                    updateEditor();
                } else {
                    console.warn('Заметка не найдена, создаем новую');
                    currentNote = { id: null, content: '' };
                }
            } catch (err) {
                console.error('Ошибка загрузки заметки:', err);
                currentNote = { id: null, content: '' };
            }
        } else {
            currentNote = { id: null, content: '' };
        }
    }

    // Обработчик транскриптов (старый вариант + новая обработка команд)
    function handleTranscript(data) {
        // console.log('🎯 Обработчик transcript :', data);
        // Новая логика обработки сегментов
        if (data.segment !== lastProcessedSegment) {
            // Обрабатываем предыдущий сегмент (если он был)
            if (lastProcessedSegment >= 0 && temporaryText.trim()) {
                handleCompletedSegment(temporaryText);
            }

            // Начинаем новый сегмент
            lastProcessedSegment = data.segment;
            temporaryText = data.text;

            // Обновляем интерфейс с временным текстом
            updateEditorWithTemporaryText();
        } else {
            // Продолжение текущего сегмента
            temporaryText = data.text;
            updateEditorWithTemporaryText();
        }
    }

    /**
     * Обрабатывает завершенный сегмент (новая логика)
     */
    async function handleCompletedSegment(segmentText) {
        if (isProcessing) return;

        isProcessing = true;

        try {
            const result = processSegment(segmentText);
            console.log('🔧 Результат обработки сегмента:', result);

            if (result.hasCommand) {
                const { newContent, action } = executeCommand(
                    result.command,
                    result.text,
                    currentNote?.content || ''
                );

                if (currentNote) {
                    currentNote.content = newContent;
                } else {
                    currentNote = { id: null, content: newContent };
                }

                await handleCommandAction(action);
            } else if (result.text.trim()) {
                const newText = result.text;
                if (currentNote) {
                    currentNote.content = addTextWithSpace(currentNote.content, newText);
                } else {
                    currentNote = { id: null, content: newText };
                }
            }

            updateEditor();
        } catch (err) {
            console.error('Ошибка обработки сегмента:', err);
            updateEditor();
        } finally {
            isProcessing = false;
        }
    }

    /**
     * Обрабатывает дополнительные действия команд
     */
    async function handleCommandAction(action) {
        switch (action.type) {
            case 'save':
                await saveNote();
                break;
            case 'startRecording':
                if (!isRecording) {
                    await startRecording();
                }
                break;
            case 'stopRecording':
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

    // Обработчики статуса и ошибок (как в старом варианте)
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


    // Начало записи (точно как в старом варианте)
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

    // Остановка записи (точно как в старом варианте)
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

    // Сохранение заметки (как в старом варианте с небольшими изменениями)
    async function saveNote() {
        if (!currentNote?.content?.trim()) {
            console.warn('Пустая заметка, не сохраняем');
            error = 'Заметка пуста';
            return;
        }

        // Сбрасываем состояния сегментов перед сохранением
        temporaryText = '';
        lastProcessedSegment = -1;
        updateEditor();

        const method = currentNote.id ? 'PUT' : 'POST';
        const url = currentNote.id ? `/api/notes/${currentNote.id}` : '/api/notes';

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: currentNote.content,
                    title: generateTitle(currentNote.content)
                })
            });

            if (response.ok) {
                const savedNote = await response.json();
                currentNote.id = savedNote.id;

                console.log('💾 Заметка сохранена:', savedNote.id);
                error = null;

                // Переходим к списку заметок
                navigateTo.list();
            } else {
                throw new Error('Ошибка сохранения');
            }
        } catch (err) {
            console.error('❌ Ошибка сохранения:', err);
            error = 'Не удалось сохранить заметку';
        }
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

    // Очистка (как в старом варианте)
    onDestroy(() => {
        if (asrClient) {
            if (isRecording) {
                asrClient.stop().catch(console.error);
            }
            asrClient.stop();
        }
    });
</script>

<div class="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">

    <!-- Заголовок (HTML точно как в старом варианте) -->
    <!-- <div class="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50"> -->
    <!--     <div class="flex items-center space-x-3"> -->
    <!--         <button -->
    <!--             on:click={() => navigateTo.list()} -->
    <!--             class="p-2 hover:bg-gray-100 rounded-lg transition-colors" -->
    <!--             title="Назад к списку" -->
    <!--         > -->
    <!--             <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"> -->
    <!--                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /> -->
    <!--             </svg> -->
    <!--         </button> -->

    <!--         <div> -->
    <!--             <h1 class="text-lg font-semibold text-gray-800"> -->
    <!--               {currentNote?.id ? 'Редактирование заметки' : 'Новая заметка'} {currentNote?.id} </h1> -->
    <!--             <div class="flex items-center space-x-2 mt-1"> -->
    <!--                 <div class="flex items-center space-x-1"> -->
    <!--                     <div class={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}`}></div> -->
    <!--                     <span class="text-xs text-gray-600"> -->
    <!--                         {connectionStatus === 'connected' ? 'Подключено' : -->
    <!--                          connectionStatus === 'connecting' ? 'Подключение...' : -->
    <!--                          'Не подключено'} {connectionStatus} -->
    <!--                     </span> -->
    <!--                 </div> -->

    <!--                 {#if isRecording} -->
    <!--                     <div class="flex items-center space-x-1"> -->
    <!--                         <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div> -->
    <!--                         <span class="text-xs text-red-600 font-medium">Идет запись</span> -->
    <!--                     </div> -->
    <!--                 {/if} -->
    <!--             </div> -->
    <!--         </div> -->
    <!--     </div> -->

    <!--     <\!-- disabled={!asrClient || connectionStatus !== 'connected' || isRecording || isConnecting} -\-> -->
    <!--     <div class="flex items-center space-x-2"> -->
    <!--         <button -->
    <!--             on:click={startRecording} -->
    <!--             class="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" -->
    <!--         > -->
    <!--             {#if isConnecting} -->
    <!--                 <span class="flex items-center"> -->
    <!--                     <svg class="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24"> -->
    <!--                         <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" /> -->
    <!--                         <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /> -->
    <!--                     </svg> -->
    <!--                     Подключение... -->
    <!--                 </span> -->
    <!--             {:else} -->
    <!--               🎤 Начать запись -->
    <!--             {/if} -->
    <!--         </button> -->

    <!--         <button -->
    <!--             on:click={stopRecording} -->
    <!--             class="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" -->
    <!--             disabled={!isRecording} -->
    <!--         > -->
    <!--             ⏹️ Стоп запись -->
    <!--         </button> -->

    <!--         <button -->
    <!--             on:click={saveNote} -->
    <!--             class="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" -->
    <!--             disabled={!currentNote?.content?.trim()} -->
    <!--         > -->
    <!--             💾 Сохранить -->
    <!--         </button> -->
    <!--     </div> -->
    <!-- </div> -->

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
    <!-- ddd -->

    <!-- Сообщения об ошибках (как в старом варианте) -->
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

    <!-- Редактор (как в старом варианте) -->
    <div class="flex-1 p-4 overflow-auto">
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

    <!-- Статус (как в старом варианте + обработка) -->
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
