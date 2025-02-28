# 0.34.0

- Latest `mongochangestream` - Performance improvements related to updating the
  refresh token more often. See [mongochangestream
  changelog](https://github.com/smartprocure/mongochangestream/blob/master/CHANGELOG.md#0590)

# 0.33.0

- Move re-try logic out of this package.
- Removed `error` event.
- Added tests.

# 0.32.0

- Latest `mongochangestream` - Fix for downstream `processRecords` mutation.

# 0.31.0

- Bumped deps.

# 0.30.0

- Bump `mongochangestream` to enable "pausable" feature.
- Bumped deps.

# 0.29.0

- Bump packages, including latest `prom-utils` which allows for throttling of items/sec and bytes/sec.

# 0.28.0

- Latest `mongochangestream`.
- Bumped peer dependencies for `ioredis` and `mongodb`.

# 0.27.0

- Latest mongochangestream - Bug fixes.

# 0.26.0

- Remove `updateDescription` since it is not needed and may cause a `BSONObjectTooLarge` error.

# 0.25.0

- Latest `mongochangestream` - Change stream option `operationTypes` (`insert`, `update`, `delete`, ...).

# 0.24.0

- `processChangeStream` now batches records. Default timeout before the queue is automatically
  flushed is 30 seconds.

# 0.23.0

- Latest `mongochangestream` - More robust error code handling for `missingOplogEntry`.

# 0.22.0

- Latest `mongochangestream` - Don't emit the `cursorError` event when stopping.

# 0.21.1

- Latest `mongochangestream` - FSM bug fix.

# 0.21.0

- Latest `mongochangestream` - Drop health check code in favor of `cursorError` event.

# 0.20.0

- Latest `mongochangestream` - extend event types.

# 0.19.0

- Latest `mongochangestream` - `runInitialScan` pipeline.

# 0.18.0

- Latest `mongochangestream` - Handle master failover scenario properly for initial scan.

# 0.17.0

- Latest `mongochangestream` - Longer `maxSyncDelay` default.

# 0.16.0

- Export `detectResync`.
- Emit more info.

# 0.15.0

- Latest `mongochangestream` - More robust cursor consumption.

# 0.14.0

- Latest `mongochangestream` - Bug fix.

# 0.13.0

- Latest `mongochangestream` - generic emitter.
- Use emitter from `mongochangestream` which now emits two events on its own.

# 0.12.0

- Latest `mongochangestream` - health checks.

# 0.11.1

- Forgot to bump `prom-utils` in this repo.

# 0.11.0

- Latest `mongochangestream` - `batchBytes` option.

# 0.10.0

- Return `emitter` with events: `process` and `error`.
- Stats are no longer logged.

# 0.9.0

- Removed `clearCompletedOn`.
- Latest `mongochangestream` - `JSONSchema` type.

# 0.8.0

- Latest `mongochangestream` - Option to strip metadata from a JSON schema for `detectSchemaChange`.

# 0.7.0

- Latest `mongochangestream` - Ensure that you can call `start` after calling `stop`.

# 0.6.0

- Bump `mongodb` peer dep.
- Latest `mongochangestream`.

# 0.5.2

- Bug fix from `mongochangestream`.

# 0.5.0

- Latest `mongochangestream`.

# 0.4.0

- Latest `mongochangestream`.

# 0.3.0

- Added peer dependencies.
- Latest `mongochangestream`.

# 0.2.0

- Latest `mongochangestream`.

# 0.1.0

- Initial release.
