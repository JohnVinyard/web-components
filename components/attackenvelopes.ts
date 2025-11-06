interface ArrayContainer {
    array: Float32Array;
    shape: any;
}

interface AttackEnvelopeParams {
    attack: ArrayContainer;
    routing: ArrayContainer;
}

const twoDimArray = (
    data: Float32Array,
    shape: [number, number]
): Float32Array[] => {
    const [x, y] = shape;

    const output: Float32Array[] = [];
    for (let i = 0; i < data.length; i += y) {
        output.push(data.slice(i, i + y));
    }
    return output;
};

const toArray = ({ array, shape }: ArrayContainer): Float32Array[] => {
    return twoDimArray(array, shape);
};

interface CommandEvent {
    command: 'close';
}

const isCommandEvent = (d: any): d is CommandEvent => {
    return (d as CommandEvent)?.command === 'close';
};

interface EnvelopeStatus {
    gains: Float32Array;
    sample: number;
}

const vvd = (a: Float32Array, b: Float32Array): number => {
    return a.reduce((accum, current, index) => {
        return accum + current * b[index];
    }, 0);
};

const dot = (vector: Float32Array, matrix: Float32Array[]): Float32Array => {
    return new Float32Array(matrix.map((v) => vvd(v, vector)));
};

class AttackEnvelope extends AudioWorkletProcessor {
    private readonly attack: Float32Array[];
    private readonly routing: Float32Array[];

    private eventQueue: EnvelopeStatus[] = [];

    private envelopeLength: number;
    private running: boolean = true;

    constructor(options: AudioWorkletNodeOptions) {
        super();

        const ctorArgs: AttackEnvelopeParams = options.processorOptions;

        console.log(
            `Constructing AttackEnvelope with attacks of shape ${ctorArgs.attack.shape}`
        );

        const { attack, routing } = ctorArgs;

        this.attack = toArray(attack);
        this.envelopeLength = this.attack[0].length;

        this.routing = toArray(routing);

        this.port.onmessage = (
            event: MessageEvent<Float32Array | CommandEvent>
        ) => {
            if (isCommandEvent(event.data)) {
                this.running = false;
            } else {
                const routed = dot(event.data, this.routing);

                // events will each be a single control plan vector, determining
                // the gain of each attack channel
                this.eventQueue.push({ gains: routed, sample: 0 });
            }
        };
    }

    process(
        inputs: Float32Array[][],
        outputs: Float32Array[][],
        parameters: Record<string, Float32Array>
    ): boolean {
        const samplesInBlock = outputs[0][0].length;

        // remove any events that have fully completed outputting
        // their envelopes
        this.eventQueue = this.eventQueue.filter(
            (eq) => eq.sample < this.envelopeLength
        );

        for (let e = 0; e < this.eventQueue.length; e += 1) {
            // iterate over each currently active envelope event
            const event = this.eventQueue[e];
            const gains = event.gains;

            // for each channel of the control plane
            for (let channel = 0; channel < outputs.length; channel += 1) {
                const ch = outputs[channel][0];
                // there will be as many channels as the control plane dimension

                for (let sample = 0; sample < ch.length; sample += 1) {
                    // block of samples

                    // read out the curent position in this envelope, multiplying
                    // it by the specified gain and noise
                    ch[sample] +=
                        this.attack[channel][event.sample + sample] *
                        (Math.random() * 2 - 1) *
                        gains[channel];
                }
            }

            event.sample += samplesInBlock;
        }

        return this.running;
    }
}

registerProcessor('attack-envelopes', AttackEnvelope);
