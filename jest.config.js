/* eslint-disable eslint-comments/disable-enable-pair, unicorn/prefer-module */
/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */

module.exports = {
  setupFiles: ['dotenv/config'],
  preset: 'ts-jest',
  testEnvironment: 'node'
};
