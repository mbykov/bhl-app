<!-- src/routes/+page.svelte -->
<script>
    import { onMount } from 'svelte';
    import { currentComponent } from '$lib/store.js';

    let loadedComponent = $state(null);
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
                    const { default: DefaultList } = await import('./List.svelte');
              loadedComponent = DefaultList;
            }
        } catch (error) {
            console.error('Failed to load component:', error);
            const { default: List } = await import('./List.svelte');
            loadedComponent = List;
        }
    }

    // Загружаем начальный компонент
    onMount(() => {
        if (!loadedComponent) {
            loadComponent(currentComp);
        }
    });
</script>

{#if loadedComponent}
    <div class="h-full ">
        <svelte:component this={loadedComponent} />
    </div>
{:else}
    <div class="flex items-center justify-center min-h-screen bg-gray-50">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
{/if}
