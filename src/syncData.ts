import _ from 'lodash/fp.js'
import {
  ChangeStreamDocument,
  ChangeStreamInsertDocument,
  Collection,
  Document,
} from 'mongodb'
import { default as Redis } from 'ioredis'
import mongoChangeStream, { ScanOptions, getKeys } from 'mongochangestream'
import { stats } from 'print-stats'
import { QueueOptions } from 'prom-utils'
import { SyncOptions } from './types.js'

export const initSync = (
  redis: Redis,
  source: Collection,
  destination: Collection,
  options: SyncOptions & mongoChangeStream.SyncOptions = {}
) => {
  const mapper = options.mapper || _.identity<Document>
  const dbStats = stats(destination.collectionName)
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
      dbStats.incRows()
    } catch (e) {
      console.error('ERROR', e)
      dbStats.incErrors()
    }
    dbStats.print()
  }

  const processRecords = async (docs: ChangeStreamInsertDocument[]) => {
    try {
      const documents = docs.map(({ fullDocument }) => ({
        insertOne: { document: mapper(fullDocument) },
      }))
      const result = await destination.bulkWrite(documents, { ordered: false })
      const numInserted = result.nInserted
      const numFailed = documents.length - numInserted
      dbStats.incRows(numInserted)
      dbStats.incErrors(numFailed)
    } catch (e) {
      console.error('ERROR', e)
    }
    dbStats.print()
  }

  const sync = mongoChangeStream.initSync(redis, options)
  /**
   * Process MongoDB change stream for the given collection.
   */
  const processChangeStream = (pipeline?: Document[]) =>
    sync.processChangeStream(source, processRecord, pipeline)
  /**
   * Run initial collection scan. `options.batchSize` defaults to 500.
   * Sorting defaults to `_id`.
   */
  const runInitialScan = (options?: QueueOptions & ScanOptions) =>
    sync.runInitialScan(source, processRecords, options)
  const keys = getKeys(source)

  return { processChangeStream, runInitialScan, keys }
}
