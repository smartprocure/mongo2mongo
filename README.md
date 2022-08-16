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
// Process change stream events
sync.processChangeStream()
// Run initial scan of collection batching documents by 1000
const options = { batchSize: 1000 }
retry(() => sync.runInitialScan(options))
```
