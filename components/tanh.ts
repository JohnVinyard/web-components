/*
interface AudioWorkletNodeOptions extends AudioNodeOptions {
    numberOfInputs?: number;
    numberOfOutputs?: number;
    outputChannelCount?: number[];
    parameterData?: Record<string, number>;
    processorOptions?: any;
}
*/

interface TanhParams {
    gains: Float32Array;
}

/**
 * A single node will handle all resonance outputs from the model
 */
class Tanh extends AudioWorkletProcessor {
    private readonly gains: Float32Array;

    constructor(options: AudioWorkletNodeOptions) {
        super();

        const { gains }: TanhParams = options.processorOptions;
        this.gains = gains;
    }

    process(
        inputs: Float32Array[][],
        outputs: Float32Array[][],
        parameters: Record<string, Float32Array>
    ): boolean {
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

        return true;
    }
}

registerProcessor('tanh-gain', Tanh);
