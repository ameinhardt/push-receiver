import crypto from 'node:crypto';
import ece from 'http_ece';
import type * as Types from '../types.js';

interface MessageHeader {
    key: 'crypto-key' | 'encryption'
    value: string
}

interface EncryptedMessage {
    appData: MessageHeader[]
    rawData: Buffer
}

// https://tools.ietf.org/html/draft-ietf-webpush-encryption-03
export default function decrypt<T = Types.MessageEnvelope>(object: EncryptedMessage, keys: Types.Keys): T {
  const cryptoKey = object.appData.find(item => item.key === 'crypto-key');
  if (!cryptoKey) throw new Error('crypto-key is missing');

  const salt = object.appData.find(item => item.key === 'encryption');
  if (!salt) throw new Error('salt is missing');

  const dh = crypto.createECDH('prime256v1');
  dh.setPrivateKey(keys.privateKey, 'base64');

  const parameters = {
      version: 'aesgcm',
      authSecret: keys.authSecret,
      dh: cryptoKey.value.slice(3),
      privateKey: dh,
      salt: salt.value.slice(5)
    },
    decrypted = ece.decrypt(object.rawData, parameters);

  return JSON.parse(decrypted);
}
