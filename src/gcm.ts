import Long from 'long';
import * as Protos from './protos.js';
import type * as Types from './types.js';
import request from './utils/request.js';
import delay from './utils/timeout.js';

const REGISTER_URL = 'https://fcmtoken.googleapis.com/register', // 'https://android.clients.google.com/c2dm/register3',
  CHECKIN_URL = 'https://device-provisioning.googleapis.com/checkin',
  fallbackBundle = 'org.chromium.linux'; // 'https://android.clients.google.com/checkin'; // https://support.google.com/android/answer/9021432?hl=en

async function checkIn(gcm?: Types.GcmData, logger? : Types.Logger): Promise<Pick<Types.GcmData, 'androidId' | 'securityToken'>> {
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

  const data = AndroidCheckinRequest.encode(
      AndroidCheckinRequest.create(payload)
    ).finish(),

    body = await request({
      url: CHECKIN_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-protobuf'
      },
      data
    }, logger),

    AndroidCheckinResponse = Protos.checkin_proto.AndroidCheckinResponse,
    message = AndroidCheckinResponse.decode(new Uint8Array(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength))),
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

async function postRegister({ androidId, securityToken, body, retry = 0 }, logger? : Types.Logger): Promise<string> {
  const rawResponse = await request({
      url: REGISTER_URL,
      method: 'POST',
      headers: {
        Authorization: `AidLogin ${androidId}:${securityToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: body
    }),
    response = rawResponse.toString();

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

async function register(gcmConfig: Types.GcmConfig, logger?: Types.Logger): Promise<Types.GcmData> {
  const { bundleId, credentials, senderId, vapidKey } = gcmConfig,
    { androidId, securityToken } = await checkIn(credentials?.gcm),
    body = (new URLSearchParams({
      app: bundleId ?? fallbackBundle, // app package
      'X-subtype': senderId,
      device: androidId,
      sender: vapidKey
    })).toString(),
    response = await postRegister({ androidId, securityToken, body }, logger),
    token = response.split('=')[1];
  logger?.debug?.('gcm registration response', response);

  return {
    token,
    androidId,
    securityToken
  };
}

async function unregister(gcmData: Types.GcmData, bundleId: string, logger?: Types.Logger) {
  const { androidId, securityToken } = gcmData,
    body = (new URLSearchParams({
      app: bundleId ?? fallbackBundle, // app package
      device: androidId,
      delete: 'true',
      gcm_unreg_caller: 'false' // forcefully unregister the application
    })).toString(),
    response = await postRegister({ androidId, securityToken, body }, logger);
  logger?.debug?.('gcm unregistration response', response);
}

export { checkIn, register, unregister };
