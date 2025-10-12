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
const base64ToArrayBuffer = (base64) => {
    var binaryString = atob(base64);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
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
const fetchWeights = (url) => __awaiter(void 0, void 0, void 0, function* () {
    const resp = yield fetch(url);
    const data = yield resp.json();
    const { gains, router, resonances, hand } = data;
    return {
        gains: toContainer(gains),
        router: toContainer(router),
        resonances: toContainer(resonances),
        hand: toContainer(hand),
    };
});
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
    acceptConnection(node, channel) {
        node.connect(this.nodes[channel]);
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
        console.log(`Setting gains ${sm}`);
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            node.gain.value = sm[i];
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
const twoDimArray = (data, shape) => {
    const [x, y] = shape;
    const output = [];
    for (let i = 0; i < data.length; i += y) {
        output.push(data.slice(i, i + y));
    }
    return output;
};
class Instrument {
    constructor(context, params, expressivity) {
        this.context = context;
        this.params = params;
        this.expressivity = expressivity;
        this.gains = params.gains.array;
        this.router = twoDimArray(params.router.array, params.router.shape);
        this.resonances = twoDimArray(params.resonances.array, params.resonances.shape);
    }
    static fromURL(url, context, expressivity) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = yield fetchWeights(url);
            const instr = new Instrument(context, params, expressivity);
            yield instr.buildNetwork();
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
    buildNetwork() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.context.audioWorklet.addModule('https://cdn.jsdelivr.net/gh/JohnVinyard/web-components@0.0.80/build/components/tanh.js');
            }
            catch (err) {
                console.log(`Failed to add module due to ${err}`);
                alert(`Failed to load module due to ${err}`);
            }
            try {
                yield this.context.audioWorklet.addModule('https://cdn.jsdelivr.net/gh/JohnVinyard/web-components@0.0.80/build/components/whitenoise.js');
            }
            catch (err) {
                console.log(`Failed to add module due to ${err}`);
                alert(`Failed to load module due to ${err}`);
            }
            const whiteNoise = new AudioWorkletNode(this.context, 'white-noise');
            // const tanhGain = new AudioWorkletNode(this.context, 'tanh-gain', {
            //     processorOptions: {
            //         gains: this.gains,
            //     },
            //     numberOfInputs: this.nResonances,
            //     numberOfOutputs: this.nResonances,
            //     outputChannelCount: Array(this.nResonances).fill(1),
            //     channelCount: 1,
            //     channelCountMode: 'explicit',
            //     channelInterpretation: 'discrete',
            // });
            // Build the last leg;  resonances, each group of which is connected
            // to an outgoing mixer
            // const resonances: ConvolverNode[] = [];
            // const mixers: Mixer[] = [];
            // for (let i = 0; i < this.totalResonances; i += this.expressivity) {
            //     const m = Mixer.mixerWithNChannels(this.context, this.expressivity);
            //     m.oneHot(0);
            //     mixers.push(m);
            //     for (let j = 0; j < this.expressivity; j++) {
            //         const c = this.context.createConvolver();
            //         const buffer = this.context.createBuffer(
            //             1,
            //             this.nSamples,
            //             22050
            //         );
            //         buffer.getChannelData(0).set(this.resonances[i + j]);
            //         resonances.push(c);
            //         m.acceptConnection(c, j);
            //     }
            //     const currentChannel = i / this.expressivity;
            //     // m.connectTo(tanhGain, currentChannel);
            // }
            // this.mixers = mixers;
            const gains = [];
            for (let i = 0; i < this.controlPlaneDim; i++) {
                const g = this.context.createGain();
                g.gain.value = 0.0001;
                whiteNoise.connect(g);
                // const r = this.router[i];
                // for (let j = 0; j < this.nResonances; j++) {
                //     const z: GainNode = this.context.createGain();
                //     z.gain.value = r[j];
                //     g.connect(z);
                //     const startIndex: number = j * this.expressivity;
                //     const stopIndex = startIndex + this.expressivity;
                //     for (let k = startIndex; k < stopIndex; k += 1) {
                //         z.connect(resonances[k]);
                //     }
                // }
                g.connect(this.context.destination);
                gains.push(g);
            }
            // for (const mixer of this.mixers) {
            //     mixer.connectTo(this.context.destination);
            // }
            // for (let i = 0; i < this.nResonances; i++) {
            //     tanhGain.connect(this.context.destination, i);
            // }
            this.controlPlane = gains;
        });
    }
    trigger(input) {
        for (let i = 0; i < this.controlPlane.length; i++) {
            const gain = this.controlPlane[i];
            gain.gain.exponentialRampToValueAtTime(input[i], this.context.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + 0.5);
        }
    }
    deform(mixes) {
        for (let i = 0; i < this.totalResonances; i += this.expressivity) {
            const slice = mixes.slice(i, i + this.expressivity);
            this.mixers[i].adjust(slice);
        }
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
            out[i] = 10;
        }
    }
    return out;
};
export class ConvInstrument extends HTMLElement {
    constructor() {
        super();
        this.instrument = null;
        this.context = null;
        this.initialized = false;
    }
    render() {
        let shadow = this.shadowRoot;
        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
        }
        shadow.innerHTML = `
            <style>
                #target {
                    background-color: blue;
                    height: 200px;
                    width: 200px;
                    cursor: pointer;
                }
            </style>
            <div id="target"></div>
        `;
        const target = shadow.getElementById('target');
        target.addEventListener('click', () => {
            this.trigger();
        });
    }
    trigger() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initialize();
            if (this.instrument === null) {
                return;
            }
            const cp = uniform(0.001, 2, new Float32Array(this.instrument.controlPlaneDim));
            this.instrument.trigger(cp);
        });
    }
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.initialized) {
                return;
            }
            const context = new AudioContext({
                sampleRate: 22050,
            });
            this.context = context;
            this.instrument = yield Instrument.fromURL('https://resonancemodel.s3.amazonaws.com/resonancemodelparams_6cb84da73946adfec8173ba6d9935143705c0fdd', context, 2);
            this.initialized = true;
        });
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
window.customElements.define('conv-instrument', ConvInstrument);
//# sourceMappingURL=convinstrument.js.map