declare var WeakRef: import("../weakrefs.js").WeakRef.Constructor;
declare var FinalizationGroup: import("../weakrefs.js").FinalizationGroup.Constructor;

export default typeof WeakRef == "function" &&
    typeof FinalizationGroup == "function";
