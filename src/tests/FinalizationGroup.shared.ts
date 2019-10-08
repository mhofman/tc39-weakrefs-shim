import {
    before,
    expect,
    describe,
    beforeEach,
    it,
    chai,
} from "../../tests/setup.js";
import {
    clearKeptObjects,
    makeAsyncGc,
    AsyncGc,
} from "../../tests/collector-helper.js";
import { itCatchCleanStackError } from "../../tests/global-error-helper.js";
import { combine } from "../utils/iterable.js";

import { FinalizationGroup } from "../weakrefs.js";

// Temporary workaround to detecting broken d8 shells
declare var version: () => string;

export function expectThrowIfNotObject(
    functionToTest: (value: any) => any,
    skipUndefined = false
): void {
    if (!skipUndefined)
        it("undefined", async function() {
            expect(() => functionToTest(undefined)).to.throw();
        });

    it("null", async function() {
        expect(() => functionToTest(null)).to.throw();
    });

    it("boolean", async function() {
        expect(() => functionToTest(false)).to.throw();
    });

    it("string", async function() {
        expect(() => functionToTest("")).to.throw();
    });

    it("symbol", async function() {
        expect(() => functionToTest(Symbol())).to.throw();
    });

    it("number", async function() {
        expect(() => functionToTest(0)).to.throw();
    });
}

export function shouldBehaveAsCleanupJopAccordingToSpec(
    setupCleanupJob: (
        this: Mocha.Context,
        cleanupCallback: FinalizationGroup.CleanupCallback
    ) => [() => void, PromiseLike<any> | false]
): void {
    it("should call callback", async function() {
        let calledResolve: () => void;
        let called = new Promise(r => {
            calledResolve = r;
        });
        const cleanupCallback = chai.spy<
            FinalizationGroup.CleanupIterator,
            void
        >(function(i) {
            calledResolve();
        });

        const [triggerCleanupJob, triggered] = setupCleanupJob.call(
            this,
            cleanupCallback
        );
        if (!triggered) {
            triggerCleanupJob();
        } else {
            await triggered;
        }
        await called;
    });

    it("should not swallow errors", async function() {
        let called = true;
        const cleanupCallback = chai.spy<
            FinalizationGroup.CleanupIterator,
            void
        >(function(i) {
            if (called) return;
            called = true;
            throw new Error("Should not be swallowed");
        });

        const [triggerCleanupJob, triggered] = setupCleanupJob.call(
            this,
            cleanupCallback
        );
        await triggered;
        called = false;
        expect(triggerCleanupJob).to.throw();
        expect(called).to.be.true;
    });

    it("should throw when using the iterator outside cleanup job", async function() {
        let iteratorResolve: (value: FinalizationGroup.CleanupIterator) => void;
        let iteratorPromise = new Promise<FinalizationGroup.CleanupIterator>(
            r => {
                iteratorResolve = r;
            }
        );
        const cleanupCallback = chai.spy<
            FinalizationGroup.CleanupIterator,
            void
        >(function(i) {
            iteratorResolve(i);
        });

        const [triggerCleanupJob, triggered] = setupCleanupJob.call(
            this,
            cleanupCallback
        );
        if (!triggered) {
            triggerCleanupJob();
        } else {
            await triggered;
        }
        const iterator = await iteratorPromise;
        expect(() => iterator!.next()).to.throw();
    });

    it("should throw when using previous iterator", async function() {
        let iterator: FinalizationGroup.CleanupIterator;
        let iteratorChecked = false;
        let threw: Error | undefined;
        let calledOnceResolve: () => void;
        let calledOnce = new Promise(r => {
            calledOnceResolve = r;
        });
        const cleanupCallback = chai.spy<
            FinalizationGroup.CleanupIterator,
            void
        >(function(i) {
            if (iterator) {
                if (iteratorChecked) return;
                iteratorChecked = true;
                try {
                    iterator.next();
                } catch (err) {
                    threw = err;
                }
            } else {
                iterator = i;
                calledOnceResolve();
            }
        });

        const [triggerCleanupJob, triggered] = setupCleanupJob.call(
            this,
            cleanupCallback
        );
        if (!triggered) {
            triggerCleanupJob();
        } else {
            await triggered;
        }
        await calledOnce;
        triggerCleanupJob();
        expect(iteratorChecked).to.be.true;
        expect(threw).to.be.an("error");
    });

    it("should throw when nesting cleanup calls", async function() {
        let triggerCleanupJob: undefined | (() => void);
        let threw: Error | undefined;
        let calledResolve: () => void;
        let called = new Promise(r => {
            calledResolve = r;
        });
        const cleanupCallback = chai.spy<
            FinalizationGroup.CleanupIterator,
            void
        >(function(i) {
            if (!triggerCleanupJob) return;
            const trigger = triggerCleanupJob;
            triggerCleanupJob = undefined;

            calledResolve();

            try {
                trigger();
            } catch (err) {
                threw = err;
            }
        });

        let triggered;
        [triggerCleanupJob, triggered] = setupCleanupJob.call(
            this,
            cleanupCallback
        );
        if (!triggered) {
            triggerCleanupJob();
        } else {
            await triggered;
        }
        await called;
        expect(threw).to.be.an("error");
    });

    describe("iterator", function() {
        it("should have the correct toStringTag", async function() {
            let called = false;
            const cleanupCallback = (
                items: FinalizationGroup.CleanupIterator
            ) => {
                if (called) return;
                called = true;
                expect(items[Symbol.toStringTag]).to.be.equal(
                    "FinalizationGroup Cleanup Iterator"
                );
            };

            const [triggerCleanupJob, triggered] = setupCleanupJob.call(
                this,
                cleanupCallback
            );
            if (!triggered) {
                triggerCleanupJob();
            } else {
                await triggered;
                // Make sure the callback had the chance to be invoked
                await clearKeptObjects();
            }

            if (!called) this.skip();
        });
    });
}

export function shouldBehaveAsFinalizationGroupAccordingToSpec(
    details: Promise<{
        FinalizationGroup: FinalizationGroup.Constructor;
        gc?: () => Promise<void> | void;
    }>,
    gcAvailable: boolean,
    skip = false
): void {
    (!skip ? describe : describe.skip)("FinalizationGroup", function() {
        let FinalizationGroup: FinalizationGroup.Constructor;
        let gcOf: AsyncGc | undefined;
        let unregisterReturnsBool = true;
        let workingCleanupSome = true;

        before(async function() {
            let gc: (() => void) | undefined;
            ({ FinalizationGroup, gc } = await details);

            gcOf = gc ? makeAsyncGc(gc, FinalizationGroup) : undefined;
        });

        describe("register", function() {
            it("should have a length of 2", function() {
                expect(FinalizationGroup.prototype.register.length).to.be.equal(
                    2
                );
            });

            describe("should throw when function invoked on non-object", function() {
                expectThrowIfNotObject((value: any) =>
                    FinalizationGroup.prototype.register.call(value, {}, 0)
                );
            });

            it("should throw when method invoked with wrong this", async function() {
                expect(() =>
                    FinalizationGroup.prototype.register.call({}, {}, 0)
                ).to.throw();
            });

            describe("should throw when method invoked with non-object target", function() {
                let finalizationGroup: FinalizationGroup;
                beforeEach(function() {
                    finalizationGroup = new FinalizationGroup(() => {});
                });
                expectThrowIfNotObject((value: any) =>
                    finalizationGroup.register(value, 0)
                );
            });

            describe("should throw when method invoked with non-object unregisterToken", function() {
                let finalizationGroup: FinalizationGroup;
                beforeEach(function() {
                    finalizationGroup = new FinalizationGroup(() => {});
                });
                expectThrowIfNotObject(
                    (value: any) => finalizationGroup.register({}, 0, value),
                    true
                );
            });

            it("should throw when using target as holdings", async function() {
                const finalizationGroup = new FinalizationGroup(() => {});
                const target = {};
                expect(() =>
                    finalizationGroup.register(target, target)
                ).to.throw();
            });

            it("should return undefined", async function() {
                const finalizationGroup = new FinalizationGroup(() => {});
                expect(finalizationGroup.register({}, 0)).to.be.equal(
                    undefined
                );
            });

            it("should allow registering the same object multiple times", function() {
                let object = {};
                const finalizationGroup = new FinalizationGroup(() => {});
                finalizationGroup.register(object, 0);
                expect(() =>
                    finalizationGroup.register(object, 1)
                ).not.to.throw();
                // Make sure we don't ever leak!
                object = undefined!;
            });

            if (gcAvailable) {
                describe("collection behavior", function() {
                    it("performs cleanup on collected object", async function() {
                        // Calls FinalizationGroup with marker object
                        // and only completes if callback called
                        await gcOf!();
                    });

                    it("performs cleanup on collected object that stayed alive for a little bit", function() {
                        let object = {};
                        const callback = chai.spy();
                        const finalizationGroup = new FinalizationGroup(
                            callback
                        );
                        finalizationGroup.register(object, 42);
                        return new Promise(resolve => setTimeout(resolve, 200))
                            .then(() => {
                                // gcOf internally uses another FinalizationGroup object
                                const collected = gcOf!(object);
                                object = undefined!;
                                return collected;
                            })
                            .then(collected => {
                                finalizationGroup.cleanupSome();
                                expect(callback).to.have.been.called();
                            });
                    });

                    it("performs cleanup on multiple FinalizationGroup for same object", async function() {
                        let object = {};
                        const callback = chai.spy();
                        const finalizationGroup = new FinalizationGroup(
                            callback
                        );
                        finalizationGroup.register(object, 42);
                        // gcOf internally uses another FinalizationGroup object
                        const collected = gcOf!(object);
                        object = undefined!;
                        await collected;
                        finalizationGroup.cleanupSome();
                        expect(callback).to.have.been.called();
                    });

                    it("performs cleanup with multiple holdings for same object - different values", async function() {
                        let object = {};
                        let holdings = new Set<number>();
                        const finalizationGroup = new FinalizationGroup<number>(
                            items => {
                                holdings = new Set(combine(holdings, items));
                            }
                        );
                        finalizationGroup.register(object, 42);
                        finalizationGroup.register(object, 5);
                        const collected = gcOf!(object);
                        object = undefined!;
                        await collected;
                        finalizationGroup.cleanupSome();
                        expect(holdings).to.contain(5);
                        expect(holdings).to.contain(42);
                        expect(holdings).to.have.lengthOf(2);
                    });

                    it("performs cleanup with multiple holdings for same object - same values", async function() {
                        let object = {};
                        let holdings = new Array<number>();
                        const finalizationGroup = new FinalizationGroup<number>(
                            items => holdings.push(...items)
                        );
                        finalizationGroup.register(object, 42);
                        finalizationGroup.register(object, 42);
                        const collected = gcOf!(object);
                        object = undefined!;
                        await collected;
                        finalizationGroup.cleanupSome();
                        expect(holdings[0]).to.be.equal(42);
                        expect(holdings[1]).to.be.equal(42);
                        expect(holdings).to.have.lengthOf(2);
                    });

                    it("doesn't hold a strong reference to the unregister token", async function() {
                        const object = {};
                        const callback = chai.spy();
                        const finalizationGroup = new FinalizationGroup(
                            callback
                        );
                        let token = {};
                        finalizationGroup.register(object, 5, token);

                        let tokenCollected = gcOf!(token);
                        token = undefined!;
                        expect(await tokenCollected).to.be.true;
                    });

                    it("can use the target as the unregister token", async function() {
                        let object = {};
                        const callback = chai.spy();
                        const finalizationGroup = new FinalizationGroup(
                            callback
                        );
                        finalizationGroup.register(object, 5, object);

                        let collected = gcOf!(object);
                        object = undefined!;
                        expect(await collected).to.be.true;
                    });
                });
            } else {
                it("collection behavior test disabled: no gc method");
            }
        });

        describe("unregister", function() {
            it("should have a length of 1", function() {
                expect(
                    FinalizationGroup.prototype.unregister.length
                ).to.be.equal(1);
            });

            describe("should throw when function invoked on non-object", function() {
                expectThrowIfNotObject((value: any) =>
                    FinalizationGroup.prototype.unregister.call(value, {})
                );
            });

            it("should throw when method invoked with wrong this", async function() {
                expect(() =>
                    FinalizationGroup.prototype.unregister.call({}, {})
                ).to.throw();
            });

            it("should return boolean", async function() {
                const finalizationGroup = new FinalizationGroup(() => {});
                const ret = finalizationGroup.unregister({});
                unregisterReturnsBool = ret === false;
                expect(ret).to.be.false;
            });

            describe("should throw when method invoked with non-object unregisterToken", function() {
                let finalizationGroup: FinalizationGroup;
                beforeEach(function() {
                    finalizationGroup = new FinalizationGroup(() => {});
                });
                expectThrowIfNotObject((value: any) =>
                    finalizationGroup.unregister(value)
                );
            });

            it("should unregister cell with specific token", async function() {
                const token = {};
                if (!unregisterReturnsBool) this.skip();
                const finalizationGroup = new FinalizationGroup(() => {});
                finalizationGroup.register({}, 42, token);
                expect(finalizationGroup.unregister(token)).to.be.true;
            });

            if (gcAvailable) {
                describe("collection behavior", function() {
                    let finalizationGroup: FinalizationGroup<number>;
                    let holdings: Set<number>;

                    beforeEach(function() {
                        holdings = new Set();
                        finalizationGroup = new FinalizationGroup<number>(
                            items => {
                                holdings = new Set(combine(holdings, items));
                            }
                        );
                    });

                    it("callback doesn't contain unregistered holdings - different objects", async function() {
                        let objects = [{}, {}];
                        const tokens = [{}, {}];
                        finalizationGroup.register(objects[0], 5, tokens[0]);
                        finalizationGroup.register(objects[1], 42, tokens[1]);
                        const unregisterExpectation = expect(
                            finalizationGroup.unregister(tokens[0])
                        );
                        if (unregisterReturnsBool)
                            unregisterExpectation.to.be.true;
                        const collected = [
                            gcOf!(objects[0]),
                            gcOf!(objects[1]),
                        ];
                        objects = undefined!;
                        await Promise.all(collected);
                        finalizationGroup.cleanupSome();
                        expect(holdings).to.contain(42);
                        expect(holdings).to.have.lengthOf(1);
                    });

                    it("callback doesn't contain unregistered holdings - same object", async function() {
                        let object = {};
                        const tokens = [{}, {}];
                        finalizationGroup.register(object, 5, tokens[0]);
                        finalizationGroup.register(object, 42, tokens[1]);
                        const unregisterExpectation = expect(
                            finalizationGroup.unregister(tokens[0])
                        );
                        if (unregisterReturnsBool)
                            unregisterExpectation.to.be.true;
                        const collected = gcOf!(object);
                        object = undefined!;
                        await collected;
                        finalizationGroup.cleanupSome();
                        expect(holdings).to.contain(42);
                        expect(holdings).to.have.lengthOf(1);
                    });

                    it("can unregister a finalized but not spent holding", async function() {
                        const holdings = [{}, {}];
                        let notIterated: object | undefined;
                        const finalizationGroup = new FinalizationGroup<object>(
                            items => {
                                for (const item of items) {
                                    if (item === notIterated)
                                        expect.fail(
                                            "Iterated on unregistered holding"
                                        );
                                    notIterated = item;
                                    expect(holdings).to.contain(notIterated);
                                    holdings.forEach(holding =>
                                        expect(
                                            finalizationGroup.unregister(
                                                holding
                                            )
                                        ).to.be.equal(holding == notIterated)
                                    );
                                }
                            }
                        );
                        let object = {};
                        finalizationGroup.register(
                            object,
                            holdings[0],
                            holdings[1]
                        );
                        finalizationGroup.register(
                            object,
                            holdings[1],
                            holdings[0]
                        );
                        const collected = gcOf!(object);
                        object = undefined!;
                        await collected;
                        finalizationGroup.cleanupSome();
                        expect(notIterated).to.be.ok;
                    });
                });
            } else {
                it("collection behavior test disabled: no gc method");
            }
        });

        describe("cleanupSome", function() {
            it("should have a length of 0", function() {
                expect(
                    FinalizationGroup.prototype.cleanupSome.length
                ).to.be.equal(0);
            });

            describe("should throw when function invoked on non-object", function() {
                expectThrowIfNotObject((value: any) =>
                    FinalizationGroup.prototype.cleanupSome.call(value)
                );
            });

            it("should throw when method invoked with wrong this", async function() {
                expect(() =>
                    FinalizationGroup.prototype.cleanupSome.call({})
                ).to.throw();
            });

            it("should not call callback when no empty cell", async function() {
                let object = {};
                const callback = chai.spy();
                const finalizationGroup = new FinalizationGroup(callback);
                finalizationGroup.register(object, 42);
                finalizationGroup.cleanupSome();
                expect(callback).not.to.have.been.called();
            });

            describe("should throw when called with non-object", function() {
                let finalizationGroup: FinalizationGroup;
                beforeEach(function() {
                    if (!workingCleanupSome) this.skip();
                    finalizationGroup = new FinalizationGroup(() => {});
                });

                expectThrowIfNotObject(
                    (value: any) => finalizationGroup.cleanupSome(value),
                    true
                );
            });

            it("should throw when called with non-callable", async function() {
                const finalizationGroup = new FinalizationGroup(() => {});
                // No point testing this if cleanupSome does nothing
                if (!workingCleanupSome) this.skip();
                expect(() =>
                    finalizationGroup.cleanupSome(
                        {} as FinalizationGroup.CleanupCallback
                    )
                ).to.throw();
            });

            it("should return undefined", async function() {
                const finalizationGroup = new FinalizationGroup(() => {});
                expect(finalizationGroup.cleanupSome(() => {})).to.be.equal(
                    undefined
                );
            });

            if (gcAvailable) {
                describe("collection behavior", function() {
                    let constructorCallback: ChaiSpies.SpyFunc1<
                        FinalizationGroup.CleanupIterator<number>,
                        void
                    >;
                    let constructorCalled: number;
                    let finalizationGroup: FinalizationGroup<number>;

                    beforeEach(async function() {
                        let object = {};
                        constructorCalled = 0;
                        constructorCallback = chai.spy(() => {
                            ++constructorCalled;
                        });
                        finalizationGroup = new FinalizationGroup(
                            constructorCallback
                        );
                        finalizationGroup.register(object, 42);
                        const collected = gcOf!(object);
                        object = undefined!;
                        await collected;
                    });

                    it("should yield previously finalized cells", async function() {
                        let holdings: Array<number>;
                        workingCleanupSome = false;
                        expect(
                            finalizationGroup.cleanupSome(items => {
                                workingCleanupSome = true;
                                holdings = [...items];
                            })
                        );
                        if (!workingCleanupSome) this.skip();
                        expect(holdings!).to.contain(42);
                        expect(holdings!).to.have.lengthOf(1);
                    });

                    it("should not call the callback given at constructor if one is provided", async function() {
                        const callback = chai.spy();
                        const calledBefore = constructorCalled;
                        finalizationGroup.cleanupSome(callback);
                        expect(constructorCallback).to.have.been.called.exactly(
                            calledBefore
                        );
                        if (workingCleanupSome)
                            expect(callback).to.have.been.called();
                    });

                    shouldBehaveAsCleanupJopAccordingToSpec(function(
                        cleanupCallback
                    ) {
                        if (!workingCleanupSome) this.skip();
                        return [
                            function() {
                                finalizationGroup.cleanupSome(cleanupCallback);
                            },
                            false,
                        ];
                    });
                });
            } else {
                it("collection behavior test disabled: no gc method");
            }
        });

        describe("iterator", function() {
            if (gcAvailable) {
                describe("collection behavior", function() {
                    it("doesn't remove cell if iterator not consumed", async function() {
                        let object = {};
                        let consume = false;
                        let consumed: Array<number>;
                        const token = {};
                        const callback = chai.spy((items: Iterable<number>) => {
                            if (consume) consumed = [...items];
                        });
                        const finalizationGroup = new FinalizationGroup(
                            callback
                        );
                        finalizationGroup.register(object, 42, token);
                        const collected = gcOf!(object);
                        object = undefined!;
                        await collected;
                        finalizationGroup.cleanupSome();
                        expect(callback).to.have.been.called();
                        consume = true;
                        finalizationGroup.cleanupSome();
                        expect(consumed!).to.contain(42);
                        expect(consumed!).to.have.lengthOf(1);
                    });

                    it("doesn't remove cell if iterator is closed before", async function() {
                        const holdings = [{}, {}];
                        let iterated: object | undefined;
                        let collect = false;
                        let invocations = 0;
                        const finalizationGroup = new FinalizationGroup<object>(
                            items => {
                                if (!collect) return;
                                for (const item of items) {
                                    invocations++;
                                    iterated = item;
                                    expect(holdings).to.contain(iterated);
                                    break;
                                }
                            }
                        );
                        let object = {};
                        finalizationGroup.register(object, holdings[0]);
                        finalizationGroup.register(object, holdings[1]);
                        const collected = gcOf!(object);
                        object = undefined!;
                        await collected;
                        expect(invocations).to.be.equal(0);

                        collect = true;
                        finalizationGroup.cleanupSome();
                        expect(invocations).to.be.equal(1);
                        expect(iterated).to.be.ok;

                        const previouslyIterated = iterated;
                        iterated = undefined;
                        finalizationGroup.cleanupSome();
                        expect(invocations).to.equal(2);
                        expect(iterated).to.be.ok;
                        expect(iterated).to.not.be.equal(previouslyIterated);

                        iterated = undefined;
                        finalizationGroup.cleanupSome();
                        expect(invocations).to.equal(2);
                        expect(iterated).to.be.undefined;
                    });
                });
            } else {
                it("collection behavior test disabled: no gc method");
            }
        });

        describe("constructor", function() {
            it("should have a length of 1", function() {
                expect(FinalizationGroup.length).to.be.equal(1);
            });

            it("should throw when constructor called without new", async function() {
                const constructorFn: Function = FinalizationGroup;

                expect(() => constructorFn(() => {})).to.throw();
            });

            describe("should throw when constructed with non-object", function() {
                expectThrowIfNotObject(
                    (value: any) => new FinalizationGroup(value)
                );
            });

            it("should throw when constructed with non-callable", async function() {
                expect(
                    () =>
                        new FinalizationGroup(
                            {} as FinalizationGroup.CleanupCallback
                        )
                ).to.throw();
            });

            it("should allow being subclassed", async function() {
                class FinalizationGroupSubclass extends FinalizationGroup {
                    register(target: object, holding: any): object {
                        const token = {};
                        super.register(target, holding, token);
                        return token;
                    }
                }
                const finalizationGroup = new FinalizationGroupSubclass(
                    () => {}
                );

                const token = finalizationGroup.register({}, 42);
                expect(token).to.be.ok;
                if (unregisterReturnsBool)
                    expect(finalizationGroup.unregister(token)).to.be.true;
            });

            if (gcAvailable) {
                describe("callback - collection behavior", function() {
                    it("doesn't call callback if has no empty cell", async function() {
                        let object = {};
                        const callback = chai.spy();
                        const finalizationGroup = new FinalizationGroup(
                            callback
                        );
                        finalizationGroup.register(object, 42);
                        await gcOf!();
                        await clearKeptObjects();
                        expect(callback).not.to.have.been.called();
                    });

                    itCatchCleanStackError(
                        "throws callback errors on a clean stack",
                        async function() {
                            let object = {};
                            let resolve: () => void;

                            // d8 SegFaults in version 7.8 and above
                            if (
                                typeof version == "function" &&
                                Function.prototype.toString
                                    .call(FinalizationGroup)
                                    .indexOf("native code") > 0 &&
                                Number(version().substring(0, 3)) > 7.7
                            ) {
                                this.skip();
                            }

                            const called = new Promise<void>(r => {
                                resolve = r;
                            });
                            const finalizationGroup = new FinalizationGroup(
                                () => {
                                    resolve();
                                    throw new Error("Should not be swallowed");
                                }
                            );
                            finalizationGroup.register(object, 42);
                            const collected = gcOf!(object);
                            object = undefined!;
                            await collected;
                            await called;
                        }
                    );

                    shouldBehaveAsCleanupJopAccordingToSpec(function(
                        cleanupCallback
                    ) {
                        let object = {};
                        const finalizationGroup = new FinalizationGroup(
                            cleanupCallback
                        );
                        finalizationGroup.register(object, 42);
                        const collected = gcOf!(object);
                        object = undefined!;
                        return [
                            function() {
                                finalizationGroup.cleanupSome();
                            },
                            collected,
                        ];
                    });
                });

                describe("instance - collection behavior", function() {
                    it("can be collected after all targets are finalized", function() {
                        let object = {};
                        let callback = chai.spy();
                        let observerCallback = chai.spy();
                        let finalizationGroup = new FinalizationGroup(callback);
                        let observer = new FinalizationGroup(observerCallback);
                        observer.register(finalizationGroup, 0);
                        finalizationGroup.register(object, 42);

                        let objectCollected = gcOf!(object);
                        object = undefined!;

                        return objectCollected
                            .then(() => {
                                finalizationGroup.cleanupSome();
                                expect(callback).to.have.been.called();

                                // Just to be sure finalizationGroup isn't held anymore
                                return clearKeptObjects();
                            })
                            .then(() => {
                                let finalizationGroupCollected = gcOf!(
                                    finalizationGroup
                                );
                                finalizationGroup = undefined!;
                                return finalizationGroupCollected;
                            })
                            .then(finalizationGroupCollected => {
                                expect(finalizationGroupCollected).to.be.true;
                                observer.cleanupSome();
                                expect(observerCallback).to.have.been.called();
                            });
                    });
                });
            } else {
                it("callback collection behavior test disabled: no gc method");
            }
        });
    });
}
