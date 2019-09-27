import { describe, it, expect, beforeEach, chai } from "../../tests/setup.js";
import { merge } from "../utils/set.js";
import { createFinalizationGroupClassShim } from "./FinalizationGroup.js";
import { ObjectInfoMock } from "./ObjectInfo.mock.js";
import { FinalizationGroupJobsMock } from "./FinalizationGroupJobs.mock.js";
import {
    expectThrowIfNotObject,
    shouldBehaveAsCleanupJopAccordingToSpec,
} from "../tests/FinalizationGroup.shared.js";

import { FinalizationGroup } from "../weakrefs.js";

describe("FinalizationGroupShim", function() {
    type Holding = number;
    let objectMap: Map<object, ObjectInfoMock>;
    let jobs: FinalizationGroupJobsMock<ObjectInfoMock>;
    let getInfo: ChaiSpies.SpyFunc1<object, ObjectInfoMock>;
    let isAlive: ChaiSpies.SpyFunc1<ObjectInfoMock, boolean>;
    let FinalizationGroup: FinalizationGroup.Constructor;
    let finalizationGroup: FinalizationGroup<Holding>;
    let recentlyFinalized: Array<Holding>;

    beforeEach(function() {
        objectMap = new Map();
        jobs = new FinalizationGroupJobsMock(
            chai.spy((fg: FinalizationGroup<Holding>) => {
                const finalized = new Set();
                for (const info of objectMap.values()) {
                    if (!info.target) finalized.add(info);
                }
                return finalized;
            })
        );
        getInfo = chai.spy((object: object) => objectMap.get(object)!);
        isAlive = chai.spy((info: ObjectInfoMock) => !!info.target);
        FinalizationGroup = createFinalizationGroupClassShim(
            jobs,
            getInfo,
            isAlive
        );
        recentlyFinalized = [];
        finalizationGroup = new FinalizationGroup(items => {
            recentlyFinalized.push(...items);
        });
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

        it("should return undefined and ask for object info", async function() {
            const object = {};
            const info = new ObjectInfoMock(object);
            objectMap.set(object, info);
            expect(finalizationGroup.register(object, 1)).to.be.equal(
                undefined
            );
            expect(getInfo).to.have.been.called.with(object);
        });

        it("should allow registering the same object multiple times, but register with agent only the first time", async function() {
            const object = {};
            const info = new ObjectInfoMock(object);
            objectMap.set(object, info);
            finalizationGroup.register(object, 0);
            expect(jobs.registerFinalizationGroup).to.have.been.called.with(
                finalizationGroup,
                info
            );
            expect(() => finalizationGroup.register(object, 1)).not.to.throw();
            expect(jobs.registerFinalizationGroup).to.have.been.called.once;
        });

        describe("collection behavior", function() {
            it("should invoke cleanup callback and unregister from agent when object finalized", async function() {
                const object = {};
                const info = new ObjectInfoMock(object);
                objectMap.set(object, info);
                finalizationGroup.register(object, 1);
                info.target = undefined;
                finalizationGroup.cleanupSome();
                expect(isAlive).to.have.been.called.with(info);
                expect(
                    jobs.unregisterFinalizationGroup
                ).to.have.been.called.with(finalizationGroup, info);
                expect(recentlyFinalized).to.have.lengthOf(1);
                expect(recentlyFinalized).to.contain(1);
            });

            it("should invoke cleanup callback with all finalized object and no live ones", async function() {
                const objects = [{}, {}, {}];
                const infos = objects.map((object, idx) => {
                    const info = new ObjectInfoMock(object);
                    objectMap.set(object, info);
                    finalizationGroup.register(object, idx);
                    return info;
                });
                infos[1].target = infos[2].target = undefined;
                finalizationGroup.cleanupSome();
                expect(
                    jobs.unregisterFinalizationGroup
                ).to.have.been.called.with(finalizationGroup, infos[1]);
                expect(
                    jobs.unregisterFinalizationGroup
                ).to.have.been.called.with(finalizationGroup, infos[2]);
                expect(recentlyFinalized).to.have.lengthOf(2);
                expect(recentlyFinalized).to.contain(1);
                expect(recentlyFinalized).to.contain(2);
            });

            it("calls callback with multiple holdings for same object - different values", async function() {
                const object = {};
                const info = new ObjectInfoMock(object);
                objectMap.set(object, info);
                finalizationGroup.register(object, 1);
                finalizationGroup.register(object, 2);
                info.target = undefined;
                finalizationGroup.cleanupSome();
                expect(jobs.unregisterFinalizationGroup).to.have.been.called
                    .once;
                expect(
                    jobs.unregisterFinalizationGroup
                ).to.have.been.called.with(finalizationGroup, info);
                expect(recentlyFinalized).to.have.lengthOf(2);
                expect(recentlyFinalized).to.contain(1);
                expect(recentlyFinalized).to.contain(2);
            });

            it("calls callback with multiple holdings for same object - same values", async function() {
                const object = {};
                const info = new ObjectInfoMock(object);
                objectMap.set(object, info);
                finalizationGroup.register(object, 42);
                finalizationGroup.register(object, 42);
                info.target = undefined;
                finalizationGroup.cleanupSome();
                expect(jobs.unregisterFinalizationGroup).to.have.been.called
                    .once;
                expect(
                    jobs.unregisterFinalizationGroup
                ).to.have.been.called.with(finalizationGroup, info);
                expect(recentlyFinalized[0]).to.be.equal(42);
                expect(recentlyFinalized[1]).to.be.equal(42);
                expect(recentlyFinalized).to.have.lengthOf(2);
            });
        });
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
            expect(finalizationGroup.unregister({})).to.be.false;
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
            const object = {};
            const token = {};
            const info = new ObjectInfoMock(object);
            objectMap.set(object, info);
            finalizationGroup.register(object, 42, token);
            expect(finalizationGroup.unregister(token)).to.be.true;
        });

        it("should unregister every cell with same token", async function() {
            const objects = [{}, {}, {}];
            const token = {};
            const infos = objects.map((object, idx) => {
                const info = new ObjectInfoMock(object);
                objectMap.set(object, info);
                finalizationGroup.register(
                    object,
                    idx,
                    idx % 2 ? undefined : token
                );
                info.target = undefined;
                return info;
            });
            expect(finalizationGroup.unregister(token)).to.be.true;
            expect(jobs.unregisterFinalizationGroup).to.have.been.called.twice;
            expect(jobs.unregisterFinalizationGroup).to.have.been.called.with(
                finalizationGroup,
                infos[0]
            );
            expect(jobs.unregisterFinalizationGroup).to.have.been.called.with(
                finalizationGroup,
                infos[2]
            );
        });

        describe("collection behavior", function() {
            it("callback doesn't contain unregistered holdings - different objects", async function() {
                let objects = [{}, {}];
                const infos = objects.map((object, idx) => {
                    const info = new ObjectInfoMock(object);
                    objectMap.set(object, info);
                    finalizationGroup.register(object, idx, info);
                    info.target = undefined;
                    return info;
                });
                expect(finalizationGroup.unregister(infos[0])).to.be.true;
                finalizationGroup.cleanupSome();
                expect(recentlyFinalized).to.have.lengthOf(1);
                expect(recentlyFinalized).to.contain(1);
            });

            it("callback doesn't contain unregistered holdings - same object", async function() {
                let object = {};
                const info = new ObjectInfoMock(object);
                objectMap.set(object, info);
                finalizationGroup.register(object, 5, info);
                finalizationGroup.register(object, 42);
                expect(finalizationGroup.unregister(info)).to.be.true;
                info.target = undefined;
                finalizationGroup.cleanupSome();
                expect(recentlyFinalized).to.contain(42);
                expect(recentlyFinalized).to.have.lengthOf(1);
            });

            it("can unregister a finalized but not spent holding", async function() {
                let object = {};
                const info = new ObjectInfoMock(object);
                objectMap.set(object, info);
                const holdings = [{}, {}];
                let notIterated: object | undefined;
                const finalizationGroup = new FinalizationGroup(items => {
                    for (const item of items) {
                        if (item === notIterated)
                            expect.fail("Iterated on unregistered holding");
                        notIterated = item;
                        expect(holdings).to.contain(notIterated!);
                        holdings.forEach(holding =>
                            expect(
                                finalizationGroup.unregister(holding)
                            ).to.be.equal(holding == notIterated)
                        );
                    }
                });
                finalizationGroup.register(object, holdings[0], holdings[1]);
                finalizationGroup.register(object, holdings[1], holdings[0]);
                info.target = undefined;
                finalizationGroup.cleanupSome();
                expect(notIterated).to.be.ok;
            });
        });
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

        it("should call callback even when no empty cell", async function() {
            const callback = chai.spy();
            finalizationGroup.cleanupSome(callback);
            expect(callback).to.be.have.been.called;
        });

        it("should throw when called with non-callable", async function() {
            expect(() =>
                finalizationGroup.cleanupSome(
                    {} as FinalizationGroup.CleanupCallback<any>
                )
            ).to.throw();
        });

        it("should return undefined", async function() {
            expect(finalizationGroup.cleanupSome(() => {})).to.be.equal(
                undefined
            );
        });

        describe("collection behavior", function() {
            let constructorCallback: ChaiSpies.SpyFunc1<
                FinalizationGroup.CleanupIterator<Holding>,
                void
            >;

            beforeEach(function() {
                let object = {};
                const info = new ObjectInfoMock(object);
                objectMap.set(object, info);
                constructorCallback = chai.spy();
                finalizationGroup = new FinalizationGroup(constructorCallback);
                finalizationGroup.register(object, 42);
                info.target = undefined;
            });

            it("should yield previously finalized cells", async function() {
                finalizationGroup.cleanupSome();
                expect(constructorCallback).to.have.been.called();
                let holdings: Array<number>;
                expect(
                    finalizationGroup.cleanupSome(items => {
                        holdings = [...items];
                    })
                );
                expect(holdings!).to.contain(42);
                expect(holdings!).to.have.lengthOf(1);
            });

            it("should not call the callback given at constructor if one is provided", async function() {
                const callback = chai.spy();
                finalizationGroup.cleanupSome(callback);
                expect(constructorCallback).to.not.have.been.called();
                expect(callback).to.have.been.called();
            });

            shouldBehaveAsCleanupJopAccordingToSpec(async function(
                cleanupCallback
            ) {
                return () => finalizationGroup.cleanupSome(cleanupCallback);
            });
        });
    });

    describe("iterator", function() {
        describe("collection behavior", function() {
            it("doesn't remove cell if iterator not consumed", async function() {
                let object = {};
                const info = new ObjectInfoMock(object);
                objectMap.set(object, info);
                const callback = chai.spy();
                const finalizationGroup = new FinalizationGroup(callback);
                finalizationGroup.register(object, 42, info);
                info.target = undefined;
                finalizationGroup.cleanupSome();
                expect(callback).to.have.been.called();
                expect(finalizationGroup.unregister(info)).to.be.true;
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
                const info = new ObjectInfoMock(object);
                objectMap.set(object, info);
                finalizationGroup.register(object, holdings[0], holdings[1]);
                finalizationGroup.register(object, holdings[1], holdings[0]);
                info.target = undefined;
                finalizationGroup.cleanupSome();
                expect(notIterated).to.be.ok;
                expect(finalizationGroup.unregister(notIterated!)).to.be.true;
            });
        });
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
            const recentlyFinalized = new Set<ObjectInfoMock>();
            class FinalizationGroupSubclass extends FinalizationGroup<
                ObjectInfoMock
            > {
                constructor() {
                    super(items => {
                        merge(recentlyFinalized, items);
                    });
                }

                register(target: object): object {
                    const token = {};
                    super.register(target, objectMap.get(target)!, token);
                    return token;
                }

                cleanupSome(): void {
                    super.cleanupSome();
                }
            }
            const finalizationGroup = new FinalizationGroupSubclass();

            const objects = [{}, {}];
            const infos = objects.map((object, idx) => {
                const info = new ObjectInfoMock(object);
                objectMap.set(object, info);
                return info;
            });
            const tokens = objects.map((object, idx) =>
                finalizationGroup.register(object)
            );
            infos[0].target = infos[1].target = undefined;
            expect(finalizationGroup.unregister(tokens[0])).to.be.true;
            expect(jobs.unregisterFinalizationGroup).to.have.been.called.once;
            expect(jobs.unregisterFinalizationGroup).to.have.been.called.with(
                finalizationGroup,
                infos[0]
            );
            finalizationGroup.cleanupSome();
            expect(recentlyFinalized).to.have.lengthOf(1);
            expect(recentlyFinalized).to.contain(infos[1]);
            expect(jobs.unregisterFinalizationGroup).to.have.been.called.with(
                finalizationGroup,
                infos[1]
            );
        });
    });
});
