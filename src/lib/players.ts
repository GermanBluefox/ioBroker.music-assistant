/** One entry of the player picker in the settings of the devices widget (`selectSendTo`) */
export interface PlayerOption {
    /** Channel name of the player below `players` */
    value: string;
    /** Name of the player in Music Assistant */
    label: string;
}

/**
 * The players of an instance for the `getPlayers` message, sorted by name. Only the player channels
 * directly below `players` count - a channel below a player (as `control` up to 0.0.2) is skipped.
 *
 * @param channels the channel objects below `<namespace>.players.`
 * @param prefix `<namespace>.players.`
 * @param lang language for a translated name
 */
export function playerOptions(
    channels: Record<string, ioBroker.Object | null | undefined>,
    prefix: string,
    lang: ioBroker.Languages = 'en',
): PlayerOption[] {
    const options: PlayerOption[] = [];
    for (const [id, obj] of Object.entries(channels)) {
        if (!id.startsWith(prefix)) {
            continue;
        }
        const value = id.substring(prefix.length);
        if (!value || value.includes('.')) {
            continue;
        }
        const name = obj?.common?.name;
        const label = typeof name === 'string' ? name : name?.[lang] || name?.en || '';
        options.push({ value, label: label || value });
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
}
