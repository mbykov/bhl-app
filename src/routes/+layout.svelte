<script>
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';

  import Header from './Header.svelte';
  let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- {@render children()} -->

<div class="app h-full overflow-hidden">
        <div class="flex items-center justify-center">
            <Header />
        </div>

        <main class="h-full overflow-hidden">
                {@render children() }
        </main>

</div>
