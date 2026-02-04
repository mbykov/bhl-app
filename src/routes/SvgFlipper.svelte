<script>
    import { onMount, tick } from 'svelte';

    let { data = $bindable() } = $props();

    let container = $state();
    let scriptLoaded = $state(false);

    // Вместо viewState используем накопительный угол
    let currentRotation = $state(0);

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
        // Каждый клик добавляет 120 градусов по оси X
        // Используем отрицательное значение (-120), чтобы крутилось "от себя"
        currentRotation -= 120;
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="flipper-container"
    onclick={cycleView}
    role="button"
    tabindex="0"
>
    <!-- Применяем вращение по оси X к внутреннему контейнеру -->
    <div class="flipper-inner" style="transform: rotateX({currentRotation}deg);">
        <!-- Сторона 0: SVG (Лицо) -->
        <div class="side side-0" bind:this={container}>
            ${data.latex}$
        </div>

        <!-- Сторона 1: Текст (Низ/Зад) -->
        <div class="side side-1">
            <p class="label">Описание:</p>
            <div class="content">{data.text}</div>
        </div>

        <!-- Сторона 2: LaTeX (Верх/Зад) -->
        <div class="side side-2">
            <p class="label">LaTeX Source:</p>
            <code>{data.latex}</code>
        </div>
    </div>
</div>

<style>
    .flipper-container {
        perspective: 1000px;
        width: 100%;
        height: 180px; /* Увеличьте, если формулы крупные */
        cursor: pointer;
        margin: 10px 0;
    }

    .flipper-inner {
        position: relative;
        width: 100%;
        height: 100%;
        transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
        transform-style: preserve-3d;
    }

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
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
        padding: 15px;
    }

    /* Располагаем стороны в виде треугольной призмы вдоль оси X */
    /* translateZ определяет "радиус" вращения. 52px подобрано для высоты 180px */
    .side-0 { transform: rotateX(0deg) translateZ(52px); }
    .side-1 { transform: rotateX(120deg) translateZ(52px); }
    .side-2 { transform: rotateX(240deg) translateZ(52px); }

    .label {
        font-size: 0.7rem;
        color: #9ca3af;
        margin-bottom: 5px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .content {
        text-align: center;
        color: #374151;
        font-size: 1.1rem;
    }

    code {
        background: #f3f4f6;
        padding: 6px 10px;
        border-radius: 6px;
        font-family: 'Fira Code', monospace;
        font-size: 0.9rem;
        color: #ef4444;
    }

    /* Исправление для MathJax внутри 3D */
    :global(.side svg) {
        max-width: 100%;
        height: auto !important;
    }
</style>
