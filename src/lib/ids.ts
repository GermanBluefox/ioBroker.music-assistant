/*
 * Object ids of players and queues, derived from the ids Music Assistant uses.
 */
import { createHash } from 'node:crypto';

/**
 * ioBroker object ids may only contain a limited character set.
 *
 * @param id the raw id from Music Assistant
 */
export function sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Hands out the ids of the channels below `players` and `queues`.
 *
 * The sanitized id of a raw id is used as it is, so existing installations keep their objects. Only if
 * another raw id already took the same id - ignoring the case, because ioBroker ids must be unique
 * case-insensitively - the later one gets a short hash of its raw id appended.
 * The registry is shared by players and queues: the queue of a player has the raw id of the player and
 * must end up with the same id.
 */
export class SafeIdRegistry {
    /** lower-case sanitized id -> raw id that owns it */
    private readonly owners = new Map<string, string>();

    /**
     * The id of the channel of a player or queue
     *
     * @param rawId the id Music Assistant uses
     * @returns the same id for the same raw id, and a different one for every other raw id
     */
    public get(rawId: string): string {
        const base = sanitizeId(rawId);
        const owner = this.owners.get(base.toLowerCase());
        if (owner === undefined) {
            this.owners.set(base.toLowerCase(), rawId);
            return base;
        }
        if (owner === rawId) {
            return base;
        }
        const suffixed = `${base}_${createHash('sha1').update(rawId).digest('hex').substring(0, 8)}`;
        if (!this.owners.has(suffixed.toLowerCase())) {
            this.owners.set(suffixed.toLowerCase(), rawId);
        }
        return suffixed;
    }

    /**
     * Forgets a raw id, e.g. after its player was deleted, so that its id can be used by another one
     *
     * @param rawId the id Music Assistant used
     */
    public release(rawId: string): void {
        for (const [key, owner] of this.owners) {
            if (owner === rawId) {
                this.owners.delete(key);
            }
        }
    }
}
