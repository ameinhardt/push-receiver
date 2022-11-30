
import { rejects } from 'node:assert';
import https from 'node:https';
import Client from '../dist/client.js';
import FourK from './4kb';

const { SENDER_ID, SERVER_KEY } = process.env;

if (!SERVER_KEY || !SENDER_ID) {
  throw new Error('please define SERVER_KEY and SENDER_ID envvar');
}

const NOTIFICATIONS = {
    SIMPLE: { title: 'Hello world ', body: 'Test' },
    LARGE: { title: 'Hello world ', body: FourK }
  },
  FCM_SEND_API = 'https://fcm.googleapis.com/fcm/send',

  client = new Client({
    senderId: SENDER_ID,
    persistentIds: [],
    heartbeatIntervalMs: 10_000
  }, console);

function send(message) {
  return new Promise((resolve, reject) =>
    https
      .request(FCM_SEND_API, {
        method: 'POST',
        headers: {
          Authorization: `key=${SERVER_KEY}`,
          'Content-Type': 'application/json'
        }
      })
      .end(JSON.stringify({
        time_to_live: 3,
        data: message,
        registration_ids: [client.config.credentials.fcm.token] // send to self
      }))
      .on('error', error => reject(error))
  );
}

async function receive(n) {
  const received = [];

  return new Promise((resolve) => {
    client.on('ON_MESSAGE_RECEIVED', (notification) => {
      received.push(notification);
      if (received.length >= n) {
        resolve(received);
      }
    });
  });
}

describe('Parser', function() {
  beforeAll(async function() {
    await client.connect();
  });

  it('should receive a simple notification', async function() {
    send(NOTIFICATIONS.SIMPLE);
    const notifications = await receive(1);
    expect(notifications.length).toEqual(1);
    expect(notifications[0].message.data).toEqual(NOTIFICATIONS.SIMPLE);
  });

  it('should receive a large notification', async function() {
    send(NOTIFICATIONS.LARGE);
    const notifications = await receive(1);
    expect(notifications.length).toEqual(1);
    expect(notifications[0].message.data).toEqual(NOTIFICATIONS.LARGE);
  });

  afterAll(() => {
    client.destroy();
  });
});
