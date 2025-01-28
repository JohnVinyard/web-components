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
// const elementwiseSum = (a: Float32Array, b: Float32Array): Float32Array => {
//     return a.map((value, index) => value + b[index]);
// };
// const sum = (a: Float32Array): number => {
//     return a.reduce((accum, current) => {
//         return accum + current;
//     }, 0);
// };
// const l1Norm = (a: Float32Array): number => {
//     return sum(a.map(Math.abs));
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
const oneHot = (vector) => {
    const output = new Float32Array(vector.length).fill(0);
    const [mx, index] = vector.reduce(([mx, idx], current, index) => {
        return current > mx ? [current, index] : [mx, idx];
    }, [0, 0]);
    output[index] = vector[index];
    return output;
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
    const { in_projection, out_projection, rnn_in_projection, rnn_out_projection, control_plane_mapping, } = data;
    const [inProjection, inProjectionShape] = fromNpy(base64ToArrayBuffer(in_projection));
    const [outProjection, outProjectionShape] = fromNpy(base64ToArrayBuffer(out_projection));
    const [rnnInProjection, rnnInProjectionShape] = fromNpy(base64ToArrayBuffer(rnn_in_projection));
    const [rnnOutProjection, rnnOutProjectionShape] = fromNpy(base64ToArrayBuffer(rnn_out_projection));
    const [controlPlaneMapping, controlPlaneMappingShape] = fromNpy(base64ToArrayBuffer(control_plane_mapping));
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
    };
});
class Interval {
    constructor(start, end) {
        this.start = start;
        this.end = end;
        this.start = start;
        this.end = end;
        this.range = end - start;
    }
    toRatio(value) {
        return (value - this.start) / this.range;
    }
    fromRatio(value) {
        return this.start + value * this.range;
    }
    translateTo(value, otherInterval) {
        const r = this.toRatio(value);
        const v = otherInterval.fromRatio(r);
        return v;
    }
}
const filterCutoff = new Interval(500, 22050);
const gamma = new Interval(-90, 90);
const unitInterval = new Interval(0, 1);
export class Instrument extends HTMLElement {
    constructor() {
        super();
        this.url = null;
        this.url = null;
    }
    render() {
        let shadow = this.shadowRoot;
        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
        }
        const currentControlPlaneVector = new Float32Array(64).fill(Math.random() * 1e-3);
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
                            />`)
                .join('')}
            </svg>`;
        };
        shadow.innerHTML = `
<style>
        div {
            margin: 10px;
        }
        .instrument-container {
            height: 200px;
            cursor: pointer;
            border: solid 1px #eee;
            position: relative;
        }
        .current-event-vector {
            position: absolute;
            top: 10px;
            left: 150px;
        }
</style>
<div class="instrument-container">
        <div>
            <button id="start-demo">Start Demo</button>
        </div>
        <p>
            2D click coordinates will be projected into control-plane space
        </p>
        <div class="current-event-vector" title="Most recent control-plane input vector">
            ${renderVector(currentControlPlaneVector)}
        </div>
</div>
`;
        const start = shadow.getElementById('start-demo');
        const container = shadow.querySelector('.instrument-container');
        const eventVectorContainer = shadow.querySelector('.current-event-vector');
        const context = new AudioContext({
            sampleRate: 22050,
        });
        const rnnWeightsUrl = this.url;
        // TODO: Here, we'd like to create a random projection from 2D click location
        // to control-plane space
        const scale = 10;
        const clickProjectionFlat = new Float32Array(2 * 64).map((x) => Math.random() * scale - scale / 2);
        const clickProjection = twoDimArray(clickProjectionFlat, [64, 2]);
        class ConvUnit {
            constructor(url) {
                this.url = url;
                this.initialized = false;
                // private gain: GainNode | null = null;
                // private filt: BiquadFilterNode | null = null;
                this.instrument = null;
                this.weights = null;
                this.url = url;
            }
            triggerInstrument(arr, point) {
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
            projectClick(clickPoint) {
                const proj = dotProduct(clickPoint, this.weights);
                const sparse = relu(proj);
                return sparse;
            }
            initialize() {
                return __awaiter(this, void 0, void 0, function* () {
                    this.initialized = true;
                    try {
                        yield context.audioWorklet.addModule('/build/components/rnn.js');
                    }
                    catch (err) {
                        console.log(`Failed to add module due to ${err}`);
                    }
                    try {
                        const weights = yield fetchRnnWeights(rnnWeightsUrl);
                        this.weights = twoDimArray(weights.controlPlaneMapping.array, [2, 64]);
                        const whiteNoise = new AudioWorkletNode(context, 'rnn-instrument', {
                            processorOptions: weights,
                        });
                        whiteNoise.connect(context.destination);
                        this.instrument = whiteNoise;
                    }
                    catch (err) {
                        console.log('Failed to initialize instrument');
                    }
                });
            }
        }
        const notes = {
            C: 'https://nsynth.s3.amazonaws.com/bass_electronic_018-036-100',
            E: 'https://nsynth.s3.amazonaws.com/bass_electronic_018-040-127',
            G: 'https://nsynth.s3.amazonaws.com/bass_electronic_018-043-100',
            B: 'https://nsynth.s3.amazonaws.com/bass_electronic_018-047-100',
        };
        class Controller {
            constructor(urls) {
                this.units = urls.reduce((accum, url) => {
                    accum[url] = new ConvUnit(url);
                    return accum;
                }, {});
            }
            projectClick(point) {
                const key = notes['C'];
                const convUnit = this.units[key];
                if (convUnit) {
                    convUnit.projectClick(point);
                }
                throw new Error('Missing weights');
            }
            triggerInstrument(arr, point) {
                const key = notes['C'];
                const convUnit = this.units[key];
                if (convUnit) {
                    convUnit.triggerInstrument(arr, point);
                }
            }
        }
        // const activeNotes = new Set(['C']);
        const unit = new Controller(Object.values(notes));
        const useMouse = () => {
            container.addEventListener('click', (event) => {
                if (unit) {
                    const width = container.clientWidth;
                    const height = container.clientHeight;
                    // // Get click coordinates in [0, 1]
                    const x = event.offsetX / width;
                    const y = event.offsetY / height;
                    // // Project click location to control plane space, followed by RELU
                    const point = { x, y };
                    const pointArr = pointToArray(point);
                    const pos = unit.projectClick(pointArr);
                    // const proj = dotProduct(pointArr, clickProjection);
                    // const pos = relu(proj);
                    // const pos = new Float32Array(64).map((x) =>
                    //     Math.random() > 0.9 ? Math.random() * 2 : 0
                    // );
                    currentControlPlaneVector.set(pos);
                    eventVectorContainer.innerHTML = renderVector(currentControlPlaneVector);
                    // TODO: I don't actually need to pass the point here, since
                    // the projection is the only thing that matters
                    unit.triggerInstrument(pos, { x, y });
                }
            });
            // document.addEventListener(
            //     'mousemove',
            //     ({ movementX, movementY, clientX, clientY }) => {
            //         if (Math.abs(movementX) > 10 || Math.abs(movementY) > 10) {
            //             unit.trigger(
            //                 Array.from(activeNotes).map((an) => notes[an]),
            //                 1
            //             );
            //         }
            //         const u = vertical.translateTo(clientY, unitInterval);
            //         const hz = unitInterval.translateTo(u ** 2, filterCutoff);
            //         unit.updateCutoff(hz);
            //     }
            // );
        };
        const useAcc = () => {
            if (DeviceMotionEvent) {
                window.addEventListener('deviceorientationabsolute', (event) => {
                    const u = gamma.translateTo(event.gamma, unitInterval);
                    const hz = unitInterval.translateTo(Math.pow(u, 4), filterCutoff);
                    // unit.updateCutoff(hz);
                });
                window.addEventListener('devicemotion', (event) => {
                    const threshold = 4;
                    // TODO: maybe this trigger condition should be the norm as well?
                    if (Math.abs(event.acceleration.x) > threshold ||
                        Math.abs(event.acceleration.y) > threshold ||
                        Math.abs(event.acceleration.z) > threshold) {
                        const norm = Math.sqrt(Math.pow(event.acceleration.x, 2) +
                            Math.pow(event.acceleration.y, 2) +
                            Math.pow(event.acceleration.z, 2));
                        // unit.trigger(
                        //     Array.from(activeNotes).map((an) => notes[an]),
                        //     norm * 0.2
                        // );
                    }
                }, true);
            }
            else {
                console.log('Device motion not supported');
                alert('device motion not supported');
            }
        };
        start.addEventListener('click', (event) => __awaiter(this, void 0, void 0, function* () {
            // useAcc();
            console.log('BEGINNING MONITORIING');
            useMouse();
            // TODO: How do I get to the button element here?
            // @ts-ignore
            event.target.disabled = true;
        }));
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