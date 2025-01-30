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
    play(params: T, context: AudioContext): Promise<void>;
}

interface TriggeredEvent<T extends Params> {
    time: number;
    event: T;
}

class AudioCache {
    private readonly _cache: Record<string, Promise<AudioBuffer>> = {};

    constructor() {}

    async get(): Promise<AudioBuffer> {
        throw new Error('');
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
    async play({
        url,
        startSeconds,
        durationSeconds,
        gain,
        filter,
        convolve,
    }: SamplerParams): Promise<void> {
        throw new Error('Method not implemented.');
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
