import {
    MusicalEvent,
    SamplerParams,
    Sequencer,
    SequencerParams,
    SynthType,
    applyPatternTransform,
    emptyPattern,
} from './synth';

function audioBufferToBlob(audioBuffer: AudioBuffer, type: string): Blob {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const interleaved = new Float32Array(length * numberOfChannels);
    for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            interleaved[i * numberOfChannels + channel] = channelData[i];
        }
    }
    const dataView = encodeWAV(interleaved, numberOfChannels, sampleRate);
    const blob = new Blob([dataView], { type: type });
    return blob;
}

function encodeWAV(
    samples: Float32Array,
    channels: number,
    sampleRate: number
): DataView {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);
    floatTo16BitPCM(view, 44, samples);
    return view;
}

function floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

export class SamplerTest extends HTMLElement {
    public url: string | null;
    public start: string | null;
    public duration: string | null;
    public conv: string | null;

    constructor() {
        super();
        this.url = null;
        this.start = null;
        this.duration = null;
        this.conv = null;
    }

    public render(topLevel: SequencerParams = undefined) {
        let shadow: ShadowRoot | null = this.shadowRoot;

        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
        }

        shadow.innerHTML = `
        <style>
            #play-sampler {
                cursor: pointer;
                border: solid 1px black;
                background-color: #eee;
            }
        </style>
        <div id="play-sampler">
            <pre><code id="viz"></code></pre>
            <textarea id="code-pane">
            (x) => {
                return x;
            }
            </textarea>
        <button id="evaluate">Evaluate</button>
        
        </div>
        <button id="render">Render</button>
        <audio id="rendered-audio" src="" controls></audio>`;

        const sequencer = new Sequencer(0.01);

        const church =
            'https://matching-pursuit-reverbs.s3.amazonaws.com/St+Nicolaes+Church.wav';

        const drumRoom =
            'https://matching-pursuit-reverbs.s3.amazonaws.com/Nice+Drum+Room.wav';

        const params: SamplerParams = {
            type: SynthType.Sampler,
            url: 'https://one-laptop-per-child.s3.amazonaws.com/tamtam44old/drum1kick.wav',
            convolve: {
                url: drumRoom,
                mix: 0.5,
            },
        };

        const snare: SamplerParams = {
            type: SynthType.Sampler,
            url: 'https://one-laptop-per-child.s3.amazonaws.com/tamtam44old/drum1snare.wav',
            convolve: {
                url: drumRoom,
                mix: 0.5,
            },
        };

        const starting = emptyPattern();
        const fourOnTheFloor = applyPatternTransform(
            starting,
            (starting: SequencerParams): SequencerParams => {
                return {
                    type: starting.type,
                    speed: starting.speed,
                    events: [
                        {
                            timeSeconds: 0,
                            params,
                            type: SynthType.Sampler,
                        },
                        {
                            timeSeconds: 0.25,
                            params,
                            type: SynthType.Sampler,
                        },
                        {
                            timeSeconds: 0.5,
                            params,
                            type: SynthType.Sampler,
                        },
                        {
                            timeSeconds: 0.75,
                            params,
                            type: SynthType.Sampler,
                        },
                    ],
                };
            }
        );

        const withSnare = applyPatternTransform(
            fourOnTheFloor,
            (x: SequencerParams): SequencerParams => {
                return {
                    type: x.type,
                    speed: x.speed,
                    events: x.events.reduce((accum, current) => {
                        if (
                            current.timeSeconds === 0.25 ||
                            current.timeSeconds === 0.75
                        ) {
                            return [
                                ...accum,
                                current,
                                {
                                    type: SynthType.Sampler,
                                    timeSeconds: current.timeSeconds,
                                    params: snare,
                                },
                            ];
                        }
                        return [...accum, current];
                    }, []),
                };
            }
        );

        const repeatFourTimes = applyPatternTransform(
            withSnare,
            (x: SequencerParams): SequencerParams => {
                return {
                    type: SynthType.Sequencer,
                    speed: 1,
                    events: [0, 1, 2, 3].map((t) => {
                        const e: MusicalEvent = {
                            type: SynthType.Sequencer,
                            timeSeconds: t,
                            params: x,
                        };
                        return e;
                    }),
                };
            }
        );

        topLevel = repeatFourTimes;

        const viz = shadow.getElementById('viz');
        viz.innerHTML = JSON.stringify(topLevel, null, 4);

        const code = shadow.getElementById('code-pane') as HTMLTextAreaElement;
        const evaluate = shadow.getElementById('evaluate');

        evaluate.addEventListener('click', () => {
            const func = eval(code.value);
            topLevel = func(topLevel);
            this.render(topLevel);
        });

        const context = new AudioContext({
            sampleRate: 22050,
            latencyHint: 'interactive',
        });

        const button = shadow.getElementById('play-sampler');
        button.addEventListener('click', async () => {
            sequencer.play(topLevel, context, 0);
        });

        const audioElement = shadow.getElementById(
            'rendered-audio'
        ) as HTMLAudioElement;

        const renderButton = shadow.getElementById('render');
        renderButton.addEventListener('click', async () => {
            const offline = new OfflineAudioContext(1, 44100 * 20, 44100);

            await sequencer.play(topLevel, offline, 0);
            const result = await offline.startRendering();

            const blob = audioBufferToBlob(result, 'audio/wav');
            const url = URL.createObjectURL(blob);
            audioElement.src = url;
        });
    }

    public connectedCallback() {
        this.render();
    }

    public static get observedAttributes(): (keyof SamplerTest)[] {
        return ['url', 'start', 'duration', 'conv'];
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

        if (
            SamplerTest.observedAttributes.includes(
                property as keyof SamplerTest
            )
        ) {
            this.render();
            return;
        }
    }
}

window.customElements.define('sampler-test', SamplerTest);
