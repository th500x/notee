import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  albumNameFromPhotos,
  appendUploadedPhotos,
  beginNewGalleryAlbum,
  normalizeStoredGalleryAlbums,
  resolveGalleryAlbums,
  uniqueAlbumName
} from './galleryAlbums.js';

function photo(partial) {
  return {
    id: partial.id,
    url: 'https://example.com/a.jpg',
    name: partial.name || '',
    uploadedAt: partial.uploadedAt || '',
    capturedAt: partial.capturedAt || '',
    albumId: partial.albumId || ''
  };
}

describe('albumNameFromPhotos', () => {
  it('uses the latest capture day and ignores undated uploads', () => {
    const name = albumNameFromPhotos(
      [
        photo({ id: 'a', name: 'IMG_20251107_120000.jpg', uploadedAt: '2026-11-23T02:00:00' }),
        photo({ id: 'b', name: 'IMG_20261116_162700.jpg', uploadedAt: '2026-11-23T02:00:00' }),
        photo({ id: 'c', name: '1000008139.jpg', uploadedAt: '2026-11-23T02:00:00' })
      ],
      []
    );
    assert.equal(name, '20261116');
  });

  it('uses the latest upload day only when no photo has a capture date', () => {
    const name = albumNameFromPhotos(
      [
        photo({ id: 'a', name: 'scan.jpg', uploadedAt: '2026-11-01T08:00:00' }),
        photo({ id: 'b', name: 'note.jpg', uploadedAt: '2026-11-23T18:30:00' })
      ],
      []
    );
    assert.equal(name, '20261123');
  });

  it('adds -2 when the day is already used', () => {
    assert.equal(uniqueAlbumName('20261116', ['20261116']), '20261116-2');
    assert.equal(uniqueAlbumName('20261116', ['20261116', '20261116-2']), '20261116-3');
  });
});

describe('beginNewGalleryAlbum', () => {
  it('names the current batch and opens an empty draft', () => {
    const photos = [
      photo({ id: 'p1', name: 'IMG_20261116_162700.jpg', uploadedAt: '2026-11-16T10:00:00' })
    ];
    const created = beginNewGalleryAlbum([], photos, '');
    assert.equal(created.error, undefined);
    assert.equal(created.albums.length, 2);
    assert.equal(created.albums[0].name, '20261116');
    assert.equal(created.albums[1].name, '');
    assert.equal(created.photos[0].albumId, created.albums[0].id);
    assert.equal(created.activeAlbumId, created.albums[1].id);

    const view = resolveGalleryAlbums(created.albums, created.photos);
    assert.equal(view.multi, true);
    assert.equal(view.albums[1].draft, true);
    assert.equal(view.albums[1].photos.length, 0);
  });

  it('does not keep a second empty draft', () => {
    const photos = [photo({ id: 'p1', name: 'IMG_20261116_162700.jpg' })];
    const created = beginNewGalleryAlbum([], photos, '');
    const again = beginNewGalleryAlbum(created.albums, created.photos, created.albums[0].id);
    assert.equal(again.created, false);
    assert.equal(again.activeAlbumId, created.albums[1].id);
    assert.equal(again.albums.length, 2);
  });
});

describe('appendUploadedPhotos', () => {
  it('names a new album once and does not rename it on the next upload', () => {
    const draftId = 'alb-0123456789abcdef';
    const first = appendUploadedPhotos(
      [
        { id: 'alb-aaaaaaaaaaaaaaaa', name: '20251107' },
        { id: draftId, name: '' }
      ],
      [],
      draftId,
      [photo({ id: 'n1', name: 'IMG_20261116_100000.jpg', uploadedAt: '2026-11-20T10:00:00' })]
    );
    assert.equal(first.name, '20261116');
    assert.equal(first.photos[0].albumId, draftId);

    const second = appendUploadedPhotos(first.albums, first.photos, draftId, [
      photo({ id: 'n2', name: 'IMG_20261201_100000.jpg', uploadedAt: '2026-12-01T10:00:00' })
    ]);
    assert.equal(second.name, '20261116');
    assert.equal(second.albums.find((album) => album.id === draftId).name, '20261116');
  });

  it('uses -2 for a second album shot on the same day', () => {
    const draftId = 'alb-0123456789abcdef';
    const named = appendUploadedPhotos(
      [
        { id: 'alb-aaaaaaaaaaaaaaaa', name: '20261116' },
        { id: draftId, name: '' }
      ],
      [photo({ id: 'old', albumId: 'alb-aaaaaaaaaaaaaaaa', name: 'IMG_20261116_090000.jpg' })],
      draftId,
      [photo({ id: 'n1', name: 'IMG_20261116_180000.jpg' })]
    );
    assert.equal(named.name, '20261116-2');
  });
});

describe('resolveGalleryAlbums', () => {
  it('keeps a single saved batch looking like today', () => {
    const view = resolveGalleryAlbums(
      [],
      [photo({ id: 'p1', name: 'IMG_20261116_162700.jpg' })]
    );
    assert.equal(view.multi, false);
    assert.equal(view.albums.length, 1);
    assert.equal(view.albums[0].photos.length, 1);
  });

  it('hides the name when only one named album remains', () => {
    const view = resolveGalleryAlbums(
      [{ id: 'alb-aaaaaaaaaaaaaaaa', name: '20261116' }],
      [photo({ id: 'p1', albumId: 'alb-aaaaaaaaaaaaaaaa', name: 'IMG_20261116_162700.jpg' })]
    );
    assert.equal(view.multi, false);
    assert.equal(view.albums[0].photos.length, 1);
  });

  it('drops an empty draft when storing', () => {
    const stored = normalizeStoredGalleryAlbums(
      [
        { id: 'alb-aaaaaaaaaaaaaaaa', name: '20261116' },
        { id: 'alb-bbbbbbbbbbbbbbbb', name: '' }
      ],
      [photo({ id: 'p1', albumId: 'alb-aaaaaaaaaaaaaaaa' })]
    );
    assert.deepEqual(stored, [{ id: 'alb-aaaaaaaaaaaaaaaa', name: '20261116' }]);
  });
});
