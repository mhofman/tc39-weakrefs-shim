// Override the Karma setup for local debugging
window.__karma__.info = function(info) {
    if (info.dump && window.console) window.console.log(info.dump);
};
window.__karma__.complete = function() {
    if (window.console)
        window.console.log(
            "Total: " +
                this.failed +
                " FAILED, " +
                this.passing +
                " SUCCESS, " +
                this.skipped +
                " SKIPPED"
        );
};
window.__karma__.skipped = 0;
window.__karma__.passing = 0;
window.__karma__.failed = 0;
window.__karma__.result = window.console
    ? function(result) {
          var msg;

          if (result.skipped) {
              this.skipped++;
              msg = "SKIPPED ";
          } else if (result.success) {
              this.passing++;
              msg = "SUCCESS ";
          } else {
              this.failed++;
              msg = "FAILED ";
          }
          window.console.log(
              msg + result.suite.join(" ") + " " + result.description
          );

          for (var i = 0; i < result.log.length; i++) {
              // Printing error without losing stack trace
              (function(err) {
                  setTimeout(function() {
                      window.console.error(err);
                  });
              })(result.log[i]);
          }
      }
    : function() {};
window.__karma__.loaded = function() {
    this.start();
};
