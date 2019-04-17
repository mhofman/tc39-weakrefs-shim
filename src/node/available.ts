declare namespace process {
    var browser: any;
}

export default typeof process == "object" && !process.browser;
