import { Sampler, SamplerParams, SynthType } from './synth';

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

        //

        const sampler = new Sampler(0.01);

        const button = shadow.getElementById('play-sampler');
        button.addEventListener('click', async () => {
            const context = new AudioContext({});

            const params: SamplerParams = {
                type: SynthType.Sampler,
                url: this.url ?? '',
                startSeconds: this.start ? parseFloat(this.start) : 0,
                durationSeconds: this.duration
                    ? parseFloat(this.duration)
                    : undefined,
                convolve: this.conv
                    ? {
                          url: this.conv,
                          mix: 0.5,
                      }
                    : undefined,
            };
            console.log(params);
            sampler.play(params, context);
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
