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
const base64ToArrayBuffer = (base64) => {
    var binaryString = atob(base64);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};
const zeros = (size) => {
    return new Float32Array(size).fill(0);
};
const deserialize = (raw) => {
    return fromNpy(base64ToArrayBuffer(raw));
};
const toContainer = (raw) => {
    const [arr, shape] = deserialize(raw);
    return {
        array: arr,
        shape,
    };
};
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
const dotProduct = (vector, matrix) => {
    return new Float32Array(matrix.map((v) => vectorVectorDot(v, vector)));
};
const elementwiseDifference = (a, b, out) => {
    for (let i = 0; i < a.length; i++) {
        out[i] = a[i] - b[i];
    }
    return out;
};
const relu = (vector) => {
    return vector.map((x) => Math.max(0, x));
};
const fetchWeights = (url) => __awaiter(void 0, void 0, void 0, function* () {
    const resp = yield fetch(url);
    const data = yield resp.json();
    const { gains, router, resonances, hand, attacks, mix } = data;
    return {
        gains: toContainer(gains),
        router: toContainer(router),
        resonances: toContainer(resonances),
        hand: toContainer(hand),
        attacks: toContainer(attacks),
        mix: toContainer(mix),
    };
});
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
const vectorScalarMultiply = (vec, scalar) => {
    for (let i = 0; i < vec.length; i++) {
        vec[i] = vec[i] * scalar;
    }
    return vec;
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
const enableCam = (shadowRoot) => __awaiter(void 0, void 0, void 0, function* () {
    const stream = yield navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
    });
    const video = shadowRoot.querySelector('video');
    video.srcObject = stream;
});
let lastVideoTime = 0;
let lastPosition = new Float32Array(21 * 3);
const DEFORMATION_PROJECTION_MATRIX = randomProjectionMatrix([2, 21 * 3], -1, 1);
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
const predictWebcamLoop = (shadowRoot, handLandmarker, canvas, ctx, deltaThreshold, deltaMax, unit, inputTrigger, defUpdate) => {
    const predictWebcam = () => {
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
            const detections = handLandmarker.detectForVideo(video, startTimeMs);
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
                const delta = elementwiseDifference(newPosition, lastPosition, output);
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
                        const scaled = vectorScalarMultiply(rnnInput, 30);
                        const sp = relu(scaled);
                        inputTrigger(sp);
                    }
                }
                if (unit.deformation) {
                    // always trigger a deformation
                    // const defInput = dotProduct(delta, unit.deformation);
                    // defUpdate(defInput);
                    defUpdate(new Float32Array([
                        Math.abs(0.5 - Math.abs(zPos)) * 10,
                        Math.abs(0 - Math.abs(zPos)) * 10,
                    ]));
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
    constructor(nodes) {
        this.nodes = nodes;
    }
    static mixerWithNChannels(context, n) {
        const nodes = [];
        for (let i = 0; i < n; i++) {
            const g = context.createGain();
            g.gain.value = 0.0001;
            nodes.push(g);
        }
        return new Mixer(nodes);
    }
    connectTo(node, channel) {
        for (const gain of this.nodes) {
            gain.connect(node, undefined, channel);
        }
    }
    acceptConnection(node, mixerChannel, outgoingNodeChannel = undefined) {
        node.connect(this.nodes[mixerChannel], outgoingNodeChannel);
    }
    randomGains() {
        const vec = new Float32Array(this.nodes.length);
        const random = uniform(-1, 1, vec);
        this.adjust(random);
    }
    sparseGains() {
        const vec = new Float32Array(this.nodes.length);
        const random = sparse(0.05, vec);
        this.adjust(random);
    }
    adjust(gainValues) {
        const vec = new Float32Array(gainValues.length);
        const sm = softmax(gainValues, vec);
        for (let i = 0; i < this.nodes.length; i++) {
            try {
                const node = this.nodes[i];
                node.gain.value = sm[i];
            }
            catch (err) {
                console.log(`Failed to set gain with ${sm[i]}`);
            }
        }
    }
    oneHot(index) {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            if (i === index) {
                node.gain.value = 1;
            }
            else {
                node.gain.value = 0.0001;
            }
        }
    }
}
const truncate = (arr, threshold, count) => {
    let run = 0;
    for (let i = 0; i < arr.length; i++) {
        const value = Math.abs(arr[i]);
        if (value < threshold) {
            run += 1;
        }
        else {
            run = 0;
        }
        if (run >= count) {
            return arr.slice(0, i);
        }
    }
    return arr;
};
const CLOSE_COMMAND = { command: 'close' };
class Instrument {
    constructor(context, params, expressivity) {
        this.context = context;
        this.params = params;
        this.expressivity = expressivity;
        this.controlPlane = null;
        this.tanhGain = null;
        this.gains = params.gains.array;
        this.router = twoDimArray(params.router.array, params.router.shape);
        this.resonances = twoDimArray(params.resonances.array, params.resonances.shape);
        this.hand = twoDimArray(params.hand.array, params.hand.shape);
        this.attackContainer = params.attacks;
        this.attacks = twoDimArray(params.attacks.array, params.attacks.shape);
        this.mix = twoDimArray(params.mix.array, params.mix.shape);
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            this.tanhGain.port.postMessage(CLOSE_COMMAND);
            this.controlPlane.port.postMessage(CLOSE_COMMAND);
            this.tanhGain.disconnect();
            this.controlPlane.disconnect();
            this.context.close();
        });
    }
    static fromURL(url, context, expressivity) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = yield fetchWeights(url);
            const instr = new Instrument(context, params, expressivity);
            yield instr.buildAudioNetwork();
            return instr;
        });
    }
    get nSamples() {
        return this.resonances[0].length;
    }
    get controlPlaneDim() {
        return this.router.length;
    }
    get nResonances() {
        return this.resonances.length / this.expressivity;
    }
    get totalResonances() {
        return this.resonances.length;
    }
    buildAudioNetwork() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.context.audioWorklet.addModule('https://cdn.jsdelivr.net/gh/JohnVinyard/web-components@0.0.93/build/components/tanh.js');
            }
            catch (err) {
                console.log(`Failed to add module due to ${err}`);
                alert(`Failed to load module due to ${err}`);
            }
            try {
                yield this.context.audioWorklet.addModule('https://cdn.jsdelivr.net/gh/JohnVinyard/web-components@0.0.93/build/components/attackenvelopes.js');
            }
            catch (err) {
                console.log(`Failed to add module due to ${err}`);
                alert(`Failed to load module due to ${err}`);
            }
            const OUTPUT_NOISE_CHANNEL = 0;
            const OUTPUT_RESONANCE_CHANNEL = 1;
            if (this.controlPlaneDim !== this.nResonances) {
                throw new Error(`Currently cannot construct audio network when control plane dim and n resonances are not equal, they were ${this.controlPlaneDim} and ${this.nResonances}, respectively`);
            }
            const attackEnvelopes = new AudioWorkletNode(this.context, 'attack-envelopes', {
                processorOptions: {
                    attack: this.attackContainer,
                },
                numberOfOutputs: this.controlPlaneDim,
                outputChannelCount: Array(this.controlPlaneDim).fill(1),
                channelCount: 1,
                channelCountMode: 'explicit',
                channelInterpretation: 'discrete',
            });
            this.controlPlane = attackEnvelopes;
            // There is a noise/resonance mix for each channel
            const noiseResonanceMixers = [];
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
            // for (let i = 0; i < this.nResonances; i++) {
            //     tanhGain.connect(this.context.destination, i);
            // }
            // Build the last leg;  resonances, each group of which is connected
            // to an outgoing mixer
            const resonances = [];
            const expressivityMixers = [];
            for (let i = 0; i < this.totalResonances; i += this.expressivity) {
                const m = Mixer.mixerWithNChannels(this.context, this.expressivity);
                m.oneHot(0);
                expressivityMixers.push(m);
                const currentChannel = i / this.expressivity;
                for (let j = 0; j < this.expressivity; j++) {
                    const c = this.context.createConvolver();
                    // The default here is true, but we've already scaled
                    // the resonances the way we'd like them
                    c.normalize = false;
                    const buffer = this.context.createBuffer(1, this.nSamples, 22050);
                    const res = this.resonances[i + j];
                    const truncated = truncate(res, 1e-12, 32);
                    buffer.getChannelData(0).set(truncated);
                    c.buffer = buffer;
                    attackEnvelopes.connect(c, currentChannel);
                    resonances.push(c);
                    m.acceptConnection(c, j);
                }
                m.connectTo(tanhGain, currentChannel);
                // Connect the gain channel to the resonance side of the output mixer
                noiseResonanceMixers[currentChannel].acceptConnection(tanhGain, OUTPUT_RESONANCE_CHANNEL, currentChannel);
            }
            this.expressivityMixers = expressivityMixers;
        });
    }
    trigger(input) {
        this.controlPlane.port.postMessage(input);
    }
    deform(mix) {
        // The resonance mixes are tied across all channels/routes
        for (let i = 0; i < this.nResonances; i += 1) {
            this.expressivityMixers[i].adjust(mix);
        }
    }
    randomDeformation() {
        const values = uniform(-1, 1, zeros(this.totalResonances));
        this.deform(values);
    }
}
const exp = (vec, out) => {
    for (let i = 0; i < vec.length; i++) {
        out[i] = Math.exp(vec[i]);
    }
    return out;
};
const sum = (vec) => {
    let total = 0;
    for (let i = 0; i < vec.length; i++) {
        total += vec[i];
    }
    return total;
};
const divide = (vec, value, out) => {
    for (let i = 0; i < vec.length; i++) {
        out[i] = vec[i] / value;
    }
    return out;
};
const softmax = (vec, out) => {
    const e = exp(vec, out);
    const s = sum(e);
    return divide(e, s, e);
};
const uniform = (min, max, out) => {
    const range = max - min;
    for (let i = 0; i < out.length; i++) {
        out[i] = min + Math.random() * range;
    }
    return out;
};
const sparse = (probability, out) => {
    for (let i = 0; i < out.length; i++) {
        if (Math.random() < probability) {
            out[i] = 0.1;
        }
        else {
            out[i] = 0.0001;
        }
    }
    return out;
};
export class ConvInstrument extends HTMLElement {
    constructor() {
        super();
        this.url = null;
        this.instrument = null;
        this.context = null;
        this.videoInitialized = false;
        this.instrumentInitialized = false;
        this.animationLoopHandle = null;
        this.url = null;
        this.hand = null;
        this.open = 'false';
    }
    get isOpen() {
        return this.open === 'true';
    }
    render() {
        let shadow = this.shadowRoot;
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

                dialog {
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
        const dialog = shadow.querySelector('dialog');
        dialog.showModal();
        const startButton = shadow.getElementById('start');
        startButton.addEventListener('click', () => {
            this.initialize();
        });
        const closeButton = shadow.getElementById('close');
        closeButton.addEventListener('click', () => __awaiter(this, void 0, void 0, function* () {
            this.setAttribute('open', 'false');
            yield this.instrument.close();
            this.instrument = null;
            this.videoInitialized = false;
            this.instrumentInitialized = false;
            if (this.animationLoopHandle) {
                cancelAnimationFrame(this.animationLoopHandle);
            }
            this.animationLoopHandle = null;
        }));
        const prepareForVideo = () => __awaiter(this, void 0, void 0, function* () {
            const landmarker = yield createHandLandmarker();
            const canvas = shadow.querySelector('canvas');
            const ctx = canvas.getContext('2d');
            enableCam(shadow);
            const onTrigger = (vec) => {
                this.trigger(vec);
                const eventVectorContainer = shadow.querySelector('.current-event-vector');
                eventVectorContainer.innerHTML = renderVector(vec);
            };
            const loop = predictWebcamLoop(shadow, landmarker, canvas, ctx, 0.1, // norm threshold
            1.0, // norm max (to prevent overly loud sounds)
            this, onTrigger, (weights) => {
                if (this.instrument) {
                    this.instrument.deform(weights);
                }
            });
            const video = shadow.querySelector('video');
            video.addEventListener('loadeddata', () => {
                this.animationLoopHandle = loop();
            });
        });
        if (!this.videoInitialized) {
            prepareForVideo();
            this.videoInitialized = true;
        }
    }
    trigger(vec) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initialize();
            if (this.instrument === null) {
                return;
            }
            this.instrument.trigger(vec);
        });
    }
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.instrumentInitialized) {
                return;
            }
            const context = new AudioContext({
                sampleRate: 22050,
            });
            this.context = context;
            this.instrument = yield Instrument.fromURL(this.url, context, 2);
            this.hand = this.instrument.hand;
            this.deformation = DEFORMATION_PROJECTION_MATRIX;
            this.instrumentInitialized = true;
        });
    }
    connectedCallback() {
        this.render();
    }
    static get observedAttributes() {
        return ['url', 'open'];
    }
    attributeChangedCallback(property, oldValue, newValue) {
        if (newValue === oldValue) {
            return;
        }
        this[property] = newValue;
        this.render();
    }
}
window.customElements.define('conv-instrument', ConvInstrument);
//# sourceMappingURL=convinstrument.js.map