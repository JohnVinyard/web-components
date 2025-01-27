import { fromNpy } from './numpy';

interface RawRnnParams {
    in_projection: string;
    out_projection: string;
    rnn_in_projection: string;
    rnn_out_projection: string;
}

interface ArrayContainer {
    array: Float32Array;
    shape: any;
}

interface RnnParams {
    inProjection: ArrayContainer;
    outProjection: ArrayContainer;
    rnnInProjection: ArrayContainer;
    rnnOutProjection: ArrayContainer;
}

interface Point {
    x: number;
    y: number;
}

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

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    var binaryString = atob(base64);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

const fetchRnnWeights = async (url: string): Promise<RnnParams> => {
    const resp = await fetch(url);
    const data = await resp.json();
    const {
        in_projection,
        out_projection,
        rnn_in_projection,
        rnn_out_projection,
    } = data as RawRnnParams;

    const [inProjection, inProjectionShape] = fromNpy(
        base64ToArrayBuffer(in_projection)
    );

    const [outProjection, outProjectionShape] = fromNpy(
        base64ToArrayBuffer(out_projection)
    );

    const [rnnInProjection, rnnInProjectionShape] = fromNpy(
        base64ToArrayBuffer(rnn_in_projection)
    );

    const [rnnOutProjection, rnnOutProjectionShape] = fromNpy(
        base64ToArrayBuffer(rnn_out_projection)
    );

    return {
        inProjection: {
            array: inProjection as Float32Array,
            shape: inProjectionShape,
        },
        outProjection: {
            array: outProjection as Float32Array,
            shape: outProjectionShape,
        },
        rnnInProjection: {
            array: rnnInProjection as Float32Array,
            shape: rnnInProjectionShape,
        },
        rnnOutProjection: {
            array: rnnOutProjection as Float32Array,
            shape: rnnOutProjectionShape,
        },
    };
};

class Interval {
    public readonly range: number;

    constructor(public readonly start: number, public readonly end: number) {
        this.start = start;
        this.end = end;
        this.range = end - start;
    }

    toRatio(value: number): number {
        return (value - this.start) / this.range;
    }

    fromRatio(value: number): number {
        return this.start + value * this.range;
    }

    translateTo(value: number, otherInterval: Interval): number {
        const r = this.toRatio(value);
        const v = otherInterval.fromRatio(r);
        return v;
    }
}

const filterCutoff = new Interval(500, 22050);
const gamma = new Interval(-90, 90);
const vertical = new Interval(0, window.innerHeight);
const unitInterval = new Interval(0, 1);

export class Instrument extends HTMLElement {
    public url: string | null = null;

    constructor() {
        super();
        this.url = null;
    }

    private render() {
        let shadow: ShadowRoot | null = this.shadowRoot;

        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
        }

        shadow.innerHTML = `
<style>
        div {
            margin: 10px;
        }
        .instrument-container {
            height: 200px;
            cursor: crosshair;
            border: solid 1px #eee;
        }
</style>
<div class="instrument-container">
        <div>
            <button id="start-demo">Start Demo</button>
        </div>
</div>
`;

        const start = shadow.getElementById('start-demo');

        const container = shadow.getElementById('instrument-container');

        const context = new AudioContext({
            sampleRate: 22050,
        });

        // const fetchBinary = async (url: string): Promise<ArrayBuffer> => {
        //     const resp = await fetch(url);
        //     return resp.arrayBuffer();
        // };

        // const audioCache: Record<string, Promise<AudioBuffer>> = {};

        // const fetchAudio = async (url: string, context: AudioContext) => {
        //     const cached = audioCache[url];
        //     if (cached !== undefined) {
        //         return cached;
        //     }

        //     const audioBufferPromise = fetchBinary(url).then(function (
        //         data: ArrayBuffer
        //     ) {
        //         return new Promise<AudioBuffer>(function (resolve, reject) {
        //             context.decodeAudioData(
        //                 data,
        //                 (buffer) => resolve(buffer),
        //                 (error) => reject(error)
        //             );
        //         });
        //     });

        //     audioCache[url] = audioBufferPromise;

        //     return audioBufferPromise;
        // };

        const rnnWeightsUrl = this.url;

        // TODO: Here, we'd like to create a random projection from 2D click location
        // to control-plane space
        const clickProjectionFlat = new Float32Array(2 * 64).map(
            (x) => Math.random() * 2 - 1
        );

        const currentControlPlaneVector: Float32Array = new Float32Array(
            64
        ).fill(0);

        const currentControlPlaneMin = Math.min(...currentControlPlaneVector);
        const currentControlPlaneMax = Math.max(...currentControlPlaneVector);
        const currentControlPlaneSpan =
            currentControlPlaneMax - currentControlPlaneMin;

        const clickProjection = twoDimArray(clickProjectionFlat, [64, 2]);

        class ConvUnit {
            private initialized: boolean = false;
            private gain: GainNode | null = null;
            private filt: BiquadFilterNode | null = null;
            private instrument: AudioWorkletNode | null = null;

            constructor(public readonly url: string) {
                this.url = url;
            }

            public async triggerInstrument(arr: Float32Array, point: Point) {
                if (!this.initialized) {
                    await this.initialize();
                }

                if (this.instrument.port) {
                    this.instrument.port.postMessage(arr);
                }
            }

            async initialize() {
                this.initialized = true;

                try {
                    await context.audioWorklet.addModule(
                        '/build/components/rnn.js'
                    );
                } catch (err) {
                    console.log(`Failed to add module due to ${err}`);
                }

                const weights = await fetchRnnWeights(rnnWeightsUrl);

                const whiteNoise = new AudioWorkletNode(
                    context,
                    'rnn-instrument',
                    {
                        processorOptions: weights,
                    }
                );

                whiteNoise.connect(context.destination);

                this.instrument = whiteNoise;
            }

            updateCutoff(hz: number) {
                if (!this.filt) {
                    return;
                }

                this.filt.frequency.exponentialRampToValueAtTime(
                    hz,
                    context.currentTime + 0.05
                );
            }

            async trigger(amplitude: number) {
                if (!this.initialized) {
                    await this.initialize();
                }

                if (!this.gain) {
                    return;
                }

                this.gain.gain.exponentialRampToValueAtTime(
                    amplitude,
                    context.currentTime + 0.001
                );
                this.gain.gain.exponentialRampToValueAtTime(
                    0.000001,
                    context.currentTime + 0.2
                );
            }
        }

        const notes: Record<string, string> = {
            C: 'https://nsynth.s3.amazonaws.com/bass_electronic_018-036-100',
            E: 'https://nsynth.s3.amazonaws.com/bass_electronic_018-040-127',
            G: 'https://nsynth.s3.amazonaws.com/bass_electronic_018-043-100',
            B: 'https://nsynth.s3.amazonaws.com/bass_electronic_018-047-100',
        };

        class Controller {
            private readonly units: Record<string, ConvUnit>;

            constructor(urls: string[]) {
                this.units = urls.reduce((accum, url) => {
                    accum[url] = new ConvUnit(url);
                    return accum;
                }, {});
            }

            public triggerInstrument(arr: Float32Array, point: Point) {
                const key = notes['C'];
                const convUnit = this.units[key];
                console.log('INNER TRIGGER', key, convUnit);
                if (convUnit) {
                    convUnit.triggerInstrument(arr, point);
                }
            }

            updateCutoff(hz: number) {
                for (const key in this.units) {
                    const u = this.units[key];
                    u.updateCutoff(hz);
                }
            }

            async trigger(urls: string[], amplitude: number) {
                urls.forEach((url) => {
                    this.units[url].trigger(amplitude);
                });
            }
        }

        const activeNotes = new Set(['C']);

        const unit = new Controller(Object.values(notes));

        // const buttons = shadow.querySelectorAll('.big-button');
        // buttons.forEach((button) => {
        //     button.addEventListener('click', (event) => {
        //         const id = event.target.id;

        //         if (!id || id === '') {
        //             return;
        //         }

        //         console.log(activeNotes);
        //         if (activeNotes.has(id)) {
        //             activeNotes.delete(id);
        //             button.classList.remove('selected');
        //         } else {
        //             activeNotes.add(id);
        //             button.classList.add('selected');
        //         }
        //     });
        // });

        const useMouse = () => {
            container.addEventListener('click', (event: MouseEvent) => {
                // const arr = new Float32Array(64).map((x) =>
                //     Math.random() > 0.9 ? Math.random() * 2 : 0
                // );

                if (unit) {
                    const width = container.clientWidth;
                    const height = container.clientHeight;

                    // Get click coordinates in [0, 1]
                    const x: number = event.offsetX / width;
                    const y: number = event.offsetY / height;

                    // Project click location to control plane space
                    const point: Point = { x, y };
                    const pointArr = pointToArray(point);
                    const proj = dotProduct(pointArr, clickProjection);

                    console.log(proj);
                    currentControlPlaneVector.set(proj);

                    // TODO: I don't actually need to pass the point here, since
                    // the projection is the only thing that matters
                    unit.triggerInstrument(proj, { x, y });
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
                window.addEventListener(
                    'deviceorientationabsolute',
                    (event) => {
                        const u = gamma.translateTo(event.gamma, unitInterval);
                        const hz = unitInterval.translateTo(
                            u ** 4,
                            filterCutoff
                        );
                        unit.updateCutoff(hz);
                    }
                );

                window.addEventListener(
                    'devicemotion',
                    (event) => {
                        const threshold = 4;

                        // TODO: maybe this trigger condition should be the norm as well?
                        if (
                            Math.abs(event.acceleration.x) > threshold ||
                            Math.abs(event.acceleration.y) > threshold ||
                            Math.abs(event.acceleration.z) > threshold
                        ) {
                            const norm = Math.sqrt(
                                event.acceleration.x ** 2 +
                                    event.acceleration.y ** 2 +
                                    event.acceleration.z ** 2
                            );

                            unit.trigger(
                                Array.from(activeNotes).map((an) => notes[an]),
                                norm * 0.2
                            );
                        }
                    },
                    true
                );
            } else {
                console.log('Device motion not supported');
                alert('device motion not supported');
            }
        };

        start.addEventListener('click', async (event) => {
            // useAcc();
            useMouse();

            // TODO: How do I get to the button element here?
            // @ts-ignore
            event.target.disabled = true;
        });
    }

    public connectedCallback() {
        this.render();
    }

    public static get observedAttributes(): (keyof Instrument)[] {
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

window.customElements.define('instrument-element', Instrument);
