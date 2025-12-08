module.exports = (env) => {
  return {
    output: {
      path: path.resolve(__dirname, "../build"),
    },
    resolve: {
      extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
      fallback: {
        crypto: false,
      },
    },
    optimization: {
      runtimeChunk: false,
      splitChunks: false,
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx|js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            // options: {
            //   presets: ["@babel/preset-env", "@babel/preset-react"],
            //   plugins: ["@babel/plugin-transform-runtime"],
            // },
          },
        },
        {
          test: /\.(jpe?g|png|webp|gif|svg)$/i,
          type: "asset/resource",
          generator: {
            filename: "[path][name][ext]?[hash]",
          },
        },
        {
          test: /\.(css|s[ac]ss)$/i,
          use: ["style-loader", "css-loader", "postcss-loader"],
        },
        {
          test: /\.m?js$/,
          type: "javascript/auto",
          resolve: {
            fullySpecified: false,
          },
        },
        // Webpack 5 handles JSON imports natively; no loader needed
      ],
    },
    plugins: [
      new MiniCssExtractPlugin(),
      new HtmlWebpackPlugin({
        template: "./public/index.html",
        publicPath: "/",
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, "../envConfig"),
            to: path.resolve(__dirname, "../build"),
          },
        ],
      }),
    ],
  };
};