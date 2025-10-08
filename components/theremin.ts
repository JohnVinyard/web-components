import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// const elementwiseDifference = (
//     a: Float32Array,
//     b: Float32Array,
//     out: Float32Array
// ): Float32Array => {
//     for (let i = 0; i < a.length; i++) {
//         out[i] = a[i] - b[i];
//     }
//     return out;
// };

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

const zeros = (size: number): Float32Array => {
    return new Float32Array(size).fill(0);
};

// const zerosMatrix = (shape: [number, number]): Float32Array[] => {
//     const total = shape[0] * shape[1];
//     const z = zeros(total);
//     return twoDimArray(z, shape);
// };

const vectorVectorDot = (a: Float32Array, b: Float32Array): number => {
    return a.reduce((accum, current, index) => {
        return accum + current * b[index];
    }, 0);
};

// const sum = (a: Float32Array): number => {
//     return a.reduce((accum, current) => {
//         return accum + current;
//     }, 0);
// };

// const l2Norm = (vec: Float32Array): number => {
//     let norm = 0;
//     for (let i = 0; i < vec.length; i++) {
//         norm += vec[i] ** 2;
//     }
//     return Math.sqrt(norm);
// };

// const zerosLike = (x: Float32Array): Float32Array => {
//     return new Float32Array(x.length).fill(0);
// };

interface Point {
    x: number;
    y: number;
}

const meanPoint = (points: Point[]): Point => {
    const nItems = points.length;
    const output: Point = { x: 0, y: 0 };
    for (const point of points) {
        output.x += point.x / nItems;
        output.y += point.y / nItems;
    }
    return output;
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

// let lastPosition = new Float32Array(21 * 3);

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

const predictWebcamLoop = (
    shadowRoot: ShadowRoot,
    handLandmarker: HandLandmarker,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    newParams: (frequency: number, amplitude: number) => void
    // deltaThreshold: number,
    // inputTrigger: (vec: Float32Array) => void
): (() => void) => {
    const predictWebcam = () => {
        const video = shadowRoot.querySelector('video');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // const output = zerosLike(lastPosition);

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

            const points: Point[] = [];

            // Process and draw landmarks from 'detections'
            if (detections.landmarks) {
                // const newPosition = new Float32Array(21 * 3);

                for (let i = 0; i < detections.landmarks.length; i++) {
                    const landmarks = detections.landmarks[i];

                    // const pt: Point = { x: 0, y: 0};

                    for (let j = 0; j < landmarks.length; j++) {
                        const landmark = landmarks[j];

                        points.push({ x: landmark.x, y: landmark.y });

                        const x = landmark.x * canvas.width;
                        const y = landmark.y * canvas.height;

                        ctx.beginPath();
                        ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
                        ctx.fillStyle = colorScheme[j];
                        ctx.fill();
                    }
                }
            }

            const mean = meanPoint(points);
            newParams(mean.x, mean.y);
            lastVideoTime = video.currentTime;
        }
        requestAnimationFrame(predictWebcam);
    };

    return predictWebcam;
};

export const pointToArray = (point: Point): Float32Array => {
    return new Float32Array([point.x, point.y]);
};

export const tanh = (arr: Float32Array): Float32Array => {
    return arr.map(Math.tanh);
};

export const tanh2d = (arr: Float32Array[]): Float32Array[] => {
    return arr.map(tanh);
};

export const sin = (arr: Float32Array): Float32Array => {
    return arr.map(Math.sin);
};

export const sin2d = (arr: Float32Array[]): Float32Array[] => {
    return arr.map(sin);
};

/**
 * e.g., if vetor is length 64, and matrix is (128, 64), we'll end up
 * with a new vector of length 128
 */
// const dotProduct = (
//     vector: Float32Array,
//     matrix: Float32Array[]
// ): Float32Array => {
//     return new Float32Array(matrix.map((v) => vectorVectorDot(v, vector)));
// };

// const argMax = (vector: Float32Array): number => {
//     let index = 0;
//     let mx = Number.MIN_VALUE;
//     for (let i = 0; i < vector.length; i++) {
//         if (vector[i] > mx) {
//             mx = vector[i];
//             index = i;
//         }
//     }
//     return index;
// };

// const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
//     var binaryString = atob(base64);
//     var bytes = new Uint8Array(binaryString.length);
//     for (var i = 0; i < binaryString.length; i++) {
//         bytes[i] = binaryString.charCodeAt(i);
//     }
//     return bytes.buffer;
// };

class Interval {
    constructor(public readonly start: number, public readonly end: number) {
        if (end < start) {
            throw new Error(
                `end must be greater than start, but got [${start}-${end}]`
            );
        }
    }

    public static unit(): Interval {
        return new Interval(0, 1);
    }

    public get range(): number {
        return this.end - this.start;
    }

    public pointToPercentage(location: number) {
        const relative = location - this.start;
        return relative / this.range;
    }

    public percentageToPoint(percentage: number) {
        return this.start + percentage * this.range;
    }
}

interface LoudnessUnits {
    raw: number;
    relativePosition: number;
}

interface FrequencyUnits {
    hz: number;
    relativePosition: number;
}

class IntervalMapping<T> {
    constructor(private readonly intervals: Record<keyof T, Interval>) {}

    public map(
        location: number,
        from: keyof T,
        to: keyof T,
        percentageTransform: (n: number) => number = (x) => x
    ) {
        const fromInterval = this.intervals[from];
        const toInterval = this.intervals[to];

        const percentage = percentageTransform(
            fromInterval.pointToPercentage(location)
        );
        const newLocation = toInterval.percentageToPoint(percentage);
        return newLocation;
    }
}

const loudnessMapping = new IntervalMapping<LoudnessUnits>({
    raw: new Interval(0.0001, 2),
    relativePosition: new Interval(0, 1),
});

const frequencyMapping = new IntervalMapping<FrequencyUnits>({
    hz: new Interval(150, 1000),
    relativePosition: new Interval(0, 1),
});

export class ThereminInstrument extends HTMLElement {
    private initialized: boolean = false;
    private audioGraphStarted: boolean = false;

    private oscillator: OscillatorNode | null = null;
    private gain: GainNode | null = null;
    private context: AudioContext | null = null;

    constructor() {
        super();
        this.initialized = false;
        this.audioGraphStarted = false;
    }

    private async prepareAudioGraph() {
        if (this.audioGraphStarted) {
            return;
        }

        const context = new AudioContext({ sampleRate: 22050 });
        const osc = context.createOscillator();
        osc.type = 'sine';

        const gain = context.createGain();

        const conv = context.createConvolver();
        conv.normalize = true;
        conv.buffer = await fetch(
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Parking Garage.wav'
        )
            .then((resp) => resp.arrayBuffer())
            .then((x) => {
                const audio = context.decodeAudioData(x);
                return audio;
            });

        osc.connect(gain);
        gain.connect(conv);
        conv.connect(context.destination);

        this.oscillator = osc;
        this.gain = gain;
        this.context = context;

        osc.start();

        this.audioGraphStarted = true;
    }

    private render() {
        let shadow: ShadowRoot | null = this.shadowRoot;

        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
        }

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

        #start {
            position: absolute;
            top: 600px;
            left: 20px;
        }

        video {
            -webkit-transform: scaleX(-1);
            transform: scaleX(-1);
        }

        
</style>
<div class="instrument-container">
        <div id="video-container">
            <video autoplay playsinline id="video-element"></video>
            <canvas id="canvas-element" width="800" height="800"></canvas>
        </div>
        
</div>
<button id="start">Start</button>
`;

        const startButton = shadow.getElementById('start');
        startButton.addEventListener('click', () => {
            this.prepareAudioGraph();
        });

        const prepareForVideo = async () => {
            const landmarker = await createHandLandmarker();
            const canvas = shadow.querySelector('canvas') as HTMLCanvasElement;
            const ctx: CanvasRenderingContext2D = canvas.getContext('2d');

            enableCam(shadow);

            const loop = predictWebcamLoop(
                shadow,
                landmarker,
                canvas,
                ctx,
                (rawFrequency, rawAmplitude) => {
                    const freq = frequencyMapping.map(
                        rawFrequency,
                        'relativePosition',
                        'hz',
                        (x) => x ** 2
                    );
                    const amp = loudnessMapping.map(
                        rawAmplitude,
                        'relativePosition',
                        'raw',
                        (x) => x ** 2
                    );
                    if (this.oscillator) {
                        console.log('Setting freq to ', freq);
                        this.oscillator.frequency.exponentialRampToValueAtTime(
                            freq,
                            this.context.currentTime + 0.1
                        );
                    }

                    if (this.gain) {
                        console.log('seting gain to', amp);
                        this.gain.gain.exponentialRampToValueAtTime(
                            amp,
                            this.context.currentTime + 0.1
                        );
                    }
                }
            );

            const video = shadow.querySelector('video');
            video.addEventListener('loadeddata', () => {
                loop();
            });
        };

        if (!this.initialized) {
            prepareForVideo();
            this.initialized = true;
        }
    }

    public connectedCallback() {
        this.render();
    }

    public static get observedAttributes(): (keyof ThereminInstrument)[] {
        return [];
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

window.customElements.define('theremin-instrument', ThereminInstrument);
