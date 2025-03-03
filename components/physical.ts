const elementwiseDifference = (
    a: Float32Array,
    b: Float32Array
): Float32Array => {
    return a.map((x, i) => x - b[i]);
};

const elementwiseAdd = (a: Float32Array, b: Float32Array): Float32Array => {
    return a.map((x, i) => x + b[i]);
};

const zerosLike = (x: Float32Array): Float32Array => {
    return new Float32Array(x.length).fill(0);
};

const vectorSum = (vec: Float32Array): number => {
    return vec.reduce((accum, current) => accum + current, 0);
};

const vectorScalarDivide = (
    vec: Float32Array,
    scalar: number
): Float32Array => {
    return vec.map((x) => x / scalar);
};

const vectorScalarMultiply = (
    vec: Float32Array,
    scalar: number
): Float32Array => {
    return vec.map((x) => x * scalar);
};

const l2Norm = (vec: Float32Array): number => {
    const squared = vec.map((x) => x ** 2);
    return Math.sqrt(vectorSum(squared));
};

const el1Norm = (vec: Float32Array): number => {
    return vectorSum(vec.map(Math.abs));
};

const distance = (a: Float32Array, b: Float32Array): number => {
    const diff = elementwiseDifference(a, b);
    return l2Norm(diff);
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
    private velocity: Float32Array = null;

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
    }

    public get diff(): Float32Array {
        return elementwiseDifference(this.position, this.origPosition);
    }

    public applyForce(force: Float32Array) {
        this.acceleration = elementwiseAdd(
            this.acceleration,
            vectorScalarDivide(force, this.mass)
        );
    }

    public updateVelocity() {
        this.velocity = elementwiseAdd(this.velocity, this.acceleration);
    }

    public updatePosition() {
        if (this.fixed) {
            return;
        }

        this.position = elementwiseAdd(this.position, this.velocity);
    }

    public clear() {
        this.velocity = vectorScalarMultiply(this.velocity, this.damping);
        this.acceleration = this.acceleration.fill(0);
    }
}

class Spring {
    private m1Resting: Float32Array;
    private m2Resting: Float32Array;

    constructor(public m1: Mass, public m2: Mass, public tension: number) {
        this.m1Resting = elementwiseDifference(m1.position, m2.position);
        this.m2Resting = elementwiseDifference(m2.position, m1.position);
    }

    public get masses(): Mass[] {
        return [this.m2, this.m2];
    }

    public updateForces() {
        // compute for m1
        const current = elementwiseDifference(
            this.m1.position,
            this.m2.position
        );
        const displacement = elementwiseDifference(this.m1Resting, current);
        this.m1.applyForce(vectorScalarMultiply(displacement, this.tension));

        // compute for m2
        const c2 = elementwiseDifference(this.m2.position, this.m1.position);
        const d2 = elementwiseDifference(this.m2Resting, c2);
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

    public updateVelocities() {
        for (const mass of this.masses) {
            mass.updateVelocity();
        }
    }

    public updatePositions() {
        for (const mass of this.masses) {
            mass.updatePosition();
        }
    }

    public clear() {
        for (const mass of this.masses) {
            mass.clear();
        }
    }

    public simulationStep(force: Force | null): number {
        if (force !== null) {
            const nearest = this.findNearestMass(force);
            console.log('NEAREST', nearest);
            nearest.applyForce(force.force);
        }

        this.updateForces();
        this.updateVelocities();
        this.updatePositions();
        this.clear();

        const outputSample: number = this.masses.reduce((accum, mass) => {
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

const buildString = (
    mass: number = 10,
    tension: number = 0.5,
    damping: number = 0.9998,
    nMasses: number = 16
): SpringMesh => {
    // Create the masses

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

        const f: ForceInjectionEvent | undefined = this.eventQueue.shift();

        const output: Float32Array = new Float32Array(nSteps);

        for (let i = 0; i < nSteps; i++) {
            if (i === 0 && f !== undefined) {
                const frce = new Force(f.location, f.force);
                output[i] = this.mesh.simulationStep(frce);
            } else {
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
