<!-- ASR.svelte -->
<script>
    import { SherpaASRClient } from '$lib/asr-client.js';
    import { onMount, onDestroy } from 'svelte';

    let asrClient;
    let transcript = '';
    let isRecording = false;
    let isConnected = false;

    onMount(() => {
        asrClient = new SherpaASRClient();

        // Listen for transcript updates
        window.addEventListener('asr-transcript', handleTranscript);
    });

    onDestroy(() => {
        if (asrClient) {
            asrClient.stop();
        }
        window.removeEventListener('asr-transcript', handleTranscript);
    });

    function handleTranscript(event) {
        transcript = event.detail.text;
        // You can also store full history
    }

    async function startRecording() {
        try {
            await asrClient.start();
            isRecording = true;
            isConnected = true;
        } catch (error) {
            console.error('Failed to start:', error);
        }
    }

    function stopRecording() {
        asrClient.stop();
        isRecording = false;
        isConnected = false;
    }
</script>

<div class="asr-container">
    <h2>Speech Recognition</h2>

    <div class="status">
        Status: {isConnected ? 'Connected' : 'Disconnected'}
        {isRecording ? ' • Recording' : ''}
    </div>

    <div class="controls">
        <button on:click={startRecording} disabled={isRecording}>
            Start Recording
        </button>
        <button on:click={stopRecording} disabled={!isRecording}>
            Stop Recording
        </button>
    </div>

    <div class="transcript">
        <h3>Transcript:</h3>
        <p>{transcript}</p>
    </div>
</div>

<style>
    .asr-container {
        padding: 20px;
        max-width: 600px;
        margin: 0 auto;
    }

    .status {
        padding: 10px;
        background: #f0f0f0;
        border-radius: 4px;
        margin: 10px 0;
    }

    .controls button {
        padding: 10px 20px;
        margin: 5px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .controls button:first-child {
        background: #4CAF50;
        color: white;
    }

    .controls button:last-child {
        background: #f44336;
        color: white;
    }

    .transcript {
        margin-top: 20px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 4px;
        min-height: 100px;
    }
</style>
