import axios, { AxiosRequestConfig } from 'axios';
import delay from './timeout.js';

// In seconds
const MAX_RETRY_TIMEOUT = 15,

  // Step in seconds
  RETRY_STEP = 5;

async function retry<T>(retryCount = 0, options: AxiosRequestConfig, logger? : Console): Promise<T> {
  try {
    const response = await axios<T>(options);
    return response.data;
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

export default function requestWithRety<T>(options: AxiosRequestConfig, logger? : Console): Promise<T> {
  return retry<T>(0, options, logger);
}
