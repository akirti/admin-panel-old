(function (window) {
  window.__env = window.__env || {};
  window.__env.ENV = "prd";
  // Set APP_BASE_PATH to the Apigee proxy basepath for production.
  // API_BASE_URL will be derived as APP_BASE_PATH + "/api/v1".
  window.__env.APP_BASE_PATH = "";
})(window);
