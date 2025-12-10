<!-- ASRWorklet.svelte -->
<script>
    import { onMount, onDestroy } from 'svelte';
    import { SherpaASRClient } from '$lib/asr-client.js';

    let asr = null;
    let transcript = '';
    let isRecording = false;
    let isConnected = false;
    let isSupported = true;
    let errorMessage = '';
    let transcriptHistory = [];

    onMount(() => {
        // Initialize ASR client
        asr = new SherpaASRClient();

        // Check if AudioWorklet is supported
        isSupported = asr.isSupported();

        if (!isSupported) {
            errorMessage = 'AudioWorklet is not supported in this browser. Please use Chrome, Edge, or Firefox.';
            return;
        }

        // Setup event listeners
        asr.on('transcript', (data) => {
            transcript = data.text;

            if (data.isFinal) {
                transcriptHistory.push({
                    text: data.text,
                    timestamp: data.timestamp,
                    isFinal: true
                });

                // Keep only last 20 transcripts
                if (transcriptHistory.length > 20) {
                    transcriptHistory.shift();
                }

                transcriptHistory = transcriptHistory; // Trigger reactivity
            }
        });

        asr.on('status', (status) => {
            isRecording = status.recording;
            isConnected = status.connected;
        });

        asr.on('error', (error) => {
            errorMessage = error.message;
            console.error('ASR error:', error);
        });
    });

    onDestroy(() => {
        if (asr) {
            asr.stop();
        }
    });

    async function startRecording() {
        errorMessage = '';
        try {
            await asr.start();
        } catch (error) {
            errorMessage = `Failed to start: ${error.message}`;
        }
    }

    function stopRecording() {
        if (asr) {
            asr.stop();
        }
    }

    function clearTranscript() {
        transcript = '';
        transcriptHistory = [];
    }
</script>

<div class="asr-container">
    <h2>🎤 Speech Recognition (AudioWorklet)</h2>

    {#if !isSupported}
        <div class="error">
            ⚠️ {errorMessage || 'AudioWorklet not supported'}
        </div>
    {:else}
        <!-- Status display -->
        <div class="status">
            <div class="status-item">
                <span class="label">Connection:</span>
                <span class="value {isConnected ? 'connected' : 'disconnected'}">
                    {isConnected ? '✅ Connected' : '❌ Disconnected'}
                </span>
            </div>
            <div class="status-item">
                <span class="label">Recording:</span>
                <span class="value {isRecording ? 'recording' : 'stopped'}">
                    {isRecording ? '🔴 Recording' : '⏸️ Stopped'}
                </span>
            </div>
        </div>

        <!-- Controls -->
        <div class="controls">
            <button
                on:click={startRecording}
                disabled={isRecording}
                class="start-btn"
            >
                Start Recording
            </button>
            <button
                on:click={stopRecording}
                disabled={!isRecording}
                class="stop-btn"
            >
                Stop Recording
            </button>
            <button
                on:click={clearTranscript}
                class="clear-btn"
            >
                Clear
            </button>
        </div>

        <!-- Error display -->
        {#if errorMessage}
            <div class="error">
                ⚠️ {errorMessage}
            </div>
        {/if}

        <!-- Live transcript -->
        <div class="transcript-container">
            <h3>Live Transcript:</h3>
            <div class="live-transcript">
                {transcript || 'Speak to see transcript here...'}
            </div>
        </div>

        <!-- Transcript history -->
        {#if transcriptHistory.length > 0}
            <div class="history-container">
                <h3>History:</h3>
                <div class="history-list">
                    {#each transcriptHistory as item (item.timestamp)}
                        <div class="history-item">
                            <span class="timestamp">
                                {new Date(item.timestamp).toLocaleTimeString()}
                            </span>
                            <span class="text">{item.text}</span>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    {/if}
</div>

<style>
    .asr-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 24px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    }

    h2 {
        color: #333;
        margin-bottom: 24px;
        border-bottom: 2px solid #e0e0e0;
        padding-bottom: 12px;
    }

    .status {
        display: flex;
        gap: 32px;
        margin-bottom: 24px;
        padding: 16px;
        background: #f8f9fa;
        border-radius: 8px;
    }

    .status-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .label {
        font-size: 14px;
        color: #666;
    }

    .value {
        font-size: 16px;
        font-weight: 600;
    }

    .value.connected {
        color: #28a745;
    }

    .value.disconnected {
        color: #dc3545;
    }

    .value.recording {
        color: #dc3545;
    }

    .value.stopped {
        color: #6c757d;
    }

    .controls {
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
    }

    button {
        padding: 12px 24px;
        border: none;
        border-radius: 6px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .start-btn {
        background: #28a745;
        color: white;
    }

    .start-btn:hover:not(:disabled) {
        background: #218838;
    }

    .stop-btn {
        background: #dc3545;
        color: white;
    }

    .stop-btn:hover:not(:disabled) {
        background: #c82333;
    }

    .clear-btn {
        background: #6c757d;
        color: white;
    }

    .clear-btn:hover {
        background: #5a6268;
    }

    .error {
        padding: 12px;
        background: #f8d7da;
        color: #721c24;
        border-radius: 6px;
        margin-bottom: 24px;
        border: 1px solid #f5c6cb;
    }

    .transcript-container, .history-container {
        margin-bottom: 24px;
    }

    h3 {
        color: #495057;
        margin-bottom: 12px;
        font-size: 18px;
    }

    .live-transcript {
        min-height: 80px;
        padding: 16px;
        background: white;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        font-size: 18px;
        line-height: 1.5;
        color: #333;
    }

    .history-list {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 0;
    }

    .history-item {
        padding: 12px 16px;
        border-bottom: 1px solid #f0f0f0;
        display: flex;
        align-items: flex-start;
        gap: 12px;
    }

    .history-item:last-child {
        border-bottom: none;
    }

    .timestamp {
        font-size: 12px;
        color: #6c757d;
        min-width: 60px;
        padding-top: 2px;
    }

    .text {
        flex: 1;
        font-size: 16px;
        line-height: 1.4;
    }
</style>
