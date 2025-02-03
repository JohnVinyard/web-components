var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Sampler, SynthType } from './synth';
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
        //
        const sampler = new Sampler(0.01);
        const button = shadow.getElementById('play-sampler');
        button.addEventListener('click', () => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const context = new AudioContext({});
            const params = {
                type: SynthType.Sampler,
                url: (_a = this.url) !== null && _a !== void 0 ? _a : '',
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