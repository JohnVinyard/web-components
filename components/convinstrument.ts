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
}

const fetchWeights = async (url: string): Promise<ConvInstrumentParams> => {
    const resp = await fetch(url);
    const data = await resp.json();

    const { gains, router, resonances, hand } = data as RawConvInstrumentParams;
    return {
        gains: toContainer(gains),
        router: toContainer(router),
        resonances: toContainer(resonances),
        hand: toContainer(hand),
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

const enableCam = async (
    shadowRoot: ShadowRoot
    // video: HTMLVideoElement,
    // predictWebcam: () => void
): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
    });

    const video = shadowRoot.querySelector('video');
    video.srcObject = stream;

    // video.addEventListener('loadeddata', () => {
    //     predictWebcam();
    // });
};

let lastVideoTime: number = 0;

let lastPosition = new Float32Array(21 * 3);

const PROJECTION_MATRIX = randomProjectionMatrix([16, 21 * 3], -0.5, 0.5, 0.5);

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
}

const predictWebcamLoop = (
    shadowRoot: ShadowRoot,
    handLandmarker: HandLandmarker,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    deltaThreshold: number,
    unit: HasWeights,
    // projectionMatrix: Float32Array[],
    inputTrigger: (vec: Float32Array) => void
): (() => void) => {
    const predictWebcam = () => {
        const video = shadowRoot.querySelector('video');

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
                let vecPos = 0;

                for (let i = 0; i < detections.landmarks.length; i++) {
                    const landmarks = detections.landmarks[i];
                    const wl = detections.worldLandmarks[i];

                    for (let j = 0; j < landmarks.length; j++) {
                        const landmark = landmarks[j];
                        const wll = wl[j];

                        // TODO: This determines whether we're using
                        // screen-space or world-space
                        const mappingVector = landmark;

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
                // TODO: threshold should be based on movement of individual points
                // rather than the norm of the delta
                if (deltaNorm > deltaThreshold) {
                    const matrix = unit.hand;
                    if (matrix) {
                        // project the position of all points to the rnn input
                        // dimensions
                        const rnnInput = dotProduct(delta, matrix);
                        // console.log(delta.length, rnnInput.length, matrix.length, matrix[0].length);
                        // console.log(rnnInput);
                        const scaled = vectorScalarMultiply(rnnInput, 10);
                        const sp = relu(scaled);

                        inputTrigger(sp);
                    }
                }

                lastPosition = newPosition;
            }
            lastVideoTime = video.currentTime;
        }
        requestAnimationFrame(predictWebcam);
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

    public acceptConnection(node: AudioNode, channel: number): void {
        node.connect(this.nodes[channel]);
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
        console.log(`Setting gains ${sm}`);
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            node.gain.value = sm[i];
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
            console.log(`Was ${arr.length} now ${i}, ${i / arr.length}`);
            return arr.slice(0, i);
        }
    }

    return arr;
};

// const computeStats = (arr: Float32Array): void => {
//     let mx = 0;
//     let mn = Number.MAX_VALUE;
//     let mean = 0;
//     let sparse = 0;

//     for (let i = 0; i < arr.length; i++) {
//         const value = Math.abs(arr[i]);

//         if (value > mx) {
//             mx = value;
//         }

//         if (value < mn) {
//             mn = value;
//         }

//         mean += value / arr.length;

//         if (value < 1e-6) {
//             sparse += 1;
//         }
//     }

//     console.log(mx, mn, mean, sparse / arr.length);

//     // console.log(`stats: ${Math.max(...arr)}, ${Math.min(...arr)}`);

//     // return count / arr.length;
// };

class Instrument {
    private readonly gains: Float32Array;
    private readonly router: Float32Array[];
    private readonly resonances: Float32Array[];
    public hand: Float32Array[];
    private controlPlane: GainNode[];
    private mixers: Mixer[];

    constructor(
        private readonly context: AudioContext,
        private readonly params: ConvInstrumentParams,
        public readonly expressivity: number
    ) {
        this.gains = params.gains.array;
        this.router = twoDimArray(params.router.array, params.router.shape);
        this.resonances = twoDimArray(
            params.resonances.array,
            params.resonances.shape
        );
        this.hand = twoDimArray(params.hand.array, params.hand.shape);
    }

    public static async fromURL(
        url: string,
        context: AudioContext,
        expressivity: number
    ): Promise<Instrument> {
        const params: ConvInstrumentParams = await fetchWeights(url);
        const instr = new Instrument(context, params, expressivity);
        await instr.buildNetwork();
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

    public async buildNetwork() {
        try {
            await this.context.audioWorklet.addModule(
                'https://cdn.jsdelivr.net/gh/JohnVinyard/web-components@0.0.81/build/components/tanh.js'
            );
        } catch (err) {
            console.log(`Failed to add module due to ${err}`);
            alert(`Failed to load module due to ${err}`);
        }

        try {
            await this.context.audioWorklet.addModule(
                'https://cdn.jsdelivr.net/gh/JohnVinyard/web-components@0.0.81/build/components/whitenoise.js'
            );
        } catch (err) {
            console.log(`Failed to add module due to ${err}`);
            alert(`Failed to load module due to ${err}`);
        }

        const whiteNoise = new AudioWorkletNode(this.context, 'white-noise');

        // TODO: This should probably have n inputs for total resonances
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
        const mixers: Mixer[] = [];

        for (let i = 0; i < this.totalResonances; i += this.expressivity) {
            const m = Mixer.mixerWithNChannels(this.context, this.expressivity);
            m.oneHot(0);
            mixers.push(m);

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

                resonances.push(c);
                m.acceptConnection(c, j);
            }

            const currentChannel = i / this.expressivity;
            // m.connectTo(this.context.destination);
            m.connectTo(tanhGain, currentChannel);
            tanhGain.connect(this.context.destination, currentChannel);
        }

        this.mixers = mixers;

        const gains: GainNode[] = [];
        for (let i = 0; i < this.controlPlaneDim; i++) {
            const g = this.context.createGain();
            g.gain.value = 0.0001;
            whiteNoise.connect(g);

            const r = this.router[i];

            for (let j = 0; j < this.nResonances; j++) {
                const z: GainNode = this.context.createGain();
                z.gain.value = r[j];
                g.connect(z);

                const startIndex: number = j * this.expressivity;
                const stopIndex = startIndex + this.expressivity;

                for (let k = startIndex; k < stopIndex; k += 1) {
                    z.connect(resonances[k]);
                }
            }

            gains.push(g);
        }

        this.controlPlane = gains;
    }

    public trigger(input: Float32Array) {
        for (let i = 0; i < this.controlPlane.length; i++) {
            const gain = this.controlPlane[i];

            gain.gain.linearRampToValueAtTime(
                input[i],
                this.context.currentTime + 0.02
            );
            gain.gain.linearRampToValueAtTime(
                0.0001,
                this.context.currentTime + 0.09
            );
        }
    }

    public deform(mixes: Float32Array) {
        for (let i = 0; i < this.totalResonances; i += this.expressivity) {
            const slice = mixes.slice(i, i + this.expressivity);
            this.mixers[i].adjust(slice);
        }
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

    constructor() {
        super();
        this.url = null;
        this.hand = null;
    }

    private render() {
        let shadow: ShadowRoot | null = this.shadowRoot;

        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
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

                
        </style>
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
`;

        const startButton = shadow.getElementById('start');
        startButton.addEventListener('click', () => {
            this.initialize();
        });

        // const container = shadow.querySelector('.instrument-container');
        // const eventVectorContainer = shadow.querySelector(
        //     '.current-event-vector'
        // );

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
                0.25,
                this,
                onTrigger
            );

            const video = shadow.querySelector('video');
            video.addEventListener('loadeddata', () => {
                loop();
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
        // this.hand = PROJECTION_MATRIX;

        this.instrumentInitialized = true;
    }

    public connectedCallback() {
        this.render();
    }

    public static get observedAttributes(): (keyof ConvInstrument)[] {
        return ['url'];
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
