declare interface FinalizationGroup<
    Holdings = any,
    Token extends object = object
> {
    register(target: object, holdings: Holdings, unregisterToken?: Token): void;
    unregister(unregisterToken: Token): boolean;
    cleanupSome(
        cleanupCallback?: FinalizationGroup.CleanupCallback<Holdings>
    ): void;
}

declare namespace FinalizationGroup {
    interface CleanupIterator<Holdings> extends IterableIterator<Holdings> {
        [Symbol.toStringTag]: string;
    }

    interface CleanupCallback<Holdings> {
        (items: CleanupIterator<Holdings>): void;
    }

    interface Constructor {
        new (cleanupCallback: CleanupCallback<any>): FinalizationGroup<
            any,
            object
        >;
        new <Holdings, Token extends object = object>(
            cleanupCallback: CleanupCallback<Holdings>
        ): FinalizationGroup<Holdings, Token>;
        readonly prototype: FinalizationGroup<any>;
    }
}

declare interface WeakRef<T extends object = object> {
    deref(): T | undefined;
}

declare namespace WeakRef {
    interface Constructor {
        new (target: object): WeakRef<object>;
        new <T extends object>(target: T): WeakRef<T>;
        readonly prototype: WeakRef<object>;
    }
}
