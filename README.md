# push-receiver

A library to subscribe to GCM/FCM and receive notifications within a node process.
Initially created by [Matthieu Lemoine](https://github.com/MatthieuLemoine/push-receiver), improved by [Martin Kalábek](https://github.com/eneris/push-receiver). This for updates dependencies, adds a rollup bundle and improves the example.

For [Electron](https://github.com/electron/electron), you can use [electron-push-receiver](https://github.com/MatthieuLemoine/electron-push-receiver) instead which provides a convenient wrapper.

See [this blog post](https://medium.com/@MatthieuLemoine/my-journey-to-bring-web-push-support-to-node-and-electron-ce70eea1c0b0) for more details.

## When should I use `push-receiver` ?

- I want to **receive** push notifications sent using Firebase Cloud Messaging in an [electron](https://github.com/electron/electron) desktop application.
- I want to communicate with a node process/server using Firebase Cloud Messaging infrastructure.

## When should I not use `push-receiver` ?

- I want to **send** push notifications (use the firebase SDK instead)
- My application is running on a FCM supported platform (Android, iOS, Web).

## Install

```
npm i -S @ameinhardt/push-receiver
```

## Requirements

- Node v16 (async/await/randomUUID support)
- Firebase sender id to receive notification
- Firebase serverKey to send notification (optional)


## Usage

### ClientConfig

```typescript
interface ClientConfig {
    credentials?: Credentials // Will be generated if missing - save this after first use!
    persistentIds?: PersistentId[] // Default - []
    senderId: string // Required
    bundleId: string // Required
    vapidKey?: string // Default - default firebase VAPID key
    heartbeatIntervalMs?: number // Default - 5 * 60 * 1000
}
```

### Node example

See [example/index.js](example/index.js)
