import { fromNpy } from './numpy';

interface RawRnnParams {
    in_projection: string;
    out_projection: string;
    rnn_in_projection: string;
    rnn_out_projection: string;
    control_plane_mapping: string;
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
    controlPlaneMapping: ArrayContainer;
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

const vectorVectorDot = (a: Float32Array, b: Float32Array): number => {
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
const dotProduct = (
    vector: Float32Array,
    matrix: Float32Array[]
): Float32Array => {
    return new Float32Array(matrix.map((v) => vectorVectorDot(v, vector)));
};

const relu = (vector: Float32Array): Float32Array => {
    return vector.map((x) => Math.max(0, x));
};

const oneHot = (vector: Float32Array): Float32Array => {
    const output = new Float32Array(vector.length).fill(0);

    const [mx, index] = vector.reduce(
        ([mx, idx]: [number, number], current, index) => {
            return current > mx ? [current, index] : [mx, idx];
        },
        [0, 0]
    );

    output[index] = vector[index];
    return output;
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
        control_plane_mapping,
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

    const [controlPlaneMapping, controlPlaneMappingShape] = fromNpy(
        base64ToArrayBuffer(control_plane_mapping)
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
        controlPlaneMapping: {
            array: controlPlaneMapping as Float32Array,
            shape: controlPlaneMappingShape,
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

        const currentControlPlaneVector: Float32Array = new Float32Array(
            64
        ).fill(Math.random() * 1e-3);

        const renderVector = (
            currentControlPlaneVector: Float32Array
        ): string => {
            const currentControlPlaneMin = Math.min(
                ...currentControlPlaneVector
            );
            const currentControlPlaneMax = Math.max(
                ...currentControlPlaneVector
            );
            const currentControlPlaneSpan =
                currentControlPlaneMax - currentControlPlaneMin;

            const normalizedControlPlaneVector: Float32Array =
                currentControlPlaneVector.map((x) => {
                    const shifted = x - currentControlPlaneMin;
                    const scaled = shifted / (currentControlPlaneSpan + 1e-8);
                    return scaled;
                });

            const vectorElementHeight: number = 10;
            const vectorElementWidth: number = 10;

            const valueToRgb = (x: number): string => {
                const eightBit = x * 255;
                return `rgba(${eightBit}, ${eightBit}, ${eightBit}, 1.0)`;
            };

            return `<svg width="${
                vectorElementWidth * 64
            }" height="${vectorElementHeight}">
                ${Array.from(normalizedControlPlaneVector)
                    .map(
                        (x, index) =>
                            `<rect 
                                x="${index * vectorElementWidth}" 
                                y="${0}" 
                                width="${vectorElementWidth}" 
                                height="${vectorElementHeight}"
                                fill="${valueToRgb(x)}"
                            />`
                    )
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
        const eventVectorContainer = shadow.querySelector(
            '.current-event-vector'
        );

        const context = new AudioContext({
            sampleRate: 22050,
        });

        const rnnWeightsUrl = this.url;

        // TODO: Here, we'd like to create a random projection from 2D click location
        // to control-plane space
        const scale = 10;
        const clickProjectionFlat = new Float32Array(2 * 64).map(
            (x) => Math.random() * scale - scale / 2
        );

        const clickProjection = twoDimArray(clickProjectionFlat, [64, 2]);

        class ConvUnit {
            private initialized: boolean = false;
            // private gain: GainNode | null = null;
            // private filt: BiquadFilterNode | null = null;
            private instrument: AudioWorkletNode | null = null;
            private weights: Float32Array[] | null = null;

            constructor(public readonly url: string) {
                this.url = url;
            }

            public async triggerInstrument(arr: Float32Array, point: Point) {
                if (!this.initialized) {
                    await this.initialize();
                }

                if (this.instrument?.port) {
                    this.instrument.port.postMessage(arr);
                }
            }

            public projectClick(clickPoint: Float32Array): Float32Array {
                const proj = dotProduct(clickPoint, this.weights);
                const sparse = relu(proj);
                return sparse;
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

                try {
                    const weights = await fetchRnnWeights(rnnWeightsUrl);
                    this.weights = twoDimArray(
                        weights.controlPlaneMapping.array,
                        [2, 64]
                    );

                    const whiteNoise = new AudioWorkletNode(
                        context,
                        'rnn-instrument',
                        {
                            processorOptions: weights,
                        }
                    );

                    whiteNoise.connect(context.destination);
                    this.instrument = whiteNoise;
                } catch (err) {
                    console.log('Failed to initialize instrument');
                }
            }

            // updateCutoff(hz: number) {
            //     if (!this.filt) {
            //         return;
            //     }

            //     this.filt.frequency.exponentialRampToValueAtTime(
            //         hz,
            //         context.currentTime + 0.05
            //     );
            // }

            // async trigger(amplitude: number) {
            //     if (!this.initialized) {
            //         await this.initialize();
            //     }

            //     if (!this.gain) {
            //         return;
            //     }

            //     this.gain.gain.exponentialRampToValueAtTime(
            //         amplitude,
            //         context.currentTime + 0.001
            //     );
            //     this.gain.gain.exponentialRampToValueAtTime(
            //         0.000001,
            //         context.currentTime + 0.2
            //     );
            // }
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

            public projectClick(point: Float32Array): Float32Array {
                const key = notes['C'];
                const convUnit = this.units[key];
                if (convUnit) {
                    convUnit.projectClick(point);
                }

                throw new Error('Missing weights');
            }

            public triggerInstrument(arr: Float32Array, point: Point) {
                const key = notes['C'];
                const convUnit = this.units[key];
                if (convUnit) {
                    convUnit.triggerInstrument(arr, point);
                }
            }

            // updateCutoff(hz: number) {
            //     for (const key in this.units) {
            //         const u = this.units[key];
            //         u.updateCutoff(hz);
            //     }
            // }

            // async trigger(urls: string[], amplitude: number) {
            //     urls.forEach((url) => {
            //         this.units[url].trigger(amplitude);
            //     });
            // }
        }

        // const activeNotes = new Set(['C']);

        const unit = new Controller(Object.values(notes));

        const useMouse = () => {
            container.addEventListener('click', (event: MouseEvent) => {
                if (unit) {
                    const width = container.clientWidth;
                    const height = container.clientHeight;

                    // // Get click coordinates in [0, 1]
                    const x: number = event.offsetX / width;
                    const y: number = event.offsetY / height;

                    // // Project click location to control plane space, followed by RELU
                    const point: Point = { x, y };
                    const pointArr = pointToArray(point);

                    const pos = unit.projectClick(pointArr);

                    // const proj = dotProduct(pointArr, clickProjection);
                    // const pos = relu(proj);

                    // const pos = new Float32Array(64).map((x) =>
                    //     Math.random() > 0.9 ? Math.random() * 2 : 0
                    // );

                    currentControlPlaneVector.set(pos);

                    eventVectorContainer.innerHTML = renderVector(
                        currentControlPlaneVector
                    );

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
                window.addEventListener(
                    'deviceorientationabsolute',
                    (event) => {
                        const u = gamma.translateTo(event.gamma, unitInterval);
                        const hz = unitInterval.translateTo(
                            u ** 4,
                            filterCutoff
                        );
                        // unit.updateCutoff(hz);
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

                            // unit.trigger(
                            //     Array.from(activeNotes).map((an) => notes[an]),
                            //     norm * 0.2
                            // );
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
            console.log('BEGINNING MONITORIING');

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
