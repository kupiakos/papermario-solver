/* eslint-disable node/no-unpublished-require */
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const WasmPackPlugin = require('@wasm-tool/wasm-pack-plugin');

const dist = path.resolve(__dirname, 'dist');
module.exports = {
  entry: './src/index.ts',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    modules: ['src', 'node_modules'],
    extensions: ['.ts', '.js', '.wasm'],
  },
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
    new WasmPackPlugin({
      crateDirectory: __dirname,
      outName: 'solver',
      withTypescript: true,
    }),
  ],
};
