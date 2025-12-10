export class SherpaASRClient {
    constructor() {
        this.ws = null;
        this.audioContext = null;
        this.processor = null;
        this.mediaStream = null;
        this.isRecording = false;
        this.sampleRate = 16000;
        this.chunkSize = 3200; // 200ms at 16kHz = 3200 samples
        this.audioBuffer = [];
        this.hasSentConfig = false; // Track config state

        // For Svelte reactivity if needed
        this.transcript = '';
        this.isConnected = false;
    }

    async start() {
        try {
            // Reset config tracking for new session
            this.hasSentConfig = false;

            // Get microphone
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: this.sampleRate,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // Connect WebSocket
            await this.connectWebSocket();

            // Setup audio
            await this.setupAudioProcessing();

            this.isRecording = true;
            this.isConnected = true;

            console.log('✅ ASR recording started');

        } catch (error) {
            console.error('Start error:', error);
            this.stop();
            throw error;
        }
    }

    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            const url = 'ws://localhost:6006'; // Or make configurable
            this.ws = new WebSocket(url);
            this.ws.binaryType = 'arraybuffer';

            // Track connection timeout
            const timeoutId = setTimeout(() => {
                if (this.ws.readyState !== WebSocket.OPEN) {
                    reject(new Error('Connection timeout'));
                }
            }, 5000);

            this.ws.onopen = () => {
                clearTimeout(timeoutId);
                console.log('✅ WebSocket connected');

                // OPTIONAL: Only send config once per page load
                // Since your server has --sample-rate 16000, you can skip this
                // If you want to send it, do it only once:
                if (!this.hasSentConfig) {
                    // Uncomment if needed:
                    // this.ws.send(JSON.stringify({ sample_rate: 16000 }));
                    // this.hasSentConfig = true;
                }

                resolve();
            };

            this.ws.onmessage = (event) => {
                this.handleServerMessage(event.data);
            };

            this.ws.onerror = (error) => {
                clearTimeout(timeoutId);
                console.error('WebSocket error:', error);
                this.isConnected = false;
                reject(error);
            };

            this.ws.onclose = () => {
                console.log('WebSocket closed');
                this.isConnected = false;
                if (this.isRecording) {
                    this.stop();
                }
            };
        });
    }

    async setupAudioProcessing() {
        // Create AudioContext with exact sample rate
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.sampleRate
        });

        // Resume if suspended
        if (this.audioContext.state !== 'running') {
            await this.audioContext.resume();
        }

        // Create source
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);

        // Use ScriptProcessor with 4096 buffer (same as HTML version)
        // 4096 samples ÷ 16000 Hz = 256ms chunks
        const bufferSize = 4096;
        this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

        // Clear buffer
        this.audioBuffer = [];

        this.processor.onaudioprocess = (event) => {
            if (!this.isRecording || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return;
            }

            // Get audio data
            const inputData = event.inputBuffer.getChannelData(0);

            // Add to buffer
            for (let i = 0; i < inputData.length; i++) {
                this.audioBuffer.push(inputData[i]);
            }

            // Send when we have exactly chunkSize samples
            while (this.audioBuffer.length >= this.chunkSize) {
                const chunk = this.audioBuffer.splice(0, this.chunkSize);
                this.sendAudioChunk(chunk);
            }
        };

        // Connect
        source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
    }

    sendAudioChunk(float32Array) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || float32Array.length !== this.chunkSize) {
            return;
        }

        // Convert to bytes (float32 little-endian)
        const buffer = new ArrayBuffer(float32Array.length * 4);
        const view = new DataView(buffer);

        for (let i = 0; i < float32Array.length; i++) {
            view.setFloat32(i * 4, float32Array[i], true);
        }

        // Send binary
        this.ws.send(buffer);

        // Debug: log size
        console.log(`📤 Sent ${buffer.byteLength} bytes (${float32Array.length} samples)`);
    }

    handleServerMessage(message) {
        try {
            const data = JSON.parse(message);

            if (data.text && data.text.trim()) {
                this.transcript = data.text;

                // Dispatch event for Svelte reactivity
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('asr-transcript', {
                        detail: {
                            text: data.text,
                            isFinal: data.is_final || false,
                            timestamp: new Date().toISOString()
                        }
                    }));
                }

                console.log(`📥 ${data.is_final ? '[FINAL]' : '[PARTIAL]'}: ${data.text}`);
            }
        } catch (error) {
            console.warn('Failed to parse server message:', message);
        }
    }

    async stop() {
        this.isRecording = false;
        this.isConnected = false;

        // Cleanup in order
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }

        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.audioBuffer = [];
        this.hasSentConfig = false;

        console.log('🛑 ASR stopped');
    }

    // Helper method for Svelte components
    getTranscript() {
        return this.transcript;
    }
}
