/*
interface AudioWorkletNodeOptions extends AudioNodeOptions {
    numberOfInputs?: number;
    numberOfOutputs?: number;
    outputChannelCount?: number[];
    parameterData?: Record<string, number>;
    processorOptions?: any;
}
*/
/**
 * A single node will handle all resonance outputs from the model
 */
class Tanh extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.running = true;
        const { gains } = options.processorOptions;
        this.gains = gains;
        this.port.onmessage = (event) => {
            if (event.data.command === 'close') {
                this.running = false;
            }
        };
    }
    process(inputs, outputs, parameters) {
        for (let i = 0; i < inputs.length; i++) {
            const inp = inputs[i][0];
            const out = outputs[i][0];
            if (inp === undefined) {
                continue;
            }
            for (let j = 0; j < inp.length; j++) {
                // apply gain and non-linearity
                out[j] = Math.tanh(inp[j] * this.gains[i]);
            }
        }
        return this.running;
    }
}
registerProcessor('tanh-gain', Tanh);
//# sourceMappingURL=tanh.js.map