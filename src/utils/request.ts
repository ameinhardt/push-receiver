import axios, { AxiosRequestConfig } from 'axios';
import Logger from './logger.js';
import delay from './timeout.js';

// In seconds
const MAX_RETRY_TIMEOUT = 15,

  // Step in seconds
  RETRY_STEP = 5;

async function retry<T>(retryCount = 0, options: AxiosRequestConfig): Promise<T> {
  try {
    const response = await axios<T>(options);
    return response.data;
  } catch (error) {
    const timeout = Math.min(retryCount * RETRY_STEP, MAX_RETRY_TIMEOUT);
    Logger.verbose(`Request failed : ${error.message}`);

    if (error.code !== 'ERR_BAD_REQUEST') {
      throw error;
    }
    Logger.verbose(`Retrying in ${timeout} seconds`);
    await delay(timeout * 1000);
    return retry(retryCount + 1, options);
  }
}

export default function requestWithRety<T>(options: AxiosRequestConfig): Promise<T> {
  return retry<T>(0, options);
}
