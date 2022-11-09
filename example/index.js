/* eslint-disable eslint-comments/disable-enable-pair, no-console */
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import dotenv from 'dotenv';
// eslint-disable-next-line import/namespace, import/default, import/no-named-as-default
import PushReceiver from '../dist/client.js';

dotenv.config({
  path: '../.env'
});

const SENDER_ID = process.env.SENDER_ID,
  LOG_LEVEL = process.env.LOG_LEVEL || 'DEBUG',
  SERVER_KEY = process.env.SERVER_KEY,
  CREDENTIALFILE = path.join(path.dirname(url.fileURLToPath(import.meta.url)), './credentials.json'),
  PERSISTENTIDSFILE = path.join(path.dirname(url.fileURLToPath(import.meta.url)), './persistentIds.json');

let credentials;

async function onMessageReceived({ message }) {
  console.log('Message received', message);
}

async function onCredentialsChanged({ oldCredentials, newCredentials }) {
  console.log('Client generated new credentials');
  credentials = newCredentials;
  await fs.writeFile(CREDENTIALFILE, JSON.stringify(credentials));
  console.log('saved in ./credentials.json');
}

function onHeartbeat() {
  console.log('still alive...');
}

if (!SENDER_ID) {
  console.error('Missing senderId');
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(1);
}

const main = async () => {
  let persistentIds = [];
  try {
    credentials = JSON.parse(await fs.readFile(CREDENTIALFILE));
    persistentIds = JSON.parse(await fs.readFile(PERSISTENTIDSFILE));
  } catch {}
  const instance = new PushReceiver({
    bundleId: 'com.bosch.riot.applauth',
    credentials,
    logLevel: LOG_LEVEL,
    senderId: SENDER_ID,
    heartbeatIntervalMs: 5 * 60 * 1000, // 5 min
    persistentIds
  });

  instance.on('ON_MESSAGE_RECEIVED', onMessageReceived);
  instance.on('ON_CREDENTIALS_CHANGE', onCredentialsChanged);
  instance.on('ON_HEARTBEAT', onHeartbeat);

  await instance.connect();
  console.log('connected. Waiting for messages...');

  if (SERVER_KEY) {
    await instance.send({
      message: 'PushReceiver test message',
      title: 'testMessage',
      key: '',
      action: ''
    }, SERVER_KEY);
  }
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, async () => {
      instance.off('ON_HEARTBEAT', onHeartbeat);
      instance.off('ON_CREDENTIALS_CHANGE', onCredentialsChanged);
      instance.off('ON_MESSAGE_RECEIVED', onMessageReceived);
      await fs.writeFile(PERSISTENTIDSFILE, JSON.stringify(instance.persistentIds));
      instance.destroy();
      process.exit();
    });
  }
};

main();
