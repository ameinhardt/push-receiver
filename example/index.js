/* eslint-disable eslint-comments/disable-enable-pair, no-console */
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import dotenv from 'dotenv';
import PushReceiver from '@ameinhardt/push-receiver';

dotenv.config({
  path: '../.env'
});

const SENDER_ID = process.env.SENDER_ID,
  SERVER_KEY = process.env.SERVER_KEY,
  CREDENTIALFILE = path.join(path.dirname(url.fileURLToPath(import.meta.url)), './credentials.json'),
  PERSISTENTIDSFILE = path.join(path.dirname(url.fileURLToPath(import.meta.url)), './persistentIds.json'),
  config = {
    bundleId: 'com.example.bundle.id',
    credentials: undefined,
    senderId: SENDER_ID,
    heartbeatIntervalMs: 5 * 60 * 1000, // 5 min
    persistentIds: []
  };

async function onMessageReceived({ message }) {
  console.log('Message received', message);
}

async function onCredentialsChanged({ oldCredentials, newCredentials }) {
  console.log('Client updated credentials');
  if (newCredentials) {
    await fs.writeFile(CREDENTIALFILE, JSON.stringify(newCredentials));
  } else {
    fs.unlink(CREDENTIALFILE);
  }
  console.log('updated ./credentials.json');
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
  try {
    config.credentials = JSON.parse(await fs.readFile(CREDENTIALFILE));
    config.persistentIds = JSON.parse(await fs.readFile(PERSISTENTIDSFILE));
  } catch {}
  console.log(config);
  const instance = new PushReceiver(config, {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  })
    .on('ON_MESSAGE_RECEIVED', onMessageReceived)
    .on('ON_CREDENTIALS_CHANGE', onCredentialsChanged)
    .on('ON_HEARTBEAT', onHeartbeat);

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
  for (const signal of ['exit', 'SIGINT', 'SIGTERM']) {
    process.once(signal, async () => {
      await fs.writeFile(PERSISTENTIDSFILE, JSON.stringify(config.persistentIds));
      instance
        .off('ON_HEARTBEAT', onHeartbeat)
        .off('ON_CREDENTIALS_CHANGE', onCredentialsChanged)
        .off('ON_MESSAGE_RECEIVED', onMessageReceived)
        .destroy();
      process.exit();
    });
  }
  /* setTimeout(async () => {
    console.log('destroying connection...');
    await instance.destroy();
    console.log('destroyed, bye');
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(0);
  }, 10 * 1000); */
};

main();
