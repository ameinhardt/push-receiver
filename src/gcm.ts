import Long from 'long';
import * as Protos from './protos.js';
import type * as Types from './types.js';
import request from './utils/request.js';
import delay from './utils/timeout.js';

const REGISTER_URL = 'https://fcmtoken.googleapis.com/register', // 'https://android.clients.google.com/c2dm/register3',
  CHECKIN_URL = 'https://device-provisioning.googleapis.com/checkin'; // 'https://android.clients.google.com/checkin';

function prepareCheckinBuffer(gcm?: Types.GcmData) {
  const AndroidCheckinRequest = Protos.checkin_proto.AndroidCheckinRequest,
    payload = {
      userSerialNumber: 0,
      checkin: {
        type: 3
      },
      version: 3,
      id: gcm?.androidId ? Long.fromString(gcm.androidId) : undefined,
      securityToken: gcm?.securityToken ? Long.fromString(gcm?.securityToken, true) : undefined
    },
    errorMessage = AndroidCheckinRequest.verify(payload);
  if (errorMessage) throw new Error(errorMessage);

  const message = AndroidCheckinRequest.create(payload);
  return AndroidCheckinRequest.encode(message).finish();
}

export async function checkIn(gcm?: Types.GcmData, logger? : Console): Promise<Types.GcmData> {
  const body = await request<ArrayBuffer>({
    url: CHECKIN_URL,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-protobuf'
    },
    data: prepareCheckinBuffer(gcm),
    responseType: 'arraybuffer'
  }, logger),

    AndroidCheckinResponse = Protos.checkin_proto.AndroidCheckinResponse,
    message = AndroidCheckinResponse.decode(new Uint8Array(body)),
    object = AndroidCheckinResponse.toObject(message, {
      longs: String,
      enums: String,
      bytes: String
    });

  return {
    androidId: object.androidId,
    securityToken: object.securityToken
  };
}

async function postRegister({ androidId, securityToken, body, retry = 0 }, logger? : Console): Promise<string> {
  const response = await request<string>({
    url: REGISTER_URL,
    method: 'POST',
    headers: {
      Authorization: `AidLogin ${androidId}:${securityToken}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: body
  });

  if (response.includes('Error')) {
    logger?.warn?.(`Register request has failed with ${response}`);
    if (retry >= 5) {
      throw new Error('GCM register has failed');
    }

    logger?.warn?.(`Retring... ${retry + 1}`);
    await delay(1000);
    return postRegister({ androidId, securityToken, body, retry: retry + 1 }, logger);
  }

  return response;
}

export default async (config: Types.ClientConfig, logger? : Console): Promise<Types.GcmData> => {
  const { androidId, securityToken } = await checkIn(config.credentials?.gcm),
    { bundleId, senderId, vapidKey } = config,
    body = (new URLSearchParams({
      app: bundleId ?? 'org.chromium.linux', // app package
      'X-subtype': senderId,
      device: androidId,
      sender: vapidKey
    })).toString(),

    response = await postRegister({ androidId, securityToken, body }, logger),
    token = response.split('=')[1];

  return {
    token,
    androidId,
    securityToken
  };
};
