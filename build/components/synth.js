var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var SynthType;
(function (SynthType) {
    SynthType["Sampler"] = "sampler";
    SynthType["Sequencer"] = "sequencer";
})(SynthType || (SynthType = {}));
class AudioCache {
    constructor() {
        this._cache = {};
    }
    get() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('');
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
class Sampler {
    play({ url, startSeconds, durationSeconds, gain, filter, convolve, }) {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('Method not implemented.');
        });
    }
}
const nestedExample = {
    type: SynthType.Sequencer,
    events: [
        {
            type: SynthType.Sampler,
            timeSeconds: 1,
            params: {
                type: SynthType.Sampler,
                url: '',
                startSeconds: 1,
                durationSeconds: 10,
            },
        },
        {
            type: SynthType.Sequencer,
            timeSeconds: 5,
            params: {
                type: SynthType.Sequencer,
                events: [
                    {
                        type: SynthType.Sampler,
                        timeSeconds: 1,
                        params: {
                            type: SynthType.Sampler,
                            url: '',
                            startSeconds: 1,
                            durationSeconds: 10,
                        },
                    },
                    {
                        type: SynthType.Sampler,
                        timeSeconds: 2,
                        params: {
                            type: SynthType.Sampler,
                            url: '',
                            startSeconds: 1,
                            durationSeconds: 10,
                        },
                    },
                ],
            },
        },
    ],
};
//# sourceMappingURL=synth.js.map