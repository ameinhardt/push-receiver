export interface Keys {
  privateKey: string;
  publicKey: string;
  authSecret: string;
}

export interface GcmData {
  androidId: string;
  securityToken: string;
  token?: string;
}

// TODO: replace this with actual data
export type FcmData = {
  token: string;
  pushSet: string;
}
export interface Credentials {
  keys: Keys;
  gcm: GcmData;
  fcm: FcmData;
}

export type PersistentId = string;

export type DisposeFunction = CallableFunction;

// table 2b. - https://firebase.google.com/docs/cloud-messaging/http-server-ref
export interface Notification {
  title?: string;
  body?: string;
  android_channel_id?: string;
  icon?: string;
  sound?: string;
  tag?: string;
  color?: string;
  image?: string;
  click_action?: string;
  body_loc_key?: string;
  body_loc_args?: string; // JSON array as string
  title_loc_key?: string;
  title_loc_args?: string; // JSON array as string
}

export interface MessageCustomData {
  [key: string]: unknown;
}

// table 1. - https://firebase.google.com/docs/cloud-messaging/http-server-ref
export interface Message {
  to?: string;
  registration_ids?: string[];
  condition?: string;
  collapse_key?: string;
  priority?: 'normal' | 'high';
  content_available?: boolean;
  mutable_content?: string; // JSON boolean ???
  restricted_package_name?: string;
  dry_run?: boolean;
  data?: MessageCustomData;
  notification?: Notification;

  // Not in table, but found in data
  fcmMessageId?: string;
  from?: string;
}

export interface MessageEnvelope {
  message: Message;
  persistentId: string;
}

export interface DataPacket<T = unknown> {
  tag: number;
  object: T;
}

export interface GcmConfig {
  bundleId: string;
  credentials?: Credentials;
  senderId: string;
  vapidKey?: string;
}

export interface ClientConfig extends GcmConfig {
  persistentIds: PersistentId[];
  heartbeatIntervalMs?: number
}

export interface EventChangeCredentials {
  oldCredentials?: Credentials;
  newCredentials: Credentials;
}

export interface MessageToSend {
  title: string;
  message: string;
  key?: string;
  action?: string;
  // TODO: Fill all options
}

export type Logger = Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
