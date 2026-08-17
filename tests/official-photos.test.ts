import test from 'node:test'
import assert from 'node:assert/strict'
import {
  officialEmailLocalPart,
  officialPhotoDisplayUrl,
  officialPhotoCatalogFingerprint,
  replaceOfficialPhotoCache,
  applyOfficialPhotoCatalog,
  getOfficialPhotoUrlByEmail,
  getOfficialPhotoById,
  resolveOfficialAvatarUrl,
  resolveOfficialAvatarForIdentity,
  type OfficialPhoto,
} from '../src/lib/officialPhotosCore.ts'

function photo(partial: Partial<OfficialPhoto> & Pick<OfficialPhoto, 'userId' | 'name'>): OfficialPhoto {
  return {
    externalUserId: null,
    email: null,
    photoUrl: null,
    source: 'selected',
    version: 'v1',
    updatedAt: '2026-08-17T00:00:00.000Z',
    ...partial,
  }
}

test('ignora foto oficial sem URL ou source none', () => {
  assert.equal(officialPhotoDisplayUrl(photo({ userId: '1', name: 'A', source: 'none' })), null)
  assert.equal(officialPhotoDisplayUrl(photo({ userId: '1', name: 'A', photoUrl: '  ' })), null)
})

test('resolve avatar oficial por e-mail e local-part', () => {
  replaceOfficialPhotoCache([
    photo({
      userId: 'u1',
      name: 'Gustavo',
      email: 'gustavo@bpplaw.com.br',
      photoUrl: 'https://cdn.example/gustavo.jpg',
    }),
  ])

  assert.equal(officialEmailLocalPart('Gustavo@bismarchipires.com.br'), 'gustavo')
  assert.equal(getOfficialPhotoUrlByEmail('gustavo@bismarchipires.com.br'), 'https://cdn.example/gustavo.jpg')
  assert.equal(resolveOfficialAvatarUrl('desconhecido@bp.com', '/team/x.jpg'), '/team/x.jpg')
})

test('alias de e-mail SIOE resolve foto indexada só por ID', () => {
  replaceOfficialPhotoCache(
    [
      photo({
        userId: 'u2',
        externalUserId: 'colab-1',
        name: 'Ana',
        email: 'ana@orquestrai.local',
        photoUrl: 'https://cdn.example/ana.jpg',
      }),
    ],
    { persist: false, aliases: [{ externalUserId: 'colab-1', email: 'ana@bpplaw.com.br' }] },
  )

  assert.equal(getOfficialPhotoById('colab-1')?.photoUrl, 'https://cdn.example/ana.jpg')
  assert.equal(getOfficialPhotoUrlByEmail('ana@bismarchipires.com.br'), 'https://cdn.example/ana.jpg')
  assert.equal(
    resolveOfficialAvatarForIdentity({
      email: 'ana@bpplaw.com.br',
      colaboradorId: 'colab-1',
      fallback: '/local.jpg',
    }),
    'https://cdn.example/ana.jpg',
  )
})

test('catálogo só atualiza quando version/updatedAt/URL mudam', () => {
  const first = photo({
    userId: 'u3',
    externalUserId: 'colab-2',
    name: 'Bia',
    email: 'bia@bpplaw.com.br',
    photoUrl: 'https://cdn.example/bia.jpg',
    version: 'v1',
    updatedAt: '2026-08-17T10:00:00.000Z',
  })
  replaceOfficialPhotoCache([first], { persist: false })
  assert.equal(applyOfficialPhotoCatalog([first]), false)

  const next = { ...first, version: 'v2', updatedAt: '2026-08-17T12:00:00.000Z' }
  assert.equal(applyOfficialPhotoCatalog([next]), true)
  assert.equal(getOfficialPhotoUrlByEmail('bia@bpplaw.com.br'), 'https://cdn.example/bia.jpg')
  assert.notEqual(
    officialPhotoCatalogFingerprint([first]),
    officialPhotoCatalogFingerprint([next]),
  )
})
