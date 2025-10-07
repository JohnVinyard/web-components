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

class Mixer {
    constructor(private readonly nodes: GainNode[]) {}

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
}

export class ConvInstrument extends HTMLElement {
    private instrument: GainNode | null = null;
    private context: AudioContext | null = null;
    private initialized: boolean = false;
    private mixer: Mixer | null = null;

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
            <button id="adjust">Random Mix</button>
        `;

        const target = shadow.getElementById('target');
        target.addEventListener('click', () => {
            this.trigger();
        });

        const button = shadow.getElementById('adjust');
        button.addEventListener('click', () => {
            this.mixer.sparseGains();
        });
    }

    private async trigger() {
        await this.initialize();

        if (this.instrument === null) {
            return;
        }

        this.instrument.gain.exponentialRampToValueAtTime(
            5.0,
            this.context.currentTime + 0.02
        );
        this.instrument.gain.exponentialRampToValueAtTime(
            0.0001,
            this.context.currentTime + 0.5
        );
    }

    private async initialize() {
        if (this.initialized) {
            return;
        }

        const impulseResponses = [
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Five Columns Long.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Scala Milan Opera Hall.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Direct Cabinet N3.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Small Drum Room.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Deep Space.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Masonic Lodge.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Large Wide Echo Hall.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/St Nicolaes Church.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Right Glass Triangle.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Chateau de Logne, Outside.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Ruby Room.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Nice Drum Room.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Vocal Duo.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Conic Long Echo Hall.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Cement Blocks 1.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Narrow Bumpy Space.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Musikvereinsaal.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Bottle Hall.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Cement Blocks 2.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Direct Cabinet N2.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Highly Damped Large Room.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/In The Silo Revised.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/French 18th Century Salon.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Rays.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Greek 7 Echo Hall.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Small Prehistoric Cave.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Large Long Echo Hall.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Five Columns.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/On a Star.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Parking Garage.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Direct Cabinet N1.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Going Home.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Direct Cabinet N4.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Trig Room.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Block Inside.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Derlon Sanctuary.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Large Bottle Hall.wav',
            'https://matching-pursuit-reverbs.s3.amazonaws.com/In The Silo.wav',
        ];
        const context = new AudioContext({
            sampleRate: 22050,
        });

        this.context = context;

        const gain = context.createGain();

        try {
            await context.audioWorklet.addModule(
                'https://cdn.jsdelivr.net/gh/JohnVinyard/web-components@0.0.78/build/components/whitenoise.js'
            );
        } catch (err) {
            console.log(`Failed to add module due to ${err}`);
            alert(`Failed to load module due to ${err}`);
        }

        const whiteNoise = new AudioWorkletNode(context, 'white-noise');
        whiteNoise.connect(gain);
        // gain.connect(context.destination);
        this.instrument = gain;

        const gainNodes: GainNode[] = [];

        const convGain = 1 / impulseResponses.length;
        for (const ir of impulseResponses) {
            const conv = context.createConvolver();
            conv.normalize = true;

            conv.buffer = await fetch(ir)
                .then((resp) => resp.arrayBuffer())
                .then((x) => {
                    const audio = context.decodeAudioData(x);
                    return audio;
                });
            console.log(`Loaded ${ir}`);
            const g = context.createGain();
            gainNodes.push(g);
            g.gain.value = convGain;
            conv.connect(g);
            g.connect(context.destination);
            gain.connect(conv);
        }

        gain.gain.value = 0.0001;

        this.mixer = new Mixer(gainNodes);
        this.mixer.sparseGains();

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
