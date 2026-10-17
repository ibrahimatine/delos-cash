export const run = (sql) => {
  // Cloud uploads use a person-scoped private Blob pathname; SQLite files
  // keep using the content hash on disk, so this column is nullable.
  sql`ALTER TABLE file ADD COLUMN blobPath TEXT`.run()
}
