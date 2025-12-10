// pcm-processor.js - AudioWorklet Processor
class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.sampleRate = 16000;
        this.targetSampleRate = 16000;
        this.chunkSize = 3200; // 200ms at 16kHz = 3200 samples
        this.resampleBuffer = [];
        this.port.onmessage = this.handleMessage.bind(this);
    }

    handleMessage(event) {
        if (event.data.command === 'config') {
            this.targetSampleRate = event.data.sampleRate || 16000;
            this.chunkSize = Math.floor(this.targetSampleRate * 0.2); // 200ms chunks
        }
    }

    resampleAudio(input, inputSampleRate, outputSampleRate) {
        if (inputSampleRate === outputSampleRate || input.length === 0) {
            return input;
        }

        const ratio = inputSampleRate / outputSampleRate;
        const newLength = Math.round(input.length / ratio);
        const result = new Float32Array(newLength);

        for (let i = 0; i < newLength; i++) {
            const pos = i * ratio;
            const index = Math.floor(pos);
            const fraction = pos - index;

            if (index + 1 < input.length) {
                result[i] = input[index] * (1 - fraction) + input[index + 1] * fraction;
            } else if (index < input.length) {
                result[i] = input[index];
            } else {
                result[i] = 0;
            }
        }

        return result;
    }

    floatTo16BitPCM(float32Array) {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);

        for (let i = 0; i < float32Array.length; i++) {
            // Clamp to [-1, 1]
            const sample = Math.max(-1, Math.min(1, float32Array[i]));
            // Convert to 16-bit integer
            view.setInt16(i * 2, sample * 0x7FFF, true); // Little-endian
        }

        return buffer;
    }

    process(inputs) {
        const input = inputs[0];

        if (input && input.length > 0 && input[0]) {
            const channelData = input[0]; // Mono

            // Resample if needed (from AudioContext sampleRate to target)
            let processedData;
            if (this.sampleRate !== this.targetSampleRate) {
                processedData = this.resampleAudio(channelData, this.sampleRate, this.targetSampleRate);
            } else {
                processedData = channelData;
            }

            // Add to buffer
            for (let i = 0; i < processedData.length; i++) {
                this.resampleBuffer.push(processedData[i]);
            }

            // Send chunks when we have enough data
            while (this.resampleBuffer.length >= this.chunkSize) {
                const chunk = new Float32Array(this.resampleBuffer.splice(0, this.chunkSize));
                const pcmBuffer = this.floatTo16BitPCM(chunk);

                // Send binary data directly (not as object!)
                this.port.postMessage(pcmBuffer, [pcmBuffer]);
            }
        }

        // Keep processor alive
        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);
