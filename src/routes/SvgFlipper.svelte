<script>
    import { onMount, tick } from 'svelte';

    // 1. Use $bindable to allow mutation of the 'data' prop
    let { data = $bindable() } = $props();

    let container = $state();
    let scriptLoaded = $state(false);

    // We add a specific state for the 3 steps: 0 (SVG), 1 (Text), 2 (LaTeX)
    let viewState = $state(0);

    onMount(() => {
        if (!window.MathJax) {
            window.MathJax = {
                tex: { inlineMath: [['$', '$']] },
                svg: { fontCache: 'global' },
                startup: {
                    ready: () => {
                        window.MathJax.startup.defaultReady();
                        scriptLoaded = true;
                    }
                }
            };
            const script = document.createElement('script');
            script.src = '/js/mathjax/tex-svg.js';
            script.async = true;
            document.head.appendChild(script);
        } else {
            scriptLoaded = true;
        }
    });

    $effect(() => {
        if (scriptLoaded && container && data.latex) {
            tick().then(() => {
                window.MathJax.typesetPromise([container]);
            });
        }
    });

    function cycleView() {
        viewState = (viewState + 1) % 3;
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="flipper-container"
    onclick={cycleView}
    role="button"
    tabindex="0"
>
    <div class="flipper-inner state-{viewState}">
        <!-- Side 0: SVG Render -->
        <div class="side front" bind:this={container}>
            ${data.latex}$
        </div>

        <!-- Side 1: Text Description -->
        <div class="side back">
            <p class="label">Описание:</p>
            {data.text}
        </div>

        <!-- Side 2: Raw LaTeX Code -->
        <div class="side raw">
            <p class="label">LaTeX Source:</p>
            <code>{data.latex}</code>
        </div>
    </div>
</div>

<style>
    .flipper-container {
        perspective: 1000px;
        width: 100%;
        height: 200px;
        cursor: pointer;
    }

    .flipper-inner {
        position: relative;
        width: 100%;
        height: 100%;
        transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        transform-style: preserve-3d;
    }

    /* Rotation Logic for 3 sides */
    .state-0 { transform: rotateY(0deg); }
    .state-1 { transform: rotateY(-120deg); }
    .state-2 { transform: rotateY(-240deg); }

    .side {
        position: absolute;
        width: 100%;
        height: 100%;
        backface-visibility: hidden;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        border: 1px solid #e5e7eb;
        background: white;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        padding: 20px;
    }

    .front { transform: rotateY(0deg) translateZ(100px); }
    .back  { transform: rotateY(120deg) translateZ(100px); }
    .raw   { transform: rotateY(240deg) translateZ(100px); }

    .label { font-size: 0.75rem; color: #9ca3af; margin-bottom: 8px; text-transform: uppercase; }
    code { background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace; }
</style>
