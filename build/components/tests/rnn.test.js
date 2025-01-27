describe('rnn', () => {
    it('computes dot correctly', () => {
        const a = new Float32Array(4).map((x) => Math.random());
        const b = new Float32Array(4).map((x) => Math.random());
        const result = vectorVectorDot(a, b);
        expect(Math.abs(result)).toBeGreaterThan(0);
    });
    it('correctly constructs a two-dimensional array', () => {
        const a = new Float32Array(16).fill(1);
        const twod = twoDimArray(a, [4, 4]);
        twod.forEach((row) => {
            expect(sum(row)).toBe(4);
        });
    });
});
//# sourceMappingURL=rnn.test.js.map