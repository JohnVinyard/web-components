import {
    Sampler,
    SamplerParams,
    Sequencer,
    SequencerParams,
    SynthType,
} from './synth';

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

    public render() {
        let shadow: ShadowRoot | null = this.shadowRoot;

        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
        }

        shadow.innerHTML = `
        <style>
            #play-sampler {
                cursor: pointer;
                height: 200px;
                border: solid 1px black;
                background-color: #eee;
            }
        </style>
        <div id="play-sampler">
        </div>`;

        // https://one-laptop-per-child.s3.amazonaws.com/tamtam44old/drum1kick.wav

        const sequencer = new Sequencer(0.01);

        const button = shadow.getElementById('play-sampler');
        button.addEventListener('click', async () => {
            const context = new AudioContext({});
            const params: SamplerParams = {
                type: SynthType.Sampler,
                url: 'https://one-laptop-per-child.s3.amazonaws.com/tamtam44old/drum1kick.wav',
            };

            const seq: SequencerParams = {
                type: SynthType.Sequencer,
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

            const topLevel: SequencerParams = {
                type: SynthType.Sequencer,
                events: [
                    {
                        timeSeconds: 0,
                        params: seq,
                        type: SynthType.Sequencer,
                    },
                    {
                        timeSeconds: 1,
                        params: seq,
                        type: SynthType.Sequencer,
                    },
                    {
                        timeSeconds: 2,
                        params: seq,
                        type: SynthType.Sequencer,
                    },
                    {
                        timeSeconds: 3,
                        params: seq,
                        type: SynthType.Sequencer,
                    },
                ],
            };

            sequencer.play(topLevel, context, 0);
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
