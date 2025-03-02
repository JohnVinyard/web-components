var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export class PhysicalStringSimulation extends HTMLElement {
    constructor() {
        super();
        this.initialized = false;
        this.node = null;
    }
    render() {
        let shadow = this.shadowRoot;
        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
        }
        shadow.innerHTML = `
        <style>
            #click-area {
                width: 600px;
                height: 200px;
                cursor: pointer;
                background-color: #e6bfdb;
            }
        </style>
        <div id="click-area">
        </div>
        `;
        const initialize = () => __awaiter(this, void 0, void 0, function* () {
            if (this.initialized) {
                return;
            }
            const context = new AudioContext({
                sampleRate: 22050,
                latencyHint: 'interactive',
            });
            try {
                yield context.audioWorklet.addModule(
                // '/build/components/physical.js'
                'https://cdn.jsdelivr.net/gh/JohnVinyard/web-components@0.0.61/build/components/physical.js');
            }
            catch (err) {
                console.log(`Failed to add module due to ${err}`);
                alert(`Failed to load module due to ${err}`);
            }
            const physicalStringSim = new AudioWorkletNode(context, 'physical-string-sim');
            this.node = physicalStringSim;
            physicalStringSim.connect(context.destination);
            this.initialized = true;
        });
        const clickArea = shadow.getElementById('click-area');
        clickArea.addEventListener('click', (event) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            yield initialize();
            const force = new Force(new Float32Array([0, Math.random()]), new Float32Array([0.1, 0.1]));
            if ((_a = this.node) === null || _a === void 0 ? void 0 : _a.port) {
                this.node.port.postMessage(force);
            }
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
window.customElements.define('physical-string-sim', PhysicalStringSimulation);
//# sourceMappingURL=string.js.map