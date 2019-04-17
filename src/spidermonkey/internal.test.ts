import { after } from "../../tests/setup.js";
import available from "./available.js";

if (available) {
    let stopCollectMonitor: () => void;

    import("./internal.js").then(({ stopCollectMonitor: stop }) => {
        stopCollectMonitor = stop;
    });

    after(function() {
        stopCollectMonitor();
    });
}
