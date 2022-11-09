/* eslint-disable eslint-comments/disable-enable-pair, max-lines */
import { EventEmitter } from 'node:events';
import tls from 'node:tls';
import Long from 'long';
import ProtobufJS from 'protobufjs';
import { Variables, MCSProtoTag } from './constants.js';
import registerFCM from './fcm.js';
import registerGCM, { checkIn } from './gcm.js';
import Parser from './parser.js';
import * as Protos from './protos.js';
import type { mcs_proto } from './protos.js';
import type * as Types from './types.js';
import decrypt from './utils/decrypt.js';

ProtobufJS.util.Long = Long;
ProtobufJS.configure();

const HOST = 'mtalk.google.com',
  PORT = 5228,
  MAX_RETRY_TIMEOUT = 15;

export default class PushReceiver extends EventEmitter {
  private config: Types.ClientConfig;
  private socket: tls.TLSSocket;
  private logger: Console;
  private retryCount = 0;
  private retryTimeout: NodeJS.Timeout;
  private parser: Parser;
  private heartbeatTimer?: NodeJS.Timeout;
  private heartbeatTimeout?: NodeJS.Timeout;
  private streamId = 0;
  private lastStreamIdReported = -1;

  public persistentIds: Types.PersistentId[];

  constructor(config: Types.ClientConfig, logger? : Console) {
    super();
    this.config = {
      vapidKey: 'BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4', // This is default Firebase VAPID key
      persistentIds: [],
      heartbeatIntervalMs: 5 * 60 * 1000, // 5 min
      ...config
    };
    this.logger = logger;

    this.persistentIds = this.config.persistentIds;
  }

  public on(event: 'ON_MESSAGE_RECEIVED', listener: (data: Types.MessageEnvelope) => void): this
  public on(event: 'ON_CREDENTIALS_CHANGE', listener: (data: Types.EventChangeCredentials) => void): this
  public on(event: 'ON_CONNECT', listener: (data: void) => void): this
  public on(event: 'ON_DISCONNECT', listener: (data: unknown) => void): this
  public on(event: 'ON_READY', listener: (data: void) => void): this
  public on(event: 'ON_HEARTBEAT', listener: (data: void) => void): this
  public on(event: unknown, listener: unknown): this {
    return Reflect.apply(EventEmitter.prototype.on, this, [event, listener]);
  }

  public off(event: 'ON_MESSAGE_RECEIVED', listener: (data: Types.MessageEnvelope) => void): this
  public off(event: 'ON_CREDENTIALS_CHANGE', listener: (data: Types.EventChangeCredentials) => void): this
  public off(event: 'ON_CONNECT', listener: (data: void) => void): this
  public off(event: 'ON_DISCONNECT', listener: (data: unknown) => void): this
  public off(event: 'ON_READY', listener: (data: void) => void): this
  public off(event: 'ON_HEARTBEAT', listener: (data: void) => void): this
  public off(event: unknown, listener: unknown): this {
    return Reflect.apply(EventEmitter.prototype.off, this, [event, listener]);
  }

  public emit(event: 'ON_MESSAGE_RECEIVED', data: Types.MessageEnvelope): boolean
  public emit(event: 'ON_CREDENTIALS_CHANGE', data: Types.EventChangeCredentials): boolean
  public emit(event: 'ON_CONNECT'): boolean
  public emit(event: 'ON_DISCONNECT', data: unknown): boolean
  public emit(event: 'ON_READY'): boolean
  public emit(event: 'ON_HEARTBEAT'): boolean
  public emit(event: unknown, ...arguments_: unknown[]): boolean {
    this.logger?.info?.(event, ...arguments_);
    return Reflect.apply(EventEmitter.prototype.emit, this, [event, ...arguments_]);
  }

  public connect = async (): Promise<void> => {
    if (this.socket) {
      return;
    }

    if (this.config.credentials) {
      await this.checkIn();
    } else {
      const oldCredentials = this.config.credentials,
        newCredentials = await this.register();
      this.emit('ON_CREDENTIALS_CHANGE', { oldCredentials, newCredentials });
      this.config.credentials = newCredentials;
    }

    this.lastStreamIdReported = -1;

    this.logger?.info?.('creating tls socket');
    this.socket = new tls.TLSSocket(null);
    this.socket.setKeepAlive(true);
    this.socket.on('connect', this.handleSocketConnect);
    this.socket.on('close', this.handleSocketClose);
    this.socket.on('error', this.handleSocketError);
    this.socket.connect({ host: HOST, port: PORT });

    this.parser = new Parser(this.socket);
    this.parser.on('message', this.handleMessage);
    this.parser.on('error', this.handleParserError);

    this.sendLogin();

    return new Promise((resolve) => {
      this.once('ON_READY', () => resolve());
    });
  };

  public destroy = () => {
    clearTimeout(this.retryTimeout);

    if (this.socket) {
      this.socket.off('close', this.handleSocketClose);
      this.socket.off('error', this.handleSocketError);
      this.socket.destroy();
      this.socket = null;
    }

    if (this.parser) {
      this.parser.off('error', this.handleParserError);
      this.parser.destroy();
      this.parser = null;
    }
  };

  public async register(): Promise<Types.Credentials> {
    const subscription = await registerGCM(this.config, this.logger);
    return registerFCM(subscription, this.config.senderId, this.logger);
  }

  public checkIn(): Promise<Types.GcmData> {
    return checkIn(this.config.credentials?.gcm, this.logger);
  }

  private clearHeartbeat() {
    clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = undefined;

    clearTimeout(this.heartbeatTimeout);
    this.heartbeatTimeout = undefined;
  }

  private startHeartbeat() {
    this.clearHeartbeat();

    if (!this.config.heartbeatIntervalMs) return;

    this.heartbeatTimer = setTimeout(this.sendHeartbeatPing.bind(this), this.config.heartbeatIntervalMs);
    this.heartbeatTimeout = setTimeout(this.socketRetry.bind(this), this.config.heartbeatIntervalMs * 2);
  }

  private handleSocketConnect = (): void => {
    this.retryCount = 0;
    this.emit('ON_CONNECT');
    this.startHeartbeat();
  };

  private handleSocketClose = (error: unknown): void => {
    this.emit('ON_DISCONNECT', error);
    this.clearHeartbeat();
    this.socketRetry();
  };

  // eslint-disable-next-line n/handle-callback-err, @typescript-eslint/no-unused-vars
  private handleSocketError = (error: Error): void => {
    // ignore, the close handler takes care of retry
  };

  private socketRetry() {
    this.destroy();
    const timeout = Math.min(++this.retryCount, MAX_RETRY_TIMEOUT) * 1000;
    this.retryTimeout = setTimeout(this.connect, timeout);
  }

  private getStreamId(): number {
    this.lastStreamIdReported = this.streamId;
    return this.streamId;
  }

  private newStreamIdAvailable(): boolean {
    return this.lastStreamIdReported !== this.streamId;
  }

  private sendHeartbeatPing() {
    const heartbeatPingRequest: Record<string, unknown> = {};

    if (this.newStreamIdAvailable()) {
      heartbeatPingRequest.last_stream_id_received = this.getStreamId();
    }

    const HeartbeatPingRequestType = Protos.mcs_proto.HeartbeatPing,
      errorMessage = HeartbeatPingRequestType.verify(heartbeatPingRequest);

    if (errorMessage) {
      throw new Error(errorMessage);
    }

    const buffer = HeartbeatPingRequestType.encodeDelimited(heartbeatPingRequest).finish();

    this.socket.write(Buffer.concat([
      Buffer.from([MCSProtoTag.kHeartbeatPingTag]),
      buffer
    ]));
  }

  private sendHeartbeatPong(object) {
    const heartbeatAckRequest: Record<string, number> = {};

    if (this.newStreamIdAvailable()) {
      heartbeatAckRequest.last_stream_id_received = this.getStreamId();
    }

    if (object?.status) {
      heartbeatAckRequest.status = object.status;
    }

    const HeartbeatAckRequestType = Protos.mcs_proto.HeartbeatAck,
      errorMessage = HeartbeatAckRequestType.verify(heartbeatAckRequest);
    if (errorMessage) {
      throw new Error(errorMessage);
    }

    const buffer = HeartbeatAckRequestType.encodeDelimited(heartbeatAckRequest).finish();

    this.logger?.info?.('sending heartbeat pong');
    this.socket.write(Buffer.concat([
      Buffer.from([MCSProtoTag.kHeartbeatAckTag]),
      buffer
    ]));
  }

  private sendLogin() {
    const gcm = this.config.credentials.gcm,
      LoginRequestType = Protos.mcs_proto.LoginRequest,
      hexAndroidId = Long.fromString(gcm.androidId).toString(16),
      loginRequest: mcs_proto.ILoginRequest = {
        adaptiveHeartbeat: false,
        authService: 2,
        authToken: gcm.securityToken,
        id: 'nodejs',
        domain: 'mcs.android.com',
        deviceId: `android-${hexAndroidId}`,
        networkType: 1,
        resource: gcm.androidId,
        user: gcm.androidId,
        useRmq2: true,
        setting: [{ name: 'new_vc', value: '1' }],
        clientEvent: [],
        // Id of the last notification received
        receivedPersistentId: this.config.persistentIds
      };

    if (this.config.heartbeatIntervalMs) {
      loginRequest.heartbeatStat = {
        ip: '',
        timeout: true,
        intervalMs: this.config.heartbeatIntervalMs
      };
    }

    const errorMessage = LoginRequestType.verify(loginRequest);
    if (errorMessage) {
      throw new Error(errorMessage);
    }

    const buffer = LoginRequestType.encodeDelimited(loginRequest).finish();

    this.logger?.info?.('sending login request', loginRequest);
    this.socket.write(Buffer.concat([
      Buffer.from([Variables.kMCSVersion, MCSProtoTag.kLoginRequestTag]),
      buffer
    ]));
  }

  private handleMessage = ({ tag, object }: Types.DataPacket): void => {
    // any message will reset the client side heartbeat timeout.
    this.startHeartbeat();

    switch (tag) {
      case MCSProtoTag.kLoginResponseTag: {
        this.logger?.info?.('received login response', object);
        // clear persistent ids, as we just sent them to the server while logging in
        this.config.persistentIds = [];
        this.emit('ON_READY');
        this.startHeartbeat();
        break;
      }

      case MCSProtoTag.kDataMessageStanzaTag: {
        this.logger?.info?.('received message', object);
        this.handleDataMessage(object);
        break;
      }

      case MCSProtoTag.kHeartbeatPingTag: {
        this.logger?.info?.('received heartbeat ping', object);
        this.emit('ON_HEARTBEAT');

        this.sendHeartbeatPong(object);
        break;
      }

      case MCSProtoTag.kHeartbeatAckTag: {
        this.logger?.info?.('received heartbeat ack', object);
        this.emit('ON_HEARTBEAT');
        break;
      }

      case MCSProtoTag.kCloseTag: {
        this.logger?.info?.('received closing', object);
        this.handleSocketClose(object);
        break;
      }

      case MCSProtoTag.kLoginRequestTag: {
        this.logger?.info?.('received login request', object);
        break;
      }

      case MCSProtoTag.kIqStanzaTag: {
        this.logger?.info?.('received iq stanza', object);
        break;
      }

      default: {
        // eslint-disable-next-line no-console
        console.error('Unknown message:', JSON.stringify(object));
        return;
      }

            // no default
    }

    this.streamId++;
  };

  private handleDataMessage = (object): void => {
    if (this.persistentIds.includes(object.persistentId)) {
      return;
    }

    let message;
    try {
      message = decrypt(object, this.config.credentials.keys);
    } catch (error) {
      switch (true) {
        case error.message.includes('Unsupported state or unable to authenticate data'):
        case error.message.includes('crypto-key is missing'):
        case error.message.includes('salt is missing'): {
          // NOTE(ibash) Periodically we're unable to decrypt notifications. In
          // all cases we've been able to receive future notifications using the
          // same keys. So, we silently drop this notification.

          this.logger?.warn?.(`Message dropped as it could not be decrypted: ${error.message}`);
          return;
        }
        default: {
          throw error;
        }
      }
    }

    // Maintain persistentIds updated with the very last received value
    this.persistentIds.push(object.persistentId);
    // Send notification
    this.emit('ON_MESSAGE_RECEIVED', {
      message,
      // Needs to be saved by the client
      persistentId: object.persistentId
    });
  };

  private handleParserError = (error) => {
    this.logger?.error?.(error);
    this.socketRetry();
  };
}

export * as Types from './types.js';
