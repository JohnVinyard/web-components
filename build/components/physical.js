/**
 * Spring-mass synthesis, computed one sample at a time in an AudioWorklet.
 *
 * Each spring pulls its two masses back toward their *original offset* from
 * one another (rather than toward a rest length), so the force on m1 is
 *
 *     k * ((p1_0 - p2_0) - (p1 - p2)) = k * (u2 - u1)
 *
 * where u = position - originalPosition is each mass's displacement.  The
 * system is therefore linear, and the x and y axes are independent.  We
 * simulate displacement directly, using flat typed arrays (struct-of-arrays)
 * rather than an object per mass/spring.
 *
 * Only the x axis contributes to the audio output; y is simulated so that the
 * visualization (which draws both axes) behaves as before.
 *
 * Stiffness, pitch and stability
 * ------------------------------
 * Mass, tension and damping are shared by every mass/spring in a mesh, and
 * the dynamics depend only on the ratio k/m (tension / mass).  With one
 * simulation step per sample, each mode of the mesh has an eigenvalue λ of
 * the spring network (its graph Laplacian), and oscillates at
 *
 *     cos(ω) = 1 - (k/m)·λ/2      (ω in radians per sample)
 *
 * which is only stable while (k/m)·λ < 4 for every mode.  Adding masses
 * lowers the smallest λ (and so the pitch), so each builder chooses k/m to
 * hit a target fundamental frequency; more masses then add higher partials
 * rather than lowering the pitch.
 *
 * The tension and mass sliders scale that k/m relative to their default
 * positions, and the result is capped below the mesh's stability limit.
 */
/** Slider defaults in string.ts and pluck.ts; at these, a mesh plays at its built-in pitch */
const REFERENCE_TENSION = 0.5;
const REFERENCE_MASS = 10;
const DEFAULT_DAMPING = 0.9998;
/** Fraction of the stability limit that k/m may reach */
const STABILITY_MARGIN = 0.95;
/**
 * Eigenvalue of the `mode`th mode (1-based) of a chain of `nFree` free masses
 * whose two ends are attached to fixed masses
 */
const chainEigenvalue = (nFree, mode = 1) => 4 * Math.pow(Math.sin((mode * Math.PI) / (2 * (nFree + 1))), 2);
/** The k/m that makes a mode with eigenvalue `lambda` sound at `hz` */
const kOverMForFrequency = (hz, lambda) => {
    const omega = (2 * Math.PI * hz) / sampleRate;
    return (2 * (1 - Math.cos(omega))) / lambda;
};
/**
 * Description of a single mass, used only while building a mesh.  The
 * simulation state lives in `SpringMesh`'s typed arrays.
 */
class Mass {
    /**
     * @param outputGain how much this mass's displacement contributes to the
     * audio output
     */
    constructor(id, position, fixed = false, outputGain = 1) {
        this.id = id;
        this.position = position;
        this.fixed = fixed;
        this.outputGain = outputGain;
    }
}
/**
 * Description of a single spring, used only while building a mesh.
 */
class Spring {
    /**
     * @param stiffness multiplier on the mesh's k/m for this spring alone
     */
    constructor(m1, m2, stiffness = 1) {
        this.m1 = m1;
        this.m2 = m2;
        this.stiffness = stiffness;
    }
}
class SpringMesh {
    /**
     * @param springs The springs (and, implicitly, masses) making up the mesh
     * @param baseKOverM k/m when the tension and mass sliders are at their
     * default positions; this sets the mesh's pitch
     */
    constructor(springs, baseKOverM) {
        this.baseKOverM = baseKOverM;
        // Slider values
        this.tension = REFERENCE_TENSION;
        this.mass = REFERENCE_MASS;
        this.damping = DEFAULT_DAMPING;
        this.struckIndex = -1;
        const indexOf = new Map();
        this.masses = [];
        for (const { m1, m2 } of springs) {
            for (const m of [m1, m2]) {
                if (!indexOf.has(m)) {
                    indexOf.set(m, this.masses.length);
                    this.masses.push(m);
                }
            }
        }
        const n = this.masses.length;
        this.restX = new Float64Array(n);
        this.restY = new Float64Array(n);
        this.ux = new Float64Array(n);
        this.uy = new Float64Array(n);
        this.vx = new Float64Array(n);
        this.vy = new Float64Array(n);
        this.ax = new Float64Array(n);
        this.ay = new Float64Array(n);
        this.outputGain = new Float64Array(n);
        const free = [];
        this.masses.forEach((m, i) => {
            this.restX[i] = m.position[0];
            this.restY[i] = m.position[1];
            this.outputGain[i] = m.outputGain;
            if (!m.fixed) {
                free.push(i);
            }
        });
        this.freeIndices = Int32Array.from(free);
        const springA = [];
        const springB = [];
        const springStiffness = [];
        const ground = [];
        const groundStiffness = [];
        for (const { m1, m2, stiffness } of springs) {
            const i = indexOf.get(m1);
            const j = indexOf.get(m2);
            if (!m1.fixed && !m2.fixed) {
                springA.push(i);
                springB.push(j);
                springStiffness.push(stiffness);
            }
            else if (!m1.fixed) {
                ground.push(i);
                groundStiffness.push(stiffness);
            }
            else if (!m2.fixed) {
                ground.push(j);
                groundStiffness.push(stiffness);
            }
        }
        this.springA = Int32Array.from(springA);
        this.springB = Int32Array.from(springB);
        this.groundIndices = Int32Array.from(ground);
        this.springStiffness = Float64Array.from(springStiffness);
        this.groundStiffness = Float64Array.from(groundStiffness);
        this.springK = new Float64Array(springA.length);
        this.groundK = new Float64Array(ground.length);
        // Bound the largest eigenvalue of the (stiffness-weighted) spring
        // network (Gershgorin): for each free mass, (total stiffness of
        // springs attached to it) + (total stiffness of springs to other free
        // masses).  A spring from a mass to itself exerts no force.
        const diagonal = new Float64Array(n);
        const offDiagonal = new Float64Array(n);
        for (let s = 0; s < springA.length; s++) {
            const i = springA[s];
            const j = springB[s];
            const k = springStiffness[s];
            if (i !== j) {
                diagonal[i] += k;
                diagonal[j] += k;
                offDiagonal[i] += k;
                offDiagonal[j] += k;
            }
        }
        ground.forEach((i, s) => {
            diagonal[i] += groundStiffness[s];
        });
        let maxEigenvalue = 0;
        for (const i of free) {
            maxEigenvalue = Math.max(maxEigenvalue, diagonal[i] + offDiagonal[i]);
        }
        this.maxKOverM =
            maxEigenvalue > 0
                ? (STABILITY_MARGIN * 4) / maxEigenvalue
                : Number.POSITIVE_INFINITY;
        this.updateStiffness();
        this.displayPositions = this.masses.map((m) => new Float32Array(m.position));
        this.massInfo = this.displayPositions.map((position) => ({
            position,
        }));
        this.springInfo = springs.map(({ m1, m2 }) => ({
            m1: this.displayPositions[indexOf.get(m1)],
            m2: this.displayPositions[indexOf.get(m2)],
        }));
    }
    /**
     * Current positions of all masses and springs, for visualization.
     *
     * The returned structure is reused (and its arrays updated in place) on
     * each call; postMessage() copies it.
     */
    toMeshInfo() {
        const { displayPositions, restX, restY, ux, uy } = this;
        for (let i = 0; i < displayPositions.length; i++) {
            displayPositions[i][0] = restX[i] + ux[i];
            displayPositions[i][1] = restY[i] + uy[i];
        }
        return {
            masses: this.massInfo,
            springs: this.springInfo,
            struck: this.struckIndex >= 0
                ? displayPositions[this.struckIndex]
                : null,
        };
    }
    setParameters({ tension, mass, damping }) {
        this.tension = tension;
        this.mass = mass;
        this.damping = damping;
        this.updateStiffness();
    }
    /**
     * Scale the mesh's base k/m by the tension and mass sliders (relative to
     * their defaults), capped below the stability limit
     */
    updateStiffness() {
        const requested = this.baseKOverM *
            (this.tension / REFERENCE_TENSION) *
            (REFERENCE_MASS / this.mass);
        this.kOverM = Math.min(requested, this.maxKOverM);
        for (let s = 0; s < this.springK.length; s++) {
            this.springK[s] = this.kOverM * this.springStiffness[s];
        }
        for (let s = 0; s < this.groundK.length; s++) {
            this.groundK[s] = this.kOverM * this.groundStiffness[s];
        }
    }
    /**
     * Index of the free mass nearest to `location`, or -1 if there are no
     * free masses
     */
    findNearestMass(location) {
        const { freeIndices, restX, restY, ux, uy } = this;
        let smallestDistance = Number.MAX_VALUE;
        let closest = -1;
        for (let q = 0; q < freeIndices.length; q++) {
            const i = freeIndices[q];
            const dx = restX[i] + ux[i] - location[0];
            const dy = restY[i] + uy[i] - location[1];
            const dist = dx * dx + dy * dy;
            if (dist < smallestDistance) {
                smallestDistance = dist;
                closest = i;
            }
        }
        return closest;
    }
    /**
     * Apply an external force to the mass nearest `location`.  It takes
     * effect during the next simulation step.
     */
    strike(location, force) {
        const i = this.findNearestMass(location);
        if (i < 0) {
            return;
        }
        this.struckIndex = i;
        this.ax[i] += force[0] / this.mass;
        this.ay[i] += force[1] / this.mass;
    }
    /**
     * Advance the simulation one step per sample of `output`, writing the
     * (soft-clipped) total x displacement of all masses, weighted by their
     * output gains, into it
     */
    render(output) {
        const { ux, uy, vx, vy, ax, ay, springA, springB, springK, groundIndices, groundK, freeIndices, outputGain, } = this;
        const damping = this.damping;
        const nSprings = springA.length;
        const nGround = groundIndices.length;
        const nFree = freeIndices.length;
        for (let t = 0; t < output.length; t++) {
            // Spring forces: equal and opposite on each end
            for (let s = 0; s < nSprings; s++) {
                const i = springA[s];
                const j = springB[s];
                const k = springK[s];
                const fx = k * (ux[j] - ux[i]);
                const fy = k * (uy[j] - uy[i]);
                ax[i] += fx;
                ax[j] -= fx;
                ay[i] += fy;
                ay[j] -= fy;
            }
            for (let s = 0; s < nGround; s++) {
                const i = groundIndices[s];
                const k = groundK[s];
                ax[i] -= k * ux[i];
                ay[i] -= k * uy[i];
            }
            // Integrate (velocity, then position, then damping), clear
            // accumulated forces and sum the output in a single pass
            let sample = 0;
            for (let q = 0; q < nFree; q++) {
                const i = freeIndices[q];
                const nvx = vx[i] + ax[i];
                const nvy = vy[i] + ay[i];
                ux[i] += nvx;
                uy[i] += nvy;
                vx[i] = nvx * damping;
                vy[i] = nvy * damping;
                ax[i] = 0;
                ay[i] = 0;
                sample += outputGain[i] * ux[i];
            }
            output[t] = Math.tanh(sample);
        }
    }
}
/**
 * Randomly-placed masses joined by randomly-chosen springs (two per mass,
 * on average).  This has no well-defined fundamental, so it keeps the
 * stiffness it has always had (tension 0.1, mass 20).
 *
 * Unlike the string and plate, adding masses doesn't lower the pitch: springs
 * join arbitrary pairs of masses, so there's no "distance" for a wave to
 * cross, and the modes stay in roughly the same range (~100-800Hz at the
 * default stiffness).  More masses just pack more modes into it.
 */
const buildRandom = (nMasses = 512) => {
    const masses = [];
    for (let i = 0; i < nMasses; i++) {
        const position = new Float32Array([
            0.1 + Math.random() * 0.8,
            0.1 + Math.random() * 0.8,
        ]);
        masses.push(new Mass(i.toString(), position, Math.random() > 0.9));
    }
    const springs = [];
    for (let i = 0; i < nMasses * 2; i++) {
        const m1 = masses[Math.floor(Math.random() * nMasses)];
        const m2 = masses[Math.floor(Math.random() * nMasses)];
        springs.push(new Spring(m1, m2));
    }
    return new SpringMesh(springs, 0.1 / 20);
};
/**
 * A square membrane of `width` x `width` masses, with its edges fixed
 *
 * @param fundamentalHz frequency of the lowest mode
 */
const buildPlate = (width = 24, fundamentalHz = 156) => {
    const isBoundary = (index) => index === 0 || index === width - 1;
    const masses = [];
    for (let i = 0; i < width; i++) {
        const row = [];
        for (let j = 0; j < width; j++) {
            row.push(new Mass(`${i}_${j}`, new Float32Array([i / width, j / width]), isBoundary(i) || isBoundary(j)));
        }
        masses.push(row);
    }
    // Connect each mass to its right and lower neighbors (no diagonals),
    // which creates each bi-directional connection exactly once
    const springs = [];
    for (let i = 0; i < width; i++) {
        for (let j = 0; j < width; j++) {
            if (j + 1 < width) {
                springs.push(new Spring(masses[i][j], masses[i][j + 1]));
            }
            if (i + 1 < width) {
                springs.push(new Spring(masses[i][j], masses[i + 1][j]));
            }
        }
    }
    // The lowest mode of the grid is the lowest chain mode along each axis
    const lowestEigenvalue = 2 * chainEigenvalue(width - 2);
    return new SpringMesh(springs, kOverMForFrequency(fundamentalHz, lowestEigenvalue));
};
/**
 * Springs for a single string with both ends fixed, laid out horizontally at
 * height `row`, starting at `start` and `length` long.
 *
 * @param stiffness k/m multiplier for every spring in the string
 * @param outputGain contribution of every mass in the string to the output
 */
const stringSprings = (nMasses, row, start, length, idPrefix, stiffness = 1, outputGain = 1) => {
    const masses = [];
    for (let i = 0; i < nMasses; i++) {
        masses.push(new Mass(`${idPrefix}${i.toString()}`, new Float32Array([row, start + (i / nMasses) * length]), i === 0 || i === nMasses - 1, outputGain));
    }
    const springs = [];
    for (let i = 0; i < nMasses - 1; i++) {
        springs.push(new Spring(masses[i], masses[i + 1], stiffness));
    }
    return springs;
};
/**
 * A single string with both ends fixed
 *
 * @param fundamentalHz frequency of the lowest mode
 */
const buildString = (nMasses = 128, fundamentalHz = 39) => {
    return new SpringMesh(stringSprings(nMasses, 0.5, 0, 1, ''), kOverMForFrequency(fundamentalHz, chainEigenvalue(nMasses - 2)));
};
/** Scales, as semitones above the tonic */
const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    naturalMinor: [0, 2, 3, 5, 7, 8, 10],
    majorPentatonic: [0, 2, 4, 7, 9],
    minorPentatonic: [0, 3, 5, 7, 10],
};
const midiToHz = (note) => 440 * Math.pow(2, ((note - 69) / 12));
/**
 * Each harp string has enough masses for partials up to roughly this
 * frequency, so low strings get many masses and high strings only a few.
 *
 * Each string's k/m is then set to tune it exactly.  Around 7800Hz at a
 * 22050Hz sample rate this gives a k/m of ~0.5 for every string, which keeps
 * the low partials of each string within a few cents of true harmonics, while
 * leaving the tension slider room to raise the pitch by a few semitones before
 * the stability limit.
 */
const HARP_PARTIAL_CEILING_HZ = 7800;
/**
 * Pitch at which a harp string's output gain is 1.  A string's (summed
 * displacement) output is proportional to 1 / fundamental, so each string's
 * gain is its fundamental / this, to make them equally loud.
 */
const HARP_REFERENCE_HZ = 262;
/**
 * A harp: `nStrings` strings tuned in equal temperament to successive notes of
 * `scale`, starting from `lowestNote` (a MIDI note number, which is also the
 * scale's tonic).
 *
 * The default is a large lever harp: 36 strings tuned to C major, from C2 to
 * C7.  (A concert pedal harp is 47 strings, C1 to G7.)
 *
 * Strings are laid out horizontally, lowest at the bottom, getting shorter as
 * they get higher, like a harp lying on its side.  The drawn length is only
 * visual; pitch is set by each string's mass count and stiffness.
 */
const buildHarp = (nStrings = 36, lowestNote = 36, scale = SCALES.major) => {
    const notes = [];
    for (let i = 0; i < nStrings; i++) {
        const octave = Math.floor(i / scale.length);
        notes.push(lowestNote + 12 * octave + scale[i % scale.length]);
    }
    const lowestHz = midiToHz(notes[0]);
    const highestHz = midiToHz(notes[notes.length - 1]);
    const top = 0.05;
    const height = 0.9;
    const springs = [];
    notes.forEach((note, i) => {
        const hz = midiToHz(note);
        const nFree = Math.max(1, Math.floor(HARP_PARTIAL_CEILING_HZ / hz));
        const stiffness = kOverMForFrequency(hz, chainEigenvalue(nFree));
        // 0 for the lowest string, 1 for the highest
        const position = nStrings > 1
            ? Math.log(hz / lowestHz) / Math.log(highestHz / lowestHz)
            : 0;
        springs.push(...stringSprings(nFree + 2, top + height * (1 - position), 0.05, 0.9 - 0.7 * position, `string${i}_`, stiffness, hz / HARP_REFERENCE_HZ));
    });
    // Each string's stiffness already holds its own k/m
    return new SpringMesh(springs, 1);
};
class Physical extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.eventQueue = [];
        this.mesh = null;
        this.samplesComputed = 0;
        /**
         * Current slider values, kept here so they carry over when the model
         * type changes
         */
        this.parameters = {
            tension: REFERENCE_TENSION,
            mass: REFERENCE_MASS,
            damping: DEFAULT_DAMPING,
        };
        this.setMesh(buildString());
        this.port.postMessage(this.mesh.toMeshInfo());
        this.port.onmessage = (event) => {
            if (event.data.type === 'force-injection') {
                this.eventQueue.push(event.data);
            }
            else if (event.data.type === 'adjust-parameter') {
                const { name, value } = event.data;
                if (name === 'mass' ||
                    name === 'tension' ||
                    name === 'damping') {
                    this.parameters[name] = value;
                    this.mesh.setParameters(this.parameters);
                }
            }
            else if (event.data.type === 'model-type') {
                const { value } = event.data;
                if (value === 'plate') {
                    this.setMesh(buildPlate());
                }
                else if (value === 'string') {
                    this.setMesh(buildString());
                }
                else if (value === 'random') {
                    this.setMesh(buildRandom());
                }
                else if (value === 'multi-string') {
                    this.setMesh(buildHarp());
                }
                else {
                    throw new Error('Unsupported model type');
                }
            }
        };
    }
    setMesh(mesh) {
        mesh.setParameters(this.parameters);
        this.mesh = mesh;
    }
    process(inputs, outputs, parameters) {
        const left = outputs[0][0];
        // At most one force injection per block, applied at its first sample
        const f = this.eventQueue.shift();
        if (f !== undefined) {
            this.mesh.strike(f.location, f.force);
        }
        this.mesh.render(left);
        this.samplesComputed += left.length;
        if (this.samplesComputed % 1024 === 0) {
            this.port.postMessage(this.mesh.toMeshInfo());
        }
        return true;
    }
}
registerProcessor('physical-string-sim', Physical);
//# sourceMappingURL=physical.js.map