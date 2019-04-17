export interface WeakTag {}

export namespace WeakTag {
    export interface Constructor {
        new <T extends object>(info: ObjectInfo<T>): WeakTag;
    }

    export interface ObjectInfo<T extends object = object> {
        readonly target: T | undefined;
    }

    export interface FinalizedCallback<T extends object = object> {
        (this: ObjectInfo<T>): void;
    }

    export namespace ObjectInfo {
        export interface Constructor {
            new <T extends object>(
                target: T,
                finalizedCallback: FinalizedCallback<T>
            ): ObjectInfo<T>;
        }
    }
}

declare module "./weak-napi" {
    var WeakTag: WeakTag.Constructor;
    var ObjectInfo: WeakTag.ObjectInfo.Constructor;
}
