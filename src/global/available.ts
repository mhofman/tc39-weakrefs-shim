declare var WeakRef: WeakRef.Constructor;
declare var FinalizationGroup: FinalizationGroup.Constructor;

export default typeof WeakRef == "function" &&
    typeof FinalizationGroup == "function";
