export enum SynthType {
    Sampler = 'sampler',
    Sequencer = 'sequencer',
}

interface GainKeyPoint {
    time: number;
    gain: number;
}

interface EnvelopeParams {
    gain: GainKeyPoint[];
    type: 'linear' | 'exponential';
}

export interface SamplerParams {
    type: SynthType.Sampler;
    url: string;
    envelope?: EnvelopeParams;
    startSeconds?: number;
    durationSeconds?: number;
    gain?: number;
    filter?: {
        centerFrequency: number;
        bandwidth: number;
    };
    convolve?: {
        url: string;
        /**
         * How much of the "wet signal is included"
         */
        mix: number;
    };
}

interface MusicalEvent {
    timeSeconds: number;
    type: SynthType;
    params: Params;
}

interface SequencerParams {
    type: SynthType.Sequencer;
    events: MusicalEvent[];
}

type Params = SamplerParams | SequencerParams;

interface Synth<T extends Params> {
    version: string;
    latencyBufferSeconds: number;

    play(params: T, context: AudioContext, time: number): Promise<void>;
}

interface TriggeredEvent<T extends Params> {
    time: number;
    event: T;
}

class AudioCache {
    private readonly _cache: Record<string, Promise<AudioBuffer>> = {};

    constructor() {}

    async get(url: string, context: AudioContext): Promise<AudioBuffer> {
        if (this._cache[url] !== undefined) {
            return this._cache[url];
        }

        const resp = await fetch(url);
        const buffer = await resp.arrayBuffer();
        const audio = context.decodeAudioData(buffer);
        this._cache[url] = audio;
        return audio;
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

export class Sampler implements Synth<SamplerParams> {
    private readonly cache: AudioCache;
    version: string = '0.0.1';

    constructor(public readonly latencyBufferSeconds: number = 0.01) {
        this.cache = new AudioCache();
    }

    async play(
        {
            url,
            startSeconds,
            durationSeconds,
            gain,
            filter,
            convolve,
        }: SamplerParams,
        context: AudioContext
    ): Promise<void> {
        const buffer = await this.cache.get(url, context);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.channelCount = 1;

        if (convolve) {
            const verb = context.createConvolver();
            console.log(`Fetching ${convolve.url}`);
            const verbBuffer = await this.cache.get(convolve.url, context);
            verb.buffer = verbBuffer;
            verb.normalize = true;
            verb.channelCount = 1;
            source.connect(verb);
            verb.connect(context.destination);
        } else {
            source.connect(context.destination);
        }

        source.start(
            context.currentTime + this.latencyBufferSeconds,
            startSeconds,
            durationSeconds
        );
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
