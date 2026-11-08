import { expect } from 'chai';

import { SafeIdRegistry, sanitizeId } from './ids';

describe('sanitizeId', () => {
    it('keeps letters, digits, underscore and dash', () => {
        expect(sanitizeId('LGcCUQla-Ao_Iv9')).to.equal('LGcCUQla-Ao_Iv9');
    });

    it('replaces everything else with an underscore', () => {
        expect(sanitizeId('up2a1b:c.d e')).to.equal('up2a1b_c_d_e');
    });
});

describe('SafeIdRegistry', () => {
    it('uses the sanitized id as it is', () => {
        const ids = new SafeIdRegistry();
        expect(ids.get('LGcCUQla-Ao')).to.equal('LGcCUQla-Ao');
        expect(ids.get('aa:bb')).to.equal('aa_bb');
    });

    it('returns the same id for the same raw id', () => {
        const ids = new SafeIdRegistry();
        const first = ids.get('Player.1');
        ids.get('player_1');
        expect(ids.get('Player.1')).to.equal(first);
    });

    it('separates ids that differ only in their case', () => {
        const ids = new SafeIdRegistry();
        const a = ids.get('AbC');
        const b = ids.get('abc');
        expect(a).to.equal('AbC');
        expect(b).to.not.equal(a);
        expect(b.toLowerCase()).to.not.equal(a.toLowerCase());
        expect(ids.get('abc')).to.equal(b);
    });

    it('separates ids that only differ in replaced characters', () => {
        const ids = new SafeIdRegistry();
        const a = ids.get('aa:bb');
        const b = ids.get('aa.bb');
        expect(a).to.equal('aa_bb');
        expect(b).to.match(/^aa_bb_[0-9a-f]{8}$/);
    });

    it('gives a player and its queue the same id', () => {
        const ids = new SafeIdRegistry();
        ids.get('AbC');
        const player = ids.get('abc');
        const queue = ids.get('abc');
        expect(queue).to.equal(player);
    });

    it('frees the id of a released raw id', () => {
        const ids = new SafeIdRegistry();
        ids.get('AbC');
        ids.release('AbC');
        expect(ids.get('abc')).to.equal('abc');
    });
});
