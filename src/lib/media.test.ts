import { expect } from 'chai';

import { imageUrl, libraryCommand, listType, normalizeBaseUrl, parseMediaRequest, toMediaEntry } from './media';

const BASE = 'http://192.168.1.10:8095';

describe('parseMediaRequest', () => {
    it('takes a list with limits in range', () => {
        expect(parseMediaRequest({ list: 'playlists' })).to.deep.equal({ list: 'playlists', limit: 100, offset: 0 });
        expect(parseMediaRequest({ list: 'radios', search: ' swr ', limit: 9999, offset: -5 })).to.deep.equal({
            list: 'radios',
            search: 'swr',
            limit: 500,
            offset: 0,
        });
    });

    it('takes every media type of the library', () => {
        for (const list of ['favorites', 'artists', 'albums', 'tracks', 'podcasts', 'audiobooks']) {
            expect(parseMediaRequest({ list })).to.have.property('list', list);
        }
    });

    it('refuses an unknown list', () => {
        expect(parseMediaRequest({ list: 'genres' })).to.be.a('string');
        expect(parseMediaRequest(null)).to.be.a('string');
    });
});

describe('libraryCommand', () => {
    it('names the command of a media type, the favorites have none', () => {
        expect(listType('favorites')).to.equal(undefined);
        expect(libraryCommand(listType('audiobooks')!)).to.equal('music/audiobooks/library_items');
        expect(libraryCommand('radio')).to.equal('music/radios/library_items');
        expect(libraryCommand('playlist')).to.equal('music/playlists/library_items');
    });
});

describe('imageUrl', () => {
    it('prefers the image proxy of the server', () => {
        expect(imageUrl({ path: 'https://x/a.jpg', remotely_accessible: true, proxy_id: 'ab12' }, BASE)).to.equal(
            `${BASE}/imageproxy/ab12?size=160`,
        );
    });

    it('takes a remote image as it is without a proxy id', () => {
        expect(imageUrl({ path: 'https://x/a.jpg', remotely_accessible: true }, BASE)).to.equal('https://x/a.jpg');
    });

    it('builds the old proxy form for a local image of an older server', () => {
        expect(imageUrl({ path: '/media/a b.jpg', provider: 'filesystem', remotely_accessible: false }, BASE)).to.equal(
            `${BASE}/imageproxy?path=%252Fmedia%252Fa%2520b.jpg&provider=filesystem&size=160`,
        );
    });

    it('gives nothing without an image', () => {
        expect(imageUrl(null, BASE)).to.equal('');
        expect(imageUrl({ path: '/local.jpg', provider: 'x' }, '')).to.equal('');
    });
});

describe('toMediaEntry', () => {
    it('takes name, URI, artists and the thumbnail', () => {
        expect(
            toMediaEntry(
                {
                    uri: 'library://album/7',
                    name: 'A Night at the Opera',
                    media_type: 'album',
                    artists: [{ name: 'Queen' }],
                    metadata: { images: [{ type: 'thumb', path: 'p', proxy_id: 'id7' }] },
                },
                BASE,
            ),
        ).to.deep.equal({
            uri: 'library://album/7',
            name: 'A Night at the Opera',
            subtitle: 'Queen',
            image: `${BASE}/imageproxy/id7?size=160`,
            type: 'album',
        });
    });

    it('adds the album to the artists of a track', () => {
        expect(
            toMediaEntry(
                {
                    uri: 'library://track/9',
                    name: 'Bohemian Rhapsody',
                    media_type: 'track',
                    artists: [{ name: 'Queen' }],
                    album: { name: 'A Night at the Opera' },
                },
                BASE,
            )?.subtitle,
        ).to.equal('Queen · A Night at the Opera');
    });

    it('takes the owner of a playlist and skips an item without URI', () => {
        expect(toMediaEntry({ uri: 'library://playlist/1', name: 'Party', owner: 'Me' }, BASE)?.subtitle).to.equal(
            'Me',
        );
        expect(toMediaEntry({ name: 'No URI' }, BASE)).to.equal(null);
    });
});

describe('normalizeBaseUrl', () => {
    it('takes base_url of the server without a trailing slash, else the fallback', () => {
        expect(normalizeBaseUrl('http://ma.local:8095/', 'http://127.0.0.1:8095')).to.equal('http://ma.local:8095');
        expect(normalizeBaseUrl('', 'http://127.0.0.1:8095')).to.equal('http://127.0.0.1:8095');
        expect(normalizeBaseUrl(undefined, 'http://10.0.0.2:8095')).to.equal('http://10.0.0.2:8095');
    });
});
