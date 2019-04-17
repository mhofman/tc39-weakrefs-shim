import { describe } from "../tests/setup.js";
import { shouldBehaveAsFinalizationGroupAccordingToSpec } from "./tests/FinalizationGroup.shared.js";
import { shouldBehaveAsWeakRefAccordingToSpec } from "./tests/WeakRef.shared.js";
import { gc, gcAvailable } from "../tests/collector-helper.js";
import { available } from "./index.js";

describe("Weakrefs shim", function() {
    const shimDetails = import("./index.js").then(exports => ({
        gc,
        ...exports,
    }));

    shouldBehaveAsWeakRefAccordingToSpec(shimDetails, gcAvailable, !available);
    shouldBehaveAsFinalizationGroupAccordingToSpec(
        shimDetails,
        gcAvailable,
        !available
    );
});
