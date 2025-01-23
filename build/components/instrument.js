var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class Interval {
    constructor(start, end) {
        this.start = start;
        this.end = end;
        this.start = start;
        this.end = end;
        this.range = end - start;
    }
    toRatio(value) {
        return (value - this.start) / this.range;
    }
    fromRatio(value) {
        return this.start + value * this.range;
    }
    translateTo(value, otherInterval) {
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
    constructor() {
        super();
    }
    render() {
        let shadow = this.shadowRoot;
        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
        }
        shadow.innerHTML = `
<style>
        div {
            margin: 10px;
        }

      .big-button {
        width: 95vw;
        height: 20vh;
        margin: 0.1em;
        padding: 0.1em;
        font-size: 2em;
        font-weight: bold;
        text-align: center;
        cursor: pointer;
     }

      .note-name {
        vertical-align: middle;
      }

      .selected {
        background-color: #eee;
      }
</style>
<div>
        <div>
      <button id="start-demo">Start Demo</button>
    </div>

    <div class="big-button selected" id="C">
      <span class="note-name">C</span>
    </div>
    <div class="big-button" id="E"><span class="note-name">E</span></div>
    <div class="big-button" id="G"><span class="note-name">G</span></div>
    <div class="big-button" id="B"><span class="note-name">B</span></div>
</div>
`;
        const start = shadow.getElementById('start-demo');
        const context = new AudioContext();
        const fetchBinary = (url) => __awaiter(this, void 0, void 0, function* () {
            const resp = yield fetch(url);
            return resp.arrayBuffer();
        });
        const audioCache = {};
        const fetchAudio = (url, context) => __awaiter(this, void 0, void 0, function* () {
            const cached = audioCache[url];
            if (cached !== undefined) {
                return cached;
            }
            const audioBufferPromise = fetchBinary(url).then(function (data) {
                return new Promise(function (resolve, reject) {
                    context.decodeAudioData(data, (buffer) => resolve(buffer), (error) => reject(error));
                });
            });
            audioCache[url] = audioBufferPromise;
            return audioBufferPromise;
        });
        class ConvUnit {
            constructor(url) {
                this.url = url;
                this.initialized = false;
                this.gain = null;
                this.filt = null;
                this.url = url;
            }
            initialize() {
                return __awaiter(this, void 0, void 0, function* () {
                    this.initialized = true;
                    yield context.audioWorklet.addModule('instrument.js');
                    const osc = context.createOscillator();
                    // const scriptNode = context.createScriptProcessor(512, 1, 1);
                    const whiteNoise = new AudioWorkletNode(context, 'white-noise');
                    const gainNode = context.createGain();
                    const conv = context.createConvolver();
                    const filter = context.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(500, context.currentTime);
                    conv.buffer = yield fetchAudio(this.url, context);
                    // scriptNode.addEventListener(
                    //     'audioprocess',
                    //     ({ inputBuffer, outputBuffer }) => {
                    //         const output = outputBuffer.getChannelData(0);
                    //         for (let i = 0; i < output.length; i++) {
                    //             output[i] = Math.random() * 2 - 1;
                    //         }
                    //     }
                    // );
                    osc.connect(whiteNoise);
                    whiteNoise.connect(gainNode);
                    gainNode.connect(conv);
                    conv.connect(filter);
                    filter.connect(context.destination);
                    osc.start();
                    this.gain = gainNode;
                    this.filt = filter;
                });
            }
            updateCutoff(hz) {
                this.filt.frequency.exponentialRampToValueAtTime(hz, context.currentTime + 0.05);
            }
            trigger(amplitude) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (!this.initialized) {
                        console.log('Initializing');
                        yield this.initialize();
                    }
                    this.gain.gain.exponentialRampToValueAtTime(amplitude, context.currentTime + 0.001);
                    this.gain.gain.exponentialRampToValueAtTime(0.000001, context.currentTime + 0.2);
                });
            }
        }
        class Controller {
            constructor(urls) {
                this.units = urls.reduce((accum, url) => {
                    accum[url] = new ConvUnit(url);
                    return accum;
                }, {});
            }
            updateCutoff(hz) {
                for (const key in this.units) {
                    const u = this.units[key];
                    u.updateCutoff(hz);
                }
            }
            trigger(urls, amplitude) {
                return __awaiter(this, void 0, void 0, function* () {
                    urls.forEach((url) => {
                        this.units[url].trigger(amplitude);
                    });
                });
            }
        }
        const activeNotes = new Set(['C']);
        const notes = {
            C: 'https://nsynth.s3.amazonaws.com/bass_electronic_018-036-100',
            E: 'https://nsynth.s3.amazonaws.com/bass_electronic_018-040-127',
            G: 'https://nsynth.s3.amazonaws.com/bass_electronic_018-043-100',
            B: 'https://nsynth.s3.amazonaws.com/bass_electronic_018-047-100',
        };
        const unit = new Controller(Object.values(notes));
        const buttons = document.querySelectorAll('.big-button');
        buttons.forEach((button) => {
            button.addEventListener('click', (event) => {
                const id = event.target.id;
                console.log(activeNotes);
                if (activeNotes.has(id)) {
                    activeNotes.delete(id);
                    button.classList.remove('selected');
                }
                else {
                    activeNotes.add(id);
                    button.classList.add('selected');
                }
            });
        });
        const useMouse = () => {
            document.addEventListener('mousemove', ({ movementX, movementY, clientX, clientY }) => {
                if (Math.abs(movementX) > 10 || Math.abs(movementY) > 10) {
                    // unit.trigger(1);
                    unit.trigger(Array.from(activeNotes).map((an) => notes[an]), 1);
                }
                const u = vertical.translateTo(clientY, unitInterval);
                const hz = unitInterval.translateTo(Math.pow(u, 2), filterCutoff);
                unit.updateCutoff(hz);
            });
        };
        const useAcc = () => {
            if (DeviceMotionEvent) {
                // if (typeof DeviceMotionEvent.requestPermission === 'function') {
                //     DeviceMotionEvent.requestPermission();
                // }
                window.addEventListener('deviceorientationabsolute', (event) => {
                    const u = gamma.translateTo(event.gamma, unitInterval);
                    const hz = unitInterval.translateTo(Math.pow(u, 4), filterCutoff);
                    unit.updateCutoff(hz);
                });
                window.addEventListener('devicemotion', (event) => {
                    const threshold = 4;
                    // TODO: maybe this trigger condition should be the norm as well?
                    if (Math.abs(event.acceleration.x) > threshold ||
                        Math.abs(event.acceleration.y) > threshold ||
                        Math.abs(event.acceleration.z) > threshold) {
                        const norm = Math.sqrt(Math.pow(event.acceleration.x, 2) +
                            Math.pow(event.acceleration.y, 2) +
                            Math.pow(event.acceleration.z, 2));
                        unit.trigger(Array.from(activeNotes).map((an) => notes[an]), norm * 0.2);
                    }
                }, true);
            }
            else {
                console.log('Device motion not supported');
                alert('device motion not supported');
            }
        };
        start.addEventListener('click', (event) => __awaiter(this, void 0, void 0, function* () {
            useAcc();
            useMouse();
            // TODO: How do I get to the button element here?
            // @ts-ignore
            event.target.disabled = true;
        }));
    }
    connectedCallback() {
        this.render();
    }
    static get observedAttributes() {
        return [];
    }
    attributeChangedCallback(property, oldValue, newValue) {
        if (newValue === oldValue) {
            return;
        }
        this[property] = newValue;
        this.render();
    }
}
window.customElements.define('instrument-element', Instrument);
//# sourceMappingURL=instrument.js.map