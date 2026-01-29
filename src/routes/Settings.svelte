<!-- src/routes/Settings.svelte -->
<script>
    import { navigateTo } from '$lib/store.js';
    // import { backIcon } from '$lib/images/icons.js';
</script>

<div class="min-h-screen bg-gray-50">
    <!-- Верхняя панель -->
    <div class="bg-white border-b border-gray-200 px-4 py-3">
        <div class="max-w-4xl mx-auto flex items-center">
            <button
                on:click={navigateTo.list}
                class="p-2 text-gray-600 hover:text-gray-900 mr-3"
                title="Назад"
              >
              backIcon
                <!-- {@html backIcon} -->
            </button>
            <h1 class="text-xl font-semibold text-gray-900">Настройки</h1>
        </div>
    </div>

    <!-- Контент -->
    <div class="max-w-4xl mx-auto px-4 py-6">
        <div class="bg-white rounded-lg border border-gray-200 p-6">
            <p class="text-gray-600 text-center py-8">
                Настройки будут добавлены в следующей версии
            </p>
        </div>
    </div>
</div>
