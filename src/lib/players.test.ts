import { expect } from 'chai';

import { playerOptions } from './players';

function channel(name: ioBroker.StringOrTranslated): ioBroker.Object {
    return { _id: '', type: 'channel', common: { name }, native: {} };
}

describe('playerOptions', () => {
    const prefix = 'music-assistant.0.players.';

    it('lists the player channels sorted by name', () => {
        const options = playerOptions(
            {
                [`${prefix}kitchen`]: channel('Kitchen'),
                [`${prefix}bath`]: channel('Bathroom'),
                [`${prefix}living_room`]: channel('Living room'),
            },
            prefix,
        );
        expect(options).to.deep.equal([
            { value: 'bath', label: 'Bathroom' },
            { value: 'kitchen', label: 'Kitchen' },
            { value: 'living_room', label: 'Living room' },
        ]);
    });

    it('skips channels below a player and outside the prefix', () => {
        const options = playerOptions(
            {
                [`${prefix}kitchen`]: channel('Kitchen'),
                [`${prefix}kitchen.control`]: channel('Control'),
                'music-assistant.0.queues.kitchen': channel('Queue'),
            },
            prefix,
        );
        expect(options).to.deep.equal([{ value: 'kitchen', label: 'Kitchen' }]);
    });

    it('takes a translated name in the language and falls back to the ID', () => {
        const options = playerOptions(
            {
                [`${prefix}a`]: channel({ en: 'Garden', de: 'Garten' }),
                [`${prefix}b`]: channel(''),
            },
            prefix,
            'de',
        );
        expect(options).to.deep.equal([
            { value: 'b', label: 'b' },
            { value: 'a', label: 'Garten' },
        ]);
    });
});
