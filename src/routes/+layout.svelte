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

<div class="app h-full">
        <Header />

        <main class="h-full">
                {@render children() }
        </main>

        <footer>
                <p>
                        <!-- visit ... -->
                </p>
        </footer>
</div>
