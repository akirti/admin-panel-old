(function (window) {
  window.__env = window.__env || {};
  window.__env.ENV = "dev";
  // Set APP_BASE_PATH to the Apigee proxy basepath for this environment.
  // API_BASE_URL will be derived as APP_BASE_PATH + "/api/v1".
  // Example: "/easylife/v1" → API calls go to /easylife/v1/api/v1/...
  window.__env.APP_BASE_PATH = "";
})(window);
