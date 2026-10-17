export const run = (sql) => {
  // Initial version: the tables are created in api/schema.ts.
  // Next migrations alter an existing database, e.g.:
  /*
    sql`ALTER TABLE fund ADD COLUMN closedAt REAL`.run()
  */
  sql`SELECT 1`.get()
}
