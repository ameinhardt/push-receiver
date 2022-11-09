# @ameinhardt/push-receiver

## 3.2.0
### Minor Changes

- using pnpm as package manager
- added rollup, also to workaround [protobuf.js#1657](https://github.com/protobufjs/protobuf.js/issues/1657)
- removed unnecessary /proxy
- removed unnecessary system (chrome*) details
- changed appId and bundleId in doRegister
- enforced lint rules
- removed code for sending from (push-receiver) client
- added dotenv, persistentId and credential storage to example
- added BSD license to LICENSE file

### Patch Changes

- Updated devDependencies


## 3.1.0

### Minor Changes

- Added automated Heartbeat messages
  - new option `heartbeatIntervalMs` DEFAULT: 5 * 60 * 1000
  - new events `ON_HEARTBEAT` - this is emited when socket recieves `ping` or `ack` messages

### Patch Changes

- Updated devDependencies
