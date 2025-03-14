// TODO: for-loop and out parameter
const elementwiseDifference = (a, b, out) => {
    for (let i = 0; i < a.length; i++) {
        out[i] = a[i] - b[i];
    }
    return out;
};
// TODO: for-loop and out parameter
const elementwiseAdd = (a, b, out) => {
    for (let i = 0; i < a.length; i++) {
        out[i] = a[i] + b[i];
    }
    return out;
};
const zerosLike = (x) => {
    return new Float32Array(x.length).fill(0);
};
// TODO: re-implement as for-loop
const vectorSum = (vec) => {
    // return vec.reduce((accum, current) => accum + current, 0);
    let total = 0;
    for (let i = 0; i < vec.length; i++) {
        total += vec[i];
    }
    return total;
};
const vectorScalarDivide = (vec, scalar) => {
    for (let i = 0; i < vec.length; i++) {
        vec[i] = vec[i] / scalar;
    }
    return vec;
};
const vectorScalarMultiply = (vec, scalar) => {
    for (let i = 0; i < vec.length; i++) {
        vec[i] = vec[i] * scalar;
    }
    return vec;
};
const l2Norm = (vec) => {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) {
        norm += Math.pow(vec[i], 2);
    }
    return Math.sqrt(norm);
};
const el1Norm = (vec) => {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) {
        norm += Math.abs(vec[i]);
    }
    return norm;
};
const distance = (a, b) => {
    let distance = 0;
    for (let i = 0; i < a.length; i++) {
        distance += Math.pow((a[i] - b[i]), 2);
    }
    return Math.sqrt(distance);
};
const clamp = (value, min, max) => {
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
};
class Mass {
    // TODO: damping should be a single value Float32Array
    constructor(id, position, mass, damping, fixed = false) {
        this.id = id;
        this.position = position;
        this.mass = mass;
        this.damping = damping;
        this.fixed = fixed;
        this.origPosition = null;
        this.acceleration = null;
        this.velocity = null;
        this._diff = null;
        this.origPosition = new Float32Array(position);
        this.acceleration = zerosLike(position);
        this.velocity = zerosLike(position);
        this._diff = zerosLike(position);
    }
    // TODO: this allocates a new array each time.  Create a diff
    // instance variable, update and return it here
    get diff() {
        return this._diff;
    }
    // TODO: This allocates a new array each time, update acceleration in place
    applyForce(force) {
        this.acceleration = elementwiseAdd(this.acceleration, vectorScalarDivide(force, this.mass), this.acceleration);
    }
    // TODO: This allocates a new array each time, update velocity in place
    updateVelocity() {
        this.velocity = elementwiseAdd(this.velocity, this.acceleration, this.velocity);
    }
    // TODO: This allocates a new array each time, update in place
    updatePosition() {
        if (this.fixed) {
            return;
        }
        this.position = elementwiseAdd(this.position, this.velocity, this.position);
    }
    // TODO: This allocates a new array each time, update velocity in place
    clear() {
        this.velocity = vectorScalarMultiply(this.velocity, this.damping);
        this.acceleration = this.acceleration.fill(0);
        this._diff = elementwiseDifference(this.position, this.origPosition, this._diff);
    }
}
class Spring {
    // TODO: tension should be a single-value, Float32Array
    constructor(m1, m2, tension) {
        this.m1 = m1;
        this.m2 = m2;
        this.tension = tension;
        this.m1Resting = elementwiseDifference(m1.position, m2.position, zerosLike(m1.position));
        this.m2Resting = elementwiseDifference(m2.position, m1.position, zerosLike(m1.position));
        this.scratchpad = zerosLike(m1.position);
    }
    get masses() {
        return [this.m2, this.m2];
    }
    updateForces() {
        // compute for m1
        const current = elementwiseDifference(this.m1.position, this.m2.position, this.scratchpad);
        const displacement = elementwiseDifference(this.m1Resting, current, this.scratchpad);
        this.m1.applyForce(vectorScalarMultiply(displacement, this.tension));
        // compute for m2
        const c2 = elementwiseDifference(this.m2.position, this.m1.position, this.scratchpad);
        const d2 = elementwiseDifference(this.m2Resting, c2, this.scratchpad);
        this.m2.applyForce(vectorScalarMultiply(d2, this.tension));
    }
}
class Force {
    constructor(location, force) {
        this.location = location;
        this.force = force;
    }
}
class SpringMesh {
    constructor(springs) {
        this.springs = springs;
        this.masses = Object.values(springs.reduce((accum, current) => {
            accum[current.m1.id] = current.m1;
            accum[current.m2.id] = current.m2;
            return accum;
        }, {}));
    }
    toMeshInfo() {
        return {
            masses: this.masses.map(({ position }) => ({ position })),
        };
    }
    adjustTension(newTension) {
        this.springs.forEach((s) => (s.tension = newTension));
    }
    adjustMass(newMass) {
        this.masses.forEach((m) => (m.mass = newMass));
    }
    adjustDamping(newDamping) {
        this.masses.forEach((m) => (m.damping = newDamping));
    }
    findNearestMass(force) {
        let smallestDistance = Number.MAX_VALUE;
        let closestMassIndex = -1;
        for (let i = 0; i < this.masses.length; i++) {
            const m = this.masses[i];
            const dist = distance(m.position, force.location);
            if (dist < smallestDistance) {
                smallestDistance = dist;
                closestMassIndex = i;
            }
        }
        const nearest = this.masses[closestMassIndex];
        return nearest;
    }
    updateForces() {
        for (const spring of this.springs) {
            spring.updateForces();
        }
    }
    secondPass() {
        for (const mass of this.masses) {
            mass.updateVelocity();
            mass.updatePosition();
            mass.clear();
        }
    }
    simulationStep(force) {
        if (force !== null) {
            // compute any force applied from outside the system
            const nearest = this.findNearestMass(force);
            nearest.applyForce(force.force);
        }
        // TODO: update forces needs to happen at once, but everything after that only depends
        // on the forces already applied, so could be collapsed into a single loop.  Right now,
        // this loops over all masses four times in total.  We only need two passes.
        this.updateForces();
        this.secondPass();
        let outputSample = 0;
        for (let i = 0; i < this.masses.length; i++) {
            outputSample += this.masses[i].diff[0];
        }
        return Math.tanh(outputSample);
    }
}
const buildRandom = (mass = 20, tension = 0.1, damping = 0.9998, nMasses = 64) => {
    const masses = [];
    for (let i = 0; i < nMasses; i++) {
        const position = new Float32Array([Math.random(), Math.random()]);
        const m = new Mass(i.toString(), position, mass, damping, Math.random() > 0.9);
        masses.push(m);
    }
    const springs = [];
    for (let i = 0; i < nMasses * 2; i++) {
        const m1 = masses[Math.floor(Math.random() * nMasses)];
        const m2 = masses[Math.floor(Math.random() * nMasses)];
        const spring = new Spring(m1, m2, tension);
        springs.push(spring);
    }
    return new SpringMesh(springs);
};
const buildPlate = (mass = 20, tension = 0.1, damping = 0.9998, width = 6) => {
    const isBoundary = (index) => index === 0 || index === width - 1;
    const isOutOfBounds = (index) => index < 0 || index >= width;
    const makeKey = ([i, j]) => `${i}_${j}`;
    const parseKey = (key) => key.split('_').map((x) => parseInt(x));
    function* iterPositions() {
        for (let i = 0; i < width; i++) {
            for (let j = 0; j < width; j++) {
                yield [i, j];
            }
        }
    }
    const masses = Array.from(iterPositions()).reduce((accum, [i, j]) => {
        const newMass = new Mass(makeKey([i, j]), new Float32Array([i / width, j / width]), mass, damping, isBoundary(i) || isBoundary(j));
        const key = makeKey([i, j]);
        accum[key] = newMass;
        return accum;
    }, {});
    function* iterNeighbors(x, y) {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) {
                    // Don't connect to self
                    continue;
                }
                const newX = x + i;
                const newY = y + j;
                if (isOutOfBounds(newX) || isOutOfBounds(newY)) {
                    // don't connect to out-of-bounds neighbors
                    // that don't exist
                    continue;
                }
                yield [newX, newY];
            }
        }
    }
    const existing = new Set();
    const springs = Object.values(masses).reduce((accum, current) => {
        const [x, y] = parseKey(current.id);
        const newSprings = [];
        Array.from(iterNeighbors(x, y)).forEach(([i, j]) => {
            const currentKey = makeKey([x, y]);
            const neighborKey = makeKey([i, j]);
            // Springs are bi-directional, once we've built a connection,
            // it does not need to be revisited
            const s1 = `${currentKey}_${neighborKey}`;
            const s2 = `${neighborKey}_${currentKey}`;
            if (existing.has(s1) || existing.has(s2)) {
                return;
            }
            existing.add(s1);
            existing.add(s2);
            const neighborMass = masses[neighborKey];
            console.log(`Connecting mass ${makeKey([i, j])} to mass ${neighborKey}`);
            newSprings.push(new Spring(current, neighborMass, tension));
        });
        return [...accum, ...newSprings];
    }, []);
    const mesh = new SpringMesh(springs);
    return mesh;
};
const buildString = (mass = 10, tension = 0.5, damping = 0.9998, nMasses = 64) => {
    // Create the masses
    let masses = [];
    for (let i = 0; i < nMasses; i++) {
        const newMass = new Mass(i.toString(), new Float32Array([0.5, i / nMasses]), mass, damping, i === 0 || i === nMasses - 1);
        masses.push(newMass);
    }
    let springs = [];
    for (let i = 0; i < nMasses - 1; i++) {
        const newSpring = new Spring(masses[i], masses[i + 1], tension);
        springs.push(newSpring);
    }
    const mesh = new SpringMesh(springs);
    return mesh;
};
class Physical extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.eventQueue = [];
        this.mesh = null;
        this.samplesComputed = 0;
        this.mesh = buildString();
        this.port.postMessage(this.mesh.toMeshInfo());
        this.port.onmessage = (event) => {
            if (event.data.type === 'force-injection') {
                this.eventQueue.push(event.data);
            }
            else if (event.data.type === 'adjust-parameter') {
                const { name, value } = event.data;
                if (name === 'mass') {
                    this.mesh.adjustMass(value);
                }
                else if (name === 'tension') {
                    this.mesh.adjustTension(value);
                }
                else if (name === 'damping') {
                    this.mesh.adjustDamping(value);
                }
            }
            else if (event.data.type === 'model-type') {
                const { value } = event.data;
                if (value === 'plate') {
                    this.mesh = buildPlate();
                }
                else if (value === 'string') {
                    this.mesh = buildString();
                }
                else if (value === 'random') {
                    this.mesh = buildRandom();
                }
                else {
                    throw new Error('Unsupported model type');
                }
            }
        };
    }
    process(inputs, outputs, parameters) {
        const left = outputs[0][0];
        const nSteps = left.length;
        // TODO: remove this, temporarily, to see if it affects the number
        // of nodes I can compute
        const f = this.eventQueue.shift();
        for (let i = 0; i < nSteps; i++) {
            if (i === 0 && f !== undefined) {
                // TODO: don't allocate this at all, or make it a mutable instance
                // variable
                const frce = new Force(f.location, f.force);
                left[i] = this.mesh.simulationStep(frce);
            }
            else {
                left[i] = this.mesh.simulationStep(null);
            }
            this.samplesComputed += 1;
        }
        // TODO: Is it possible to remove this from the process loop
        // by making it a private async instance method?
        if (this.samplesComputed % 1024 === 0) {
            this.port.postMessage(this.mesh.toMeshInfo());
        }
        return true;
    }
}
registerProcessor('physical-string-sim', Physical);
//# sourceMappingURL=physical.js.map