export declare class FinalizationGroup<
    Holdings = any,
    Token extends object = object
> {
    constructor(cleanupCallback: FinalizationGroup.CleanupCallback<Holdings>);

    register(target: object, holdings: Holdings, unregisterToken?: Token): void;
    unregister(unregisterToken: Token): boolean;
    cleanupSome(
        cleanupCallback?: FinalizationGroup.CleanupCallback<Holdings>
    ): void;
}

export declare namespace FinalizationGroup {
    export interface CleanupIterator<Holdings>
        extends IterableIterator<Holdings> {
        [Symbol.toStringTag]: string;
    }

    export interface CleanupCallback<Holdings> {
        (items: CleanupIterator<Holdings>): void;
    }

    export type Constructor = typeof FinalizationGroup;
}

export declare class WeakRef<T extends object = object> {
    constructor(target: T);
    deref(): T | undefined;
}

export declare namespace WeakRef {
    export type Constructor = typeof WeakRef;
}
