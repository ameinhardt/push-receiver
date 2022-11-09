import crypto from 'node:crypto';
import type * as Types from './types.js';
import { escape } from './utils/base64.js';
import request from './utils/request.js';

const FCM_SUBSCRIBE = 'https://fcm.googleapis.com/fcm/connect/subscribe',
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

export default async function registerFCM(gcm: Types.GcmData, config: Types.ClientConfig): Promise<Types.Credentials> {
  const keys = await createKeys(),
    response = await request<Types.FcmData>({
      url: FCM_SUBSCRIBE,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: (new URLSearchParams({
        authorized_entity: config.senderId,
        endpoint: `${FCM_ENDPOINT}/${gcm.token}`,
        encryption_key: keys.publicKey
          .replace(/=/g, '')
          .replace(/\+/g, '-')
          .replace(/\//g, '_'),
        encryption_auth: keys.authSecret
          .replace(/=/g, '')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
      })).toString()
    });

  return {
    gcm,
    keys,
    fcm: response
  };
}
