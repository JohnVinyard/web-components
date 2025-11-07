import { AccessibleTypeArray, fromNpy } from './numpy';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    var binaryString = atob(base64);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

const zeros = (size: number): Float32Array => {
    return new Float32Array(size).fill(0);
};

const deserialize = (raw: string): [AccessibleTypeArray, any] => {
    return fromNpy(base64ToArrayBuffer(raw));
};

const toContainer = (raw: string): ArrayContainer => {
    const [arr, shape] = deserialize(raw);
    return {
        array: arr as Float32Array,
        shape,
    };
};

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

const dotProduct = (
    vector: Float32Array,
    matrix: Float32Array[]
): Float32Array => {
    return new Float32Array(matrix.map((v) => vectorVectorDot(v, vector)));
};

const elementwiseDifference = (
    a: Float32Array,
    b: Float32Array,
    out: Float32Array
): Float32Array => {
    for (let i = 0; i < a.length; i++) {
        out[i] = a[i] - b[i];
    }
    return out;
};

const relu = (vector: Float32Array): Float32Array => {
    return vector.map((x) => Math.max(0, x));
};

interface RawConvInstrumentParams {
    /**
     * Scalar gain per resonance of shape (n_resonances,)
     */
    gains: string;

    /**
     * A matrix with shape
     * control_plane_dim x n_resonances
     */
    router: string;

    /**
     * Materialized resonances.  Original shape is (n_resonances, expressivity, n_samples)
     * but flattened into (n_resonances * expressivity, n_samples)
     */
    resonances: string;

    hand: string;

    attacks: string;

    mix: string;
}

interface ArrayContainer {
    array: Float32Array;
    shape: any;
}

interface ConvInstrumentParams {
    /**
     * Scalar gain per resonance
     */
    gains: ArrayContainer;

    /**
     * A matrix with shape
     * control_plane_dim x n_resonances
     */
    router: ArrayContainer;

    /**
     * Materialized resonances.  Original shape is (n_resonances, expressivity, n_samples)
     * but flattened into (n_resonances * expressivity, n_samples)
     */
    resonances: ArrayContainer;

    hand: ArrayContainer;

    attacks: ArrayContainer;

    /**
     * This should be of shape (n_resonances, 2)
     */
    mix: ArrayContainer;
}

const fetchWeights = async (url: string): Promise<ConvInstrumentParams> => {
    const resp = await fetch(url);
    const data = await resp.json();

    const { gains, router, resonances, hand, attacks, mix } =
        data as RawConvInstrumentParams;
    return {
        gains: toContainer(gains),
        router: toContainer(router),
        resonances: toContainer(resonances),
        hand: toContainer(hand),
        attacks: toContainer(attacks),
        mix: toContainer(mix),
    };
};

const l2Norm = (vec: Float32Array): number => {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) {
        norm += vec[i] ** 2;
    }
    return Math.sqrt(norm);
};

const zerosLike = (x: Float32Array): Float32Array => {
    return new Float32Array(x.length).fill(0);
};

const vectorScalarMultiply = (
    vec: Float32Array,
    scalar: number
): Float32Array => {
    for (let i = 0; i < vec.length; i++) {
        vec[i] = vec[i] * scalar;
    }
    return vec;
};

const randomProjectionMatrix = (
    shape: [number, number],
    uniformDistributionMin: number,
    uniformDistributionMax: number,
    probability: number = 0.97
): Float32Array[] => {
    const totalElements = shape[0] * shape[1];
    const span = uniformDistributionMax - uniformDistributionMin;
    const mid = span / 2;

    const rnd = zeros(totalElements).map((x) => {
        return Math.random() * span - mid;
    });
    return twoDimArray(rnd, shape);
};

const createHandLandmarker = async (): Promise<HandLandmarker> => {
    const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    );
    const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        },
        numHands: 1,
        runningMode: 'VIDEO',
    });
    return handLandmarker;
};

const enableCam = async (shadowRoot: ShadowRoot): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
    });

    const video = shadowRoot.querySelector('video');
    video.srcObject = stream;
};

let lastVideoTime: number = 0;

let lastPosition = new Float32Array(21 * 3);

const DEFORMATION_PROJECTION_MATRIX = randomProjectionMatrix(
    [2, 21 * 3],
    -1,
    1
);

const colorScheme = [
    // Coral / Pink Tones
    'rgb(255, 99, 130)', // Coral Pink
    'rgb(255, 143, 160)', // Blush
    'rgb(255, 181, 194)', // Light Rose

    // Warm Yellows / Oranges
    'rgb(255, 207, 64)', // Honey Yellow
    'rgb(255, 179, 71)', // Soft Orange
    'rgb(255, 222, 130)', // Pale Gold

    // Greens
    'rgb(72, 207, 173)', // Mint Green
    'rgb(112, 219, 182)', // Soft Seafoam
    'rgb(186, 242, 203)', // Pastel Green

    // Blues
    'rgb(64, 153, 255)', // Sky Blue
    'rgb(108, 189, 255)', // Light Blue
    'rgb(179, 220, 255)', // Pale Azure

    // Purples
    'rgb(149, 117, 205)', // Lavender Purple
    'rgb(178, 145, 220)', // Soft Lilac
    'rgb(210, 190, 245)', // Pale Violet

    // Neutrals
    'rgb(240, 240, 240)', // Light Gray
    'rgb(200, 200, 200)', // Medium Gray
    'rgb(160, 160, 160)', // Soft Charcoal
    'rgb(100, 100, 100)', // Dark Gray
    'rgb(33, 33, 33)', // Deep Charcoal

    // Accent
    'rgb(255, 255, 255)', // White (highlight or background contrast)
];

interface HasWeights {
    hand: Float32Array[] | null;
    deformation: Float32Array[] | null;
}

type DeformationUpdate = (weights: Float32Array) => void;

const predictWebcamLoop = (
    shadowRoot: ShadowRoot,
    handLandmarker: HandLandmarker,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    deltaThreshold: number,
    deltaMax: number,
    unit: HasWeights,
    inputTrigger: (vec: Float32Array) => void,
    defUpdate: DeformationUpdate
): (() => number) => {
    const predictWebcam = (): number => {
        const video = shadowRoot.querySelector('video');

        if (!video) {
            return 0;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const output = zerosLike(lastPosition);

        let startTimeMs = performance.now();
        if (lastVideoTime !== video.currentTime) {
            const detections = handLandmarker.detectForVideo(
                video,
                startTimeMs
            );

            // ctx is the plotting canvas' context
            // w is the width of the canvas
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);

            // Process and draw landmarks from 'detections'
            if (detections.landmarks) {
                const newPosition = new Float32Array(21 * 3);
                let zPos = 0;

                let vecPos = 0;

                for (let i = 0; i < detections.landmarks.length; i++) {
                    const landmarks = detections.landmarks[i];
                    const wlm = detections.worldLandmarks[i];

                    for (let j = 0; j < landmarks.length; j++) {
                        const landmark = landmarks[j];
                        const wl = wlm[j];

                        if (j === 8) {
                            // Z position of index finger
                            zPos = landmark.z;
                        }

                        // TODO: This determines whether we're using
                        // screen-space or world-space
                        const mappingVector = wl;

                        // TODO: This is assuming values in [0, 1]
                        newPosition[vecPos] = mappingVector.x * 2 - 1;
                        newPosition[vecPos + 1] = mappingVector.y * 2 - 1;
                        newPosition[vecPos + 2] = mappingVector.z * 2 - 1;

                        const x = landmark.x * canvas.width;
                        const y = landmark.y * canvas.height;

                        vecPos += 3;

                        ctx.beginPath();
                        ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
                        ctx.fillStyle = colorScheme[j];
                        ctx.fill();
                    }
                }

                const delta = elementwiseDifference(
                    newPosition,
                    lastPosition,
                    output
                );

                const deltaNorm = l2Norm(delta);

                // Ensure that an event is triggered and that it won't
                // be overly-loud
                if (deltaNorm > deltaThreshold && deltaNorm < deltaMax) {
                    // console.log('Z', zPos);
                    // trigger an event if the delta is large enough
                    const matrix = unit.hand;

                    if (matrix) {
                        // project the position of all points to the rnn input
                        // dimensions
                        const rnnInput = dotProduct(delta, matrix);
                        const scaled = vectorScalarMultiply(rnnInput, 10);
                        const sp = relu(scaled);
                        inputTrigger(sp);
                    }
                }

                if (unit.deformation) {
                    // always trigger a deformation
                    // const defInput = dotProduct(delta, unit.deformation);
                    // defUpdate(defInput);
                    defUpdate(
                        new Float32Array([
                            Math.abs(0.5 - Math.abs(zPos)) * 10,
                            Math.abs(0 - Math.abs(zPos)) * 10,
                        ])
                    );
                }

                lastPosition = newPosition;
            }
            lastVideoTime = video.currentTime;
        }

        return requestAnimationFrame(predictWebcam);
    };

    return predictWebcam;
};

class Mixer {
    constructor(private readonly nodes: GainNode[]) {}

    public static mixerWithNChannels(context: AudioContext, n: number): Mixer {
        const nodes: GainNode[] = [];
        for (let i = 0; i < n; i++) {
            const g = context.createGain();
            g.gain.value = 0.0001;
            nodes.push(g);
        }
        return new Mixer(nodes);
    }

    public connectTo(node: AudioNode, channel?: number): void {
        for (const gain of this.nodes) {
            gain.connect(node, undefined, channel);
        }
    }

    public acceptConnection(
        node: AudioNode,
        mixerChannel: number,
        outgoingNodeChannel: number | undefined = undefined
    ): void {
        node.connect(this.nodes[mixerChannel], outgoingNodeChannel);
    }

    public randomGains() {
        const vec = new Float32Array(this.nodes.length);
        const random = uniform(-1, 1, vec);
        this.adjust(random);
    }

    public sparseGains() {
        const vec = new Float32Array(this.nodes.length);
        const random = sparse(0.05, vec);
        this.adjust(random);
    }

    public adjust(gainValues: Float32Array) {
        const vec = new Float32Array(gainValues.length);
        const sm = softmax(gainValues, vec);
        for (let i = 0; i < this.nodes.length; i++) {
            try {
                const node = this.nodes[i];
                node.gain.value = sm[i];
            } catch (err) {
                console.log(`Failed to set gain with ${sm[i]}`);
            }
        }
    }

    public oneHot(index: number) {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            if (i === index) {
                node.gain.value = 1;
            } else {
                node.gain.value = 0.0001;
            }
        }
    }
}

const truncate = (
    arr: Float32Array,
    threshold: number,
    count: number
): Float32Array => {
    let run = 0;
    for (let i = 0; i < arr.length; i++) {
        const value = Math.abs(arr[i]);
        if (value < threshold) {
            run += 1;
        } else {
            run = 0;
        }

        if (run >= count) {
            return arr.slice(0, i);
        }
    }

    return arr;
};

interface CommandEvent {
    command: 'close';
}

const CLOSE_COMMAND: CommandEvent = { command: 'close' };

class Instrument {
    private readonly gains: Float32Array;
    private readonly attacks: Float32Array[];

    private readonly attackContainer: ArrayContainer;

    private readonly router: Float32Array[];
    private readonly resonances: Float32Array[];
    public hand: Float32Array[];

    private controlPlane: AudioWorkletNode | null;
    private tanhGain: AudioWorkletNode | null;

    private mix: Float32Array[];

    // private controlPlane: GainNode[];
    private expressivityMixers: Mixer[];

    constructor(
        private readonly context: AudioContext,
        private readonly params: ConvInstrumentParams,

        public readonly expressivity: number
    ) {
        this.controlPlane = null;
        this.tanhGain = null;

        this.gains = params.gains.array;
        this.router = twoDimArray(params.router.array, params.router.shape);
        this.resonances = twoDimArray(
            params.resonances.array,
            params.resonances.shape
        );
        this.hand = twoDimArray(params.hand.array, params.hand.shape);
        this.attackContainer = params.attacks;
        this.attacks = twoDimArray(params.attacks.array, params.attacks.shape);
        this.mix = twoDimArray(params.mix.array, params.mix.shape);
    }

    public async close() {
        this.tanhGain.port.postMessage(CLOSE_COMMAND);
        this.controlPlane.port.postMessage(CLOSE_COMMAND);
        this.tanhGain.disconnect();
        this.controlPlane.disconnect();
        this.context.close();
    }

    public static async fromURL(
        url: string,
        context: AudioContext,
        expressivity: number
    ): Promise<Instrument> {
        const params: ConvInstrumentParams = await fetchWeights(url);
        const instr = new Instrument(context, params, expressivity);
        await instr.buildAudioNetwork();
        return instr;
    }

    public get nSamples(): number {
        return this.resonances[0].length;
    }

    public get controlPlaneDim(): number {
        return this.router.length;
    }

    public get nResonances(): number {
        return this.resonances.length / this.expressivity;
    }

    public get totalResonances(): number {
        return this.resonances.length;
    }

    public async buildAudioNetwork() {
        try {
            await this.context.audioWorklet.addModule(
                'https://cdn.jsdelivr.net/gh/JohnVinyard/web-components@0.0.93/build/components/tanh.js'
            );
        } catch (err) {
            console.log(`Failed to add module due to ${err}`);
            alert(`Failed to load module due to ${err}`);
        }

        try {
            await this.context.audioWorklet.addModule(
                'https://cdn.jsdelivr.net/gh/JohnVinyard/web-components@0.0.93/build/components/attackenvelopes.js'
            );
        } catch (err) {
            console.log(`Failed to add module due to ${err}`);
            alert(`Failed to load module due to ${err}`);
        }

        const OUTPUT_NOISE_CHANNEL = 0;
        const OUTPUT_RESONANCE_CHANNEL = 1;

        if (this.controlPlaneDim !== this.nResonances) {
            throw new Error(
                `Currently cannot construct audio network when control plane dim and n resonances are not equal, they were ${this.controlPlaneDim} and ${this.nResonances}, respectively`
            );
        }

        const attackEnvelopes = new AudioWorkletNode(
            this.context,
            'attack-envelopes',
            {
                processorOptions: {
                    attack: this.attackContainer,
                },
                numberOfOutputs: this.controlPlaneDim,
                outputChannelCount: Array(this.controlPlaneDim).fill(1),
                channelCount: 1,
                channelCountMode: 'explicit',
                channelInterpretation: 'discrete',
            }
        );

        this.controlPlane = attackEnvelopes;

        // There is a noise/resonance mix for each channel
        const noiseResonanceMixers: Mixer[] = [];

        for (let i = 0; i < this.nResonances; i++) {
            const m = Mixer.mixerWithNChannels(this.context, 2);
            // Set the mix for this resonance channel;  it won't change over time
            m.adjust(this.mix[i]);
            noiseResonanceMixers.push(m);
            m.connectTo(this.context.destination);

            // connect attack directly to the noise side of the output mixer
            m.acceptConnection(attackEnvelopes, OUTPUT_NOISE_CHANNEL, i);
        }

        const tanhGain = new AudioWorkletNode(this.context, 'tanh-gain', {
            processorOptions: {
                gains: this.gains,
            },
            numberOfInputs: this.nResonances,
            numberOfOutputs: this.nResonances,
            outputChannelCount: Array(this.nResonances).fill(1),
            channelCount: 1,
            channelCountMode: 'explicit',
            channelInterpretation: 'discrete',
        });

        // Build the last leg;  resonances, each group of which is connected
        // to an outgoing mixer
        const resonances: ConvolverNode[] = [];

        const expressivityMixers: Mixer[] = [];

        for (let i = 0; i < this.totalResonances; i += this.expressivity) {
            const m = Mixer.mixerWithNChannels(this.context, this.expressivity);
            m.oneHot(0);
            expressivityMixers.push(m);

            const currentChannel = i / this.expressivity;

            for (let j = 0; j < this.expressivity; j++) {
                const c = this.context.createConvolver();
                const buffer = this.context.createBuffer(
                    1,
                    this.nSamples,
                    22050
                );
                const res = this.resonances[i + j];
                const truncated = truncate(res, 1e-5, 32);

                buffer.getChannelData(0).set(truncated);
                c.buffer = buffer;

                attackEnvelopes.connect(c, currentChannel);

                resonances.push(c);
                m.acceptConnection(c, j);
            }

            m.connectTo(tanhGain, currentChannel);

            // Connect the gain channel to the resonance side of the output mixer
            noiseResonanceMixers[currentChannel].acceptConnection(
                tanhGain,
                OUTPUT_RESONANCE_CHANNEL,
                currentChannel
            );
        }

        this.expressivityMixers = expressivityMixers;

        // Route control-plane channels to each resonance
        // for (let i = 0; i < this.controlPlaneDim; i++) {
        //     // Get the "weight" for this control-plane-to-
        //     // resonance connection
        //     const r = this.router[i];

        //     for (let j = 0; j < this.nResonances; j++) {
        //         const z: GainNode = this.context.createGain();
        //         z.gain.value = r[j];

        //         attackEnvelopes.connect(z, i);

        //         const startIndex: number = j * this.expressivity;
        //         const stopIndex = startIndex + this.expressivity;

        //         noiseResonanceMixers[j].acceptConnection(
        //             z,
        //             OUTPUT_NOISE_CHANNEL
        //         );

        //         for (let k = startIndex; k < stopIndex; k += 1) {
        //             z.connect(resonances[k]);
        //         }
        //     }
        // }
    }

    // public async buildAudioNetwork() {
    //     try {
    //         await this.context.audioWorklet.addModule(
    //             'https://cdn.jsdelivr.net/gh/JohnVinyard/web-components@0.0.87/build/components/tanh.js'
    //         );
    //     } catch (err) {
    //         console.log(`Failed to add module due to ${err}`);
    //         alert(`Failed to load module due to ${err}`);
    //     }

    //     try {
    //         await this.context.audioWorklet.addModule(
    //             'https://cdn.jsdelivr.net/gh/JohnVinyard/web-components@0.0.87/build/components/attackenvelopes.js'
    //         );
    //     } catch (err) {
    //         console.log(`Failed to add module due to ${err}`);
    //         alert(`Failed to load module due to ${err}`);
    //     }

    //     const OUTPUT_NOISE_CHANNEL = 0;
    //     const OUTPUT_RESONANCE_CHANNEL = 1;

    //     const attackEnvelopes = new AudioWorkletNode(
    //         this.context,
    //         'attack-envelopes',
    //         {
    //             processorOptions: {
    //                 attack: this.attackContainer,
    //             },
    //             numberOfOutputs: this.controlPlaneDim,
    //             outputChannelCount: Array(this.controlPlaneDim).fill(1),
    //             channelCount: 1,
    //             channelCountMode: 'explicit',
    //             channelInterpretation: 'discrete',
    //         }
    //     );

    //     this.controlPlane = attackEnvelopes;

    //     const noiseResonanceMixers: Mixer[] = [];

    //     for (let i = 0; i < this.nResonances; i++) {
    //         const m = Mixer.mixerWithNChannels(this.context, 2);
    //         // Set the mix for this resonance channel;  it won't change over time
    //         m.adjust(this.mix[i]);
    //         noiseResonanceMixers.push(m);
    //         m.connectTo(this.context.destination);
    //     }

    //     const tanhGain = new AudioWorkletNode(this.context, 'tanh-gain', {
    //         processorOptions: {
    //             gains: this.gains,
    //         },
    //         numberOfInputs: this.nResonances,
    //         numberOfOutputs: this.nResonances,
    //         outputChannelCount: Array(this.nResonances).fill(1),
    //         channelCount: 1,
    //         channelCountMode: 'explicit',
    //         channelInterpretation: 'discrete',
    //     });

    //     // Build the last leg;  resonances, each group of which is connected
    //     // to an outgoing mixer
    //     const resonances: ConvolverNode[] = [];
    //     const mixers: Mixer[] = [];

    //     for (let i = 0; i < this.totalResonances; i += this.expressivity) {
    //         const m = Mixer.mixerWithNChannels(this.context, this.expressivity);
    //         m.oneHot(0);
    //         mixers.push(m);

    //         for (let j = 0; j < this.expressivity; j++) {
    //             const c = this.context.createConvolver();
    //             const buffer = this.context.createBuffer(
    //                 1,
    //                 this.nSamples,
    //                 22050
    //             );
    //             const res = this.resonances[i + j];
    //             const truncated = truncate(res, 1e-5, 32);

    //             buffer.getChannelData(0).set(truncated);
    //             c.buffer = buffer;

    //             resonances.push(c);
    //             m.acceptConnection(c, j);
    //         }

    //         const currentChannel = i / this.expressivity;
    //         m.connectTo(tanhGain, currentChannel);

    //         // Connect the gain channel to the noise/resonance output mixer
    //         noiseResonanceMixers[currentChannel].acceptConnection(
    //             tanhGain,
    //             OUTPUT_RESONANCE_CHANNEL,
    //             currentChannel
    //         );

    //         // Connect the noise/resonance mixer to the destination
    //     }

    //     this.mixers = mixers;

    //     // Route control-plane channels to each resonance
    //     for (let i = 0; i < this.controlPlaneDim; i++) {
    //         // Get the "weight" for this control-plane-to-
    //         // resonance connection
    //         const r = this.router[i];

    //         for (let j = 0; j < this.nResonances; j++) {
    //             const z: GainNode = this.context.createGain();
    //             z.gain.value = r[j];

    //             attackEnvelopes.connect(z, i);

    //             const startIndex: number = j * this.expressivity;
    //             const stopIndex = startIndex + this.expressivity;

    //             noiseResonanceMixers[j].acceptConnection(
    //                 z,
    //                 OUTPUT_NOISE_CHANNEL
    //             );

    //             for (let k = startIndex; k < stopIndex; k += 1) {
    //                 z.connect(resonances[k]);
    //             }
    //         }
    //     }
    // }

    public trigger(input: Float32Array) {
        this.controlPlane.port.postMessage(input);
    }

    public deform(mix: Float32Array) {
        // The resonance mixes are tied across all channels/routes
        for (let i = 0; i < this.nResonances; i += 1) {
            this.expressivityMixers[i].adjust(mix);
        }
    }

    public randomDeformation() {
        const values = uniform(-1, 1, zeros(this.totalResonances));
        this.deform(values);
    }
}

const exp = (vec: Float32Array, out: Float32Array): Float32Array => {
    for (let i = 0; i < vec.length; i++) {
        out[i] = Math.exp(vec[i]);
    }
    return out;
};

const sum = (vec: Float32Array): number => {
    let total = 0;
    for (let i = 0; i < vec.length; i++) {
        total += vec[i];
    }
    return total;
};

const divide = (
    vec: Float32Array,
    value: number,
    out: Float32Array
): Float32Array => {
    for (let i = 0; i < vec.length; i++) {
        out[i] = vec[i] / value;
    }
    return out;
};

const softmax = (vec: Float32Array, out: Float32Array): Float32Array => {
    const e = exp(vec, out);
    const s = sum(e);
    return divide(e, s, e);
};

const uniform = (min: number, max: number, out: Float32Array): Float32Array => {
    const range = max - min;
    for (let i = 0; i < out.length; i++) {
        out[i] = min + Math.random() * range;
    }
    return out;
};

const sparse = (probability: number, out: Float32Array): Float32Array => {
    for (let i = 0; i < out.length; i++) {
        if (Math.random() < probability) {
            out[i] = 0.1;
        } else {
            out[i] = 0.0001;
        }
    }
    return out;
};

export class ConvInstrument extends HTMLElement {
    public url: string | null = null;

    private instrument: Instrument | null = null;
    private context: AudioContext | null = null;

    private videoInitialized: boolean = false;
    private instrumentInitialized: boolean = false;

    public hand: Float32Array[] | null;
    public deformation: Float32Array[] | null;

    public open: string;

    private animationLoopHandle: number | null = null;

    constructor() {
        super();
        this.url = null;
        this.hand = null;
        this.open = 'false';
    }

    public get isOpen(): boolean {
        return this.open === 'true';
    }

    private render() {
        let shadow: ShadowRoot | null = this.shadowRoot;

        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
        }

        if (!this.isOpen) {
            shadow.innerHTML = `
                <button id="start">Open Hand-Controlled Instrument</button>
            `;

            const startButton = shadow.getElementById('start');
            startButton.addEventListener('click', () => {
                this.setAttribute('open', 'true');
            });
            this.videoInitialized = false;
            this.instrumentInitialized = false;
            return;
        }

        const renderVector = (
            currentControlPlaneVector: Float32Array
        ): string => {
            const currentControlPlaneMin = Math.min(
                ...currentControlPlaneVector
            );
            const currentControlPlaneMax = Math.max(
                ...currentControlPlaneVector
            );
            const currentControlPlaneSpan =
                currentControlPlaneMax - currentControlPlaneMin;

            const normalizedControlPlaneVector: Float32Array =
                currentControlPlaneVector.map((x) => {
                    const shifted = x - currentControlPlaneMin;
                    const scaled = shifted / (currentControlPlaneSpan + 1e-8);
                    return scaled;
                });

            const vectorElementHeight: number = 10;
            const vectorElementWidth: number = 10;

            const valueToRgb = (x: number): string => {
                const eightBit = x * 255;
                return `rgba(${eightBit}, ${eightBit}, ${eightBit}, 1.0)`;
            };

            return `<svg width="${
                vectorElementWidth * 64
            }" height="${vectorElementHeight}">
                ${Array.from(normalizedControlPlaneVector)
                    .map(
                        (x, index) =>
                            `<rect 
                                x="${index * vectorElementWidth}" 
                                y="${0}" 
                                width="${vectorElementWidth}" 
                                height="${vectorElementHeight}"
                                fill="${valueToRgb(x)}"
                                stroke="black"
                            />`
                    )
                    .join('')}
            </svg>`;
        };

        shadow.innerHTML = `
            <style>

                dialog {
                    position: relative;
                    height: 90vh;
                    padding: 20px;
                }

                #video-container {
                    position: relative;
                }

                #canvas-element, 
                #video-element {
                    position: absolute;
                    top: 0;
                    left: 0;
                }

                

                video {
                    -webkit-transform: scaleX(-1);
                    transform: scaleX(-1);
                }

                #start {
                    position: absolute;
                    top: 500px;
                    left: 20px;
                }

                #close {
                    position: absolute;
                    top: 500px;
                    left: 200px;
                }

                ::backdrop {
                    background-color: #333;
                    opacity: 0.75;
                }

                
        </style>
        <dialog>
            <div class="instrument-container">
                    <div class="current-event-vector" title="Most recent control-plane input vector">
                        ${renderVector(zeros(64))}
                    </div>
                    <div id="video-container">
                        <video autoplay playsinline id="video-element"></video>
                        <canvas id="canvas-element" width="800" height="800"></canvas>
                    </div>
                    
            </div>
            <button id="start">Start Audio</button>
            <button id="close">Close</button>
        </dialog>
`;

        const dialog = shadow.querySelector('dialog') as HTMLDialogElement;
        dialog.showModal();

        const startButton = shadow.getElementById('start');
        startButton.addEventListener('click', () => {
            this.initialize();
        });

        const closeButton = shadow.getElementById('close');
        closeButton.addEventListener('click', async () => {
            this.setAttribute('open', 'false');

            await this.instrument.close();
            this.instrument = null;
            this.videoInitialized = false;
            this.instrumentInitialized = false;
            if (this.animationLoopHandle) {
                cancelAnimationFrame(this.animationLoopHandle);
            }
            this.animationLoopHandle = null;
        });

        const prepareForVideo = async () => {
            const landmarker = await createHandLandmarker();
            const canvas = shadow.querySelector('canvas') as HTMLCanvasElement;
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d');

            enableCam(shadow);

            const onTrigger = (vec: Float32Array) => {
                this.trigger(vec);
                const eventVectorContainer = shadow.querySelector(
                    '.current-event-vector'
                );
                eventVectorContainer.innerHTML = renderVector(vec);
            };

            const loop = predictWebcamLoop(
                shadow,
                landmarker,
                canvas,
                ctx,
                0.1, // norm threshold
                1.0, // norm max (to prevent overly loud sounds)
                this,
                onTrigger,
                (weights) => {
                    if (this.instrument) {
                        this.instrument.deform(weights);
                    }
                }
            );

            const video = shadow.querySelector('video');
            video.addEventListener('loadeddata', () => {
                this.animationLoopHandle = loop();
            });
        };

        if (!this.videoInitialized) {
            prepareForVideo();
            this.videoInitialized = true;
        }
    }

    private async trigger(vec: Float32Array) {
        await this.initialize();

        if (this.instrument === null) {
            return;
        }

        this.instrument.trigger(vec);
    }

    private async initialize() {
        if (this.instrumentInitialized) {
            return;
        }

        const context = new AudioContext({
            sampleRate: 22050,
        });

        this.context = context;

        this.instrument = await Instrument.fromURL(this.url, context, 2);

        this.hand = this.instrument.hand;
        this.deformation = DEFORMATION_PROJECTION_MATRIX;

        this.instrumentInitialized = true;
    }

    public connectedCallback() {
        this.render();
    }

    public static get observedAttributes(): (keyof ConvInstrument)[] {
        return ['url', 'open'];
    }

    public attributeChangedCallback(
        property: string,
        oldValue: string,
        newValue: string
    ) {
        if (newValue === oldValue) {
            return;
        }

        this[property] = newValue;
        this.render();
    }
}

window.customElements.define('conv-instrument', ConvInstrument);
