<!-- src/routes/List.svelte -->
<script>
    import { navigateTo } from '$lib/store.js';
    import { createPersistedArray } from '$lib/stores/persisted-store.svelte.js';
    import { icons } from '$lib/images/icons.js';
    import { MicrophoneOutline } from "flowbite-svelte-icons";

    // Используем persisted array для заметок
    let records = createPersistedArray('voice-notes', []);

    // Фильтруем черновики для отображения
    let notes = $derived(
      records
        .filter(note => !note.draft)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    );

    function deleteNote(note, event) {
        event.stopPropagation();
        // if (confirm(`Удалить заметку "${note.title}"?`)) {
            const index = records.indexOf(note);
            if (index > -1) {
                records.splice(index, 1);
            }
        // }
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
</script>

<div class="h-full overflow-hidden min-h-screen_ bg-gray-50">
    <div class="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-4">
        <div class="max-w-4xl mx-auto flex justify-between items-center">
            <h1 class="text-xl font-semibold text-gray-900">by human lang notes ({notes.length})</h1>
            <div class="flex items-center gap-3">
                <MicrophoneOutline class="shrink-0 h-8 w-8 m-2 text-gray-400 " onclick={() => navigateTo.asr()}/>
            </div>
        </div>
    </div>

    <!-- Основной контент -->
    <div class="h-full overflow-y-auto max-w-4xl mx-auto px-4 py-2 pt-20_"> <!-- pt-20 для отступа под фиксированным заголовком -->
        {#if notes.length === 0}
            <div class="text-center py-16">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                    {@html icons.info}
                </div>
                <h3 class="text-lg font-medium text-gray-900 mb-2">Заметок пока нет</h3>
                <p class="text-gray-600 mb-6">Создайте первую голосовую заметку</p>
                <button
                    on:click={() => navigateTo.asr()}
                    class="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                    Начать запись
                </button>
            </div>

        {:else}
            <div class="space-y-3">
                {#each notes as note (note.id)}
                    <div
                        on:click={() => navigateTo.asr(note.id)}
                        class="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow cursor-pointer group"
                    >
                        <div class="flex justify-between items-start">
                            <div class="flex-1 min-w-0">
                                <h3 class="text-base font-medium text-gray-900 truncate mb-1"> {note.title} </h3>
                                <p class="text-sm text-gray-500 mb-2">
                                    {formatDate(note.createdAt)} • {note.wordCount} слов
                                </p>
                                <!-- </p> -->
                            </div>
                            <button
                                on:click={(e) => deleteNote(note, e)}
                                class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-all ml-2 flex-shrink-0"
                                title="Удалить"
                            >
                                {@html icons.delete}
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

</div>

<style>
    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
