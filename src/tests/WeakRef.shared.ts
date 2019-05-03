import { before, expect, describe, beforeEach, it } from "../../tests/setup.js";
import { makeGcOf } from "../../tests/collector-helper.js";
import { expectThrowIfNotObject } from "./FinalizationGroup.shared.js";

import { FinalizationGroup, WeakRef } from "../weakrefs.js";

export function shouldBehaveAsWeakRefAccordingToSpec(
    details: Promise<{
        WeakRef: WeakRef.Constructor;
        FinalizationGroup?: FinalizationGroup.Constructor;
        gc?: () => void;
    }>,
    gcAvailable: boolean,
    skip = false
): void {
    (!skip ? describe : describe.skip)("WeakRef", function() {
        let gcOf: (target?: object) => Promise<boolean>;
        let WeakRef: WeakRef.Constructor;
        let FinalizationGroup: FinalizationGroup.Constructor | undefined;
        let gc: (() => void) | undefined;

        before(async function() {
            ({ WeakRef, FinalizationGroup, gc } = await details);
        });

        beforeEach(function() {
            if (gc && FinalizationGroup) {
                gcOf = makeGcOf(gc, FinalizationGroup);
            } else {
                gcOf = () => this.skip();
            }
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
                const ref = new WeakRef({});
                expect(ref.deref()).to.be.ok;
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
                let object = {};
                const weakRef = new WeakRef(object);
                await gcOf();
                expect(weakRef.deref()).to.be.ok;
                object = undefined!;
                if (gc) gc(); // No await since we need to stay in same turn
                expect(weakRef.deref()).to.be.ok;
            });

            it("should return undefined if target collected (direct observe)", async function() {
                let object = {};
                const weakRef = new WeakRef(object);
                const collected = gcOf(object);
                object = undefined!;
                await collected;
                expect(weakRef.deref()).to.be.equal(undefined);
            });

            it("should return undefined if target collected (indirect observe)", async function() {
                const weakRef = new WeakRef({});
                await gcOf();
                expect(weakRef.deref()).to.be.equal(undefined);
            });
        });

        it("should allow being subclassed", async function() {
            class SemiWeakRef<T extends object> extends WeakRef<T> {
                constructor(private target: T) {
                    super(target);
                }

                deref(): T {
                    return this.target || super.deref();
                }

                release(): void {
                    this.target = undefined!;
                }
            }

            const semiWeakRef = new SemiWeakRef({});
            semiWeakRef.release();

            expect(semiWeakRef.deref()).to.be.ok;
        });
    });
}
