module.exports = (env) => merge(commonConfig(env), devConfig);
 
(function (window) {
  window.__env = window.__env || {};
  window.__env.ENV = "dev";
  window.__env.MFE_BASE_URL = "http://localhost:800/";
  window.__env.APIGEE_BASE_URL = "http://localhost:8000/";
})(this);
 