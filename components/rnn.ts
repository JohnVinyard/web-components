export const tanh = (arr: Float32Array): Float32Array => {
    return arr.map(Math.tanh);
};

class Rnn extends AudioWorkletProcessor {
    constructor() {
        super();
    }

    /**
     * Outputs are the first dimension, channels are the second
     */
    process(
        inputs: Float32Array[][],
        outputs: Float32Array[][],
        parameters: Record<string, Float32Array>
    ): boolean {
        return true;
    }
}

registerProcessor('rnn', Rnn);
