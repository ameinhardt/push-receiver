/* eslint-disable eslint-comments/disable-enable-pair, no-console */
import { LogLevels } from '../constants.js';

let logLevel = LogLevels.NONE;

const setLogLevel = (newLogLevel: keyof typeof LogLevels): void => {
    logLevel = LogLevels[newLogLevel];
  },

  verbose = (...arguments_: unknown[]): void => {
    if (logLevel < LogLevels.VERBOSE) return;
    console.log('[PUSH_RECEIVER_VERBOSE]', ...arguments_);
  },

  debug = (...arguments_: unknown[]): void => {
    if (logLevel < LogLevels.DEBUG) return;
    console.log('[PUSH_RECEIVER_DEBUG]', ...arguments_);
  },

  warn = (...arguments_: unknown[]): void => {
    if (logLevel === LogLevels.NONE) return;
    console.warn('[PUSH_RECEIVER_WARNING]', ...arguments_);
  },

  error = console.error;

export default {
  setLogLevel,
  verbose,
  debug,
  warn,
  error
};
