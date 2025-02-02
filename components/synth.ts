enum SynthType {
    Sampler = 'sampler',
    Sequencer = 'sequencer',
}

interface SamplerParams {
    type: SynthType.Sampler;
    url: string;
    startSeconds?: number;
    durationSeconds?: number;
    gain?: number;
    filter?: {
        centerFrequency: number;
        bandwidth: number;
    };
    convolve?: {
        url: string;
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

    play(params: T, context: AudioContext): Promise<void>;
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

class Sampler implements Synth<SamplerParams> {
    private readonly cache: AudioCache;
    version: string = '0.0.1';

    constructor() {
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
        
    }
}
const nestedExample: SequencerParams = {
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
