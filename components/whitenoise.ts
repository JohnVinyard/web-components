class WhiteNoise extends AudioWorkletProcessor {
    
    constructor() {
        super();
    }

    process(
        inputs: Float32Array[][],
        outputs: Float32Array[][],
        parameters: Record<string, Float32Array>
    ): boolean {
        for (let i = 0; i < outputs.length; i++) {
            for (let j = 0; j < outputs[i].length; j++) {
                outputs[i][j].set([Math.random() * 2 - 1]);
            }
        }

        return true;
    }
}

registerProcessor('white-noise', WhiteNoise);
