var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Sequencer, SynthType, } from './synth';
export class SamplerTest extends HTMLElement {
    constructor() {
        super();
        this.url = null;
        this.start = null;
        this.duration = null;
        this.conv = null;
    }
    render() {
        let shadow = this.shadowRoot;
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
        // const sampler = new Sampler(0.01);
        const sequencer = new Sequencer(0.01);
        const button = shadow.getElementById('play-sampler');
        button.addEventListener('click', () => __awaiter(this, void 0, void 0, function* () {
            const context = new AudioContext({});
            const params = {
                type: SynthType.Sampler,
                url: 'https://one-laptop-per-child.s3.amazonaws.com/tamtam44old/drum1kick.wav',
            };
            const seq = {
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
            const topLevel = {
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
            // const params: SamplerParams = {
            //     type: SynthType.Sampler,
            //     url: this.url ?? '',
            //     startSeconds: this.start ? parseFloat(this.start) : 0,
            //     durationSeconds: this.duration
            //         ? parseFloat(this.duration)
            //         : undefined,
            //     convolve: this.conv
            //         ? {
            //               url: this.conv,
            //               mix: 0.5,
            //           }
            //         : undefined,
            // };
            // console.log(params);
            // sampler.play(params, context, 0);
        }));
    }
    connectedCallback() {
        this.render();
    }
    static get observedAttributes() {
        return ['url', 'start', 'duration', 'conv'];
    }
    attributeChangedCallback(property, oldValue, newValue) {
        if (newValue === oldValue) {
            return;
        }
        this[property] = newValue;
        if (SamplerTest.observedAttributes.includes(property)) {
            this.render();
            return;
        }
    }
}
window.customElements.define('sampler-test', SamplerTest);
//# sourceMappingURL=samplertest.js.map