var window = this;
var global = this;
var location = {};
["debug", "info", "warn", "error"].forEach(level => {
    console[level] = console.log;
});
window.onerror = undefined;
