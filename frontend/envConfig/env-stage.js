(function (window) {
  window.__env = window.__env || {};
  window.__env.ENV = "stg";
  window.__env.APP_BASE_PATH = "";
  // Explicit absolute URL — bypasses Apigee, talks to backend directly.
  window.__env.API_BASE_URL = "https://easylife-backend-stg.apps.internal/api/v1";
  window.__env.PREVAIL_API_BASE_URL = "https://easylife-backend-stg.apps.internal/api/v1";
})(window);
