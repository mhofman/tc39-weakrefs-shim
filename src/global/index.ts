import available from "./available.js";
import { gc } from "./gc.js";

declare var WeakRef: import("../weakrefs.js").WeakRef.Constructor;
declare var FinalizationGroup: import("../weakrefs.js").FinalizationGroup.Constructor;

const globalWeakRef = available ? WeakRef : undefined!;
const globalFinalizationGroup = available ? FinalizationGroup : undefined!;

export {
    globalWeakRef as WeakRef,
    globalFinalizationGroup as FinalizationGroup,
    gc,
};
