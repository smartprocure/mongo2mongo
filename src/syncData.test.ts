import Redis from 'ioredis'
import _ from 'lodash/fp.js'
import {
  initCollection,
  initState as initRedisAndMongoState,
  numDocs,
} from 'mongochangestream-testing'
import { MongoClient } from 'mongodb'
import ms from 'ms'
import { setTimeout } from 'node:timers/promises'
import { describe, expect, test } from 'vitest'
import debug from 'debug'

// Output via console.info (stdout) instead of stderr.
// Without this debug statements are swallowed by vitest.
debug.log = console.info.bind(console)

import { initSync, SyncOptions } from './index.js'

const getConns = _.memoize(async () => {
  // Redis
  const redis = new Redis({ keyPrefix: 'testing:' })
  // MongoDB source
  const mongoSourceClient = await MongoClient.connect(
    process.env.MONGO_SOURCE_CONN as string
  )
  const sourceDb = mongoSourceClient.db()
  const sourceColl = sourceDb.collection('testing')
  // MongoDB destination
  const mongoDestintationClient = await MongoClient.connect(
    process.env.MONGO_DESTINATION_CONN as string
  )
  const destinationDb = mongoDestintationClient.db()
  const destinationColl = sourceDb.collection('testing2')
  return {
    sourceDb,
    sourceColl,
    destinationDb,
    destinationColl,
    redis,
  }
})

const getSync = async (options?: SyncOptions) => {
  const { redis, sourceColl, destinationColl } = await getConns()
  const sync = initSync(redis, sourceColl, destinationColl, options)
  sync.emitter.on('stateChange', console.log)
  return sync
}

describe.sequential('syncCollection', () => {
  test('initialScan should work', async () => {
    const { sourceDb, sourceColl, destinationDb, destinationColl } =
      await getConns()
    const sync = await getSync()
    await initRedisAndMongoState(sync, sourceDb, sourceColl)
    await initCollection(destinationDb, destinationColl)

    const initialScan = await sync.runInitialScan()
    // Wait for initial scan to complete
    await initialScan.start()
    await setTimeout(ms('1s'))
    // Stop
    await initialScan.stop()
    const count = await destinationColl.countDocuments()
    expect(count).toBe(numDocs)
  })
  test('should process records via change stream', async () => {
    const { sourceDb, sourceColl, destinationDb, destinationColl } =
      await getConns()
    const sync = await getSync()
    await initRedisAndMongoState(sync, sourceDb, sourceColl)
    await initCollection(destinationDb, destinationColl)

    const changeStream = await sync.processChangeStream()
    changeStream.start()
    await setTimeout(ms('1s'))
    const date = new Date()
    // Update records
    sourceColl.updateMany({}, { $set: { createdAt: date } })
    // Wait for the change stream events to be processed
    await setTimeout(ms('2s'))
    const count = await destinationColl.countDocuments({
      createdAt: date,
    })
    // Stop
    await changeStream.stop()
    expect(count).toBe(numDocs)
  })
})
