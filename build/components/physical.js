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
    constructor(id, position, fixed = false) {
        this.id = id;
        this.position = position;
        this.fixed = fixed;
    }
}
/**
 * Description of a single spring, used only while building a mesh.
 */
class Spring {
    constructor(m1, m2) {
        this.m1 = m1;
        this.m2 = m2;
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
        const free = [];
        this.masses.forEach((m, i) => {
            this.restX[i] = m.position[0];
            this.restY[i] = m.position[1];
            if (!m.fixed) {
                free.push(i);
            }
        });
        this.freeIndices = Int32Array.from(free);
        const springA = [];
        const springB = [];
        const ground = [];
        for (const { m1, m2 } of springs) {
            const i = indexOf.get(m1);
            const j = indexOf.get(m2);
            if (!m1.fixed && !m2.fixed) {
                springA.push(i);
                springB.push(j);
            }
            else if (!m1.fixed) {
                ground.push(i);
            }
            else if (!m2.fixed) {
                ground.push(j);
            }
        }
        this.springA = Int32Array.from(springA);
        this.springB = Int32Array.from(springB);
        this.groundIndices = Int32Array.from(ground);
        // Bound the largest eigenvalue of the spring network (Gershgorin):
        // for each free mass, (springs attached to it) + (springs to other
        // free masses).  A spring from a mass to itself exerts no force.
        const diagonal = new Float64Array(n);
        const offDiagonal = new Float64Array(n);
        for (let s = 0; s < springA.length; s++) {
            const i = springA[s];
            const j = springB[s];
            if (i !== j) {
                diagonal[i] += 1;
                diagonal[j] += 1;
                offDiagonal[i] += 1;
                offDiagonal[j] += 1;
            }
        }
        for (const i of ground) {
            diagonal[i] += 1;
        }
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
     * (soft-clipped) total x displacement of all masses into it
     */
    render(output) {
        const { ux, uy, vx, vy, ax, ay, springA, springB, groundIndices, freeIndices, } = this;
        const kOverM = this.kOverM;
        const damping = this.damping;
        const nSprings = springA.length;
        const nGround = groundIndices.length;
        const nFree = freeIndices.length;
        for (let t = 0; t < output.length; t++) {
            // Spring forces: equal and opposite on each end
            for (let s = 0; s < nSprings; s++) {
                const i = springA[s];
                const j = springB[s];
                const fx = kOverM * (ux[j] - ux[i]);
                const fy = kOverM * (uy[j] - uy[i]);
                ax[i] += fx;
                ax[j] -= fx;
                ay[i] += fy;
                ay[j] -= fy;
            }
            for (let s = 0; s < nGround; s++) {
                const i = groundIndices[s];
                ax[i] -= kOverM * ux[i];
                ay[i] -= kOverM * uy[i];
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
                sample += ux[i];
            }
            output[t] = Math.tanh(sample);
        }
    }
}
/**
 * Randomly-placed masses joined by randomly-chosen springs.  This has no
 * well-defined fundamental, so it keeps the stiffness it has always had
 * (tension 0.1, mass 20).
 */
const buildRandom = (nMasses = 64) => {
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
 * Springs for a single string of `nMasses` masses with both ends fixed
 */
const stringSprings = (nMasses, xPos, lengthCoefficient, idPrefix) => {
    const masses = [];
    for (let i = 0; i < nMasses; i++) {
        masses.push(new Mass(`${idPrefix}${i.toString()}`, new Float32Array([xPos, (i / nMasses) * lengthCoefficient]), i === 0 || i === nMasses - 1));
    }
    const springs = [];
    for (let i = 0; i < nMasses - 1; i++) {
        springs.push(new Spring(masses[i], masses[i + 1]));
    }
    return springs;
};
/**
 * A single string with both ends fixed
 *
 * @param fundamentalHz frequency of the lowest mode
 */
const buildString = (nMasses = 128, fundamentalHz = 39) => {
    return new SpringMesh(stringSprings(nMasses, 0.5, 1, ''), kOverMForFrequency(fundamentalHz, chainEigenvalue(nMasses - 2)));
};
/**
 * `nStrings` strings of increasing length, sharing a single stiffness.
 * String `i` has `(3 + i) * massMultiplier` masses, so the strings' pitches
 * are spread out by their lengths.
 *
 * @param lowestFundamentalHz fundamental of the longest string
 */
const buildMultiString = (massMultiplier = 2, nStrings = 10, lowestFundamentalHz = 223) => {
    const massesInString = (i) => (3 + i) * massMultiplier;
    const springs = [];
    for (let i = 0; i < nStrings; i++) {
        springs.push(...stringSprings(massesInString(i), i / nStrings, (i + 1) / nStrings, `string${i}_`));
    }
    const longest = massesInString(nStrings - 1);
    return new SpringMesh(springs, kOverMForFrequency(lowestFundamentalHz, chainEigenvalue(longest - 2)));
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
                    this.setMesh(buildMultiString());
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