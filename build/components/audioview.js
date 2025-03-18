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
        if (end < start) {
            throw new Error(`end must be greater than start, but got [${start}-${end}]`);
        }
    }
    static unit() {
        return new Interval(0, 1);
    }
    get range() {
        return this.end - this.start;
    }
    pointToPercentage(location) {
        const relative = location - this.start;
        return relative / this.range;
    }
    percentageToPoint(percentage) {
        return this.start + percentage * this.range;
    }
}
class IntervalMapping {
    constructor(intervals) {
        this.intervals = intervals;
    }
    map(location, from, to) {
        const fromInterval = this.intervals[from];
        const toInterval = this.intervals[to];
        const percentage = fromInterval.pointToPercentage(location);
        const newLocation = toInterval.percentageToPoint(percentage);
        return newLocation;
    }
}
const fetchBinary = (url) => __awaiter(void 0, void 0, void 0, function* () {
    const resp = yield fetch(url);
    return resp.arrayBuffer();
});
const audioCache = {};
export const fetchAudio = (url, context) => __awaiter(void 0, void 0, void 0, function* () {
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
export const playAudio = (url, context, start, duration) => __awaiter(void 0, void 0, void 0, function* () {
    const audioBuffer = yield fetchAudio(url, context);
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    source.start(0, start, duration);
    return source;
});
// @ts-ignore
export const context = new (window.AudioContext || window.webkitAudioContext)();
/**
 * data url
 */
const safeParseInt = (value, defaultValue) => {
    if (value === null || value === undefined) {
        return defaultValue;
    }
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
};
const clamp = (value, min, max) => {
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
};
export class AudioView extends HTMLElement {
    constructor() {
        super();
        this.isPlaying = false;
        this.src = null;
        this.buffer = null;
        this.height = '200';
        this.scale = '1';
        this.samples = '4096';
        this.isPlaying = false;
        this.playingBuffer = null;
        this.timeoutHandle = null;
        this.currentEndTimeSeconds = null;
        this.controls = null;
        this.color = '#33aa55';
    }
    get showControls() {
        if (this.controls === null || this.controls.toLowerCase() === 'false') {
            return false;
        }
        return true;
    }
    deriveCurrentEndTimeSeconds(intervalMapping, container) {
        const currentPixelPosition = container.scrollLeft;
        const currentVisiblePixels = this.parentElement.clientWidth;
        const endPixelPosition = currentPixelPosition + currentVisiblePixels;
        if (this.buffer !== null) {
            const totalDuration = this.buffer.duration;
            this.currentEndTimeSeconds = Math.min(intervalMapping.map(endPixelPosition, 'pixels', 'seconds'), totalDuration);
        }
        else {
            this.currentEndTimeSeconds = intervalMapping.map(endPixelPosition, 'pixels', 'seconds');
        }
    }
    render() {
        var _a, _b, _c, _d, _e, _f;
        let shadow = this.shadowRoot;
        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
        }
        const duration = (_b = (_a = this.buffer) === null || _a === void 0 ? void 0 : _a.duration) !== null && _b !== void 0 ? _b : 0;
        const secondsInterval = new Interval(0, duration);
        const samplerate = (_d = (_c = this.buffer) === null || _c === void 0 ? void 0 : _c.sampleRate) !== null && _d !== void 0 ? _d : 44100;
        const totalSamples = duration * samplerate;
        const samplesInterval = new Interval(0, totalSamples);
        const samplesPerBar = Math.floor(parseInt(this.scale) * safeParseInt(this.samples, 4096));
        const totalPixels = Math.round(totalSamples / samplesPerBar);
        const pixelsInterval = new Interval(0, totalPixels);
        const intervalMapping = new IntervalMapping({
            seconds: secondsInterval,
            samples: samplesInterval,
            pixels: pixelsInterval,
        });
        const loudnessInterval = Interval.unit();
        const pixelHeightInterval = new Interval(0, safeParseInt(this.height, 200));
        const loudnessMapping = new IntervalMapping({
            raw: loudnessInterval,
            pixels: pixelHeightInterval,
        });
        // TODO: There needs to be a separate canvas container
        shadow.innerHTML = `
            <style>
                .audio-view-container {
                    width: 100%;
                    height: ${this.height}px;
                    overflow-x: ${this.showControls ? 'auto' : 'hidden'};
                    overflow-y: hidden;
                    position: relative;
                    border: solid 1px #eee;
                    background: rgb(34,193,195);
                    background: linear-gradient(0deg, rgba(200,200,200,0.5) 0%, rgba(255,255,255,0.5) 100%);
                }

                .audio-view-container.playing {
                    background: rgb(34,193,195);
                    background: linear-gradient(0deg, rgba(80,80,80,0.5) 0%, rgba(255,255,255,0.5) 40%);
                }

                .audio-view-controls-container {
                    position: absolute;
                    display: ${this.showControls ? 'block' : 'none'};
                    top: 10;
                    left: 10;
                }

                .audio-view-button {
                    cursor: pointer;
                    float: left;
                    margin: 3px;
                    padding: 3px;
                    font-size: 1em;
                    font-weight: bold;
                    background-color: #eee;
                }
                
                .audio-view-canvas {
                    cursor: pointer;
                }
            </style>
            <div class="audio-view-container">

                <div class="audio-view-controls-container">
                    <div class="audio-view-controls">
                        <div class="audio-view-button audio-view-zoom-out">-</div>
                        <div class="audio-view-button audio-view-zoom-in">+</div>
                        <div class="audio-view-button audio-view-control">play</div>
                    </div>
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
        const container = shadow.querySelector('.audio-view-container');
        const canvas = shadow.querySelector('.audio-view-canvas');
        this.deriveCurrentEndTimeSeconds(intervalMapping, container);
        container.addEventListener('scroll', (event) => {
            this.deriveCurrentEndTimeSeconds(intervalMapping, container);
        });
        container.addEventListener('click', (event) => {
            const clickedPixel = event.offsetX;
            const startSeconds = intervalMapping.map(clickedPixel, 'pixels', 'seconds');
            this.playAudio(this.src, startSeconds, undefined, event.timeStamp);
        });
        shadow
            .querySelector('.audio-view-zoom-in')
            .addEventListener('click', (event) => {
            event.stopPropagation();
            const raw = safeParseInt(this.scale, 1) * 0.5;
            const clamped = clamp(raw, 1, 8);
            this.setAttribute('scale', clamped.toString());
        });
        shadow
            .querySelector('.audio-view-zoom-out')
            .addEventListener('click', (event) => {
            event.stopPropagation();
            const raw = safeParseInt(this.scale, 1) * 2;
            const clamped = clamp(raw, 1, 8);
            this.setAttribute('scale', clamped.toString());
        });
        const control = shadow.querySelector('.audio-view-control');
        control.addEventListener('click', (event) => __awaiter(this, void 0, void 0, function* () {
            event.stopPropagation();
            this.isPlaying = !this.isPlaying;
            control.innerHTML = this.isPlaying ? 'stop' : 'play';
            const container = this.shadowRoot.querySelector('.audio-view-container');
            container.classList.remove('playing');
            clearTimeout(this.timeoutHandle);
            if (this.isPlaying) {
                const startPositionPixels = container.scrollLeft;
                const startTimeSeconds = intervalMapping.map(startPositionPixels, 'pixels', 'seconds');
                const canvas = this.shadowRoot.querySelector('canvas');
                canvas.style.filter = '';
                this.playAudio(this.src, startTimeSeconds);
            }
            else if (this.playingBuffer !== null) {
                this.playingBuffer.stop();
                this.playingBuffer = null;
                const canvas = this.shadowRoot.querySelector('canvas');
                canvas.style.filter = 'blur(2px)';
            }
        }));
        const audioData = (_f = (_e = this.buffer) === null || _e === void 0 ? void 0 : _e.getChannelData(0)) !== null && _f !== void 0 ? _f : new Float32Array(0);
        const drawContext = canvas.getContext('2d');
        drawContext.strokeStyle = this.color;
        drawContext.fillStyle = this.color;
        canvas.style.filter = 'blur(2px)';
        const midline = canvas.clientHeight / 2;
        for (let i = 0; i < totalSamples; i += samplesPerBar) {
            const sampleValue = Math.abs(audioData[i]);
            const sampleHeight = loudnessMapping.map(sampleValue, 'raw', 'pixels');
            const top = midline - sampleHeight / 2;
            const xLocation = intervalMapping.map(i, 'samples', 'pixels');
            drawContext.fillRect(xLocation, top, 1, sampleHeight);
        }
    }
    connectedCallback() {
        this.render();
    }
    playAudio(url, startSeconds, durationSeconds = 5, timestamp = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            const duration = this.currentEndTimeSeconds !== null
                ? this.currentEndTimeSeconds - startSeconds
                : durationSeconds;
            const playedEvent = new CustomEvent('audio-view-played', {
                cancelable: true,
                bubbles: true,
                detail: {
                    url,
                    startSeconds,
                    durationSeconds,
                    eventTime: timestamp / 1000,
                },
            });
            this.dispatchEvent(playedEvent);
            // start at second 1 and play for 5 seconds
            this.playingBuffer = yield playAudio(url, context, startSeconds, duration);
            this.isPlaying = true;
            const audioView = this.shadowRoot.querySelector('.audio-view-control');
            audioView.innerHTML = 'stop';
            const container = this.shadowRoot.querySelector('.audio-view-container');
            container.classList.add('playing');
            const canvas = this.shadowRoot.querySelector('canvas');
            canvas.style.filter = '';
            // @ts-ignore
            this.timeoutHandle = setTimeout(() => {
                this.isPlaying = false;
                this.playingBuffer = null;
                const audioView = this.shadowRoot.querySelector('.audio-view-control');
                audioView.innerHTML = 'play';
                const container = this.shadowRoot.querySelector('.audio-view-container');
                container.classList.remove('playing');
                const canvas = this.shadowRoot.querySelector('canvas');
                canvas.style.filter = 'blur(2px)';
            }, duration * 1000);
        });
    }
    static get observedAttributes() {
        return ['src', 'scale', 'height', 'samples', 'controls', 'color'];
    }
    attributeChangedCallback(property, oldValue, newValue) {
        if (newValue === oldValue) {
            return;
        }
        this[property] = newValue;
        if (property === 'src') {
            fetchAudio(newValue, context).then((buf) => {
                this.buffer = buf;
                this.render();
                const loadedEvent = new CustomEvent('audio-view-loaded', {
                    bubbles: true,
                    cancelable: true,
                    detail: { url: this.src },
                });
                this.dispatchEvent(loadedEvent);
            });
            return;
        }
        if (property === 'scale') {
            this.render();
            return;
        }
        if (property === 'controls') {
            this.render();
            return;
        }
        if (property === 'color') {
            this.render();
            return;
        }
    }
}
window.customElements.define('audio-view', AudioView);
//# sourceMappingURL=audioview.js.map