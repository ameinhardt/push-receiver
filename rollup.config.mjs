import { builtinModules } from 'node:module';
import Replace from '@rollup/plugin-replace';
import Typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';

const sourceMap = false;

export default defineConfig({
  input: 'src/client.ts',
  output: {
    dir: 'dist',
    format: 'module'
  },
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
