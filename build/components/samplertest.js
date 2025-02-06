var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Sequencer, SynthType } from './synth';
function audioBufferToBlob(audioBuffer, type) {
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
function encodeWAV(samples, channels, sampleRate) {
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
    constructor() {
        super();
        this.url = null;
        this.start = null;
        this.duration = null;
        this.conv = null;
    }
    render(topLevel = undefined) {
        let shadow = this.shadowRoot;
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
        // https://one-laptop-per-child.s3.amazonaws.com/tamtam44old/drum1kick.wav
        const sequencer = new Sequencer(0.01);
        const params = {
            type: SynthType.Sampler,
            url: 'https://one-laptop-per-child.s3.amazonaws.com/tamtam44old/drum1kick.wav',
            convolve: {
                url: 'https://matching-pursuit-reverbs.s3.amazonaws.com/Nice+Drum+Room.wav',
                mix: 0.5,
            },
        };
        const snare = {
            type: SynthType.Sampler,
            url: 'https://one-laptop-per-child.s3.amazonaws.com/tamtam44old/drum1snare.wav',
            convolve: {
                url: 'https://matching-pursuit-reverbs.s3.amazonaws.com/Nice+Drum+Room.wav',
                mix: 0.5,
            },
        };
        const speed = 1;
        const seq = {
            type: SynthType.Sequencer,
            speed,
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
                    timeSeconds: 0.25,
                    params: snare,
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
                {
                    timeSeconds: 0.75,
                    params: snare,
                    type: SynthType.Sampler,
                },
            ],
        };
        if (!topLevel) {
            topLevel = {
                type: SynthType.Sequencer,
                speed,
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
        }
        const viz = shadow.getElementById('viz');
        viz.innerHTML = JSON.stringify(topLevel, null, 4);
        const code = shadow.getElementById('code-pane');
        const evaluate = shadow.getElementById('evaluate');
        evaluate.addEventListener('click', () => {
            const func = eval(code.value);
            topLevel = func(topLevel);
            this.render(topLevel);
        });
        const context = new AudioContext({});
        const button = shadow.getElementById('play-sampler');
        button.addEventListener('click', () => __awaiter(this, void 0, void 0, function* () {
            sequencer.play(topLevel, context, 0);
        }));
        const audioElement = shadow.getElementById('rendered-audio');
        const renderButton = shadow.getElementById('render');
        renderButton.addEventListener('click', () => __awaiter(this, void 0, void 0, function* () {
            const offline = new OfflineAudioContext(1, 44100 * 20, 44100);
            yield sequencer.play(topLevel, offline, 0);
            const result = yield offline.startRendering();
            const blob = audioBufferToBlob(result, 'audio/wav');
            const url = URL.createObjectURL(blob);
            audioElement.src = url;
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