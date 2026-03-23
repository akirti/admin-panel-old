(function (w) {
  w.__env = w.__env || {};
  w.__env.ENV = "dev";
  // APP_BASE_PATH: Apigee proxy prefix (e.g. "/easylife/v1").
  // When set, API_BASE_URL is derived as APP_BASE_PATH + "/api/v1",
  // and BrowserRouter uses it as basename for client-side routing.
  // Leave empty for local dev (no proxy).
  w.__env.APP_BASE_PATH = "";
  w.__env.API_BASE_URL = "/api/v1";
  w.__env.PREVAIL_API_BASE_URL = "/api/v1";
  w.__env.JIRA_API_URL = "http://localhost:8002/api/v1";
})(window);
