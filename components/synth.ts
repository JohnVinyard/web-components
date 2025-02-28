export enum SynthType {
    Sampler = 'sampler',
    Sequencer = 'sequencer',
}

interface GainKeyPoint {
    time_seconds: number;
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
         * How much of the "wet" signal is included
         */
        mix: number;
    };
}

export interface MusicalEvent {
    timeSeconds: number;
    type: SynthType;
    params: Params;
}

export interface SequencerParams {
    type: SynthType.Sequencer;
    events: MusicalEvent[];
    speed: number;
}

export type PatternTransform = (params: SequencerParams) => SequencerParams;

export const applyPatternTransform = (
    pattern: SequencerParams,
    transform: PatternTransform
): SequencerParams => {
    return transform(pattern);
};

export const emptyPattern = (): SequencerParams => {
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

type Params = SamplerParams | SequencerParams;

interface Synth<T extends Params> {
    version: string;
    latencyBufferSeconds: number;

    play(params: T, context: BaseAudioContext, time: number): Promise<void>;
}

interface TriggeredEvent<T extends Params> {
    time: number;
    event: T;
}

class AudioCache {
    private readonly _cache: Record<string, Promise<AudioBuffer>> = {};

    constructor() {}

    async get(url: string, context: BaseAudioContext): Promise<AudioBuffer> {
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
    }

    async getDuration(url: string, context: BaseAudioContext): Promise<number> {
        const buf = await this.get(url, context);
        return buf.duration;
    }
}

export class Sequencer implements Synth<SequencerParams> {
    version: string = '0.0.1';
    private readonly sampler: Sampler;

    constructor(public readonly latencyBufferSeconds: number = 0.01) {
        this.sampler = new Sampler(latencyBufferSeconds);
    }

    async durationHint(
        { events, speed }: SequencerParams,
        context: BaseAudioContext,
        time: number,
        maxEndTime: number = 0
    ): Promise<number> {
        let met = maxEndTime;

        for (const event of events) {
            const t = time + event.timeSeconds * speed;
            let duration = 0;

            if (event.type === SynthType.Sampler) {
                duration = await this.sampler.getDuration(
                    event.params as SamplerParams,
                    context
                );
            } else if (event.type === SynthType.Sequencer) {
                duration = await this.durationHint(
                    event.params as SequencerParams,
                    context,
                    t,
                    met
                );
            } else {
                throw new Error('Unsupported');
            }

            if (t + duration > met) {
                met = t + duration;
            }
        }

        return met;
    }

    async play(
        { events, speed }: SequencerParams,
        context: BaseAudioContext,
        time: number
    ): Promise<void> {
        for (const event of events) {
            if (event.type === SynthType.Sampler) {
                await this.sampler.play(
                    event.params as SamplerParams,
                    context,
                    time + event.timeSeconds * speed
                );
            } else if (event.type === SynthType.Sequencer) {
                await this.play(
                    event.params as SequencerParams,
                    context,
                    time +
                        event.timeSeconds *
                            (event.params as SequencerParams).speed
                );
            } else {
                throw new Error('Unsupported');
            }
        }
    }
}

export class Sampler implements Synth<SamplerParams> {
    private readonly cache: AudioCache;
    version: string = '0.0.1';

    constructor(public readonly latencyBufferSeconds: number = 0.01) {
        this.cache = new AudioCache();
    }

    async getDuration(
        params: SamplerParams,
        context: BaseAudioContext
    ): Promise<number> {
        return Math.max(
            ...(await Promise.all([
                this.cache.getDuration(params.url, context),
                params.convolve?.url
                    ? this.cache.getDuration(params.convolve?.url, context)
                    : 0,
            ]))
        );
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
        context: BaseAudioContext,
        time: number
    ): Promise<void> {
        const buffer = await this.cache.get(url, context);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.channelCount = 1;

        const g = context.createGain();
        g.gain.setValueAtTime(0.5, 0);

        if (convolve) {
            const verb = context.createConvolver();
            console.log(`Fetching ${convolve.url}`);
            const verbBuffer = await this.cache.get(convolve.url, context);
            verb.buffer = verbBuffer;
            verb.normalize = true;
            verb.channelCount = 1;
            source.connect(verb);
            verb.connect(g);
            g.connect(context.destination);
        } else {
            source.connect(g);
            g.connect(context.destination);
        }

        source.start(
            context.currentTime + this.latencyBufferSeconds + time,
            startSeconds,
            durationSeconds
        );
    }
}
