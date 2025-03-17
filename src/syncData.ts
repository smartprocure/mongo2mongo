import type { Redis } from 'ioredis'
import _ from 'lodash/fp.js'
import * as mongoChangeStream from 'mongochangestream'
import { type ChangeStreamOptions, type ScanOptions } from 'mongochangestream'
import type {
  AnyBulkWriteOperation,
  ChangeStreamDocument,
  ChangeStreamInsertDocument,
  Collection,
  Document,
} from 'mongodb'
import type { QueueOptions } from 'prom-utils'

import type { Events, SyncOptions } from './types.js'

export const initSync = (
  redis: Redis,
  source: Collection,
  destination: Collection,
  options: SyncOptions & mongoChangeStream.SyncOptions = {}
) => {
  const mapper = options.mapper || _.identity<Document>
  // Initialize sync
  const sync = mongoChangeStream.initSync<Events>(redis, source, options)
  // Use emitter from mongochangestream
  const emitter = sync.emitter
  const emit = (event: Events, data: object) => {
    emitter.emit(event, { type: event, ...data })
  }

  /**
   * Process change stream events.
   */
  const processChangeStreamRecords = async (docs: ChangeStreamDocument[]) => {
    const operations: AnyBulkWriteOperation[] = []
    for (const doc of docs) {
      if (doc.operationType === 'insert') {
        operations.push({
          insertOne: {
            document: mapper(doc.fullDocument),
          },
        })
      } else if (
        doc.operationType === 'update' ||
        doc.operationType === 'replace'
      ) {
        const replacement = doc.fullDocument ? mapper(doc.fullDocument) : {}
        operations.push({
          replaceOne: {
            filter: { _id: doc.documentKey._id },
            replacement,
            upsert: true,
          },
        })
      } else if (doc.operationType === 'delete') {
        operations.push({
          deleteOne: {
            filter: { _id: doc.documentKey._id },
          },
        })
      }
    }
    const result = await destination.bulkWrite(operations, {
      // Operations must be ordered
      ordered: true,
    })
    const numSuccess = _.flow(
      _.pick([
        'insertedCount',
        'modifiedCount',
        'deletedCount',
        'upsertedCount',
      ]),
      Object.values,
      _.sum
    )(result)
    const numFailed = operations.length - numSuccess
    emit('process', {
      success: numSuccess,
      fail: numFailed,
      changeStream: true,
    })
  }

  const processRecords = async (docs: ChangeStreamInsertDocument[]) => {
    const operations = docs.map(({ fullDocument }) => ({
      insertOne: { document: mapper(fullDocument) },
    }))
    // Operations are unordered
    const result = await destination.bulkWrite(operations, { ordered: false })
    const numSuccess = result.insertedCount
    const numFailed = operations.length - numSuccess
    emit('process', {
      success: numSuccess,
      fail: numFailed,
      initialScan: true,
    })
  }

  const processChangeStream = (options?: QueueOptions & ChangeStreamOptions) =>
    sync.processChangeStream(processChangeStreamRecords, {
      ...options,
      pipeline: [
        { $unset: ['updateDescription'] },
        ...(options?.pipeline ?? []),
      ],
    })
  const runInitialScan = (options?: QueueOptions & ScanOptions) =>
    sync.runInitialScan(processRecords, options)

  return {
    ...sync,
    /**
     * Process MongoDB change stream for the given collection.
     * `options.batchSize` defaults to 500.
     * `options.timeout` defaults to 30 seconds.
     */
    processChangeStream,
    /**
     * Run initial collection scan. `options.batchSize` defaults to 500.
     * Sorting defaults to `_id`.
     */
    runInitialScan,
    emitter,
  }
}
