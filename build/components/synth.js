var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export var SynthType;
(function (SynthType) {
    SynthType["Sampler"] = "sampler";
    SynthType["Sequencer"] = "sequencer";
})(SynthType || (SynthType = {}));
export const applyPatternTransform = (pattern, transform) => {
    return transform(pattern);
};
export const emptyPattern = () => {
    return {
        type: SynthType.Sequencer,
        events: [
            {
                type: SynthType.Sequencer,
                timeSeconds: 0,
                params: {
                    type: SynthType.Sequencer,
                    events: [],
                    speed: 1,
                },
            },
        ],
        speed: 1,
    };
};
class AudioCache {
    constructor() {
        this._cache = {};
    }
    get(url, context) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._cache[url] !== undefined) {
                return this._cache[url];
            }
            const pr = fetch(url)
                .then((resp) => resp.arrayBuffer())
                .then((x) => {
                const audio = context.decodeAudioData(x);
                return audio;
            });
            this._cache[url] = pr;
            return pr;
        });
    }
}
export class Sequencer {
    constructor(latencyBufferSeconds = 0.01) {
        this.latencyBufferSeconds = latencyBufferSeconds;
        this.version = '0.0.1';
        this.sampler = new Sampler(latencyBufferSeconds);
    }
    play({ events, speed }, context, time) {
        return __awaiter(this, void 0, void 0, function* () {
            for (const event of events) {
                if (event.type === SynthType.Sampler) {
                    yield this.sampler.play(event.params, context, time + event.timeSeconds * speed);
                }
                else if (event.type === SynthType.Sequencer) {
                    yield this.play(event.params, context, time +
                        event.timeSeconds *
                            event.params.speed);
                }
                else {
                    throw new Error('Unsupported');
                }
            }
        });
    }
}
export class Sampler {
    constructor(latencyBufferSeconds = 0.01) {
        this.latencyBufferSeconds = latencyBufferSeconds;
        this.version = '0.0.1';
        this.cache = new AudioCache();
    }
    play({ url, startSeconds, durationSeconds, gain, filter, convolve, }, context, time) {
        return __awaiter(this, void 0, void 0, function* () {
            const buffer = yield this.cache.get(url, context);
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.channelCount = 1;
            const g = context.createGain();
            g.gain.setValueAtTime(0.5, 0);
            if (convolve) {
                const verb = context.createConvolver();
                console.log(`Fetching ${convolve.url}`);
                const verbBuffer = yield this.cache.get(convolve.url, context);
                verb.buffer = verbBuffer;
                verb.normalize = true;
                verb.channelCount = 1;
                source.connect(verb);
                verb.connect(g);
                g.connect(context.destination);
            }
            else {
                source.connect(g);
                g.connect(context.destination);
            }
            source.start(context.currentTime + this.latencyBufferSeconds + time, startSeconds, durationSeconds);
        });
    }
}
//# sourceMappingURL=synth.js.map