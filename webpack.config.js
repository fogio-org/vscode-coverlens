//@ts-check
'use strict';

const path = require('path');

/** @type {import('webpack').Configuration} */
const config = {
  target: 'node',
  // mode is set via CLI: --mode development|production
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
  },
  externals: {
    vscode: 'commonjs vscode',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
    ],
  },
  // devtool is set via CLI for production (--devtool hidden-source-map)
  devtool: 'source-map',
  infrastructureLogging: {
    level: 'log',
  },
};

module.exports = [config];
