class WhiteNoise extends AudioWorkletProcessor {
    constructor() {
        super();
    }
    process(inputs, outputs, parameters) {
        for (let i = 0; i < outputs.length; i++) {
            for (let j = 0; j < outputs[i].length; j++) {
                outputs[i][j].set([Math.random() * 2 - 1]);
            }
        }
        return true;
    }
}
registerProcessor('white-noise', WhiteNoise);
//# sourceMappingURL=whitenoise.js.map