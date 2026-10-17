// Documents sent to the server and private Blob storage (server/files.ts):
// the browser computes the SHA-256 first; the server checks it against bytes.
import { upload as uploadBlob } from '@vercel/blob/client'
import type { FileRef } from '../lib/types.ts'
import { online } from '../lib/network.ts'

/** the address of a stored document; `download` asks for a file to save */
export const fileUrl = (sha256: string, download = false) =>
  new URL(
    `api/files/${sha256}${download ? '?telecharger' : ''}`,
    document.baseURI,
  ).href

/** POST /api/files: the bytes as they are, the server reads their type */
export const uploadFile = async (file: Blob, sha256: string) => {
  if (!online.peek()) {
    throw Error('Connexion requise pour envoyer un document.')
  }
  const modeUrl = new URL('api/files/upload-mode', document.baseURI)
  const modeResponse = await fetch(modeUrl, { credentials: 'same-origin' })
    .catch(() => {
      throw Error('Envoi impossible : vérifiez votre connexion.')
    })
  const modeBody = await modeResponse.json().catch(() => ({})) as {
    directBlobUpload?: boolean
    uploadScope?: string
    message?: string
  }
  if (!modeResponse.ok) {
    throw Error(modeBody.message ?? 'Envoi du document impossible.')
  }
  if (modeBody.directBlobUpload) {
    if (!modeBody.uploadScope) throw Error('Session de dépôt invalide.')
    const blobPath = `delos/uploads/${modeBody.uploadScope}/${sha256}/${crypto.randomUUID()}`
    await uploadBlob(blobPath, file, {
      access: 'private',
      handleUploadUrl: new URL('api/files/token', document.baseURI).href,
      clientPayload: sha256,
    })
    const complete = await fetch(
      new URL('api/files/complete', document.baseURI),
      {
        method: 'POST',
        body: JSON.stringify({ sha256, blobPath }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      },
    ).catch(() => {
      throw Error('Envoi impossible : vérifiez votre connexion.')
    })
    const body = await complete.json().catch(() => ({})) as
      & Partial<FileRef>
      & { message?: string }
    if (!complete.ok) {
      throw Error(body.message ?? 'Validation du document impossible.')
    }
    if (body.sha256 !== sha256) {
      throw Error('Le document a été modifié pendant l’envoi : réessayez.')
    }
    return body as FileRef
  }
  const res = await fetch(new URL('api/files', document.baseURI), {
    method: 'POST',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    credentials: 'same-origin',
  }).catch(() => {
    throw Error('Envoi impossible : vérifiez votre connexion.')
  })
  const body = await res.json().catch(() => ({})) as
    & Partial<FileRef>
    & { message?: string }
  if (!res.ok) throw Error(body.message ?? 'Envoi du document impossible.')
  // the hash shown to the user is the one the server stored
  if (body.sha256 !== sha256) {
    throw Error('Le document a été modifié pendant l’envoi : réessayez.')
  }
  return body as FileRef
}
