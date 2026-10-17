// Documents (CDC RG-17): quotes, invoices, photos, statutes, identity scans.
// A file is stored once, named by its SHA-256: the hash shown next to a
// document is the name of the file anybody can download and check.
// - POST /api/files: a signed-in person sends one file (PDF, JPEG or PNG,
//   5 Mo). In cloud mode, Blob receives the bytes directly and the server
//   reads them back before accepting the SHA-256 and detected media type.
// - GET /api/files/<sha256>: public documents for everybody; private ones
//   (identity scans, private receipts or quotes) for the people concerned
//   and the moderators only. Unknown and forbidden answer the same 404.
import './schema.ts'
import { get as getBlob, put as putBlob } from '@vercel/blob'
import { handleUpload } from '@vercel/blob/client'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { sql } from './lib/db.ts'
import { getCookies } from './lib/http.ts'
import { dirname, join } from 'node:path'
import { ENV } from './lib/env.ts'
import { APP_ENV, DATABASE_PATH, DATABASE_URL } from './lib/env.ts'
import { log } from './lib/log.ts'
import { state } from './state.ts'
import { personOf, SESSION_COOKIE } from './session.ts'
import { DomainError } from '../web/lib/domain.ts'
import { isManager } from '../web/lib/rules.ts'
import { seedFiles } from '../web/lib/seed-files.ts'
import type { Db, Doc, FileRef, Person } from '../web/lib/types.ts'

export const MAX_FILE_SIZE = 5 * 1024 * 1024
/** uploads per person and per hour */
export const UPLOADS_PER_HOUR = 60
const validBlobPath = (path: string, sha256: string) =>
  /^[0-9a-f]{64}$/.test(sha256) &&
  new RegExp(`^delos/uploads/[^/]+/${sha256}/[0-9a-f-]{36}$`).test(path)

/** next to the database (the Docker volume), a temporary folder in tests */
export const FILES_DIR = ENV(
  'FILES_DIR',
  DATABASE_URL || DATABASE_PATH === ':memory:' || APP_ENV === 'test'
    ? mkdtempSync(join(tmpdir(), 'delos-files-'))
    : join(dirname(DATABASE_PATH), 'files'),
)
mkdirSync(FILES_DIR, { recursive: true })

/** the files of the demo documents ship with the code (task-seed-files.ts) */
const SEED_DIR = join(process.cwd(), 'server/seed-files')
const seedByHash = new Map(
  Object.entries(seedFiles).map((
    [name, f],
  ) => [f.sha256, { ...f, name }]),
)

/** the type of a file, read from its first bytes */
export const sniff = (bytes: Uint8Array) => {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b)
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'application/pdf' // %PDF-
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return 'image/png'
  }
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg'
  return undefined
}

type FileRow = {
  sha256: string
  type: string
  size: number
  uploadedBy: string
  blobPath: string | null
}

const rowOf = sql<FileRow, { sha256: string }>`
  SELECT sha256, type, size, uploadedBy, blobPath FROM file WHERE sha256 = :sha256
`.get

const uploadsSince =
  sql<{ count: number }, { personId: string; since: number }>`
  SELECT count(*) AS count FROM file
  WHERE uploadedBy = :personId AND uploadedAt > :since
`.get

/** a stored file, or a file of the demo; undefined when unknown */
export const fileInfo = (sha256: string) => {
  if (!/^[0-9a-f]{64}$/.test(sha256)) return undefined
  const row = rowOf({ sha256 })
  if (row) return {
    ...row,
    path: row.blobPath || (DATABASE_URL
      ? `delos/files/${sha256}`
      : join(FILES_DIR, sha256)),
  }
  const seed = seedByHash.get(sha256)
  if (seed) {
    return {
      sha256,
      type: seed.type,
      size: seed.size,
      uploadedBy: '',
      path: join(SEED_DIR, seed.name),
    }
  }
}

/**
 * The file a document points at must have been sent first: its real size
 * and type replace what the browser declared.
 */
export const requireFile = (sha256: string): FileRef => {
  const info = fileInfo(sha256)
  if (!info) {
    throw new DomainError('Fichier non reçu : ajoutez-le de nouveau.')
  }
  return { sha256, size: info.size, type: info.type }
}

/** a document with the size of its stored file */
export const checkedDoc = <T extends { sha256: string; size: number }>(
  doc: T,
): T => ({ ...doc, size: requireFile(doc.sha256).size })

export const storeFile = async (
  bytes: Uint8Array<ArrayBuffer>,
  personId: string,
): Promise<FileRef> => {
  if (!bytes.length || bytes.length > MAX_FILE_SIZE) {
    throw new DomainError('Fichier refusé : 5 Mo maximum.')
  }
  const type = sniff(bytes)
  if (!type) throw new DomainError('Fichier refusé : PDF, JPEG ou PNG.')
  const sent = uploadsSince({ personId, since: Date.now() - 3_600_000 })
  if ((sent?.count ?? 0) >= UPLOADS_PER_HOUR) {
    throw new DomainError(
      'Trop de fichiers envoyés : réessayez dans une heure.',
    )
  }
  const sha256 = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex')
  if (!fileInfo(sha256)) {
    const blobPath = `delos/uploads/${personId}/${sha256}`
    if (DATABASE_URL) {
      await putBlob(blobPath, Buffer.from(bytes), {
        access: 'private',
        allowOverwrite: true,
        contentType: type,
      })
    } else {
      // written under a temporary name, then renamed: never half a file
      const path = join(FILES_DIR, sha256)
      await writeFile(`${path}.part`, bytes)
      await rename(`${path}.part`, path)
    }
    sql`INSERT INTO file (sha256, type, size, uploadedBy, uploadedAt, blobPath)
      VALUES (:sha256, :type, :size, :personId, :at, :blobPath)
      ON CONFLICT (sha256) DO NOTHING`.run({
      sha256,
      type,
      size: bytes.length,
      personId,
      at: Date.now(),
      blobPath: DATABASE_URL ? blobPath : null,
    })
  }
  return { sha256, size: bytes.length, type }
}

/* ---------- who reads what ---------- */

type Reference = {
  name: string
  visibility: Doc['visibility']
  /** besides the moderators, who may read a private document */
  insider: (personId: string) => boolean
}

/** every document of the database that points at this file */
export const referencesOf = (d: Db, sha256: string) => {
  const refs: Reference[] = []
  for (const org of Object.values(d.organizations)) {
    const member = (id: string) => org.members.some((m) => m.personId === id)
    for (const doc of [org.receiptDoc, org.statutesDoc]) {
      if (doc?.sha256 === sha256) {
        refs.push({
          name: doc.name,
          visibility: doc.visibility,
          insider: member,
        })
      }
    }
  }
  for (const e of Object.values(d.expenses)) {
    const fund = d.funds[e.fundId]
    const manager = (id: string) => isManager(d, fund, id)
    for (const doc of [e.quoteDoc, ...e.proofs]) {
      if (doc.sha256 === sha256) {
        refs.push({
          name: doc.name,
          visibility: doc.visibility,
          insider: manager,
        })
      }
    }
  }
  for (const p of Object.values(d.persons)) {
    if (p.request?.file?.sha256 === sha256) {
      refs.push({
        name: p.request.fileName,
        visibility: 'private',
        insider: (id) => id === p.id,
      })
    }
  }
  return refs
}

/** the name to show, or undefined when this viewer may not read the file */
export const readableAs = (
  d: Db,
  viewer: Person | undefined,
  sha256: string,
  uploadedBy: string,
) => {
  const refs = referencesOf(d, sha256)
  const open = refs.find((r) =>
    r.visibility === 'public' ||
    (viewer && (viewer.moderator || r.insider(viewer.id)))
  )
  if (open) return { name: open.name, public: open.visibility === 'public' }
  // an example of the guided demo, shipped with the code: nothing private
  if (!refs.length && !uploadedBy) {
    return { name: seedByHash.get(sha256)?.name ?? sha256, public: true }
  }
  // a file just sent, not in a document yet: only the person who sent it
  if (viewer && uploadedBy === viewer.id) {
    return { name: refs[0]?.name ?? sha256, public: false }
  }
}

/* ---------- HTTP ---------- */

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

const sameOrigin = (req: Request, url: URL) => {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === url.host
  } catch {
    return false
  }
}

const upload = async (req: Request, url: URL) => {
  if (!sameOrigin(req, url)) return json(403, { message: 'Origine refusée.' })
  const viewer = personOf(getCookies(req.headers)[SESSION_COOKIE])
  if (!viewer) return json(401, { message: 'Connexion requise.' })
  const length = Number(req.headers.get('content-length') ?? 0)
  if (length > MAX_FILE_SIZE) {
    await req.body?.cancel()
    return json(413, { message: 'Fichier refusé : 5 Mo maximum.' })
  }
  try {
    const bytes = new Uint8Array(await req.arrayBuffer())
    if (bytes.length > MAX_FILE_SIZE) {
      return json(413, { message: 'Fichier refusé : 5 Mo maximum.' })
    }
    const file = await storeFile(bytes, viewer.id)
    log.info('file-stored', { sha256: file.sha256, size: file.size })
    return json(200, file)
  } catch (err) {
    if (err instanceof DomainError) {
      return json(400, { message: err.message })
    }
    throw err
  }
}

/** Issues a scoped Blob token so 5 Mo files bypass Vercel's 4.5 MB body cap. */
const uploadToken = async (req: Request, url: URL) => {
  if (!DATABASE_URL) {
    return json(404, { message: 'Dépôt direct indisponible.' })
  }
  if (req.headers.has('origin') && !sameOrigin(req, url)) {
    return json(403, { message: 'Origine refusée.' })
  }
  try {
    const body = await req.json()
    const response = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const viewer = personOf(getCookies(req.headers)[SESSION_COOKIE])
        if (!viewer) throw Error('Connexion requise.')
        const sha256 = clientPayload ?? ''
        if (!validBlobPath(pathname, sha256) ||
          !pathname.startsWith(`delos/uploads/${viewer.id}/`)) {
          throw Error('Chemin ou empreinte de fichier invalide.')
        }
        return {
          allowedContentTypes: ['application/pdf', 'image/jpeg', 'image/png'],
          maximumSizeInBytes: MAX_FILE_SIZE,
        }
      },
      // The browser confirms completion in a separate authenticated request,
      // which verifies the actual bytes before recording their hash and type.
      onUploadCompleted: async () => {},
    })
    return Response.json(response, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return json(400, {
      message: error instanceof Error ? error.message : 'Jeton de dépôt refusé.',
    })
  }
}

/** Reads a completed private upload and verifies it before adding DB metadata. */
const completeUpload = async (req: Request, url: URL) => {
  if (!DATABASE_URL) {
    return json(404, { message: 'Dépôt direct indisponible.' })
  }
  if (!sameOrigin(req, url)) return json(403, { message: 'Origine refusée.' })
  const viewer = personOf(getCookies(req.headers)[SESSION_COOKIE])
  if (!viewer) return json(401, { message: 'Connexion requise.' })
  try {
    const body = await req.json() as { sha256?: string; blobPath?: string }
    const sha256 = body.sha256 ?? ''
    const blobPath = body.blobPath ?? ''
    if (!validBlobPath(blobPath, sha256) ||
      !blobPath.startsWith(`delos/uploads/${viewer.id}/`)) {
      return json(400, { message: 'Empreinte de fichier invalide.' })
    }
    const blob = await getBlob(blobPath, { access: 'private' })
    if (!blob || blob.statusCode !== 200) {
      return json(404, { message: 'Fichier non reçu.' })
    }
    const bytes = new Uint8Array(await new Response(blob.stream).arrayBuffer())
    if (!bytes.length || bytes.length > MAX_FILE_SIZE) {
      return json(400, { message: 'Fichier refusé : 5 Mo maximum.' })
    }
    const type = sniff(bytes)
    if (!type) return json(400, { message: 'Fichier refusé : PDF, JPEG ou PNG.' })
    const actualHash = Buffer.from(await crypto.subtle.digest('SHA-256', bytes))
      .toString('hex')
    if (actualHash !== sha256) {
      return json(400, { message: 'Empreinte incorrecte : renvoyez le document.' })
    }
    const sent = uploadsSince({ personId: viewer.id, since: Date.now() - 3_600_000 })
    if ((sent?.count ?? 0) >= UPLOADS_PER_HOUR && !fileInfo(sha256)) {
      return json(429, { message: 'Trop de fichiers envoyés : réessayez dans une heure.' })
    }
    sql`INSERT INTO file (sha256, type, size, uploadedBy, uploadedAt, blobPath)
      VALUES (:sha256, :type, :size, :personId, :at, :blobPath)
      ON CONFLICT (sha256) DO NOTHING`.run({
      sha256,
      type,
      size: bytes.length,
      personId: viewer.id,
      at: Date.now(),
      blobPath,
    })
    return json(200, { sha256, type, size: bytes.length })
  } catch (error) {
    log.error('file-upload-completion-failed', {
      message: error instanceof Error ? error.message : String(error),
    })
    return json(400, { message: 'Validation du fichier impossible.' })
  }
}

const download = async (req: Request, url: URL, sha256: string) => {
  const info = fileInfo(sha256)
  const viewer = personOf(getCookies(req.headers)[SESSION_COOKIE])
  const access = info &&
    readableAs(state.db, viewer, sha256, info.uploadedBy)
  if (!info || !access) {
    return json(404, { message: 'Document introuvable.' })
  }
  const bytes = await (info.path.startsWith('delos/files/')
    ? getBlob(info.path, { access: 'private' }).then(async (blob) =>
      blob?.statusCode === 200
        ? new Uint8Array(await new Response(blob.stream).arrayBuffer())
        : undefined
    )
    : readFile(info.path).then((value) => new Uint8Array(value))
  ).catch(() => undefined)
  if (!bytes) {
    log.error('file-missing', { sha256 })
    return json(404, { message: 'Document introuvable.' })
  }
  const disposition = url.searchParams.has('telecharger')
    ? 'attachment'
    : 'inline'
  return new Response(bytes, {
    headers: {
      'Content-Type': info.type,
      'Content-Length': String(bytes.length),
      'Content-Disposition': `${disposition}; filename*=UTF-8''${
        encodeURIComponent(access.name)
      }`,
      'X-Content-Type-Options': 'nosniff',
      // the content of a hash never changes; a private one is never cached
      'Cache-Control': access.public
        ? 'public, max-age=31536000, immutable'
        : 'private, no-store',
    },
  })
}

/** POST /api/files and GET /api/files/<sha256>, before the router */
export const handleFiles = (req: Request, url: URL) => {
  if (url.pathname === '/api/files/upload-mode' && req.method === 'GET') {
    if (!DATABASE_URL) return json(200, { directBlobUpload: false })
    const viewer = personOf(getCookies(req.headers)[SESSION_COOKIE])
    if (!viewer) return json(401, { message: 'Connexion requise.' })
    return json(200, { directBlobUpload: true, uploadScope: viewer.id })
  }
  if (url.pathname === '/api/files/token' && req.method === 'POST') {
    return uploadToken(req, url)
  }
  if (url.pathname === '/api/files/complete' && req.method === 'POST') {
    return completeUpload(req, url)
  }
  if (url.pathname === '/api/files' && req.method === 'POST') {
    return upload(req, url)
  }
  const match = url.pathname.match(/^\/api\/files\/([0-9a-f]{64})$/)
  if (match && req.method === 'GET') return download(req, url, match[1])
}
