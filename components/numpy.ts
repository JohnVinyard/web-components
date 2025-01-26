import { TypedArray } from 'three';

interface Accessible {
    at(index: number): number;
}

export type AccessibleTypeArray = TypedArray & Accessible;

enum DataType {
    Float32 = '<f4',
    Float64 = '<f8',
    Uint32 = '<u4',
}

export const DataTypeOptions = new Set<string>([
    DataType.Float32,
    DataType.Float64,
    DataType.Uint32,
]);

export const dataTypeGuard = (value: string): value is DataType => {
    if (!DataTypeOptions.has(value)) {
        return false;
    }

    return true;
};

export const dtypeToConstructor = (dtype: DataType) => {
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



export const fromNpy = (raw: ArrayBuffer): [AccessibleTypeArray, any] => {
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
    return [arrayData, shape];
};
