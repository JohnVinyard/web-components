var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { fromNpy } from './numpy';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
const elementwiseDifference = (a, b, out) => {
    for (let i = 0; i < a.length; i++) {
        out[i] = a[i] - b[i];
    }
    return out;
};
const twoDimArray = (data, shape) => {
    const [x, y] = shape;
    const output = [];
    for (let i = 0; i < data.length; i += y) {
        output.push(data.slice(i, i + y));
    }
    return output;
};
const zeros = (size) => {
    return new Float32Array(size).fill(0);
};
const zerosMatrix = (shape) => {
    const total = shape[0] * shape[1];
    const z = zeros(total);
    return twoDimArray(z, shape);
};
// const argMax = (vec: Float32Array): number => {
//     let index = 0;
//     let value = Number.MIN_VALUE;
//     for (let i = 0; i < vec.length; i++) {
//         if (vec[i] > value) {
//             index = i;
//             value = vec[i];
//         }
//     }
//     return index;
// };
// const oneHot = (vec: Float32Array): Float32Array => {
//     const mx = vec.map((x) => Math.abs(x));
//     const index = argMax(mx);
//     const sparse = zeros(vec.length).map((x, i) => {
//         if (index === i) {
//             return x;
//         }
//         return 0;
//     });
//     return sparse;
// };
const threshold = (vec, threshold) => {
    const output = zerosLike(vec);
    for (let i = 0; i < vec.length; i++) {
        if (vec[i] > threshold) {
            output[i] = vec[i];
        }
    }
    return output;
};
const vectorVectorDot = (a, b) => {
    return a.reduce((accum, current, index) => {
        return accum + current * b[index];
    }, 0);
};
const randomProjectionMatrix = (shape, uniformDistributionMin, uniformDistributionMax, probability = 0.97) => {
    const totalElements = shape[0] * shape[1];
    const span = uniformDistributionMax - uniformDistributionMin;
    const mid = span / 2;
    const rnd = zeros(totalElements).map((x) => {
        return Math.random() * span - mid;
    });
    return twoDimArray(rnd, shape);
};
const PROJECTION_MATRIX = randomProjectionMatrix([64, 21 * 3], -1, 1, 0.5);
// const elementwiseSum = (a: Float32Array, b: Float32Array): Float32Array => {
//     return a.map((value, index) => value + b[index]);
// };
const vectorScalarMultiply = (vec, scalar) => {
    for (let i = 0; i < vec.length; i++) {
        vec[i] = vec[i] * scalar;
    }
    return vec;
};
const vectorScalarExponent = (vec, scalar) => {
    for (let i = 0; i < vec.length; i++) {
        vec[i] = Math.pow(vec[i], scalar);
    }
    return vec;
};
const sum = (a) => {
    return a.reduce((accum, current) => {
        return accum + current;
    }, 0);
};
const l1Norm = (a) => {
    return sum(a.map(Math.abs));
};
const l2Norm = (vec) => {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) {
        norm += Math.pow(vec[i], 2);
    }
    return Math.sqrt(norm);
};
const zerosLike = (x) => {
    return new Float32Array(x.length).fill(0);
};
const createHandLandmarker = () => __awaiter(void 0, void 0, void 0, function* () {
    const vision = yield FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm');
    const handLandmarker = yield HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        },
        numHands: 1,
        runningMode: 'VIDEO',
    });
    return handLandmarker;
});
const enableCam = (shadowRoot
// video: HTMLVideoElement,
// predictWebcam: () => void
) => __awaiter(void 0, void 0, void 0, function* () {
    const stream = yield navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
    });
    const video = shadowRoot.querySelector('video');
    video.srcObject = stream;
    // video.addEventListener('loadeddata', () => {
    //     predictWebcam();
    // });
});
let lastVideoTime = 0;
let lastPosition = new Float32Array(21 * 3);
const colorScheme = [
    // Coral / Pink Tones
    'rgb(255, 99, 130)',
    'rgb(255, 143, 160)',
    'rgb(255, 181, 194)',
    // Warm Yellows / Oranges
    'rgb(255, 207, 64)',
    'rgb(255, 179, 71)',
    'rgb(255, 222, 130)',
    // Greens
    'rgb(72, 207, 173)',
    'rgb(112, 219, 182)',
    'rgb(186, 242, 203)',
    // Blues
    'rgb(64, 153, 255)',
    'rgb(108, 189, 255)',
    'rgb(179, 220, 255)',
    // Purples
    'rgb(149, 117, 205)',
    'rgb(178, 145, 220)',
    'rgb(210, 190, 245)',
    // Neutrals
    'rgb(240, 240, 240)',
    'rgb(200, 200, 200)',
    'rgb(160, 160, 160)',
    'rgb(100, 100, 100)',
    'rgb(33, 33, 33)',
    // Accent
    'rgb(255, 255, 255)', // White (highlight or background contrast)
];
const predictWebcamLoop = (shadowRoot, handLandmarker, canvas, ctx, deltaThreshold, unit, 
// projectionMatrix: Float32Array[],
inputTrigger) => {
    const predictWebcam = () => {
        const video = shadowRoot.querySelector('video');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const output = zerosLike(lastPosition);
        let startTimeMs = performance.now();
        if (lastVideoTime !== video.currentTime) {
            const detections = handLandmarker.detectForVideo(video, startTimeMs);
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
                const delta = elementwiseDifference(newPosition, lastPosition, output);
                const deltaNorm = l2Norm(delta);
                // TODO: threshold should be based on movement of individual points
                // rather than the norm of the delta
                if (deltaNorm > deltaThreshold) {
                    const matrix = unit.handTrackingWeights;
                    if (matrix) {
                        // project the position of all points to the rnn input
                        // dimensions
                        const rnnInput = dotProduct(delta, matrix);
                        // const scaled = vectorScalarMultiply(rnnInput, deltaNorm);
                        const sp = relu(rnnInput);
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
export const pointToArray = (point) => {
    return new Float32Array([point.x, point.y]);
};
export const tanh = (arr) => {
    return arr.map(Math.tanh);
};
export const tanh2d = (arr) => {
    return arr.map(tanh);
};
export const sin = (arr) => {
    return arr.map(Math.sin);
};
export const sin2d = (arr) => {
    return arr.map(sin);
};
// const elementwiseSum = (a: Float32Array, b: Float32Array): Float32Array => {
//     return a.map((value, index) => value + b[index]);
// };
// const multiply = (a: Float32Array, b: number): Float32Array => {
//     return a.map((value, index) => value * b);
// };
/**
 * e.g., if vetor is length 64, and matrix is (128, 64), we'll end up
 * with a new vector of length 128
 */
const dotProduct = (vector, matrix) => {
    return new Float32Array(matrix.map((v) => vectorVectorDot(v, vector)));
};
const relu = (vector) => {
    return vector.map((x) => Math.max(0, x));
};
const argMax = (vector) => {
    let index = 0;
    let mx = Number.MIN_VALUE;
    for (let i = 0; i < vector.length; i++) {
        if (vector[i] > mx) {
            mx = vector[i];
            index = i;
        }
    }
    return index;
};
const oneHot = (vector) => {
    const mx = argMax(vector);
    for (let i = 0; i < vector.length; i++) {
        if (i !== mx) {
            vector[i] = 0;
        }
    }
    return vector;
};
const base64ToArrayBuffer = (base64) => {
    var binaryString = atob(base64);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};
const fetchRnnWeights = (url) => __awaiter(void 0, void 0, void 0, function* () {
    const resp = yield fetch(url);
    const data = yield resp.json();
    const { in_projection, out_projection, rnn_in_projection, rnn_out_projection, control_plane_mapping, accelerometer_mapping, hand_tracking_mapping, } = data;
    const [inProjection, inProjectionShape] = fromNpy(base64ToArrayBuffer(in_projection));
    const [outProjection, outProjectionShape] = fromNpy(base64ToArrayBuffer(out_projection));
    const [rnnInProjection, rnnInProjectionShape] = fromNpy(base64ToArrayBuffer(rnn_in_projection));
    const [rnnOutProjection, rnnOutProjectionShape] = fromNpy(base64ToArrayBuffer(rnn_out_projection));
    const [controlPlaneMapping, controlPlaneMappingShape] = fromNpy(base64ToArrayBuffer(control_plane_mapping));
    const [accelerometerMapping, accelerometerMappingShape] = fromNpy(base64ToArrayBuffer(accelerometer_mapping));
    const [handTrackingMapping, handTrackingShape] = fromNpy(base64ToArrayBuffer(hand_tracking_mapping));
    return {
        inProjection: {
            array: inProjection,
            shape: inProjectionShape,
        },
        outProjection: {
            array: outProjection,
            shape: outProjectionShape,
        },
        rnnInProjection: {
            array: rnnInProjection,
            shape: rnnInProjectionShape,
        },
        rnnOutProjection: {
            array: rnnOutProjection,
            shape: rnnOutProjectionShape,
        },
        controlPlaneMapping: {
            array: controlPlaneMapping,
            shape: controlPlaneMappingShape,
        },
        accelerometerMapping: {
            array: accelerometerMapping,
            shape: accelerometerMappingShape,
        },
        handTrackingMapping: {
            array: handTrackingMapping,
            shape: handTrackingShape,
        },
    };
});
export class Instrument extends HTMLElement {
    constructor() {
        super();
        this.url = null;
        this.initialized = false;
        this.url = null;
        this.initialized = false;
    }
    render() {
        let shadow = this.shadowRoot;
        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
        }
        // const currentControlPlaneVector: Float32Array = new Float32Array(
        //     64
        // ).fill(Math.random() * 1e-3);
        const renderVector = (currentControlPlaneVector) => {
            const currentControlPlaneMin = Math.min(...currentControlPlaneVector);
            const currentControlPlaneMax = Math.max(...currentControlPlaneVector);
            const currentControlPlaneSpan = currentControlPlaneMax - currentControlPlaneMin;
            const normalizedControlPlaneVector = currentControlPlaneVector.map((x) => {
                const shifted = x - currentControlPlaneMin;
                const scaled = shifted / (currentControlPlaneSpan + 1e-8);
                return scaled;
            });
            const vectorElementHeight = 10;
            const vectorElementWidth = 10;
            const valueToRgb = (x) => {
                const eightBit = x * 255;
                return `rgba(${eightBit}, ${eightBit}, ${eightBit}, 1.0)`;
            };
            return `<svg width="${vectorElementWidth * 64}" height="${vectorElementHeight}">
                ${Array.from(normalizedControlPlaneVector)
                .map((x, index) => `<rect 
                                x="${index * vectorElementWidth}" 
                                y="${0}" 
                                width="${vectorElementWidth}" 
                                height="${vectorElementHeight}"
                                fill="${valueToRgb(x)}"
                                stroke="black"
                            />`)
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

        #video-container, 
        #canvas-element, 
        #video-element {
            width: 1000px;
            height: 700px;
        }

        video {
            -webkit-transform: scaleX(-1);
            transform: scaleX(-1);
        }
</style>
<div class="instrument-container">
        <div class="current-event-vector" title="Most recent control-plane input vector">
            ${renderVector(zeros(64))}
        </div>
        <div id="video-container">
            <video autoplay playsinline id="video-element"></video>
            <canvas id="canvas-element" height="1000" width="1000"></canvas>
        </div>
        
</div>
`;
        const container = shadow.querySelector('.instrument-container');
        class ConvUnit {
            constructor(url) {
                this.url = url;
                this.initialized = false;
                this.instrument = null;
                this.weights = null;
                this.handTrackingWeights = null;
                this.url = url;
                this.handTrackingWeights = zerosMatrix([64, 21]);
            }
            triggerInstrument(arr) {
                var _a;
                return __awaiter(this, void 0, void 0, function* () {
                    if (!this.initialized) {
                        yield this.initialize();
                    }
                    if ((_a = this.instrument) === null || _a === void 0 ? void 0 : _a.port) {
                        this.instrument.port.postMessage(arr);
                    }
                });
            }
            projectAcceleration(vec) {
                if (!this.weights) {
                    return zeros(64);
                }
                const proj = dotProduct(vec, this.accelerometerWeights);
                const sparse = relu(proj);
                return sparse;
            }
            projectClick(clickPoint) {
                if (!this.weights) {
                    return zeros(64);
                }
                const proj = dotProduct(clickPoint, this.weights);
                const sparse = relu(proj);
                return sparse;
            }
            shutdown() {
                return __awaiter(this, void 0, void 0, function* () {
                    this.instrument.disconnect();
                    this.initialized = false;
                });
            }
            initialize() {
                return __awaiter(this, void 0, void 0, function* () {
                    this.initialized = true;
                    const context = new AudioContext({
                        sampleRate: 22050,
                    });
                    const convNode = context.createConvolver();
                    convNode.buffer = yield fetch('https://matching-pursuit-reverbs.s3.amazonaws.com/Small Prehistoric Cave.wav')
                        .then((resp) => resp.arrayBuffer())
                        .then((x) => {
                        const audio = context.decodeAudioData(x);
                        return audio;
                    });
                    // convNode.
                    try {
                        yield context.audioWorklet.addModule(
                        // '/build/components/rnn.js'
                        'https://cdn.jsdelivr.net/gh/JohnVinyard/web-components@0.0.78/build/components/rnn.js');
                    }
                    catch (err) {
                        console.log(`Failed to add module due to ${err}`);
                        alert(`Failed to load module due to ${err}`);
                    }
                    try {
                        const weights = yield fetchRnnWeights(rnnWeightsUrl);
                        this.weights = twoDimArray(weights.controlPlaneMapping.array, [64, 2]);
                        this.accelerometerWeights = twoDimArray(weights.accelerometerMapping.array, [64, 3]);
                        this.handTrackingWeights = twoDimArray(weights.handTrackingMapping.array, [64, 21 * 3]);
                        // this.handTrackingWeights = PROJECTION_MATRIX;
                        const whiteNoise = new AudioWorkletNode(context, 'rnn-instrument', {
                            processorOptions: weights,
                        });
                        whiteNoise.connect(convNode);
                        // whiteNoise.connect(context.destination);
                        convNode.connect(context.destination);
                        this.instrument = whiteNoise;
                        console.log('INSTRUMENT INITIALIZED');
                    }
                    catch (err) {
                        console.log('Failed to initialize instrument');
                        alert(`Failed to initialize instrument due to ${err}`);
                    }
                    container.classList.add('initialized');
                });
            }
        }
        const notes = {
            C: 'https://nsynth.s3.amazonaws.com/bass_electronic_018-036-100',
        };
        class Controller {
            constructor(urls) {
                this.units = urls.reduce((accum, url) => {
                    accum[url] = new ConvUnit(url);
                    return accum;
                }, {});
            }
            initialize() {
                return __awaiter(this, void 0, void 0, function* () {
                    for (const key in this.units) {
                        yield this.units[key].initialize();
                    }
                });
            }
            get handTrackingWeights() {
                const key = notes['C'];
                const convUnit = this.units[key];
                return convUnit.handTrackingWeights;
            }
            projectAcceleration(vec) {
                const key = notes['C'];
                const convUnit = this.units[key];
                if (convUnit) {
                    return convUnit.projectAcceleration(vec);
                }
                return zeros(64);
            }
            projectClick(point) {
                const key = notes['C'];
                const convUnit = this.units[key];
                if (convUnit) {
                    return convUnit.projectClick(point);
                }
                return zeros(64);
            }
            triggerInstrument(arr) {
                const key = notes['C'];
                const convUnit = this.units[key];
                if (convUnit) {
                    convUnit.triggerInstrument(arr);
                }
            }
        }
        const unit = new Controller(Object.values(notes));
        const prepareForVideo = () => __awaiter(this, void 0, void 0, function* () {
            const landmarker = yield createHandLandmarker();
            const canvas = shadow.querySelector('canvas');
            const ctx = canvas.getContext('2d');
            enableCam(shadow);
            const onTrigger = (vec) => {
                unit.triggerInstrument(vec);
                const eventVectorContainer = shadow.querySelector('.current-event-vector');
                eventVectorContainer.innerHTML = renderVector(vec);
            };
            const loop = predictWebcamLoop(shadow, landmarker, canvas, ctx, 0.25, unit, onTrigger);
            const video = shadow.querySelector('video');
            video.addEventListener('loadeddata', () => {
                loop();
            });
        });
        if (!this.initialized) {
            prepareForVideo();
            this.initialized = true;
        }
        const rnnWeightsUrl = this.url;
    }
    connectedCallback() {
        this.render();
    }
    static get observedAttributes() {
        return ['url'];
    }
    attributeChangedCallback(property, oldValue, newValue) {
        if (newValue === oldValue) {
            return;
        }
        this[property] = newValue;
        this.render();
    }
}
window.customElements.define('instrument-element', Instrument);
//# sourceMappingURL=instrument.js.map