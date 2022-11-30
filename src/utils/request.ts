import https from 'node:https';
import { Logger } from '../types';
import delay from './timeout.js';

interface RequestOptions {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  data?: string | Uint8Array;
  responseType?: 'arraybuffer'
}

// In seconds
const MAX_RETRY_TIMEOUT = 15,

  // Step in seconds
  RETRY_STEP = 5;

async function retry(retryCount = 0, options: RequestOptions, logger?: Logger): Promise<Buffer> {
  try {
    return new Promise<Buffer>((resolve, reject) => {
      https
        .request(options.url, {
          method: options.method,
          headers: options.headers
        }, (response) => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            response.resume();
            reject(new Error(`response code ${response.statusCode}`));
            return;
          }
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => {
            chunks.push(chunk);
          });
          response.on('close', () => {
            resolve(Buffer.concat(chunks));
          });
          response.on('error', (error) => reject(error));
        })
        .end(options.data);
    });
  } catch (error) {
    const timeout = Math.min(retryCount * RETRY_STEP, MAX_RETRY_TIMEOUT);
    logger?.debug?.(`Request failed : ${error.message}`);

    if (error.code !== 'ERR_BAD_REQUEST') {
      throw error;
    }
    logger?.debug?.(`Retrying in ${timeout} seconds`);
    await delay(timeout * 1000);
    return retry(retryCount + 1, options, logger);
  }
}

export default function requestWithRety(options: RequestOptions, logger?: Logger): Promise<Buffer> {
  return retry(0, options, logger);
}
