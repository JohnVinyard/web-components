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
class AudioCache {
    constructor() {
        this._cache = {};
    }
    get(url, context) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._cache[url] !== undefined) {
                return this._cache[url];
            }
            const resp = yield fetch(url);
            const buffer = yield resp.arrayBuffer();
            const audio = context.decodeAudioData(buffer);
            this._cache[url] = audio;
            return audio;
        });
    }
}
/*
const audioBuffer = await fetchAudio(url, context);
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    source.start(0, start, duration);
    return source;
*/
export class Sampler {
    constructor(latencyBufferSeconds = 0.01) {
        this.latencyBufferSeconds = latencyBufferSeconds;
        this.version = '0.0.1';
        this.cache = new AudioCache();
    }
    play({ url, startSeconds, durationSeconds, gain, filter, convolve, }, context) {
        return __awaiter(this, void 0, void 0, function* () {
            const buffer = yield this.cache.get(url, context);
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.channelCount = 1;
            if (convolve) {
                const verb = context.createConvolver();
                console.log(`Fetching ${convolve.url}`);
                const verbBuffer = yield this.cache.get(convolve.url, context);
                verb.buffer = verbBuffer;
                verb.normalize = true;
                verb.channelCount = 1;
                source.connect(verb);
                verb.connect(context.destination);
            }
            else {
                source.connect(context.destination);
            }
            source.start(context.currentTime + this.latencyBufferSeconds, startSeconds, durationSeconds);
        });
    }
}
// const nestedExample: SequencerParams = {
//     type: SynthType.Sequencer,
//     events: [
//         {
//             type: SynthType.Sampler,
//             timeSeconds: 1,
//             params: {
//                 type: SynthType.Sampler,
//                 url: '',
//                 startSeconds: 1,
//                 durationSeconds: 10,
//             },
//         },
//         {
//             type: SynthType.Sequencer,
//             timeSeconds: 5,
//             params: {
//                 type: SynthType.Sequencer,
//                 events: [
//                     {
//                         type: SynthType.Sampler,
//                         timeSeconds: 1,
//                         params: {
//                             type: SynthType.Sampler,
//                             url: '',
//                             startSeconds: 1,
//                             durationSeconds: 10,
//                         },
//                     },
//                     {
//                         type: SynthType.Sampler,
//                         timeSeconds: 2,
//                         params: {
//                             type: SynthType.Sampler,
//                             url: '',
//                             startSeconds: 1,
//                             durationSeconds: 10,
//                         },
//                     },
//                 ],
//             },
//         },
//     ],
// };
//# sourceMappingURL=synth.js.map