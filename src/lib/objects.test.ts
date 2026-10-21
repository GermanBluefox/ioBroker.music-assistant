import { expect } from 'chai';
import ChannelDetector, { type DetectOptions } from '@iobroker/type-detector';

import { defaultValue, parsePlayMedia, pickSearchResult, PLAYER_BUTTONS, PLAYER_STATES } from './objects';
import type { SearchResults } from './ma-types';

const NS = 'music-assistant.0';

/**
 * The objects the adapter creates for one player, as they end up in the object database
 *
 * @param safeId sanitized id of the player
 */
function playerObjects(safeId: string): Record<string, ioBroker.Object> {
    const base = `${NS}.players.${safeId}`;
    const objects: Record<string, ioBroker.Object> = {
        [`${NS}.players`]: { _id: `${NS}.players`, type: 'folder', common: { name: 'Players' }, native: {} },
        [base]: { _id: base, type: 'channel', common: { name: 'Kitchen', role: 'media.music' }, native: {} },
    };
    for (const [key, common] of Object.entries(PLAYER_STATES)) {
        objects[`${base}.${key}`] = {
            _id: `${base}.${key}`,
            type: 'state',
            common: { ...common, def: defaultValue(common) },
            native: {},
        };
    }
    for (const [key, btn] of Object.entries(PLAYER_BUTTONS)) {
        objects[`${base}.${key}`] = {
            _id: `${base}.${key}`,
            type: 'state',
            common: { name: btn.name, type: 'boolean', role: btn.role, read: false, write: true, def: false },
            native: {},
        };
    }
    return objects;
}

describe('player objects', () => {
    it('are detected as a media player by the type-detector', () => {
        const objects = playerObjects('kitchen');
        const options: DetectOptions = {
            objects,
            id: `${NS}.players.kitchen`,
            _keysOptional: Object.keys(objects),
            _usedIdsOptional: [],
        };
        const controls = new ChannelDetector().detect(options);
        expect(controls, 'nothing detected').to.be.an('array').that.is.not.empty;
        const media = controls!.find(c => String(c.type) === 'media');
        expect(media, `detected: ${controls!.map(c => c.type).join(', ')}`).to.not.equal(undefined);

        const found: Record<string, string> = {};
        for (const state of media!.states) {
            if (state.id) {
                found[state.name] = state.id.substring(`${NS}.players.kitchen.`.length);
            }
        }
        expect(found).to.include({
            STATE: 'state',
            PLAY: 'play',
            PAUSE: 'pause',
            STOP: 'stop',
            NEXT: 'next',
            PREV: 'previous',
            VOLUME: 'volume',
            MUTE: 'muted',
            SHUFFLE: 'shuffle',
            REPEAT: 'repeat',
            TITLE: 'mediaTitle',
            ARTIST: 'mediaArtist',
            ALBUM: 'mediaAlbum',
            COVER: 'mediaImage',
            DURATION: 'duration',
            ELAPSED: 'elapsedTime',
            SEEK: 'seek',
        });
    });

    it('do not give playPause a role the type-detector takes for PLAY', () => {
        expect(PLAYER_BUTTONS.playPause.role).to.not.match(/^(button|action)\.play/);
    });
});

describe('parsePlayMedia', () => {
    it('takes a value with :// as URI', () => {
        expect(parsePlayMedia(' spotify://playlist/37i9dQ ')).to.deep.equal({ uri: 'spotify://playlist/37i9dQ' });
        expect(parsePlayMedia('http://radio.example/stream.mp3')).to.deep.equal({
            uri: 'http://radio.example/stream.mp3',
        });
    });

    it('takes anything else as search text, with an optional media type prefix', () => {
        expect(parsePlayMedia('Bohemian Rhapsody')).to.deep.equal({ query: 'Bohemian Rhapsody' });
        expect(parsePlayMedia('Artist: Queen')).to.deep.equal({ query: 'Queen', mediaType: 'artist' });
        // an unknown prefix is part of the search text
        expect(parsePlayMedia('Live: Tonight')).to.deep.equal({ query: 'Live: Tonight' });
    });

    it('ignores an empty value', () => {
        expect(parsePlayMedia('   ')).to.equal(undefined);
    });
});

describe('pickSearchResult', () => {
    const item = (name: string, uri: string): { item_id: string; name: string; uri: string; media_type: string } => ({
        item_id: uri,
        name,
        uri,
        media_type: uri.split('://')[1].split('/')[0],
    });
    const results: SearchResults = {
        tracks: [item('Killer Queen', 'lib://track/1'), item('Queen', 'lib://track/2')],
        artists: [item('Queen', 'lib://artist/1')],
        albums: [item('Queen II', 'lib://album/1')],
    };

    it('prefers an exact name match, an artist before a track', () => {
        expect(pickSearchResult(results, 'queen')).to.equal('lib://artist/1');
    });

    it('takes the best track when nothing matches exactly', () => {
        expect(pickSearchResult(results, 'kill')).to.equal('lib://track/1');
    });

    it('stays within the media type of the prefix', () => {
        expect(pickSearchResult(results, 'Queen', 'track')).to.equal('lib://track/2');
        expect(pickSearchResult(results, 'something', 'album')).to.equal('lib://album/1');
        expect(pickSearchResult(results, 'Queen', 'playlist')).to.equal(undefined);
    });

    it('returns undefined for empty results', () => {
        expect(pickSearchResult({}, 'Queen')).to.equal(undefined);
    });
});
