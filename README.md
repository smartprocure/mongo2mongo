# Mongo to Mongo

## Sync one MongoDB collection to another MongoDB collection

The collections can be in the same database or different databases.

```typescript
import { initSync } from 'mongo2mongo'
import { default as Redis } from 'ioredis'
import { MongoClient } from 'mongodb'
import retry from 'p-retry'

const client = await MongoClient.connect()
const db = client.db()

const sync = initSync(
  new Redis(),
  db.collection('sourceCollection'),
  db.collection('destinationCollection'),
  { omit: ['password', 'unneededStuff'] }
)
// Log events
sync.emitter.on('process', console.info)
sync.emitter.on('error', console.error)
sync.emitter.on('cursorError', () => process.exit(1))
// Process change stream events
const changeStream = await sync.processChangeStream()
changeStream.start()
// Run initial scan of collection batching documents by 1000
const options = { batchSize: 1000 }
const initialScan = await sync.runInitialScan(options)
initialScan.start()
```

## Run the tests locally

Create a .env file with the following variables set for your MongoDB cluster(s).
Note: source and destination can be the same.

```
MONGO_SOURCE_CONN="mongodb+srv://..."
MONGO_DESTINATION_CONN="mongodb+srv://..."
```

Then run `npm test` to run the tests.
