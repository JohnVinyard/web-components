var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
const meanPoint = (points) => {
    const nItems = points.length;
    const output = { x: 0, y: 0 };
    for (const point of points) {
        output.x += point.x / nItems;
        output.y += point.y / nItems;
    }
    return output;
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
const predictWebcamLoop = (shadowRoot, handLandmarker, canvas, ctx, newParams) => {
    const predictWebcam = () => {
        const video = shadowRoot.querySelector('video');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let startTimeMs = performance.now();
        if (lastVideoTime !== video.currentTime) {
            const detections = handLandmarker.detectForVideo(video, startTimeMs);
            // ctx is the plotting canvas' context
            // w is the width of the canvas
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            const points = [];
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
export const midiToHz = (n) => 440 * Math.pow(2, ((n - 69) / 12));
class Interval {
    constructor(start, end) {
        this.start = start;
        this.end = end;
        if (end < start) {
            throw new Error(`end must be greater than start, but got [${start}-${end}]`);
        }
    }
    static unit() {
        return new Interval(0, 1);
    }
    get range() {
        return this.end - this.start;
    }
    pointToPercentage(location) {
        const relative = location - this.start;
        return relative / this.range;
    }
    percentageToPoint(percentage) {
        return this.start + percentage * this.range;
    }
}
class IntervalMapping {
    constructor(intervals) {
        this.intervals = intervals;
    }
    map(location, from, to, percentageTransform = (x) => x) {
        const fromInterval = this.intervals[from];
        const toInterval = this.intervals[to];
        const percentage = percentageTransform(fromInterval.pointToPercentage(location));
        const newLocation = toInterval.percentageToPoint(percentage);
        return newLocation;
    }
}
const loudnessMapping = new IntervalMapping({
    raw: new Interval(0.0001, 1.1),
    relativePosition: new Interval(0, 1),
});
const frequencyMapping = new IntervalMapping({
    hz: new Interval(220, 1320),
    relativePosition: new Interval(0, 1),
});
export class ThereminInstrument extends HTMLElement {
    constructor() {
        super();
        this.initialized = false;
        this.audioGraphStarted = false;
        this.oscillator = null;
        this.gain = null;
        this.context = null;
        this.initialized = false;
        this.audioGraphStarted = false;
    }
    prepareAudioGraph() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.audioGraphStarted) {
                return;
            }
            const context = new AudioContext({ sampleRate: 22050 });
            const osc = context.createOscillator();
            osc.type = 'sine';
            const gain = context.createGain();
            const conv = context.createConvolver();
            conv.normalize = true;
            conv.buffer = yield fetch('https://matching-pursuit-reverbs.s3.amazonaws.com/Parking Garage.wav')
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
        });
    }
    render() {
        let shadow = this.shadowRoot;
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
        const prepareForVideo = () => __awaiter(this, void 0, void 0, function* () {
            const landmarker = yield createHandLandmarker();
            const canvas = shadow.querySelector('canvas');
            const ctx = canvas.getContext('2d');
            enableCam(shadow);
            const loop = predictWebcamLoop(shadow, landmarker, canvas, ctx, (rawFrequency, rawAmplitude) => {
                const freq = frequencyMapping.map(rawFrequency, 'relativePosition', 'hz');
                const amp = loudnessMapping.map(rawAmplitude, 'relativePosition', 'raw', (x) => Math.pow(x, 2));
                if (this.oscillator) {
                    this.oscillator.frequency.exponentialRampToValueAtTime(freq, this.context.currentTime + 0.05);
                }
                if (this.gain) {
                    this.gain.gain.exponentialRampToValueAtTime(amp, this.context.currentTime + 0.05);
                }
            });
            const video = shadow.querySelector('video');
            video.addEventListener('loadeddata', () => {
                loop();
            });
        });
        if (!this.initialized) {
            prepareForVideo();
            this.initialized = true;
        }
    }
    connectedCallback() {
        this.render();
    }
    static get observedAttributes() {
        return [];
    }
    attributeChangedCallback(property, oldValue, newValue) {
        if (newValue === oldValue) {
            return;
        }
        this[property] = newValue;
        this.render();
    }
}
window.customElements.define('theremin-instrument', ThereminInstrument);
//# sourceMappingURL=theremin.js.map