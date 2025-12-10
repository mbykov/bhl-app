<script>
  const log = console.log

  //
  let eIndex = 0
  let { data } = $props();
  let exstring = data.records
  let records = JSON.parse(exstring)
  let current = records[eIndex]
  log('___CURRENT', current)

  import List from './List.svelte';
  import { onMount, onDestroy } from 'svelte';


  let loadedComponent = $state(null);
  let isLoading = $state(false);


  onMount(async () => {
      const { default: List } = await import('./List.svelte');
      loadedComponent = List;

    });

  import { componentName } from '$lib/store.js';

  $effect(() => {
      loadComponent($componentName)
  });

  async function loadComponent(componentName) {
    isLoading = true;
    try {
      switch (componentName) {
        case 'list':
          const { default: List } = await import('./List.svelte');
          loadedComponent = List;
          break;
        case 'edit':
          const { default: Asr } = await import('./Asr.svelte');
          loadedComponent = Asr;
          break;
        default:
          loadedComponent = null
          // loadedComponent = List;
      }
    } catch (error) {
      console.error('Failed to load component:', error);
      loadedComponent = null;
    } finally {
      isLoading = false;
    }
  }


</script>

{#if isLoading}
  <p>Loading...</p>
{:else if loadedComponent}
  <div class="border_ h-full">
  <svelte:component this={loadedComponent} {records} />
  <!-- <loadedComponent /> -->
  </div>
{:else}
  <p>No component loaded</p>
{/if}
