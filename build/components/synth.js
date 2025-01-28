var SynthType;
(function (SynthType) {
    SynthType["Sampler"] = "sampler";
    SynthType["Sequencer"] = "sequencer";
})(SynthType || (SynthType = {}));
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