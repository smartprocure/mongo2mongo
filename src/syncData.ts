import _ from 'lodash/fp.js'
import type {
  AnyBulkWriteOperation,
  ChangeStreamDocument,
  ChangeStreamInsertDocument,
  Collection,
  Document,
} from 'mongodb'
import type { Redis } from 'ioredis'
import mongoChangeStream, {
  ScanOptions,
  ChangeStreamOptions,
} from 'mongochangestream'
import { QueueOptions } from 'prom-utils'
import { SyncOptions, Events } from './types.js'

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
    try {
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
        _.pick(['nInserted', 'nModified', 'nRemoved', 'nUpserted']),
        Object.values,
        _.sum
      )(result)
      const numFailed = operations.length - numSuccess
      emit('process', {
        success: numSuccess,
        fail: numFailed,
        changeStream: true,
      })
    } catch (e) {
      emit('error', { error: e, changeStream: true })
    }
  }

  const processRecords = async (docs: ChangeStreamInsertDocument[]) => {
    try {
      const operations = docs.map(({ fullDocument }) => ({
        insertOne: { document: mapper(fullDocument) },
      }))
      // Operations are unordered
      const result = await destination.bulkWrite(operations, { ordered: false })
      const numSuccess = result.nInserted
      const numFailed = operations.length - numSuccess
      emit('process', {
        success: numSuccess,
        fail: numFailed,
        initialScan: true,
      })
    } catch (e) {
      emit('error', { error: e, initialScan: true })
    }
  }

  const processChangeStream = (options?: QueueOptions & ChangeStreamOptions) =>
    sync.processChangeStream(processChangeStreamRecords, options)
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
