class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.sampleRate = 16000;
        this.targetSampleRate = 16000;
        this.chunkSize = 3200; // 200ms at 16kHz
        this.audioBuffer = [];
        this.isActive = true;

        this.port.onmessage = (event) => {
            if (event.data.command === 'config') {
                this.targetSampleRate = event.data.sampleRate || 16000;
                this.chunkSize = event.data.chunkSize || 3200;
                this.isActive = true;
            } else if (event.data.command === 'stop') {
                this.isActive = false;
            }
        };
    }

    process(inputs) {
        if (!this.isActive) return false;

        const input = inputs[0];
        if (!input || !input[0]) return true;

        const channelData = input[0]; // Mono

        // Add samples to buffer
        for (let i = 0; i < channelData.length; i++) {
            this.audioBuffer.push(channelData[i]);
        }

        // Send chunks when we have enough samples
        while (this.audioBuffer.length >= this.chunkSize) {
            const chunk = new Float32Array(this.audioBuffer.splice(0, this.chunkSize));

            // Send to main thread
            this.port.postMessage({
                type: 'audio',
                data: chunk,
                sampleRate: this.sampleRate
            });
        }

        return true; // Keep processor alive
    }
}

registerProcessor('pcm-processor', PCMProcessor);
