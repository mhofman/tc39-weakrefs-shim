import {
    before,
    expect,
    describe,
    beforeEach,
    it,
    chai,
} from "../../tests/setup.js";
import { makeGcOf } from "../../tests/collector-helper.js";
import { itCatchCleanStackError } from "../../tests/global-error-helper.js";
import { combine } from "../utils/iterable.js";

import { FinalizationGroup } from "../weakrefs.js";

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
    triggerCleanupJob: (
        this: Mocha.Context,
        cleanupCallback: FinalizationGroup.CleanupCallback<any>
    ) => void | PromiseLike<any>
): void {
    it("should throw when using the iterator outside cleanup job", async function() {
        let iterator: FinalizationGroup.CleanupIterator<any>;
        const cleanupCallback = chai.spy<
            FinalizationGroup.CleanupIterator<any>,
            void
        >(function(i) {
            iterator = i;
        });

        await triggerCleanupJob.call(this, cleanupCallback);
        expect(cleanupCallback).to.have.been.called();
        expect(() => iterator!.next()).to.throw();
    });

    describe("iterator", function() {
        it("should have the correct toStringTag", async function() {
            let called = false;
            const cleanupCallback = (
                items: FinalizationGroup.CleanupIterator<any>
            ) => {
                called = true;
                expect(items[Symbol.toStringTag]).to.be.equal(
                    "FinalizationGroup Cleanup Iterator"
                );
            };

            await triggerCleanupJob.call(this, cleanupCallback);

            if (!called) this.skip();
        });
    });
}

export function shouldBehaveAsFinalizationGroupAccordingToSpec(
    details: Promise<{
        FinalizationGroup: FinalizationGroup.Constructor;
        gc?: () => void;
    }>,
    gcAvailable: boolean,
    skip = false
): void {
    (!skip ? describe : describe.skip)("FinalizationGroup", function() {
        let FinalizationGroup: FinalizationGroup.Constructor;
        let gcOf:
            | ((
                  target?: object,
                  cancelPromise?: Promise<false>
              ) => Promise<boolean>)
            | undefined;
        let unregisterReturnsBool = true;
        let workingCleanupSome = true;

        before(async function() {
            let gc: (() => void) | undefined;
            ({ FinalizationGroup, gc } = await details);

            gcOf = gc ? makeGcOf(gc, FinalizationGroup) : undefined;
        });

        describe("register", function() {
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
                let finalizationGroup: FinalizationGroup<any>;
                beforeEach(function() {
                    finalizationGroup = new FinalizationGroup(() => {});
                });
                expectThrowIfNotObject((value: any) =>
                    finalizationGroup.register(value, 0)
                );
            });

            describe("should throw when method invoked with non-object unregisterToken", function() {
                let finalizationGroup: FinalizationGroup<any>;
                beforeEach(function() {
                    finalizationGroup = new FinalizationGroup(() => {});
                });
                expectThrowIfNotObject(
                    (value: any) => finalizationGroup.register({}, 0, value),
                    true
                );
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
                    it("calls callback on collected object", async function() {
                        // Calls FinalizationGroup with marker object
                        // and only completes if callback called
                        await gcOf!();
                    });

                    it("calls callback on collected object that stayed alive for a little bit", async function() {
                        let object = {};
                        const callback = chai.spy();
                        const finalizationGroup = new FinalizationGroup(
                            callback
                        );
                        finalizationGroup.register(object, 42);
                        await new Promise(resolve => setTimeout(resolve, 200));
                        // gcOf internally uses another FinalizationGroup object
                        const collected = gcOf!(object);
                        object = undefined!;
                        await collected;
                        expect(callback).to.have.been.called();
                    });

                    it("calls callback on multiple FinalizationGroup for same object", async function() {
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
                        expect(callback).to.have.been.called();
                    });

                    it("calls callback with multiple holdings for same object - different values", async function() {
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
                        expect(holdings).to.contain(5);
                        expect(holdings).to.contain(42);
                        expect(holdings).to.have.lengthOf(2);
                    });

                    it("calls callback with multiple holdings for same object - same values", async function() {
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
                        expect(holdings[0]).to.be.equal(42);
                        expect(holdings[1]).to.be.equal(42);
                        expect(holdings).to.have.lengthOf(2);
                    });

                    it("doesn't hold a strong reference to the unregister token (optional)", async function() {
                        const object = {};
                        const callback = chai.spy();
                        const finalizationGroup = new FinalizationGroup(
                            callback
                        );
                        let token = {};
                        finalizationGroup.register(object, 5, token);

                        let tokenCollected = gcOf!(
                            token,
                            new Promise(resolve =>
                                setTimeout(resolve, 400, false)
                            )
                        );
                        token = undefined!;
                        if (!(await tokenCollected)) this.skip();
                    });

                    it("can use the target as the unregister token (optional)", async function() {
                        let object = {};
                        const callback = chai.spy();
                        const finalizationGroup = new FinalizationGroup(
                            callback
                        );
                        finalizationGroup.register(object, 5, object);

                        let collected = gcOf!(
                            object,
                            new Promise(resolve =>
                                setTimeout(resolve, 400, false)
                            )
                        );
                        object = undefined!;
                        if (!(await collected)) this.skip();
                    });
                });
            } else {
                it("collection behavior test disabled: no gc method");
            }
        });

        describe("unregister", function() {
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
                let finalizationGroup: FinalizationGroup<any>;
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
                        expect(notIterated).to.be.ok;
                    });
                });
            } else {
                it("collection behavior test disabled: no gc method");
            }
        });

        describe("cleanupSome", function() {
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
                let finalizationGroup: FinalizationGroup<any>;
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
                        {} as FinalizationGroup.CleanupCallback<any>
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
                    let finalizationGroup: FinalizationGroup<number>;

                    beforeEach(async function() {
                        let object = {};
                        constructorCallback = chai.spy();
                        finalizationGroup = new FinalizationGroup(
                            constructorCallback
                        );
                        finalizationGroup.register(object, 42);
                        const collected = gcOf!(object);
                        object = undefined!;
                        await collected;
                        expect(constructorCallback).to.have.been.called.once;
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
                        finalizationGroup.cleanupSome(callback);
                        expect(constructorCallback).to.have.been.called.once;
                        if (workingCleanupSome)
                            expect(callback).to.have.been.called();
                    });

                    shouldBehaveAsCleanupJopAccordingToSpec(function(
                        cleanupCallback
                    ) {
                        if (!workingCleanupSome) this.skip();
                        finalizationGroup.cleanupSome(cleanupCallback);
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
                        const token = {};
                        const callback = chai.spy();
                        const finalizationGroup = new FinalizationGroup(
                            callback
                        );
                        finalizationGroup.register(object, 42, token);
                        const collected = gcOf!(object);
                        object = undefined!;
                        await collected;
                        expect(callback).to.have.been.called();
                        if (unregisterReturnsBool) {
                            expect(finalizationGroup.unregister(token)).to.be
                                .true;
                        } else if (workingCleanupSome) {
                            let notConsumed: Array<number>;
                            expect(
                                finalizationGroup.cleanupSome(items => {
                                    notConsumed = [...items];
                                })
                            );
                            expect(notConsumed!).to.contain(42);
                            expect(notConsumed!).to.have.lengthOf(1);
                        } else {
                            this.skip();
                        }
                    });

                    it("doesn't remove cell if iterator is closed before", async function() {
                        const holdings = [{}, {}];
                        let notIterated: object | undefined;
                        const finalizationGroup = new FinalizationGroup<object>(
                            items => {
                                for (const item of items) {
                                    notIterated = item;
                                    expect(holdings).to.contain(notIterated);
                                    break;
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
                        expect(notIterated).to.be.ok;
                        if (unregisterReturnsBool) {
                            expect(finalizationGroup.unregister(notIterated!))
                                .to.be.true;
                        } else if (workingCleanupSome) {
                            finalizationGroup.cleanupSome(items => {
                                for (const item of items)
                                    expect(item).to.equal(notIterated);
                                notIterated = undefined;
                            });
                            expect(notIterated).to.be.equal(undefined);
                        } else {
                            this.skip();
                        }
                    });
                });
            } else {
                it("collection behavior test disabled: no gc method");
            }
        });

        describe("constructor", function() {
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
                            {} as FinalizationGroup.CleanupCallback<any>
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
                        expect(callback).not.to.have.been.called();
                    });

                    itCatchCleanStackError(
                        "throws callback errors on a clean stack",
                        async function() {
                            let object = {};
                            const callback = chai.spy(() => {
                                throw new Error("Should not be swallowed");
                            });
                            const finalizationGroup = new FinalizationGroup(
                                callback
                            );
                            finalizationGroup.register(object, 42);
                            const collected = gcOf!(object);
                            object = undefined!;
                            await collected;
                            expect(callback).to.have.been.called();
                        }
                    );

                    shouldBehaveAsCleanupJopAccordingToSpec(async function(
                        cleanupCallback
                    ) {
                        let object = {};
                        const finalizationGroup = new FinalizationGroup(
                            cleanupCallback
                        );
                        finalizationGroup.register(object, 42);
                        const collected = gcOf!(object);
                        object = undefined!;
                        await collected;
                    });
                });

                describe("instance - collection behavior", function() {
                    it("can be collected after all targets are finalized", async function() {
                        let object = {};
                        let callback = chai.spy();
                        let observerCallback = chai.spy();
                        let finalizationGroup = new FinalizationGroup(callback);
                        let observer = new FinalizationGroup(observerCallback);
                        observer.register(finalizationGroup, 0);
                        finalizationGroup.register(object, 42);

                        let objectCollected = gcOf!(object);
                        object = undefined!;
                        await objectCollected;

                        expect(callback).to.have.been.called();

                        let finalizationGroupCollected = gcOf!(
                            finalizationGroup,
                            new Promise(resolve =>
                                setTimeout(resolve, 400, false)
                            )
                        );
                        finalizationGroup = undefined!;
                        await finalizationGroupCollected;

                        expect(observerCallback).to.have.been.called();
                    });
                });
            } else {
                it("callback collection behavior test disabled: no gc method");
            }
        });
    });
}
