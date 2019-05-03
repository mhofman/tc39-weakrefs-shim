export declare class WeakTag {
    constructor(info: ObjectInfo);
}

export declare namespace ObjectInfo {
    export interface FinalizedCallback<T extends object = object> {
        (this: ObjectInfo<T>): void;
    }
}

export class ObjectInfo<T extends object = object> {
    constructor(target: T, finalizedCallback: ObjectInfo.FinalizedCallback<T>);

    readonly target: T | undefined;
}
