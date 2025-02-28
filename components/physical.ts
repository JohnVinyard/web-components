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
    throw new Error('Not Implemented');
};

class Mass {
    private origPosition: Float32Array = null;
    private acceleration: Float32Array = null;
    private velocity: Float32Array = null;

    constructor(
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
            this.velocity,
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

    public clear() {}
}

/**
 * class Mass(object):

    def __init__(
            self,
            _id: str,
            position: np.ndarray,
            mass: float,
            damping: float,
            fixed: bool = False):
        super().__init__()
        self._id = _id
        self.position = position.astype(np.float32)
        self.orig_position = self.position.copy()
        self.mass = mass
        self.damping = damping
        self.acceleration = np.zeros_like(self.position)
        self.velocity = np.zeros_like(self.position)
        self.fixed = fixed

    

    def diff(self):
        return self.position - self.orig_position

    def apply_force(self, force: np.ndarray):
        self.acceleration += force / self.mass

    def update_velocity(self):
        self.velocity += self.acceleration

    def update_position(self):
        if self.fixed:
            return

        self.position += self.velocity

    def clear(self):
        self.velocity *= self.damping
        self.acceleration = np.zeros_like(self.acceleration)


class Spring(object):
    def __init__(self, m1: Mass, m2: Mass, tension: float):
        super().__init__()
        self.m1 = m1
        self.m2 = m2
        self.tension = tension

        # 3D vector representing the resting state/length of the spring
        self.m1_resting = self.m1.position - self.m2.position
        self.m2_resting = self.m2.position - self.m1.position

    def __str__(self):
        return f'Spring({self.m1}, {self.m2}, {self.tension})'

    def __repr__(self):
        return self.__str__()

    def masses(self):
        return [self.m1, self.m2]

    def update_forces(self):
        # compute for m1
        current = self.m1.position - self.m2.position
        displacement = self.m1_resting - current
        self.m1.apply_force(displacement * self.tension)

        # compute for m2
        current = self.m2.position - self.m1.position
        displacement = self.m2_resting - current
        self.m2.apply_force(displacement * self.tension)

 */

class Physical extends AudioWorkletProcessor {
    constructor(options: AudioWorkletNodeOptions) {
        super();
    }

    process(
        inputs: Float32Array[][],
        outputs: Float32Array[][],
        parameters: Record<string, Float32Array>
    ): boolean {
        return true;
    }
}
