import available from "./available.js";

declare var WeakRef: WeakRef.Constructor;
declare var FinalizationGroup: FinalizationGroup.Constructor;

const globalWeakRef = available ? WeakRef : undefined!;
const globalFinalizationGroup = available ? FinalizationGroup : undefined!;

export {
    globalWeakRef as WeakRef,
    globalFinalizationGroup as FinalizationGroup,
};
