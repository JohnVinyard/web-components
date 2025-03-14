interface ForceInjectionEvent {
    force: Float32Array;
    location: Float32Array;
    type: 'force-injection';
}

interface AdjustParameterEvent {
    value: number;
    name: 'tension' | 'mass' | 'damping' | 'model-type';
    type: 'adjust-parameter';
}

interface ChangeModelTypeEvent {
    value: 'string' | 'plate' | 'random';
    type: 'model-type';
}

interface MassInfo {
    position: Float32Array;
}

interface MeshInfo {
    masses: MassInfo[];
}

type CommunicationEvent =
    | ForceInjectionEvent
    | AdjustParameterEvent
    | ChangeModelTypeEvent;

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
            body {
                overflow: hidden;
            }

            #click-area {
                width: 100%;
                height: 50vh;
                cursor: pointer;
                background-color: #e6bfdb;
                position: relative;
                background: rgb(217,193,217);
                background: linear-gradient(0deg, rgba(217,193,217,1) 0%, rgba(233,219,233,1) 75%);
            }

            #intro {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
            
            label {
                color: #eee;
            }

            .control {
                margin-top: 15px;
                margin-left: 15vw;
                margin-right: 15vw;
                width: 60vw;
                font-size: 2em;
            }
            .control input, .control select {
                width: 100%;
            }

            select {
                font-size: 1.2em;
                padding: 5px;
            }
        </style>
        <div id="click-area">
            <div id="intro">
                <h5>Click to Start</h5>
            </div>
        </div>
        <div class="control">
            <label for="model-type">Model Type</label>
            <select name="model-type" id="model-type">
                <option value="string" selected>String</option>
                <option value="plate">Plate</option>
                <option value="random">Random</option>
            </select>
        </div>
        <div class="control">
            <label for="tension-slider">Tension</label>
            <input 
                type="range" 
                name="tension-slider" 
                id="tension-slider" 
                value="0.5"
                min="0.01"
                max="5"
                step="0.001"
            />
        </div>
        <div class="control">
            <label for="mass-slider">Mass</label>
            <input 
                type="range" 
                name="mass-slider" 
                id="mass-slider" 
                value="10"
                min="2"
                max="100"
                step="1"
            />
        </div>
        <div class="control">
            <label for="damping-slider">Resonance</label>
            <input 
                type="range" 
                name="damping-slider" 
                id="damping-slider" 
                value="0.9998"
                min="0.998"
                max="0.9999"
                step="0.0001"
            />
        </div>
        `;

        const clickArea = shadow.getElementById(
            'click-area'
        ) as HTMLButtonElement;

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
                    'build/components/physical.js'
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

            this.node.port.onmessage = (event: MessageEvent<MeshInfo>) => {
                const height = clickArea.offsetHeight;
                const middle = height / 2;

                const width = clickArea.offsetWidth;

                clickArea.innerHTML = event.data.masses
                    .map(
                        (m) =>
                            `<div 
                                style="
                                    top: ${height * m.position[0]}px; 
                                    left: ${width * m.position[1]}px; 
                                    width: 20px; 
                                    height: 20px; 
                                    background-color: #55aa44;
                                    position: absolute;
                                    border-radius: 10px;
                                    -webkit-box-shadow: 10px 10px 5px 0px rgba(0,0,0,0.25);
                                    -moz-box-shadow: 10px 10px 5px 0px rgba(0,0,0,0.25);
                                    box-shadow: 10px 10px 5px 0px rgba(0,0,0,0.25);
                                "
                                >
                                </div>`
                    )
                    .join('\n');
            };

            this.initialized = true;
        };

        const tensionSlider = shadow.getElementById(
            'tension-slider'
        ) as HTMLInputElement;
        tensionSlider.addEventListener('input', (event: Event) => {
            const target = event.target as HTMLInputElement;
            const newValue = parseFloat(target.value);
            if (this.node?.port) {
                const message: AdjustParameterEvent = {
                    value: newValue,
                    name: 'tension',
                    type: 'adjust-parameter',
                };
                this.node.port.postMessage(message);
            }
        });

        const massSlider = shadow.getElementById(
            'mass-slider'
        ) as HTMLInputElement;
        massSlider.addEventListener('input', (event: Event) => {
            const target = event.target as HTMLInputElement;
            const newValue = parseFloat(target.value);
            if (this.node?.port) {
                const message: AdjustParameterEvent = {
                    value: newValue,
                    name: 'mass',
                    type: 'adjust-parameter',
                };
                this.node.port.postMessage(message);
            }
        });

        const dampingSlider = shadow.getElementById(
            'damping-slider'
        ) as HTMLInputElement;
        dampingSlider.addEventListener('input', (event: Event) => {
            const target = event.target as HTMLInputElement;
            const newValue = parseFloat(target.value);
            if (this.node?.port) {
                const message: AdjustParameterEvent = {
                    value: newValue,
                    name: 'damping',
                    type: 'adjust-parameter',
                };
                this.node.port.postMessage(message);
            }
        });

        const modelTypeSelect = shadow.getElementById('model-type');
        modelTypeSelect.addEventListener('change', (event: Event) => {
            const target = event.target as HTMLSelectElement;
            const newValue = target.value;

            if (this.node?.port) {
                const message: ChangeModelTypeEvent = {
                    type: 'model-type',
                    value: newValue as 'string' | 'plate' | 'random',
                };
                this.node.port.postMessage(message);
                if (newValue === 'string' || newValue === 'random') {
                    massSlider.value = '10';
                    tensionSlider.value = '0.5';
                    dampingSlider.value = '0.9998';
                } else if (newValue === 'plate') {
                    massSlider.value = '20';
                    tensionSlider.value = '0.1';
                    dampingSlider.value = '0.9998';
                }
            }
        });

        clickArea.addEventListener('click', async (event: MouseEvent) => {
            await initialize();

            const clickedElement = event.target as HTMLDivElement;

            const xPos = event.clientX / clickedElement.offsetWidth;
            const yPos = event.clientY / clickedElement.offsetHeight;

            const currentModel = (modelTypeSelect as HTMLInputElement).value as
                | 'string'
                | 'plate'
                | 'random';

            const force: ForceInjectionEvent = {
                location:
                    currentModel === 'plate'
                        ? new Float32Array([xPos, yPos])
                        : new Float32Array([0, xPos]),
                force:
                    currentModel === 'plate' || currentModel === 'random'
                        ? new Float32Array([
                              Math.random() * 0.5,
                              Math.random() * 0.5,
                          ])
                        : new Float32Array([0.1 + Math.random() * 0.5, 0]),
                type: 'force-injection',
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
