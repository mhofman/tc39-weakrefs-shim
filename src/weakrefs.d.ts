export interface WeakRef<T extends object = object> {
    deref(): T | undefined;
}

export declare namespace WeakRef {
    export interface Constructor {
        new <T extends object = object>(target: T): WeakRef<T>;
    }
}

export interface FinalizationGroup<
    Holdings = any,
    Token extends object = object
> {
    register(target: object, holdings: Holdings, unregisterToken?: Token): void;
    unregister(unregisterToken: Token): boolean;
    cleanupSome(
        cleanupCallback?: FinalizationGroup.CleanupCallback<Holdings>
    ): void;
}

export declare namespace FinalizationGroup {
    export interface CleanupIterator<Holdings = any>
        extends IterableIterator<Holdings> {
        [Symbol.toStringTag]: "FinalizationGroup Cleanup Iterator";
    }

    export interface CleanupCallback<Holdings = any> {
        (items: CleanupIterator<Holdings>): void;
    }

    export interface Constructor {
        new <Holdings = any, Token extends object = object>(
            cleanupCallback: FinalizationGroup.CleanupCallback<Holdings>
        ): FinalizationGroup<Holdings, Token>;
    }
}
