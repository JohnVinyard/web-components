interface ArrayContainer {
    array: Float32Array;
    shape: any;
}

interface RnnParams {
    inProjection: ArrayContainer;
    outProjection: ArrayContainer;
    rnnInProjection: ArrayContainer;
    rnnOutProjection: ArrayContainer;
    accelerometerMapping: ArrayContainer;
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

const vectorVectorDot = (a: Float32Array, b: Float32Array): number => {
    return a.reduce((accum, current, index) => {
        return accum + current * b[index];
    }, 0);
};

const elementwiseSum = (a: Float32Array, b: Float32Array): Float32Array => {
    return a.map((value, index) => value + b[index]);
};

const sum = (a: Float32Array): number => {
    return a.reduce((accum, current) => {
        return accum + current;
    }, 0);
};

const l1Norm = (a: Float32Array): number => {
    return sum(a.map(Math.abs));
};

/**
 * e.g., if vetor is length 64, and matrix is (128, 64), we'll end up
 * with a new vector of length 128
 */
const dotProduct = (
    vector: Float32Array,
    matrix: Float32Array[]
): Float32Array => {
    return new Float32Array(matrix.map((v) => vectorVectorDot(v, vector)));
};

class Rnn extends AudioWorkletProcessor {
    private eventQueue: Float32Array[] = [];
    private rnnHiddenState: Float32Array;
    private readonly controlPlaneDim: number;

    private readonly inProjection: Float32Array[];
    private readonly rnnInProjection: Float32Array[];
    private readonly rnnOutProjection: Float32Array[];
    private readonly outProjection: Float32Array[];

    constructor(options: AudioWorkletNodeOptions) {
        super();

        console.log('Constructing RNN Worklet');
        console.log(options);

        const ctorArgs: RnnParams = options.processorOptions;

        this.controlPlaneDim = ctorArgs.inProjection.shape[0];

        const hiddenDim = ctorArgs.rnnInProjection.shape[1];
        this.rnnHiddenState = new Float32Array(hiddenDim).fill(0);

        this.inProjection = twoDimArray(
            ctorArgs.inProjection.array,
            ctorArgs.inProjection.shape
        );
        this.rnnInProjection = twoDimArray(
            ctorArgs.rnnInProjection.array,
            ctorArgs.rnnInProjection.shape
        );
        this.rnnOutProjection = twoDimArray(
            ctorArgs.rnnOutProjection.array,
            ctorArgs.rnnOutProjection.shape
        );
        this.outProjection = twoDimArray(
            ctorArgs.outProjection.array,
            ctorArgs.outProjection.shape
        );

        this.port.onmessage = (event: MessageEvent<Float32Array>) => {
            this.eventQueue.push(event.data);
        };
    }

    /**
     * Outputs are the first dimension, channels are the second
     */
    process(
        inputs: Float32Array[][],
        outputs: Float32Array[][],
        parameters: Record<string, Float32Array>
    ): boolean {
        const left = outputs[0][0];
        // const right = outputs[0][1];

        // see if there's an "event" in the queue
        const maybeControlPlane: Float32Array | undefined =
            this.eventQueue.shift();

        // https://pytorch.org/docs/stable/generated/torch.nn.RNN.html

        const controlPlane =
            maybeControlPlane ?? new Float32Array(this.controlPlaneDim).fill(0);

        const inp = dotProduct(controlPlane, this.inProjection);

        const rnnInp = dotProduct(inp, this.rnnInProjection);

        const rnnHidden = dotProduct(
            this.rnnHiddenState,
            this.rnnOutProjection
        );

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
