const { merge } = require("webpack-merge");
const commonConfig = require("./webpack.common");
 
const deps = require("../package.json").dependencies;
 
const devConfig = {
  mode: "development",
  output: {
    publicPath: "auto",
  },
  devServer: {
    port: 3001,
    historyApiFallback: true,
  },
  optimization: {
    runtimeChunk: false,
    splitChunks: false,
  },
  plugins: [],
};