import crypto from 'node:crypto';
import type * as Types from './types.js';
import { escape } from './utils/base64.js';
import request from './utils/request.js';

const FCM_CONNECT_BASE = 'https://fcm.googleapis.com/fcm/connect',
  FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send';

function createKeys(): Promise<Types.Keys> {
  return new Promise((resolve, reject) => {
    const dh = crypto.createECDH('prime256v1');

    dh.generateKeys();
    crypto.randomBytes(16, (error, buf) => {
      if (error) {
        return reject(error);
      }
      resolve({
        privateKey: escape(dh.getPrivateKey('base64')),
        publicKey: escape(dh.getPublicKey('base64')),
        authSecret: escape(buf.toString('base64'))
      });
    });
  });
}

// this is the old API version https://github.com/firebase/firebase-js-sdk/blob/8d1f1bf8276d3ff88b21ea08279f5404079a8770/packages/messaging/src/models/iid-model.ts#L39
// TODO: update to new API version (with https://fcmregistrations.googleapis.com/v1/projects/${projectId}/registrations), see https://github.com/firebase/firebase-js-sdk/blob/d87d3a8b8cd68e757be6628a72538bfd303e78d1/packages/messaging/src/internals/requests.ts#L39
export default async function getToken(subscription: Types.GcmData, senderId: string, logger?: Types.Logger): Promise<Types.Credentials> {
  const keys = await createKeys(),
    response = await request({
      url: `${FCM_CONNECT_BASE}/subscribe`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: (new URLSearchParams({
        authorized_entity: senderId,
        endpoint: `${FCM_ENDPOINT}/${subscription.token}`,
        encryption_key: keys.publicKey
          .replace(/=/g, '')
          .replace(/\+/g, '-')
          .replace(/\//g, '_'),
        encryption_auth: keys.authSecret
          .replace(/=/g, '')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
      })).toString()
    }, logger);

  return {
    gcm: subscription,
    keys,
    fcm: JSON.parse(response.toString()) as Types.FcmData
  };
}

// Deletes the registration token and unsubscribes instance from the push subscription
async function deleteToken(subscription: Types.FcmData, senderId: string, logger?: Types.Logger) {
  await request({
    url: `${FCM_CONNECT_BASE}/unsubscribe`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: (new URLSearchParams({
      authorized_entity: senderId,
      token: subscription.token,
      pushSet: subscription.pushSet
    })).toString()
  }, logger);
}

export { getToken, deleteToken };
