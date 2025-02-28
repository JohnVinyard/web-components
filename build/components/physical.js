const elementwiseDifference = (a, b) => {
    return a.map((x, i) => x - b[i]);
};
const elementwiseAdd = (a, b) => {
    return a.map((x, i) => x + b[i]);
};
const zerosLike = (x) => {
    return new Float32Array(x.length).fill(0);
};
const vectorScalarDivide = (vec, scalar) => {
    return vec.map((x) => x / scalar);
};
const vectorScalarMultiply = (vec, scalar) => {
    throw new Error('Not Implemented');
};
class Mass {
    constructor(position, mass, damping, fixed = false) {
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
        this.acceleration = elementwiseAdd(this.velocity, vectorScalarDivide(force, this.mass));
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
    clear() { }
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
    constructor(options) {
        super();
    }
    process(inputs, outputs, parameters) {
        return true;
    }
}
//# sourceMappingURL=physical.js.map