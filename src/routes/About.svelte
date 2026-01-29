<!-- src/routes/About.svelte -->
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
            <h1 class="text-xl font-semibold text-gray-900">О приложении</h1>
        </div>
    </div>

    <!-- Контент -->
    <div class="max-w-4xl mx-auto px-4 py-6">
        <div class="bg-white rounded-lg border border-gray-200 p-6">
            <div class="text-center py-8">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                    <svg class="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd" />
                    </svg>
                </div>
                <h2 class="text-2xl font-bold text-gray-900 mb-2">Голосовой дневник</h2>
                <p class="text-gray-600 mb-4">Версия 1.0.0</p>
                <p class="text-gray-700 mb-6">
                    Приложение для создания заметок с помощью голоса.
                    Используйте голосовые команды для управления записью.
                </p>
                <div class="text-sm text-gray-500">
                    <p>Команды: "абзац", "стоп запись", "сохранить"</p>
                </div>
            </div>
        </div>
    </div>
</div>
