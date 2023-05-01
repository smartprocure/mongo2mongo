import _ from 'lodash/fp.js'
import type {
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

  const processRecord = async (doc: ChangeStreamDocument) => {
    try {
      if (doc.operationType === 'insert') {
        const document = mapper(doc.fullDocument)
        await destination.insertOne(document)
      } else if (
        doc.operationType === 'update' ||
        doc.operationType === 'replace'
      ) {
        const document = doc.fullDocument ? mapper(doc.fullDocument) : {}
        await destination.replaceOne({ _id: doc.documentKey._id }, document, {
          upsert: true,
        })
      } else if (doc.operationType === 'delete') {
        await destination.deleteOne({ _id: doc.documentKey._id })
      }
      emit('process', { success: 1, changeStream: true })
    } catch (e) {
      emit('error', { error: e, changeStream: true })
    }
  }

  const processRecords = async (docs: ChangeStreamInsertDocument[]) => {
    try {
      const documents = docs.map(({ fullDocument }) => ({
        insertOne: { document: mapper(fullDocument) },
      }))
      const result = await destination.bulkWrite(documents, { ordered: false })
      const numInserted = result.nInserted
      const numFailed = documents.length - numInserted
      emit('process', {
        success: numInserted,
        fail: numFailed,
        initialScan: true,
      })
    } catch (e) {
      emit('error', { error: e, initialScan: true })
    }
  }

  const processChangeStream = (options?: ChangeStreamOptions) =>
    sync.processChangeStream(processRecord, options)
  const runInitialScan = (options?: QueueOptions & ScanOptions) =>
    sync.runInitialScan(processRecords, options)

  return {
    ...sync,
    /**
     * Process MongoDB change stream for the given collection.
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
