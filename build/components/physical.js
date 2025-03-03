const elementwiseDifference = (a, b) => {
    return a.map((x, i) => x - b[i]);
};
const elementwiseAdd = (a, b) => {
    return a.map((x, i) => x + b[i]);
};
const zerosLike = (x) => {
    return new Float32Array(x.length).fill(0);
};
const vectorSum = (vec) => {
    return vec.reduce((accum, current) => accum + current, 0);
};
const vectorScalarDivide = (vec, scalar) => {
    return vec.map((x) => x / scalar);
};
const vectorScalarMultiply = (vec, scalar) => {
    return vec.map((x) => x * scalar);
};
const l2Norm = (vec) => {
    const squared = vec.map((x) => Math.pow(x, 2));
    return Math.sqrt(vectorSum(squared));
};
const el1Norm = (vec) => {
    return vectorSum(vec.map(Math.abs));
};
const distance = (a, b) => {
    const diff = elementwiseDifference(a, b);
    return l2Norm(diff);
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
    constructor(id, position, mass, damping, fixed = false) {
        this.id = id;
        this.position = position;
        this.mass = mass;
        this.damping = damping;
        this.fixed = fixed;
        this.origPosition = null;
        this.acceleration = null;
        this.velocity = null;
        this.origPosition = new Float32Array(position);
        this.acceleration = zerosLike(position);
        this.velocity = zerosLike(position);
    }
    get diff() {
        return elementwiseDifference(this.position, this.origPosition);
    }
    applyForce(force) {
        this.acceleration = elementwiseAdd(this.acceleration, vectorScalarDivide(force, this.mass));
    }
    updateVelocity() {
        this.velocity = elementwiseAdd(this.velocity, this.acceleration);
    }
    updatePosition() {
        if (this.fixed) {
            return;
        }
        this.position = elementwiseAdd(this.position, this.velocity);
    }
    clear() {
        this.velocity = vectorScalarMultiply(this.velocity, this.damping);
        this.acceleration = this.acceleration.fill(0);
    }
}
class Spring {
    constructor(m1, m2, tension) {
        this.m1 = m1;
        this.m2 = m2;
        this.tension = tension;
        this.m1Resting = elementwiseDifference(m1.position, m2.position);
        this.m2Resting = elementwiseDifference(m2.position, m1.position);
    }
    get masses() {
        return [this.m2, this.m2];
    }
    updateForces() {
        // compute for m1
        const current = elementwiseDifference(this.m1.position, this.m2.position);
        const displacement = elementwiseDifference(this.m1Resting, current);
        this.m1.applyForce(vectorScalarMultiply(displacement, this.tension));
        // compute for m2
        const c2 = elementwiseDifference(this.m2.position, this.m1.position);
        const d2 = elementwiseDifference(this.m2Resting, c2);
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
        this.masses.forEach((m, index) => {
            const dist = distance(m.position, force.location);
            if (dist < smallestDistance) {
                smallestDistance = dist;
                closestMassIndex = index;
            }
        });
        return this.masses[closestMassIndex];
    }
    updateForces() {
        for (const spring of this.springs) {
            spring.updateForces();
        }
    }
    updateVelocities() {
        for (const mass of this.masses) {
            mass.updateVelocity();
        }
    }
    updatePositions() {
        for (const mass of this.masses) {
            mass.updatePosition();
        }
    }
    clear() {
        for (const mass of this.masses) {
            mass.clear();
        }
    }
    simulationStep(force) {
        if (force !== null) {
            const nearest = this.findNearestMass(force);
            console.log('NEAREST', nearest);
            nearest.applyForce(force.force);
        }
        this.updateForces();
        this.updateVelocities();
        this.updatePositions();
        this.clear();
        const outputSample = this.masses.reduce((accum, mass) => {
            return accum + el1Norm(mass.diff);
        }, 0);
        return outputSample;
    }
}
/**
 * def build_string():
    mass = 10
    tension = 0.9
    damping = 0.9998
    n_masses = 100

    x_pos = np.linspace(0, 1, num=n_masses)
    positions = np.zeros((n_masses, 3))
    positions[:, 0] = x_pos

    masses = [
        Mass(str(i), pos, mass, damping, fixed=i == 0 or i == n_masses - 1)
        for i, pos in enumerate(positions)
    ]

    springs = [
        Spring(masses[i], masses[i + 1], tension)
        for i in range(n_masses - 1)
    ]

    mesh = SpringMesh(springs)
    return mesh

 */
const buildString = (mass = 10, tension = 0.5, damping = 0.9998, nMasses = 16) => {
    // Create the masses
    let masses = [];
    for (let i = 0; i < nMasses; i++) {
        const newMass = new Mass(i.toString(), new Float32Array([0, i / nMasses]), mass, damping, i === 0 || i === nMasses - 1);
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
        };
    }
    process(inputs, outputs, parameters) {
        const left = outputs[0][0];
        const nSteps = left.length;
        const f = this.eventQueue.shift();
        const output = new Float32Array(nSteps);
        for (let i = 0; i < nSteps; i++) {
            if (i === 0 && f !== undefined) {
                const frce = new Force(f.location, f.force);
                output[i] = this.mesh.simulationStep(frce);
            }
            else {
                output[i] = this.mesh.simulationStep(null);
            }
            this.samplesComputed += 1;
        }
        left.set(output);
        if (this.samplesComputed % 1024 === 0) {
            this.port.postMessage(this.mesh.toMeshInfo());
        }
        return true;
    }
}
registerProcessor('physical-string-sim', Physical);
//# sourceMappingURL=physical.js.map