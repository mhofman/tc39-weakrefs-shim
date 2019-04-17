const path = require("path");
var appRoot = require("app-root-path");
const BinWrapper = require("bin-wrapper");

const version = "66.0.3";

const base = `https://ftp.mozilla.org/pub/firefox/releases/${version}/jsshell`;
const bin = new BinWrapper()
    .src(`${base}/jsshell-mac.zip`, "darwin")
    .src(`${base}/jsshell-linux-x86_64.zip`, "linux", "x64")
    .src(`${base}/jsshell-linux-i686.zip`, "linux", "x86")
    .src(`${base}/jsshell-win64.zip`, "win32", "x64")
    .src(`${base}/jsshell-win32.zip`, "win32", "x86")
    .dest(path.join(appRoot.toString(), "vendor", "jsshell", version))
    .use(process.platform === "win32" ? "js.exe" : "js")
    .version(">=66");

(async () => {
    await bin.run();
    console.log(bin.path());
})();
