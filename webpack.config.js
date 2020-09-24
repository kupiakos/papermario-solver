/* eslint-disable node/no-unpublished-require */
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const WasmPackPlugin = require('@wasm-tool/wasm-pack-plugin');

const dist = path.resolve(__dirname, 'dist');
const baseConfig = {
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
        // options: {projectReferences: true},
      },
    ],
  },
  resolve: {
    modules: ['src', 'node_modules'],
    extensions: ['.ts', '.js', '.wasm'],
  },
};

const browserConfig = {
  ...baseConfig,
  entry: './src/index.ts',
  devtool: 'source-map',
  output: {
    filename: 'index.js',
    path: dist,
  },
  devServer: {
    contentBase: dist,
    port: 8000,
  },
  plugins: [
    new CopyPlugin({
      patterns: [{from: path.resolve(__dirname, 'static'), to: dist}],
    }),
  ],
};

const workerConfig = {
  ...baseConfig,
  entry: './src/worker.ts',
  target: 'webworker',
  output: {
    filename: 'worker.js',
    path: dist,
  },
  plugins: [
    new WasmPackPlugin({
      crateDirectory: __dirname,
      outName: 'solver',
      withTypescript: true,
    }),
  ],
};

// See https://github.com/webpack/webpack/issues/7647#issuecomment-423788776.
module.exports = [browserConfig, workerConfig];
