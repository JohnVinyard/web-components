const twoDimArray = (data, shape) => {
    const [x, y] = shape;
    const output = [];
    for (let i = 0; i < data.length; i += y) {
        output.push(data.slice(i, i + y));
    }
    return output;
};
const toArray = ({ array, shape }) => {
    return twoDimArray(array, shape);
};
const isCommandEvent = (d) => {
    return (d === null || d === void 0 ? void 0 : d.command) === 'close';
};
const vvd = (a, b) => {
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result += a[i] * b[i];
    }
    return result;
    // return a.reduce((accum, current, index) => {
    //     return accum + current * b[index];
    // }, 0);
};
const dot = (vector, matrix) => {
    // return new Float32Array(matrix.map((v) => vvd(v, vector)));
    const output = new Float32Array(matrix.length);
    for (let i = 0; i < matrix.length; i++) {
        output[i] = vvd(vector, matrix[i]);
    }
    return output;
};
class AttackEnvelope extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.eventQueue = [];
        this.running = true;
        const ctorArgs = options.processorOptions;
        console.log(`Constructing AttackEnvelope with attacks of shape ${ctorArgs.attack.shape}`);
        const { attack, routing } = ctorArgs;
        this.attack = toArray(attack);
        this.envelopeLength = this.attack[0].length;
        this.routing = toArray(routing);
        this.port.onmessage = (event) => {
            if (isCommandEvent(event.data)) {
                this.running = false;
            }
            else {
                const routed = dot(event.data, this.routing);
                // events will each be a single control plan vector, determining
                // the gain of each attack channel
                this.eventQueue.push({ gains: routed, sample: 0 });
            }
        };
    }
    process(inputs, outputs, parameters) {
        const samplesInBlock = outputs[0][0].length;
        // remove any events that have fully completed outputting
        // their envelopes
        this.eventQueue = this.eventQueue.filter((eq) => eq.sample < this.envelopeLength);
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
//# sourceMappingURL=attackenvelopes.js.map