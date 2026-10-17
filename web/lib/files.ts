// Documents sent to the server (api/files.ts): a file is named by its
// SHA-256, computed in the browser first and checked again by the server.
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
