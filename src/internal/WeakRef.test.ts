import { describe, it, expect, beforeEach, chai } from "../../tests/setup.js";

import { createWeakRefClassShim } from "./WeakRef.js";

import { AgentMock, ObjectInfoMock } from "./Agent.mock.js";
import { expectThrowIfNotObject } from "../tests/FinalizationGroup.shared.js";

describe("WeakRefShim", function() {
    let objectMap: Map<object, ObjectInfoMock>;
    let agent: AgentMock<ObjectInfoMock>;
    let getInfo: ChaiSpies.SpyFunc1<object, ObjectInfoMock>;
    let getTarget: ChaiSpies.SpyFunc1<ObjectInfoMock, object | undefined>;
    let WeakRef: WeakRef.Constructor;

    beforeEach(function() {
        objectMap = new Map();
        agent = new AgentMock();
        getInfo = chai.spy((object: object) => objectMap.get(object)!);
        getTarget = chai.spy((info: ObjectInfoMock) => info.target);
        [WeakRef] = createWeakRefClassShim(agent, getInfo, getTarget);
    });

    describe("constructor", function() {
        it("should throw when constructor called without new", async function() {
            const constructorFn: Function = WeakRef;

            expect(() => constructorFn({})).to.throw();
        });

        describe("should throw when constructed with non-object", function() {
            expectThrowIfNotObject((value: any) => new WeakRef(value));
        });

        it("should hold target on creation", async function() {
            const object = {};
            objectMap.set(object, new ObjectInfoMock(object));
            const ref = new WeakRef(object);
            expect(ref.deref()).to.be.ok;
        });

        it("should request object info", async function() {
            const object = {};
            objectMap.set(object, new ObjectInfoMock(object));
            new WeakRef(object);
            expect(getInfo).to.have.been.called.with(object);
        });

        it("should hold target on creation", async function() {
            const object = {};
            objectMap.set(object, new ObjectInfoMock(object));
            new WeakRef(object);
            expect(agent.keepDuringJob).to.have.been.called.once;
            expect(agent.keepDuringJob).to.have.been.called.with(object);
        });
    });

    describe("deref", function() {
        describe("should throw when function invoked on non-object", function() {
            expectThrowIfNotObject((value: any) =>
                WeakRef.prototype.deref.call(value)
            );
        });

        it("should throw when method invoked with wrong this", async function() {
            const weakRef = new WeakRef({});
            expect(() => weakRef.deref.call({})).to.throw();
        });

        it("should hold target on deref", async function() {
            const object = {};
            objectMap.set(object, new ObjectInfoMock(object));
            const weakRef = new WeakRef(object);
            expect(agent.keepDuringJob).to.have.been.called.once;
            expect(weakRef.deref()).to.be.equal(object);
            expect(agent.keepDuringJob).to.have.been.called.twice;
            expect(agent.keepDuringJob).to.have.been.second.called.with(object);
        });

        it("should ask for the target", async function() {
            const object = {};
            const info = new ObjectInfoMock(object);
            objectMap.set(object, info);
            const weakRef = new WeakRef(object);
            expect(weakRef.deref()).to.be.equal(object);
            expect(getTarget).to.have.been.called.with(info);
        });

        it("should not call hold if no target", async function() {
            const object = {};
            const info = new ObjectInfoMock(object);
            objectMap.set(object, info);
            const weakRef = new WeakRef(object);
            expect(agent.keepDuringJob).to.have.been.called.once;
            info.target = undefined;
            expect(weakRef.deref()).to.be.equal(undefined);
            expect(agent.keepDuringJob).to.have.been.called.once;
        });
    });

    it("should allow being subclassed", async function() {
        class ReleasableWeakRef<T extends object> extends WeakRef<T> {
            private readonly info: ObjectInfoMock;
            constructor(private target: T) {
                super(target);
                this.info = objectMap.get(target)!;
            }

            deref(): T | undefined {
                return this.target || super.deref();
            }

            release(): void {
                this.info.target = undefined;
                this.target = undefined!;
            }
        }
        const object = {};
        objectMap.set(object, new ObjectInfoMock(object));
        const releasableWeakRef = new ReleasableWeakRef(object);

        expect(agent.keepDuringJob).to.have.been.called.once;
        releasableWeakRef.release();
        expect(releasableWeakRef.deref()).to.not.exist;
        expect(agent.keepDuringJob).to.have.been.called.once;
    });
});
