import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildGalleryLinkDigest } from './galleryLinkDigest.js';

const origin = 'https://notee.vip';

describe('buildGalleryLinkDigest', () => {
  it('lists saved galleries with an English occupancy and a blank line between them', () => {
    const text = buildGalleryLinkDigest(
      [
        {
          room: 'TW A206',
          galleryShareToken: 'aaa',
          photos: [{ id: 'p1' }],
          galleryListing: { occupancy: 'rented' }
        },
        {
          room: 'CV 417',
          galleryShareToken: 'bbb',
          photos: [{ id: 'p2' }],
          galleryListing: { occupancy: 'vacant' }
        }
      ],
      origin
    );
    assert.equal(
      text,
      [
        'https://notee.vip/06-rental-tracking/gallery/aaa',
        'TW A206 -- Rented',
        '',
        'https://notee.vip/06-rental-tracking/gallery/bbb',
        'CV 417 -- Vacant'
      ].join('\n')
    );
  });

  it('skips rooms without a link or without photos, and does not invent a status', () => {
    const text = buildGalleryLinkDigest(
      [
        { room: 'NO PHOTO', galleryShareToken: 'ccc', photos: [], galleryListing: { occupancy: 'rented' } },
        { room: 'NO LINK', galleryShareToken: '', photos: [{ id: 'p3' }], galleryListing: { occupancy: 'vacant' } },
        { room: 'SP 1', galleryShareToken: 'ddd', photos: [{ id: 'p4' }], galleryListing: { occupancy: '' } }
      ],
      origin
    );
    assert.equal(text, 'https://notee.vip/06-rental-tracking/gallery/ddd\nSP 1');
  });
});