interface ForceInjectionEvent {
    force: Float32Array;
    location: Float32Array;
}

export class PhysicalStringSimulation extends HTMLElement {
    private initialized: boolean = false;
    private node: AudioWorkletNode | null = null;

    constructor() {
        super();
    }

    private render() {
        let shadow: ShadowRoot | null = this.shadowRoot;

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

        const initialize = async () => {
            if (this.initialized) {
                return;
            }

            const context = new AudioContext({
                sampleRate: 22050,
                latencyHint: 'interactive',
            });

            try {
                await context.audioWorklet.addModule(
                    // '/build/components/physical.js'
                    'https://cdn.jsdelivr.net/gh/JohnVinyard/web-components@0.0.63/build/components/physical.js'
                );
            } catch (err) {
                console.log(`Failed to add module due to ${err}`);
                alert(`Failed to load module due to ${err}`);
            }
            const physicalStringSim = new AudioWorkletNode(
                context,
                'physical-string-sim'
            );
            this.node = physicalStringSim;
            physicalStringSim.connect(context.destination);

            this.initialized = true;
        };

        const clickArea = shadow.getElementById(
            'click-area'
        ) as HTMLButtonElement;

        clickArea.addEventListener('click', async (event: MouseEvent) => {
            await initialize();

            const force: ForceInjectionEvent = {
                location: new Float32Array([0, Math.random()]),
                force: new Float32Array([0.1, 0.1]),
            };

            if (this.node?.port) {
                this.node.port.postMessage(force);
            }
        });
    }

    public connectedCallback() {
        this.render();
    }

    public static get observedAttributes(): (keyof PhysicalStringSimulation)[] {
        return [];
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

window.customElements.define('physical-string-sim', PhysicalStringSimulation);
