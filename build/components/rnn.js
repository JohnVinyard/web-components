const twoDimArray = (data, shape) => {
    const [x, y] = shape;
    const output = [];
    for (let i = 0; i < data.length; i += y) {
        output.push(data.slice(i, i + y));
    }
    return output;
};
const vectorVectorDot = (a, b) => {
    return a.reduce((accum, current, index) => {
        return accum + current * b[index];
    }, 0);
};
const elementwiseSum = (a, b) => {
    return a.map((value, index) => value + b[index]);
};
const sum = (a) => {
    return a.reduce((accum, current) => {
        return accum + current;
    }, 0);
};
const l1Norm = (a) => {
    return sum(a.map(Math.abs));
};
/**
 * e.g., if vetor is length 64, and matrix is (128, 64), we'll end up
 * with a new vector of length 128
 */
const dotProduct = (vector, matrix) => {
    return new Float32Array(matrix.map((v) => vectorVectorDot(v, vector)));
};
class Rnn extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.eventQueue = [];
        console.log('Constructing RNN Worklet');
        console.log(options);
        const ctorArgs = options.processorOptions;
        this.controlPlaneDim = ctorArgs.inProjection.shape[0];
        const hiddenDim = ctorArgs.rnnInProjection.shape[1];
        this.rnnHiddenState = new Float32Array(hiddenDim).fill(0);
        this.inProjection = twoDimArray(ctorArgs.inProjection.array, ctorArgs.inProjection.shape);
        this.rnnInProjection = twoDimArray(ctorArgs.rnnInProjection.array, ctorArgs.rnnInProjection.shape);
        this.rnnOutProjection = twoDimArray(ctorArgs.rnnOutProjection.array, ctorArgs.rnnOutProjection.shape);
        this.outProjection = twoDimArray(ctorArgs.outProjection.array, ctorArgs.outProjection.shape);
        this.port.onmessage = (event) => {
            this.eventQueue.push(event.data);
        };
    }
    /**
     * Outputs are the first dimension, channels are the second
     */
    process(inputs, outputs, parameters) {
        const left = outputs[0][0];
        // const right = outputs[0][1];
        // see if there's an "event" in the queue
        const maybeControlPlane = this.eventQueue.shift();
        // https://pytorch.org/docs/stable/generated/torch.nn.RNN.html
        const controlPlane = maybeControlPlane !== null && maybeControlPlane !== void 0 ? maybeControlPlane : new Float32Array(this.controlPlaneDim).fill(0);
        const inp = dotProduct(controlPlane, this.inProjection);
        const rnnInp = dotProduct(inp, this.rnnInProjection);
        const rnnHidden = dotProduct(this.rnnHiddenState, this.rnnOutProjection);
        const summed = elementwiseSum(rnnInp, rnnHidden);
        const nonlinearity = summed.map(Math.tanh);
        // update the hidden state for this "instrument"
        this.rnnHiddenState = nonlinearity;
        const output = dotProduct(nonlinearity, this.outProjection);
        const withSin = output.map(Math.sin);
        left.set(withSin);
        // left.set(
        //     new Float32Array(left.length).map((x) => Math.random() * 2 - 1)
        // );
        return true;
    }
}
registerProcessor('rnn-instrument', Rnn);
//# sourceMappingURL=rnn.js.map