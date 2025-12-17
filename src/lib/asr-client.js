export class SherpaASRClient {
    constructor() {
        this.ws = null;
        this.audioContext = null;
        this.workletNode = null;
        this.mediaStream = null;
        this.isRecording = false;
        this.isConnected = false;
        this.isShuttingDown = false;
        this.sampleRate = 16000;
        this.chunkSize = 3200; // 200ms at 16kHz
        this.hasSentConfig = false;

        // AudioWorklet state
        this.workletLoaded = false;
        this.audioQueue = [];

        // Event system
        this.listeners = new Map();
    }

    // Event system methods (same as before)
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} listener:`, error);
                }
            });
        }
    }

    async start() {
        if (this.isRecording) return;

        try {
            this.isShuttingDown = false;

            // 1. Get microphone access
            await this.getMicrophoneAccess();

            // 2. Initialize AudioContext and AudioWorklet
            await this.initializeAudioWorklet();

            // 3. Connect to WebSocket server
            await this.connectWebSocket();

            // 4. Start audio processing
            await this.startAudioProcessing();

            this.isRecording = true;
            this.emit('status', { recording: true, connected: true });

            console.log('✅ ASR recording started with AudioWorklet');

        } catch (error) {
            console.error('Failed to start ASR:', error);
            this.emit('error', error);
            await this.stop();
            throw error;
        }
    }

    async getMicrophoneAccess() {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: this.sampleRate,
                echoCancellation: false,
                noiseSuppression: true,
                autoGainControl: false,
                latency: 0
            }
        });
    }

    async initializeAudioWorklet() {
        // Create AudioContext
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.sampleRate,
            latencyHint: 'interactive'
        });

        // Resume if suspended
        if (this.audioContext.state !== 'running') {
            await this.audioContext.resume();
        }

        // Load AudioWorklet module
        try {
            // Path depends on your SvelteKit setup
            // Option 1: If file is in public folder
            await this.audioContext.audioWorklet.addModule('/pcm-processor.js');
            // Option 2: If using Vite, you might need to import it
            // await this.audioContext.audioWorklet.addModule(new URL('./pcm-processor.js', import.meta.url));

            this.workletLoaded = true;
            console.log('✅ AudioWorklet module loaded');
        } catch (error) {
            console.error('Failed to load AudioWorklet:', error);
            throw new Error('AudioWorklet not supported or failed to load');
        }
    }

    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            const url = 'ws://localhost:6006';
            this.ws = new WebSocket(url);
            this.ws.binaryType = 'arraybuffer';

            const timeout = setTimeout(() => {
                if (this.ws.readyState !== WebSocket.OPEN) {
                    reject(new Error('Connection timeout after 5 seconds'));
                }
            }, 5000);

            this.ws.onopen = () => {
                clearTimeout(timeout);
                this.isConnected = true;
                this.emit('status', { recording: this.isRecording, connected: true });
                console.log('✅ Connected to ASR server');
                resolve();
            };

            this.ws.onmessage = (event) => {
                this.handleServerMessage(event.data);
            };

            this.ws.onerror = (error) => {
                clearTimeout(timeout);
                this.isConnected = false;
                this.emit('status', { recording: this.isRecording, connected: false });
                console.error('WebSocket error:', error);
                reject(error);
            };

            this.ws.onclose = (event) => {
                this.isConnected = false;
                this.emit('status', { recording: this.isRecording, connected: false });

                if (event.code !== 1000 || !this.isShuttingDown) {
                    console.log(`WebSocket closed: code=${event.code}, reason=${event.reason}`);
                }
            };
        });
    }

    async startAudioProcessing() {
        if (!this.workletLoaded || !this.mediaStream || !this.audioContext) {
            throw new Error('AudioWorklet not initialized');
        }

        // Create audio source from microphone
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);

        // Create AudioWorkletNode
        this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1],
            processorOptions: {
                sampleRate: this.sampleRate,
                chunkSize: this.chunkSize
            }
        });

        // Configure the processor
        this.workletNode.port.postMessage({
            command: 'config',
            sampleRate: this.sampleRate,
            chunkSize: this.chunkSize
        });

        // Handle audio data from worklet
        this.workletNode.port.onmessage = (event) => {
            if (event.data.type === 'audio') {
                this.handleAudioData(event.data.data);
            }
        };

        // Connect audio nodes: source → worklet → destination
        source.connect(this.workletNode);
        this.workletNode.connect(this.audioContext.destination);

        // Start sending audio data
        this.startAudioSending();

        console.log('✅ AudioWorklet processing started');
    }

    handleAudioData(float32Array) {
        // Queue audio data for sending
        this.audioQueue.push(float32Array);
    }

    startAudioSending() {
        // Send audio chunks at regular intervals
        const sendInterval = setInterval(() => {
            if (!this.isRecording || this.isShuttingDown ||
                !this.ws || this.ws.readyState !== WebSocket.OPEN) {
                clearInterval(sendInterval);
                return;
            }

            // Send all queued audio chunks
            while (this.audioQueue.length > 0) {
                const audioData = this.audioQueue.shift();
                this.sendAudioChunk(audioData);
            }
        }, 50); // Send every 50ms
    }

    sendAudioChunk(float32Array) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        // Convert Float32Array to bytes (little-endian)
        const buffer = new ArrayBuffer(float32Array.length * 4);
        const view = new DataView(buffer);

        for (let i = 0; i < float32Array.length; i++) {
            view.setFloat32(i * 4, float32Array[i], true);
        }

        // Send binary data
        this.ws.send(buffer);
    }

    handleServerMessage(message) {
        try {
            const data = JSON.parse(message);
            // console.log('_p', data);
            if (data.text && data.text.trim()) {
                // ====================== ME
                // this.emit('transcript', {
                //     text: data.text,
                //     isFinal: data.is_final || false,
                //     timestamp: new Date().toISOString()
                // });
                this.emit('transcript', data);

                // console.log(`📥 ${data.is_final ? '[FINAL]' : '[PARTIAL]'}: ${data.text}`);
            }
        } catch (error) {
            console.warn('Invalid server message:', message);
        }
    }

    async stop() {
        if (this.isShuttingDown) return;

        this.isShuttingDown = true;
        this.isRecording = false;

        // Stop AudioWorklet processing
        if (this.workletNode) {
            // Send stop command to processor
            this.workletNode.port.postMessage({ command: 'stop' });

            // Disconnect and clean up
            this.workletNode.disconnect();
            this.workletNode = null;
        }

        // Stop microphone
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        // Close AudioContext
        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }

        // Gracefully close WebSocket
        if (this.ws) {
            if (this.ws.readyState === WebSocket.OPEN) {
                // Send close frame with normal closure code
                this.ws.close(1000, "Recording stopped");
            }

            // Clear reference
            setTimeout(() => {
                this.ws = null;
            }, 100);
        }

        // Clear queues
        this.audioQueue = [];

        this.emit('status', { recording: false, connected: false });
        console.log('✅ ASR stopped gracefully');
    }

    // Utility methods
    getSampleRate() {
        return this.sampleRate;
    }

    isSupported() {
        return !!(window.AudioContext || window.webkitAudioContext) &&
               window.AudioWorkletNode;
    }

    // For debugging
    getAudioContextState() {
        return this.audioContext ? this.audioContext.state : 'none';
    }
}
