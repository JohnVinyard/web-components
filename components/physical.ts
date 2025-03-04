// TODO: for-loop and out parameter
const elementwiseDifference = (
    a: Float32Array,
    b: Float32Array,
    out: Float32Array
): Float32Array => {
    // const out = zerosLike(a);
    // return a.map((x, i) => x - b[i]);
    for (let i = 0; i < a.length; i++) {
        out[i] = a[i] - b[i];
    }
    return out;
};

// TODO: for-loop and out parameter
const elementwiseAdd = (
    a: Float32Array,
    b: Float32Array,
    out: Float32Array
): Float32Array => {
    // const out = zerosLike(a);
    // return a.map((x, i) => x + b[i]);
    for (let i = 0; i < a.length; i++) {
        out[i] = a[i] + b[i];
    }
    return out;
};

const zerosLike = (x: Float32Array): Float32Array => {
    return new Float32Array(x.length).fill(0);
};

// TODO: re-implement as for-loop
const vectorSum = (vec: Float32Array): number => {
    // return vec.reduce((accum, current) => accum + current, 0);
    let total = 0;
    for (let i = 0; i < vec.length; i++) {
        total += vec[i];
    }
    return total;
};

const vectorScalarDivide = (
    vec: Float32Array,
    scalar: number
): Float32Array => {
    for (let i = 0; i < vec.length; i++) {
        vec[i] = vec[i] / scalar;
    }
    return vec;
};

const vectorScalarMultiply = (
    vec: Float32Array,
    scalar: number
): Float32Array => {
    for (let i = 0; i < vec.length; i++) {
        vec[i] = vec[i] * scalar;
    }
    return vec;
};

const l2Norm = (vec: Float32Array): number => {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) {
        norm += vec[i] ** 2;
    }
    return Math.sqrt(norm);
};

const el1Norm = (vec: Float32Array): number => {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) {
        norm += Math.abs(vec[i]);
    }
    return norm;
};

const distance = (a: Float32Array, b: Float32Array): number => {
    // const diff = elementwiseDifference(a, b);
    // return l2Norm(diff);
    let distance = 0;
    for (let i = 0; i < a.length; i++) {
        distance += (a[i] - b[i]) ** 2;
    }
    return Math.sqrt(distance);
};

const clamp = (value: number, min: number, max: number): number => {
    if (value < min) {
        return min;
    }

    if (value > max) {
        return max;
    }

    return value;
};

class Mass {
    private origPosition: Float32Array = null;
    private acceleration: Float32Array = null;
    public velocity: Float32Array = null;
    private _diff: Float32Array = null;

    // TODO: damping should be a single value Float32Array
    constructor(
        public readonly id: string,
        public position: Float32Array,
        public mass: number,
        public damping: number,
        public fixed: boolean = false
    ) {
        this.origPosition = new Float32Array(position);
        this.acceleration = zerosLike(position);
        this.velocity = zerosLike(position);
        this._diff = zerosLike(position);
    }

    // TODO: this allocates a new array each time.  Create a diff
    // instance variable, update and return it here
    public get diff(): Float32Array {
        return this._diff;
    }

    // TODO: This allocates a new array each time, update acceleration in place
    public applyForce(force: Float32Array) {
        this.acceleration = elementwiseAdd(
            this.acceleration,
            vectorScalarDivide(force, this.mass),
            this.acceleration
        );
    }

    // TODO: This allocates a new array each time, update velocity in place
    public updateVelocity() {
        this.velocity = elementwiseAdd(
            this.velocity,
            this.acceleration,
            this.velocity
        );
    }

    // TODO: This allocates a new array each time, update in place
    public updatePosition() {
        if (this.fixed) {
            return;
        }

        this.position = elementwiseAdd(
            this.position,
            this.velocity,
            this.position
        );
    }

    // TODO: This allocates a new array each time, update velocity in place
    public clear() {
        this.velocity = vectorScalarMultiply(this.velocity, this.damping);
        this.acceleration = this.acceleration.fill(0);
        this._diff = elementwiseDifference(
            this.position,
            this.origPosition,
            this._diff
        );
    }
}

class Spring {
    private m1Resting: Float32Array;
    private m2Resting: Float32Array;
    private scratchpad: Float32Array;

    // TODO: tension should be a single-value, Float32Array
    constructor(public m1: Mass, public m2: Mass, public tension: number) {
        this.m1Resting = elementwiseDifference(
            m1.position,
            m2.position,
            zerosLike(m1.position)
        );
        this.m2Resting = elementwiseDifference(
            m2.position,
            m1.position,
            zerosLike(m1.position)
        );
        this.scratchpad = zerosLike(m1.position);
    }

    public get masses(): Mass[] {
        return [this.m2, this.m2];
    }

    // TODO: current and c2 should be symmetric, thereforce, I should be able to just
    // invert the sign, I think?

    // TODO: private instance variable scratchpad for current and c2 to avoid memory allocation

    public updateForces() {
        // compute for m1
        const current = elementwiseDifference(
            this.m1.position,
            this.m2.position,
            this.scratchpad
        );
        const displacement = elementwiseDifference(
            this.m1Resting,
            current,
            this.scratchpad
        );
        this.m1.applyForce(vectorScalarMultiply(displacement, this.tension));

        // compute for m2
        const c2 = elementwiseDifference(
            this.m2.position,
            this.m1.position,
            this.scratchpad
        );
        const d2 = elementwiseDifference(this.m2Resting, c2, this.scratchpad);
        this.m2.applyForce(vectorScalarMultiply(d2, this.tension));
    }
}

class Force {
    constructor(
        public readonly location: Float32Array,
        public readonly force: Float32Array
    ) {}
}

class SpringMesh {
    private readonly masses: Mass[];

    constructor(private readonly springs: Spring[]) {
        this.masses = Object.values(
            springs.reduce((accum: Record<string, Mass>, current: Spring) => {
                accum[current.m1.id] = current.m1;
                accum[current.m2.id] = current.m2;
                return accum;
            }, {})
        );
    }

    public toMeshInfo(): MeshInfo {
        return {
            masses: this.masses.map(({ position }) => ({ position })),
        };
    }

    public adjustTension(newTension: number) {
        this.springs.forEach((s) => (s.tension = newTension));
    }

    public adjustMass(newMass: number) {
        this.masses.forEach((m) => (m.mass = newMass));
    }

    public adjustDamping(newDamping: number) {
        this.masses.forEach((m) => (m.damping = newDamping));
    }

    public findNearestMass(force: Force): Mass {
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

    public updateForces() {
        for (const spring of this.springs) {
            spring.updateForces();
        }
    }

    public secondPass() {
        for (const mass of this.masses) {
            mass.updateVelocity();
            mass.updatePosition();
            mass.clear();
        }
    }

    public simulationStep(force: Force | null): number {
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
            outputSample += el1Norm(this.masses[i].diff);
        }

        return Math.tanh(outputSample);
    }
}

const buildString = (
    mass: number = 10,
    tension: number = 0.5,
    damping: number = 0.9998,
    nMasses: number = 64
): SpringMesh => {
    // Create the masses256

    let masses: Mass[] = [];
    for (let i = 0; i < nMasses; i++) {
        const newMass = new Mass(
            i.toString(),
            new Float32Array([0, i / nMasses]),
            mass,
            damping,
            i === 0 || i === nMasses - 1
        );
        masses.push(newMass);
    }

    let springs: Spring[] = [];
    for (let i = 0; i < nMasses - 1; i++) {
        const newSpring = new Spring(masses[i], masses[i + 1], tension);
        springs.push(newSpring);
    }

    const mesh = new SpringMesh(springs);
    return mesh;
};

interface ForceInjectionEvent {
    force: Float32Array;
    location: Float32Array;
    type: 'force-injection';
}

interface AdjustParameterEvent {
    value: number;
    name: 'tension' | 'mass' | 'damping';
    type: 'adjust-parameter';
}

interface MassInfo {
    position: Float32Array;
}

interface MeshInfo {
    masses: MassInfo[];
}

type CommunicationEvent = ForceInjectionEvent | AdjustParameterEvent;

class Physical extends AudioWorkletProcessor {
    private eventQueue: ForceInjectionEvent[] = [];
    private mesh: SpringMesh = null;
    private samplesComputed = 0;

    constructor(options: AudioWorkletNodeOptions) {
        super();

        this.mesh = buildString();

        this.port.postMessage(this.mesh.toMeshInfo());

        this.port.onmessage = (event: MessageEvent<CommunicationEvent>) => {
            if (event.data.type === 'force-injection') {
                this.eventQueue.push(event.data);
            } else if (event.data.type === 'adjust-parameter') {
                const { name, value } = event.data;

                if (name === 'mass') {
                    this.mesh.adjustMass(value);
                } else if (name === 'tension') {
                    this.mesh.adjustTension(value);
                } else if (name === 'damping') {
                    this.mesh.adjustDamping(value);
                }
            }
        };
    }

    process(
        inputs: Float32Array[][],
        outputs: Float32Array[][],
        parameters: Record<string, Float32Array>
    ): boolean {
        const left = outputs[0][0];

        const nSteps = left.length;

        // TODO: remove this, temporarily, to see if it affects the number
        // of nodes I can compute
        const f: ForceInjectionEvent | undefined = this.eventQueue.shift();

        for (let i = 0; i < nSteps; i++) {
            if (i === 0 && f !== undefined) {
                // TODO: don't allocate this at all, or make it a mutable instance
                // variable
                const frce = new Force(f.location, f.force);
                left[i] = this.mesh.simulationStep(frce);
            } else {
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
