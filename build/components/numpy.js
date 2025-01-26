var DataType;
(function (DataType) {
    DataType["Float32"] = "<f4";
    DataType["Float64"] = "<f8";
    DataType["Uint32"] = "<u4";
})(DataType || (DataType = {}));
export const DataTypeOptions = new Set([
    DataType.Float32,
    DataType.Float64,
    DataType.Uint32,
]);
export const dataTypeGuard = (value) => {
    if (!DataTypeOptions.has(value)) {
        return false;
    }
    return true;
};
export const dtypeToConstructor = (dtype) => {
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
export const fromNpy = (raw) => {
    const headerAndData = raw.slice(8);
    const headerLen = new Uint16Array(headerAndData.slice(0, 2)).at(0);
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
    const arrayData = new (dtypeToConstructor(dtype))(headerAndData.slice(2 + headerLen));
    return [arrayData, shape];
};
//# sourceMappingURL=numpy.js.map