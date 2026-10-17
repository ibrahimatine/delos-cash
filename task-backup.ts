// `npm run backup`: copies the database and the documents into
// BACKUP_DIR (next to the database by default). In Docker:
// docker exec delos-cash-app npm run backup
import './api/schema.ts'
import { backup } from './api/backup.ts'

const { target, files } = await backup()
console.log(`✅ ${target} · ${files} nouveau(x) document(s)`)
process.exit(0)
