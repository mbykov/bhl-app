<!-- src/routes/+page.svelte -->
<script>
    import { onMount, onDestroy } from 'svelte';
    import { currentComponent } from '$lib/store.js';

    let loadedComponent = $state(null);
    let isLoading = $state(false);
    let currentComp = $state('list');

    // Подписываемся на изменения currentComponent
    onMount(() => {
        const unsubscribe = currentComponent.subscribe(value => {
            currentComp = value;
            loadComponent(value);
        });

        return () => unsubscribe();
    });

    async function loadComponent(componentName) {
        if (!componentName) return;

        isLoading = true;

        try {
            switch (componentName) {
                case 'list':
                    const { default: List } = await import('./List.svelte');
                    loadedComponent = List;
                    break;
                case 'asr':
                    const { default: Asr } = await import('./Asr.svelte');
                    loadedComponent = Asr;
                    break;
                case 'settings':
                    const { default: Settings } = await import('./Settings.svelte');
                    loadedComponent = Settings;
                    break;
                case 'about':
                    const { default: About } = await import('./About.svelte');
                    loadedComponent = About;
                    break;
                default:
                    // По умолчанию загружаем List
                    const { default: DefaultList } = await import('./List.svelte');
                    loadedComponent = DefaultList;
            }
        } catch (error) {
            console.error('Failed to load component:', error);
            // При ошибке загружаем List
            try {
                const { default: List } = await import('./List.svelte');
                loadedComponent = List;
                currentComponent.set('list');
            } catch (fallbackError) {
                console.error('Even fallback failed:', fallbackError);
                loadedComponent = null;
            }
        } finally {
            isLoading = false;
        }
    }

    // Загружаем начальный компонент
    onMount(async () => {
        // Даем время на подписку и затем загружаем
        setTimeout(() => {
            if (!loadedComponent && currentComp) {
                loadComponent(currentComp);
            }
        }, 10);
    });
</script>

{#if isLoading}
    <div class="flex items-center justify-center min-h-screen bg-gray-50">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
{:else if loadedComponent}
    <div class="h-full">
        <svelte:component this={loadedComponent} />
    </div>
{:else}
    <div class="flex items-center justify-center min-h-screen bg-gray-50">
        <button
            on:click={() => currentComponent.set('list')}
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
            Загрузить список заметок
        </button>
    </div>
{/if}
