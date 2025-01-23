export const tanh = (arr) => {
    return arr.map(Math.tanh);
};
class Rnn extends AudioWorkletProcessor {
    constructor() {
        super();
    }
    /**
     * Outputs are the first dimension, channels are the second
     */
    process(inputs, outputs, parameters) {
        return true;
    }
}
registerProcessor('rnn', Rnn);
//# sourceMappingURL=rnn.js.map