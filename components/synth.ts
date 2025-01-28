enum SynthType {
    Sampler = 'sampler',
    Sequencer = 'sequencer',
}

interface SamplerParams {
    type: SynthType.Sampler;
    url: string;
    startSeconds: number;
    durationSeconds: number;
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
    play(params: T): Promise<void>;
}

interface TriggeredEvent<T extends Params> {
    time: number;
    event: T;
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
