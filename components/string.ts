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

type ModelType = 'string' | 'plate' | 'random' | 'multi-string';

interface ChangeModelTypeEvent {
    value: ModelType;
    type: 'model-type';
}

interface MassInfo {
    position: Float32Array;
}

interface SpringInfo {
    m1: Float32Array;
    m2: Float32Array;
}

interface MeshInfo {
    masses: MassInfo[];
    springs: SpringInfo[];
    struck: Float32Array | null;
}

const pointsEqual = (p1: Float32Array, p2: Float32Array): boolean => {
    return p1[0] == p2[0] && p1[1] == p2[1];
};

const distance = (a: Float32Array, b: Float32Array): number => {
    let distance = 0;
    for (let i = 0; i < a.length; i++) {
        distance += (a[i] - b[i]) ** 2;
    }
    return Math.sqrt(distance);
};

export class PhysicalStringSimulation extends HTMLElement {
    private initialized: boolean = false;
    private node: AudioWorkletNode | null = null;
    private mostRecentlyStruck: Float32Array | null;
    private isUsingAccelerometer: boolean = false;
    private massPosition: Float32Array = new Float32Array(2);

    private mass: number = 1;
    private meshInfo: MeshInfo | null = null;

    constructor() {
        super();

        this.massPosition = new Float32Array([0, 0]);
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
            <select name="model-type" id="model-type" disabled>
                <option value="string" selected>String</option>
                <option value="plate">Plate</option>
                <option value="random">Random</option>
                <option value="multi-string">Multi-String</option>
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
        <div class="control">
            <label for="use-accelerometer">Use Accelerometer</label>
            <input 
                type="checkbox"
                id="use-accelerometer" 
                name="use-accelerometer" 
            />
        </div>
        `;

        const clickArea = shadow.getElementById(
            'click-area'
        ) as HTMLButtonElement;

        const collisionCheck = (
            xPos: number,
            yPos: number,
            frc: Float32Array | null = null
        ) => {
            if (this.meshInfo !== null) {
                const { masses } = this.meshInfo;
                let dist = Number.MAX_SAFE_INTEGER;

                for (const mass of masses) {
                    const d = distance(mass.position, this.massPosition);
                    if (d < dist) {
                        dist = d;
                    }
                }

                if (dist < 0.02) {
                    injectForce(xPos, yPos, 1, frc);
                }
            }
        };

        const initialize = async () => {
            if (this.initialized) {
                return;
            }

            modelTypeSelect.disabled = false;

            const context = new AudioContext({
                sampleRate: 22050,
                latencyHint: 'interactive',
            });

            try {
                await context.audioWorklet.addModule(
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
                const { masses, springs, struck } = event.data;

                this.meshInfo = event.data;

                this.mostRecentlyStruck = struck;

                const elements = masses.map(
                    (m) => `<circle 
                            cx="${m.position[1]}" 
                            cy="${m.position[0]}" 
                            fill="${
                                event.data.struck &&
                                pointsEqual(struck, m.position)
                                    ? 'black'
                                    : '#55aa44'
                            }"
                            r="0.01"></circle>`
                );

                const lines = springs.map(
                    (s) => `
                        <line 
                            x1="${s.m1[1]}" 
                            x2="${s.m2[1]}" 

                            y1="${s.m1[0]}"
                            y2="${s.m2[0]}" 
                            stroke="#55aa44"
                            strokeWidth="0.001"
                            style="stroke-width: 0.001;"
                            ></line>
                        `
                );

                clickArea.innerHTML = `
                    <svg 
                        viewBox="0 0 1 1" 
                        width="100%" 
                        height="50vh" 
                        style="background-color:transparent; pointer-events: none;"
                        preserveAspectRatio="none"
                    >

                        ${elements}
                        ${lines}
                        <circle id="mass" cx="${this.massPosition[1]}" cy="${this.massPosition[0]}" r="0.008" />
                    </svg>
                `;
            };

            collisionCheck(this.massPosition[0], this.massPosition[1]);

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

        const modelTypeSelect = shadow.getElementById(
            'model-type'
        ) as HTMLInputElement;

        modelTypeSelect.addEventListener('change', (event: Event) => {
            const target = event.target as HTMLSelectElement;
            const newValue = target.value;

            if (this.node?.port) {
                const message: ChangeModelTypeEvent = {
                    type: 'model-type',
                    value: newValue as ModelType,
                };
                this.node.port.postMessage(message);
                if (
                    newValue === 'string' ||
                    newValue === 'random' ||
                    newValue === 'multi-string'
                ) {
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

        const injectForce = (
            xPos: number,
            yPos: number,
            magnitude: number = 1,
            frce: Float32Array | null = null
        ) => {
            const currentModel = (modelTypeSelect as HTMLInputElement)
                .value as ModelType;

            let f: Float32Array =
                currentModel === 'plate' ||
                currentModel === 'random' ||
                currentModel === 'multi-string'
                    ? new Float32Array([
                          Math.random() * 0.5 * magnitude,
                          Math.random() * 0.5 * magnitude,
                      ])
                    : new Float32Array([
                          0.1 + Math.random() * 0.5 * magnitude,
                          0 * magnitude,
                      ]);
            if (frce) {
                f = frce;
            }

            const force: ForceInjectionEvent = {
                location:
                    currentModel === 'plate' ||
                    currentModel === 'random' ||
                    currentModel === 'multi-string'
                        ? new Float32Array([xPos, yPos])
                        : new Float32Array([0, yPos]),
                force: f,
                type: 'force-injection',
            };

            if (this.node?.port) {
                this.node.port.postMessage(force);
            }
        };

        clickArea.addEventListener('click', async (event: MouseEvent) => {
            await initialize();
            const rect = clickArea.getBoundingClientRect();
            const yPos = (event.pageX - rect.left) / rect.width;
            const xPos = (event.pageY - rect.top) / rect.height;
            injectForce(xPos, yPos);
        });

        clickArea.addEventListener('mousemove', async (event: MouseEvent) => {
            // await initialize();
            const rect = clickArea.getBoundingClientRect();

            const yPos = (event.pageX - rect.left) / rect.width;
            const xPos = (event.pageY - rect.top) / rect.height;

            

            this.massPosition[0] = xPos;
            this.massPosition[1] = yPos;


            // TODO: This a quick/cheap proxy for calculating force, which
            // _should_ be based on acceleration
            const xDelta = (event.movementX - rect.left) / rect.width;
            const yDelta = (event.movementY - rect.top) / rect.height;
            const force: Float32Array = new Float32Array([
                yDelta * this.mass,
                xDelta * this.mass,
            ]);

            collisionCheck(xPos, yPos, force);

            // if (this.meshInfo !== null) {
            //     const { masses } = this.meshInfo;
            //     let dist = Number.MAX_SAFE_INTEGER;

            //     for (const mass of masses) {
            //         const d = distance(mass.position, this.massPosition);
            //         if (d < dist) {
            //             dist = d;
            //         }
            //     }

            //     if (dist < 0.003) {
            //         injectForce(xPos, yPos);
            //     }
            // }

            // const mass = this.shadowRoot.getElementById('mass');
            // mass.setAttribute('cx', xPos.toString());
            // mass.setAttribute('cy', yPos.toString());
        });

        const useAcc = () => {
            if (DeviceMotionEvent) {
                window.addEventListener(
                    'devicemotion',
                    (event) => {
                        if (!this.isUsingAccelerometer) {
                            return;
                        }

                        const threshold: number = 4;

                        const xAcc = Math.abs(event.acceleration.x);
                        const yAcc = Math.abs(event.acceleration.y);
                        const zAcc = Math.abs(event.acceleration.z);

                        const thresholdExceeded: boolean =
                            xAcc > threshold ||
                            yAcc > threshold ||
                            zAcc > threshold;

                        if (
                            thresholdExceeded &&
                            this.isUsingAccelerometer &&
                            this.mostRecentlyStruck
                        ) {
                            const magnitude = Math.max(xAcc, yAcc, zAcc) / 4;

                            injectForce(
                                this.mostRecentlyStruck[0],
                                this.mostRecentlyStruck[1],
                                magnitude
                            );
                        }
                    },
                    true
                );
            } else {
                console.log('Device motion not supported');
                alert('device motion not supported');
            }
        };

        const useAccelerometerCheckbox = shadow.getElementById(
            'use-accelerometer'
        ) as HTMLInputElement;
        useAccelerometerCheckbox.addEventListener('change', (event) => {
            // @ts-ignore
            this.isUsingAccelerometer = event.target.checked;
            console.log('USING', this.isUsingAccelerometer);
        });

        useAcc();
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
