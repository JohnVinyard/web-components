import { AccessibleTypeArray, fromNpy } from './numpy';

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    var binaryString = atob(base64);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
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

class Instrument {
    private readonly gains: Float32Array;
    private readonly router: Float32Array[];
    private readonly resonances: Float32Array[];
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
                'https://cdn.jsdelivr.net/gh/JohnVinyard/web-components@0.0.80/build/components/tanh.js'
            );
        } catch (err) {
            console.log(`Failed to add module due to ${err}`);
            alert(`Failed to load module due to ${err}`);
        }

        try {
            await this.context.audioWorklet.addModule(
                'https://cdn.jsdelivr.net/gh/JohnVinyard/web-components@0.0.80/build/components/whitenoise.js'
            );
        } catch (err) {
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

        const gains: GainNode[] = [];
        for (let i = 0; i < this.controlPlaneDim; i++) {
            const g = this.context.createGain();
            g.gain.value = 0.0001;
            whiteNoise.connect(g);

            const resIndex = Math.floor(Math.random() * this.totalResonances);
            const res = this.resonances[resIndex];

            const c = this.context.createConvolver();
            const buffer = this.context.createBuffer(1, this.nSamples, 22050);
            buffer.getChannelData(0).set(res);
            c.buffer = buffer;
            
            g.connect(c);

            c.connect(this.context.destination);

            gains.push(g);
        }

        // for (let i = 0; i < this.nResonances; i++) {
        //     tanhGain.connect(this.context.destination, i);
        // }

        this.controlPlane = gains;
    }

    public trigger(input: Float32Array) {
        for (let i = 0; i < this.controlPlane.length; i++) {
            const gain = this.controlPlane[i];

            gain.gain.exponentialRampToValueAtTime(
                input[i],
                this.context.currentTime + 0.02
            );
            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                this.context.currentTime + 0.5
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
            out[i] = 10;
        }
    }
    return out;
};

export class ConvInstrument extends HTMLElement {
    private instrument: Instrument | null = null;
    private context: AudioContext | null = null;
    private initialized: boolean = false;

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

    private async trigger() {
        await this.initialize();

        if (this.instrument === null) {
            return;
        }

        const cp = uniform(
            0.001,
            1.5,
            new Float32Array(this.instrument.controlPlaneDim)
        );
        this.instrument.trigger(cp);
    }

    private async initialize() {
        if (this.initialized) {
            return;
        }

        const context = new AudioContext({
            sampleRate: 22050,
        });

        this.context = context;

        this.instrument = await Instrument.fromURL(
            'https://resonancemodel.s3.amazonaws.com/resonancemodelparams_6cb84da73946adfec8173ba6d9935143705c0fdd',
            context,
            2
        );

        this.initialized = true;
    }

    public connectedCallback() {
        this.render();
    }

    public static get observedAttributes(): (keyof ConvInstrument)[] {
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

window.customElements.define('conv-instrument', ConvInstrument);
