const fetchBinary = async (url: string): Promise<ArrayBuffer> => {
    const resp = await fetch(url);
    return resp.arrayBuffer();
};

const audioCache = {};

const fetchAudio = async (
    url: string,
    context: AudioContext
): Promise<AudioBuffer> => {
    const cached = audioCache[url];
    if (cached !== undefined) {
        return cached;
    }

    const audioBufferPromise = fetchBinary(url).then(function (data) {
        return new Promise<AudioBuffer>(function (resolve, reject) {
            context.decodeAudioData(
                data,
                (buffer) => resolve(buffer),
                (error) => reject(error)
            );
        });
    });
    audioCache[url] = audioBufferPromise;
    return audioBufferPromise;
};

const playAudio = async (
    url: string,
    context: AudioContext,
    start?: number,
    duration?: number
) => {
    const audioBuffer = await fetchAudio(url, context);
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    source.start(0, start, duration);
};

// @ts-ignore
const context = new (window.AudioContext || window.webkitAudioContext)();

class AudioView extends HTMLElement {
    public src: string | null;
    public buffer: AudioBuffer | null;
    public height: number = 200;
    private scale: number | null;
    private defaultSamplesPerBar: number | null;

    constructor() {
        super();
        this.src = null;
        this.buffer = null;
        this.height = 200;
        this.scale = 1;
        this.defaultSamplesPerBar = 4096;
    }

    private render() {
        let shadow: ShadowRoot | null = this.shadowRoot;

        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
        }

        const duration = this.buffer?.duration ?? 0;

        const samplerate = this.buffer?.sampleRate ?? 44100;

        const totalSamples = duration * samplerate;

        const samplesPerBar = Math.floor(
            this.scale * this.defaultSamplesPerBar
        );

        const totalPixels = Math.round(totalSamples / samplesPerBar);

        // TODO: There needs to be a separate canvas container
        shadow.innerHTML = `
            <style>
                .audio-view-container {
                    width: 100%;
                    height: ${this.height}px;
                    overflow-x: auto;
                    overflow-y: hidden;
                    position: relative;
                    border: solid 1px black;
                }

                .audio-view-controls {
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    background-color: #eee;
                }
                .audio-view-button {
                    cursor: pointer;
                    font-size: 1.5em;
                    font-weight: bold;
                    float: left;
                    margin: 5px;
                    padding: 5px;
                }
                .audio-view-button:first-of-type {
                    border-right: solid 1px gray;
                }
            </style>
            <div class="audio-view-container">
                <div class="audio-view-controls">
                    <div class="audio-view-button">+</div>
                    <div class="audio-view-button">-</div>
                </div>
                <canvas 
                    class="audio-view-canvas" 
                    width="${totalPixels.toFixed(0)}px" 
                    height="${this.height}px">

                </canvas>
                <div>
                    Duration in seconds is ${duration.toFixed(2)} seconds
                </div>
            </div>
        `;

        shadow
            .querySelector('.audio-view-container')
            .addEventListener('click', (event: Event) => {
                console.log('Clicked!');

                // TODO: translate click position into play start time
                this.playAudio(this.src);
            });

        const canvas: HTMLCanvasElement =
            shadow.querySelector('.audio-view-canvas');
        const audioData = this.buffer?.getChannelData(0) ?? new Float32Array(0);

        const drawContext = canvas.getContext('2d');
        const canvasHeight = this.height;
        drawContext.strokeStyle = '#000000';
        drawContext.fillStyle = '#000000';

        const midline = canvas.clientHeight / 2;

        for (let i = 0; i < totalSamples; i += samplesPerBar) {
            const sampleValue = Math.abs(audioData[i]);
            const sampleHeight = sampleValue * canvasHeight;
            const top = midline - sampleHeight / 2;
            const percentage = i / totalSamples;
            const xLocation = percentage * totalPixels;
            drawContext.fillRect(xLocation, top, 1, sampleHeight);
        }
    }

    public connectedCallback() {
        this.render();
    }

    public playAudio(url: string) {
        // TODO: Keep track of playing status and animate playhead when playing

        // start at second 1 and play for 5 seconds
        playAudio(url, context, 1, 5);
    }

    public static get observedAttributes() {
        return ['src', 'scale', 'height'];
    }

    public attributeChangedCallback(
        property: string,
        oldValue: string,
        newValue: string
    ) {
        this[property] = newValue;

        if (property === 'src') {
            console.log(`src set to ${newValue}`);
            fetchAudio(newValue, context).then((buf) => {
                this.buffer = buf;
                this.render();
            });
        }
    }
}

window.customElements.define('audio-view', AudioView);
