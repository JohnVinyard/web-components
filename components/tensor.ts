import {
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
    Clock,
    AmbientLight,
    Object3D,
    Object3DEventMap,
    TypedArray,
    Color,
    Mesh,
    MeshBasicMaterial,
    BoxGeometry,
} from 'three';
import { OrbitControls } from 'three-orbitcontrols-ts';

type Point = [number, number, number];

type WorldChild = Object3D<Object3DEventMap>;

interface Accessible {
    at(index: number): number;
}

type AccessibleTypeArray = TypedArray & Accessible;

class World {
    private readonly camera: PerspectiveCamera;
    private readonly renderer: WebGLRenderer;
    public readonly scene: Scene;
    private readonly clock: Clock;
    private elapsedTime: number = 0;
    private orbitControls: OrbitControls;
    public isStarted: boolean = false;

    constructor(
        private readonly myCanvas: HTMLCanvasElement,
        private readonly cameraPosition: Point,
        private readonly enableOrbitControls: boolean
    ) {
        this.enableOrbitControls = enableOrbitControls;

        const scene = new Scene();

        const camera = new PerspectiveCamera(
            50,
            myCanvas.offsetWidth / myCanvas.offsetHeight
        );
        camera.position.set(...cameraPosition);
        this.camera = camera;

        const renderer = new WebGLRenderer({ canvas: myCanvas });
        renderer.setClearColor(0xeeeeee, 1.0);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(myCanvas.offsetWidth, myCanvas.offsetHeight);
        this.renderer = renderer;

        if (this.enableOrbitControls) {
            this.setupOrbitControls();
        }

        const clock = new Clock(true);

        const directionalLight = new AmbientLight(0xffffff);
        directionalLight.position.x = 0;
        directionalLight.position.y = 0;
        directionalLight.position.z = -10;
        scene.add(directionalLight);

        this.scene = scene;
        this.clock = clock;

        this.elapsedTime = 0;

        // this.sceneUpdater = null;

        this.isStarted = false;
    }

    setCameraPosition(pos: Point) {
        this.camera.position.set(...pos);
    }

    setupOrbitControls() {
        const orbitControls = new OrbitControls(
            this.camera,
            this.renderer.domElement
        );
        orbitControls.enablePan = true;
        orbitControls.enableRotate = true;
        orbitControls.minDistance = 0.1;
        orbitControls.maxDistance = 100;
        this.orbitControls = orbitControls;
    }

    get nChilidren() {
        return this.scene.children.length;
    }

    childAt(index: number) {
        return this.scene.children[index];
    }

    getObjectByName(name: string) {
        return this.scene.getObjectByName(name);
    }

    traverseChildren(func: (child: WorldChild) => void) {
        this.scene.children.forEach(func);
    }

    clear() {
        while (this.scene.children.length) {
            this.scene.remove(this.scene.children[0]);
        }
    }

    start() {
        this.isStarted = true;

        this.renderer.setAnimationLoop(() => {
            this.elapsedTime += this.clock.getDelta();
            this.renderer.render(this.scene, this.camera);
        });
    }

    stop() {
        throw new Error('Not Implemented');
    }
}

enum DataType {
    Float32 = '<f4',
    Float64 = '<f8',
    Uint32 = '<u4',
}

const DataTypeOptions = new Set<string>([
    DataType.Float32,
    DataType.Float64,
    DataType.Uint32,
]);

const dataTypeGuard = (value: string): value is DataType => {
    if (!DataTypeOptions.has(value)) {
        return false;
    }

    return true;
};

const dtypeToConstructor = (dtype: DataType) => {
    if (dtype === '<f4') {
        return Float32Array;
    }

    if (dtype === '<f8') {
        return Float64Array;
    }

    if (dtype === '<u4') {
        return Uint32Array;
    }

    throw new Error(`Type ${dtype} not implemented`);
};

const product = (arr: number[]): number => {
    if (arr.length === 0) {
        return 1;
    }
    return arr.reduce((accum, current) => accum * current, 1);
};

const strides = (shape: number[]): number[] => {
    return shape.map((x, index, arr) => product(arr.slice(index + 1)));
};

const computeIndices = (
    flatIndex: number,
    shape: number[],
    stride: number[]
) => {
    return shape.map((sh, index) => {
        return Math.floor(flatIndex / stride[index]) % sh;
    });
};

type Visitor = (value: number, location: number[], scene: Scene) => void;

const visit = (
    typedArray: AccessibleTypeArray,
    shape: number[],
    visitor: Visitor,
    scene: Scene
) => {
    const stride = strides(shape);

    const shapes = [];

    for (let i = 0; i < typedArray.length; i++) {
        const location = computeIndices(i, shape, stride);
        const shpe = visitor(typedArray.at(i), location, scene);
        shapes.push(shpe);
    }

    return shapes;
};

class TensorData {
    private readonly strides: number[];

    constructor(
        private readonly data: AccessibleTypeArray,
        private readonly shape: number[],
        private readonly metadata: Record<string, string> = {}
    ) {
        this.data = data;
        this.shape = shape;
        this.strides = strides(shape);
        this.metadata = metadata;
    }

    get nDim(): number {
        return this.shape.length;
    }

    get totalSize(): number {
        return this.data.length;
    }

    get maxValue(): number {
        let max = 0;

        for (let i = 0; i < this.totalSize; i++) {
            const v = this.data.at(i);
            if (v > max) {
                max = v;
            }
        }

        return max;
    }

    get minValue(): number {
        let min = Infinity;

        for (let i = 0; i < this.totalSize; i++) {
            const v = this.data.at(i);
            if (v < min) {
                min = v;
            }
        }

        return min;
    }

    toRGBA(scene: Scene): Uint8ClampedArray {
        const arr = new Uint8ClampedArray(this.totalSize * 4);

        this.visit((value: number, loc: number[]) => {
            const [x, y] = loc;
            const scaled = Math.floor(value * 255);
            const pos =
                Math.floor(x * this.strides[0]) +
                Math.floor(y * this.strides[1]);
            arr[pos] = scaled;
            arr[pos + 1] = scaled;
            arr[pos + 2] = scaled;
            arr[pos + 3] = scaled;
        }, scene);

        return arr;
    }

    getElement(channel: number): TensorData | number {
        // return a new tensor resulting from index
        // the first dimension of this one, or, if the
        // tensor is one dimensional, return the value
        if (this.nDim === 1) {
            return this.data.at(channel);
        }

        const channelStride = this.strides[0];

        const remainingShape = this.shape.slice(1);
        const start = channel * channelStride;
        const nElements = product(remainingShape);
        const newData = this.data.slice(
            start,
            start + nElements
        ) as AccessibleTypeArray;

        return new TensorData(newData, remainingShape);
    }

    getChannelData(channel: number): number[] {
        // TODO: replace this with the more general getElement
        const [channelStride, elementStride] = this.strides;
        const output = [];

        const start = channel * channelStride;
        const channelSize = this.shape[1];
        const end = start + channelSize;

        for (let i = start; i < end; i += elementStride) {
            output.push(this.data.at(i));
        }
        return output;
    }

    indices(flat: number) {
        return computeIndices(flat, this.shape, this.strides);
    }

    visit(visitor: any, scene: Scene) {
        return visit(this.data, this.shape, visitor, scene);
    }

    static async fromNpy(raw: ArrayBuffer) {
        const headerAndData = raw.slice(8);
        const headerLen = (
            new Uint16Array(headerAndData.slice(0, 2)) as AccessibleTypeArray
        ).at(0);

        const arr = new Uint8Array(headerAndData.slice(2, 2 + headerLen));
        const str = String.fromCharCode(...arr);
        const dtypePattern = /('descr':\s+)'([^']+)'/;
        const shapePattern = /('shape':\s+)(\([^/)]+\))/;

        const dtype = str.match(dtypePattern)[2];
        if (!dataTypeGuard(dtype)) {
            throw new Error(`Only ${DataTypeOptions} are currently supported`);
        }
        const rawShape = str.match(shapePattern)[2];
        const hasTrailingComma = rawShape.slice(-2)[0] === ',';
        const truncated = rawShape.slice(1, hasTrailingComma ? -2 : -1);
        const massagedShape = `[${truncated}]`;
        const shape = JSON.parse(massagedShape);
        const arrayData = new (dtypeToConstructor(dtype))(
            headerAndData.slice(2 + headerLen)
        ) as AccessibleTypeArray;
        return new TensorData(arrayData, shape);
    }

    static async fromURL(url: string): Promise<TensorData> {
        if (!url || url.length === 0) {
            return new TensorData(new Uint8Array(), [0]);
        }

        try {
            return await fetch(url).then(async (resp) => {
                const raw = await resp.arrayBuffer();
                return TensorData.fromNpy(raw);
            });
        } catch (err) {
            console.log(err);
            throw err;
        }
    }
}

export class TensorView extends HTMLElement {
    private world: World | null = null;
    private tensor: TensorData | null = null;

    /**
     *
     * @param src - A URL pointing to data stored in npy format OR
     * a data url with the content type application/npy, e.g.:
     *
     * data:application/npy;base64,k05VTVBZAQB2AHsnZGVzY3InOiAnPGY4JywgJ2ZvcnRyYW5fb3JkZXInOiBGYWxzZSwgJ3NoYXBlJzogKDgsKSwgfSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAqQKP/A8rDDv1NKJCtJXNc/MA5EIEXN17+/EQkQ+WnwvwaLr7Oc9KM/JCO1MVc87D/eQQ8SoDnVPwdI44ffeP0/
     *
     */
    constructor(
        public src: string,
        public width: string,
        public height: string
    ) {
        super();
    }

    private buildVisitor() {
        const renderCubeVisitor = (
            value: number,
            location: number[],
            scene: Scene
        ) => {
            const [x, y, z] = location;

            const size = 0.5;

            const color = new Color(1 * value, 0.5 * value, 0.1 * value);

            const geometry = new BoxGeometry(size, size, size);
            const material = new MeshBasicMaterial({
                color,
            });
            const cube = new Mesh(geometry, material);
            cube.position.x = (x || 0) * size;
            cube.position.y = (y || 0) * size;
            cube.position.z = (z || 0) * size;

            scene.add(cube);

            return cube;
        };
        return renderCubeVisitor;
    }

    private async render(): Promise<void> {
        console.log('TensorView.render()');

        this.tensor = await TensorData.fromURL(this.src);

        let shadow: ShadowRoot | null = this.shadowRoot;

        if (!shadow) {
            shadow = this.attachShadow({ mode: 'open' });
        }

        shadow.innerHTML = `
            <div width="${this.width}" height="${this.height}">
                <canvas width="${this.width}" height="${this.height}">
                </canvas>
            </div>
        `;

        const canvas = shadow.querySelector('canvas');

        if (this.world) {
            this.world.clear();
        }

        const world = new World(canvas, [10, 10, 10], true);
        this.world = world;

        // render the initial scene
        this.tensor.visit(this.buildVisitor(), this.world.scene);

        if (!this.world.isStarted) {
            this.world.start();
        }
    }

    public static get observedAttributes(): (keyof TensorView)[] {
        return ['src', 'width', 'height'];
    }

    public attributeChangedCallback(
        property: string,
        oldValue: string,
        newValue: string
    ) {
        if (newValue === oldValue) {
            return;
        }

        this[property] = newValue;

        const obs = new Set<string>(TensorView.observedAttributes);

        if (obs.has(property)) {
            console.log('Re-rendering');
            this.render();
        }
    }

    public connectedCallback() {
        console.log('TENSOR connected');
        this.render();
    }
}

window.customElements.define('tensor-view', TensorView);
