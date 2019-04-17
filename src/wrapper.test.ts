import { describe } from "../tests/setup.js";
import { shouldBehaveAsFinalizationGroupAccordingToSpec } from "./tests/FinalizationGroup.shared.js";
import { shouldBehaveAsWeakRefAccordingToSpec } from "./tests/WeakRef.shared.js";
import { gc, gcAvailable } from "../tests/collector-helper.js";
import { available } from "./index.js";
import { wrap } from "./wrapper.js";

describe("Weakrefs shim wrapper", function() {
    const wrappedDetails = (async () => {
        let { WeakRef, FinalizationGroup } = await import("./index.js");

        if (available) {
            ({ WeakRef, FinalizationGroup } = wrap(WeakRef, FinalizationGroup));
        }

        return { gc, WeakRef, FinalizationGroup };
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
