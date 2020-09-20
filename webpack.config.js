const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

const dist = path.resolve(__dirname, 'dist');
module.exports = {
  entry: './src/index.ts',
  devtool: 'inline-source-map',
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
    extensions: ['.ts', '.js'],
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
  ],
};
