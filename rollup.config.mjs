import { builtinModules } from 'node:module';
import Replace from '@rollup/plugin-replace';
import Typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';

const sourceMap = false;

export default defineConfig({
  input: 'src/client.ts',
  output: [{
    file: 'dist/client.mjs',
    format: 'es'
  }, {
    file: 'dist/client.cjs',
    format: 'cjs'
  }],
  external: [
    'protobufjs',
    'http_ece',
    'axios',
    'long',
    'protobufjs/minimal.js',
    ...builtinModules.flatMap(p => [p, `node:${p}`])
  ],
  plugins: [
    Replace({
      preventAssignment: true,
      sourceMap,
      delimiters: ['\\b', ''],
      values: {
        'import * as $protobuf from "protobufjs/minimal"': 'import $protobuf from \'protobufjs/minimal.js\''
      }
    }),
    Typescript({
      // declaration: false,
      sourceMap
    })
  ]
});
