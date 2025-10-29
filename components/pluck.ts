import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

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

// interface HasWeights {
//     hand: Float32Array[] | null;
// }

interface Point {
    x: number;
    y: number;
}

const predictWebcamLoop = (
    shadowRoot: ShadowRoot,
    handLandmarker: HandLandmarker,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    deltaThreshold: number,
    handlePosition: (p: Point) => void
): (() => void) => {
    const predictWebcam = () => {
        const video = shadowRoot.querySelector('video');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

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
                for (let i = 0; i < detections.landmarks.length; i++) {
                    const landmarks = detections.landmarks[i];
                    const wl = detections.worldLandmarks[i];

                    for (let j = 0; j < landmarks.length; j++) {
                        const landmark = landmarks[j];

                        // TODO: This determines whether we're using
                        // screen-space or world-space
                        const mappingVector = landmark;

                        // https://mediapipe.readthedocs.io/en/latest/solutions/hands.html#hand-landmark-model
                        if (j === 8) {
                            const pos: Point = {
                                x: mappingVector.x,
                                y: mappingVector.y,
                            };
                            handlePosition(pos);

                            const x = landmark.x * canvas.width;
                            const y = landmark.y * canvas.height;
                            ctx.beginPath();
                            ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
                            ctx.fillStyle = colorScheme[j];
                            ctx.fill();
                        }
                    }
                }
            }
            lastVideoTime = video.currentTime;
        }
        requestAnimationFrame(predictWebcam);
    };

    return predictWebcam;
};

interface ForceInjectionEvent {
    force: Float32Array;
    location: Float32Array;
    type: 'force-injection';
}

interface AdjustParameterEvent {
    value: number;
    name: 'tension' | 'mass' | 'damping' | 'model-type';
    type: 'adjust-parameter';
}

type ModelType = 'string' | 'plate' | 'random' | 'multi-string';

interface ChangeModelTypeEvent {
    value: ModelType;
    type: 'model-type';
}

interface MassInfo {
    position: Float32Array;
}

interface SpringInfo {
    m1: Float32Array;
    m2: Float32Array;
}

interface MeshInfo {
    masses: MassInfo[];
    springs: SpringInfo[];
    struck: Float32Array | null;
}

const pointsEqual = (p1: Float32Array, p2: Float32Array): boolean => {
    return p1[0] == p2[0] && p1[1] == p2[1];
};

const distance = (a: Float32Array, b: Float32Array): number => {
    let distance = 0;
    for (let i = 0; i < a.length; i++) {
        distance += (a[i] - b[i]) ** 2;
    }
    return Math.sqrt(distance);
};

export class PluckStringSimulation extends HTMLElement {
    private initialized: boolean = false;
    private node: AudioWorkletNode | null = null;
    // private massPosition: Float32Array = new Float32Array(2);
    private videoInitialized: boolean = false;

    private mass: number = 1;
    private meshInfo: MeshInfo | null = null;

    constructor() {
        super();
    }

    private render() {
        let shadow: ShadowRoot | null = this.shadowRoot;

        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
        }

        shadow.innerHTML = `
        <style>
            body {
                overflow: hidden;
            }

            #video-container {
                position: relative;
            }

            #canvas-element, 
            #video-element {
                position: absolute;
                top: 0;
                left: 0;
                width: 800px;
                height: 800px;
            }

            video {
                -webkit-transform: scaleX(-1);
                transform: scaleX(-1);
            }

            #click-area {
                width: 800px;
                height: 800px;
                cursor: pointer;
                position: relative;
                border: solid 1px #000;
            }

            #intro {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
            
            label {
                color: #eee;
            }

            .control {
                margin-top: 15px;
                margin-left: 15vw;
                margin-right: 15vw;
                width: 60vw;
                font-size: 2em;
            }
            .control input, .control select {
                width: 100%;
            }

            select {
                font-size: 1.2em;
                padding: 5px;
            }
        </style>
        <div id="video-container">
            <video autoplay playsinline id="video-element"></video>
            <canvas id="canvas-element" width="800" height="800"></canvas>
        </div>
        <div id="click-area">
            <div id="intro">
                <h5>Click to Start</h5>
            </div>
        </div>
        <div class="control">
            <label for="model-type">Model Type</label>
            <select name="model-type" id="model-type" disabled>
                <option value="string" selected>String</option>
                <option value="plate">Plate</option>
                <option value="random">Random</option>
                <option value="multi-string">Multi-String</option>
            </select>
        </div>
        <div class="control">
            <label for="tension-slider">Tension</label>
            <input 
                type="range" 
                name="tension-slider" 
                id="tension-slider" 
                value="0.5"
                min="0.01"
                max="5"
                step="0.001"
            />
        </div>
        <div class="control">
            <label for="mass-slider">Mass</label>
            <input 
                type="range" 
                name="mass-slider" 
                id="mass-slider" 
                value="10"
                min="2"
                max="100"
                step="1"
            />
        </div>
        <div class="control">
            <label for="damping-slider">Resonance</label>
            <input 
                type="range" 
                name="damping-slider" 
                id="damping-slider" 
                value="0.9998"
                min="0.998"
                max="0.9999"
                step="0.0001"
            />
        </div>
        <div class="control">
            <label for="use-accelerometer">Use Accelerometer</label>
            <input 
                type="checkbox"
                id="use-accelerometer" 
                name="use-accelerometer" 
            />
        </div>
        `;

        const clickArea = shadow.getElementById(
            'click-area'
        ) as HTMLButtonElement;

        const collisionCheck = (
            xPos: number,
            yPos: number,
            frc: Float32Array | null = null
        ) => {

            const queryPos = new Float32Array([yPos, 1 - xPos]);

            if (this.meshInfo !== null) {
                const { masses } = this.meshInfo;
                let dist = Number.MAX_SAFE_INTEGER;

                for (const mass of masses) {
                    const d = distance(mass.position, queryPos);
                    if (d < dist) {
                        dist = d;
                    }
                }

                if (dist < 0.02) {
                    injectForce(yPos, 1 - xPos, 1, frc);
                }
            }
        };

        const initialize = async () => {
            if (this.initialized) {
                return;
            }

            const prepareForVideo = async () => {
                const landmarker = await createHandLandmarker();
                const canvas = shadow.querySelector(
                    'canvas'
                ) as HTMLCanvasElement;
                const ctx: CanvasRenderingContext2D = canvas.getContext('2d');

                enableCam(shadow);

                const loop = predictWebcamLoop(
                    shadow,
                    landmarker,
                    canvas,
                    ctx,
                    0.25,
                    (p) => {
                        collisionCheck(p.x, p.y);
                    }
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

            modelTypeSelect.disabled = false;

            const context = new AudioContext({
                sampleRate: 22050,
                latencyHint: 'interactive',
            });

            try {
                await context.audioWorklet.addModule(
                    'build/components/physical.js'
                );
            } catch (err) {
                console.log(`Failed to add module due to ${err}`);
                alert(`Failed to load module due to ${err}`);
            }
            const physicalStringSim = new AudioWorkletNode(
                context,
                'physical-string-sim'
            );
            this.node = physicalStringSim;
            physicalStringSim.connect(context.destination);

            this.node.port.onmessage = (event: MessageEvent<MeshInfo>) => {
                const { masses, springs, struck } = event.data;

                this.meshInfo = event.data;

                const elements = masses.map(
                    (m) => `<circle 
                            cx="${m.position[1]}" 
                            cy="${m.position[0]}" 
                            fill="${
                                event.data.struck &&
                                pointsEqual(struck, m.position)
                                    ? 'black'
                                    : '#55aa44'
                            }"
                            r="0.01"></circle>`
                );

                const lines = springs.map(
                    (s) => `
                        <line 
                            x1="${s.m1[1]}" 
                            x2="${s.m2[1]}" 

                            y1="${s.m1[0]}"
                            y2="${s.m2[0]}" 
                            stroke="#55aa44"
                            strokeWidth="0.001"
                            style="stroke-width: 0.001;"
                            ></line>
                        `
                );

                clickArea.innerHTML = `
                    <svg 
                        viewBox="0 0 1 1" 
                        width="800px" 
                        height="800px" 
                        style="background-color:transparent; pointer-events: none; border: solid 1px purple;"
                    >

                        ${elements}
                        ${lines}
                    </svg>
                `;
            };

            this.initialized = true;
        };

        const tensionSlider = shadow.getElementById(
            'tension-slider'
        ) as HTMLInputElement;
        tensionSlider.addEventListener('input', (event: Event) => {
            const target = event.target as HTMLInputElement;
            const newValue = parseFloat(target.value);
            if (this.node?.port) {
                const message: AdjustParameterEvent = {
                    value: newValue,
                    name: 'tension',
                    type: 'adjust-parameter',
                };
                this.node.port.postMessage(message);
            }
        });

        const massSlider = shadow.getElementById(
            'mass-slider'
        ) as HTMLInputElement;
        massSlider.addEventListener('input', (event: Event) => {
            const target = event.target as HTMLInputElement;
            const newValue = parseFloat(target.value);
            if (this.node?.port) {
                const message: AdjustParameterEvent = {
                    value: newValue,
                    name: 'mass',
                    type: 'adjust-parameter',
                };
                this.node.port.postMessage(message);
            }
        });

        const dampingSlider = shadow.getElementById(
            'damping-slider'
        ) as HTMLInputElement;
        dampingSlider.addEventListener('input', (event: Event) => {
            const target = event.target as HTMLInputElement;
            const newValue = parseFloat(target.value);
            if (this.node?.port) {
                const message: AdjustParameterEvent = {
                    value: newValue,
                    name: 'damping',
                    type: 'adjust-parameter',
                };
                this.node.port.postMessage(message);
            }
        });

        const modelTypeSelect = shadow.getElementById(
            'model-type'
        ) as HTMLInputElement;

        modelTypeSelect.addEventListener('change', (event: Event) => {
            const target = event.target as HTMLSelectElement;
            const newValue = target.value;

            if (this.node?.port) {
                const message: ChangeModelTypeEvent = {
                    type: 'model-type',
                    value: newValue as ModelType,
                };
                this.node.port.postMessage(message);
                if (
                    newValue === 'string' ||
                    newValue === 'random' ||
                    newValue === 'multi-string'
                ) {
                    massSlider.value = '10';
                    tensionSlider.value = '0.5';
                    dampingSlider.value = '0.9998';
                } else if (newValue === 'plate') {
                    massSlider.value = '20';
                    tensionSlider.value = '0.1';
                    dampingSlider.value = '0.9998';
                }
            }
        });

        const injectForce = (
            xPos: number,
            yPos: number,
            magnitude: number = 1,
            frce: Float32Array | null = null
        ) => {
            const currentModel = (modelTypeSelect as HTMLInputElement)
                .value as ModelType;

            let f: Float32Array =
                currentModel === 'plate' ||
                currentModel === 'random' ||
                currentModel === 'multi-string'
                    ? new Float32Array([
                          Math.random() * 0.5 * magnitude,
                          Math.random() * 0.5 * magnitude,
                      ])
                    : new Float32Array([
                          0.1 + Math.random() * 0.5 * magnitude,
                          0 * magnitude,
                      ]);
            if (frce) {
                f = frce;
            }

            const force: ForceInjectionEvent = {
                location:
                    currentModel === 'plate' ||
                    currentModel === 'random' ||
                    currentModel === 'multi-string'
                        ? new Float32Array([xPos, yPos])
                        : new Float32Array([0, yPos]),
                force: f,
                type: 'force-injection',
            };

            if (this.node?.port) {
                this.node.port.postMessage(force);
            }
        };

        clickArea.addEventListener('click', async (event: MouseEvent) => {
            await initialize();
            // const rect = clickArea.getBoundingClientRect();
            // const yPos = (event.pageX - rect.left) / rect.width;
            // const xPos = (event.pageY - rect.top) / rect.height;
            // injectForce(xPos, yPos);
        });

        // clickArea.addEventListener('mousemove', async (event: MouseEvent) => {
        //     // await initialize();
        //     const rect = clickArea.getBoundingClientRect();

        //     const yPos = (event.pageX - rect.left) / rect.width;
        //     const xPos = (event.pageY - rect.top) / rect.height;

        //     this.massPosition[0] = xPos;
        //     this.massPosition[1] = yPos;

        //     // TODO: This a quick/cheap proxy for calculating force, which
        //     // _should_ be based on acceleration
        //     const xDelta = (event.movementX - rect.left) / rect.width;
        //     const yDelta = (event.movementY - rect.top) / rect.height;
        //     const force: Float32Array = new Float32Array([
        //         yDelta * this.mass,
        //         xDelta * this.mass,
        //     ]);

        //     collisionCheck(xPos, yPos, force);
        // });
    }

    public connectedCallback() {
        this.render();
    }

    public static get observedAttributes(): (keyof PluckStringSimulation)[] {
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

window.customElements.define('pluck-string-sim', PluckStringSimulation);
