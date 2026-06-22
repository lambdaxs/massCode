import { Buffer } from 'node:buffer'
import { createPublicKey, verify } from 'node:crypto'
import { store } from '../store'

// Ed25519 公钥（SPKI DER，base64）。配对私钥仅维护者持有，供脚本使用 scripts/license/issue.js.
const LICENSE_PUBLIC_KEY
  = 'MCowBQYDK2VwAyEA50TFZklSS8Q64UeasAngOrgKnQe2COfVkqiuS9YPIdo='

const publicKey = createPublicKey({
  key: Buffer.from(LICENSE_PUBLIC_KEY, 'base64'),
  format: 'der',
  type: 'spki',
})

export interface LicensePayload {
  email: string
  name?: string
  issuedAt?: string
}

export interface LicenseStatus {
  active: boolean
  name: string | null
  email: string | null
}

export function verifyLicenseKey(key: string): LicensePayload | null {
  try {
    const [payloadBase64, signatureBase64] = key.trim().split('.')

    if (!payloadBase64 || !signatureBase64) {
      return null
    }

    const isValid = verify(
      null,
      Buffer.from(payloadBase64),
      publicKey,
      Buffer.from(signatureBase64, 'base64url'),
    )

    if (!isValid) {
      return null
    }

    const payload = JSON.parse(
      Buffer.from(payloadBase64, 'base64url').toString('utf8'),
    )

    if (typeof payload?.email !== 'string') {
      return null
    }

    return payload as LicensePayload
  }
  catch {
    return null
  }
}

export function activateLicense(key: string): LicenseStatus {
  const payload = verifyLicenseKey(key)

  if (!payload) {
    return { active: false, name: null, email: null }
  }

  const name = payload.name ?? null

  store.app.set('license', {
    key: key.trim(),
    name,
    email: payload.email,
  })

  return { active: true, name, email: payload.email }
}

// 防止手动篡改 store 文件：无效 key 会被重置.
export function validateStoredLicense() {
  const key = store.app.get('license.key')

  if (typeof key === 'string' && key && !verifyLicenseKey(key)) {
    store.app.set('license', { key: null, name: null, email: null })
  }
}
