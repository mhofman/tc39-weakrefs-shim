import { describe } from "../tests/setup.js";
import { shouldBehaveAsFinalizationGroupAccordingToSpec } from "./tests/FinalizationGroup.shared.js";
import { shouldBehaveAsWeakRefAccordingToSpec } from "./tests/WeakRef.shared.js";
import { available as gcAvailable } from "./global/gc.js";
import { available, shim } from "./index.js";

describe("Weakrefs shim", function() {
    const shimDetails = shim(true).then(exports => ({
        ...exports,
    }));

    shouldBehaveAsWeakRefAccordingToSpec(shimDetails, gcAvailable, !available);
    shouldBehaveAsFinalizationGroupAccordingToSpec(
        shimDetails,
        gcAvailable,
        !available
    );
});
