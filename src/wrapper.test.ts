import { describe } from "../tests/setup.js";
import { shouldBehaveAsFinalizationGroupAccordingToSpec } from "./tests/FinalizationGroup.shared.js";
import { shouldBehaveAsWeakRefAccordingToSpec } from "./tests/WeakRef.shared.js";
import { available as gcAvailable } from "./global/gc.js";
import { available } from "./index.js";
import { wrap } from "./wrapper.js";

describe("Weakrefs shim wrapper", function() {
    const wrappedDetails = (async () => {
        let { WeakRef, FinalizationGroup, gc } = await import("./index.js");

        if (available) {
            ({ WeakRef, FinalizationGroup, gc } = wrap(
                WeakRef,
                FinalizationGroup,
                gc
            ));
        }

        return { WeakRef, FinalizationGroup, gc };
    })();

    shouldBehaveAsWeakRefAccordingToSpec(
        wrappedDetails,
        gcAvailable,
        !available
    );
    shouldBehaveAsFinalizationGroupAccordingToSpec(
        wrappedDetails,
        gcAvailable,
        !available
    );
});
