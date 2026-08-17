import test from 'node:test'
import assert from 'node:assert/strict'
import {
  officialEmailLocalPart,
  officialPhotoDisplayUrl,
  replaceOfficialPhotoCache,
  getOfficialPhotoUrlByEmail,
  resolveOfficialAvatarUrl,
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
