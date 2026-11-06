/*
 * The library of Music Assistant for the players of the UIs: favorites, playlists and radio stations, as the
 * message `getMedia` lists them. A UI plays an entry by writing its URI into `players.<id>.playMedia`.
 */

/** An image of a media item, as Music Assistant serializes it */
export interface MaImage {
    type?: string;
    path?: string;
    provider?: string;
    remotely_accessible?: boolean;
    /** Opaque id of the image proxy of the server, set by current servers */
    proxy_id?: string | null;
}

/** The part of a media item (or summary item) of the library that a list shows */
export interface MaLibraryItem {
    item_id?: string | number;
    name?: string;
    uri?: string;
    media_type?: string;
    image?: MaImage | null;
    metadata?: { images?: MaImage[] | null } | null;
    artists?: { name?: string }[] | null;
    owner?: string | null;
    publisher?: string | null;
    authors?: string[] | null;
}

/** One entry of the list `getMedia` answers with */
export interface MediaEntry {
    /** Written into `players.<id>.playMedia` to play it */
    uri: string;
    name: string;
    /** Artists, owner of a playlist, publisher of a podcast - or empty */
    subtitle: string;
    /** URL of a thumbnail, or empty */
    image: string;
    /** `track`, `album`, `artist`, `playlist`, `radio`, `podcast`, `audiobook` */
    type: string;
}

/** The lists a UI can ask for */
export type MediaList = 'favorites' | 'playlists' | 'radios';

/** What the message `getMedia` takes */
export interface MediaRequest {
    list: MediaList;
    /** Only entries whose name contains it */
    search?: string;
    limit: number;
    offset: number;
}

/** The API base of the library per media type: `music/<base>/library_items` */
const LIBRARY_BASE: Record<string, string> = {
    playlist: 'playlists',
    radio: 'radios',
    album: 'albums',
    artist: 'artists',
    track: 'tracks',
    podcast: 'podcasts',
    audiobook: 'audiobooks',
};

/** The media types of the favorites, in the order they are listed */
export const FAVORITE_TYPES = ['playlist', 'radio', 'album', 'artist', 'track', 'podcast', 'audiobook'];

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
/** Size of the thumbnails: one of the sizes the image proxy of Music Assistant takes */
const THUMB_SIZE = 160;

/**
 * The command that lists the library items of a media type
 *
 * @param type a media type of {@link FAVORITE_TYPES}
 */
export function libraryCommand(type: string): string {
    return `music/${LIBRARY_BASE[type] || `${type}s`}/library_items`;
}

/**
 * Checks what a UI sent with `getMedia`
 *
 * @param message the message
 * @returns the request, or a text why it is not one
 */
export function parseMediaRequest(message: unknown): MediaRequest | string {
    const msg = (message && typeof message === 'object' ? message : {}) as Record<string, unknown>;
    const list = msg.list;
    if (list !== 'favorites' && list !== 'playlists' && list !== 'radios') {
        return `Unknown list "${String(list)}", use "favorites", "playlists" or "radios"`;
    }
    const search = typeof msg.search === 'string' ? msg.search.trim() : '';
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.round(Number(msg.limit) || DEFAULT_LIMIT)));
    const offset = Math.max(0, Math.round(Number(msg.offset) || 0));
    return { list, limit, offset, ...(search ? { search } : {}) };
}

/**
 * The URL of a thumbnail of an image. The image proxy of the server resizes it; an image without a proxy id
 * (an older server) is taken as it is, if the browser can load it.
 *
 * @param image the image of the item
 * @param baseUrl the address of the server as it reports it (`base_url`), without a trailing slash
 */
export function imageUrl(image: MaImage | null | undefined, baseUrl: string): string {
    if (!image?.path && !image?.proxy_id) {
        return '';
    }
    if (image.proxy_id && baseUrl) {
        return `${baseUrl}/imageproxy/${encodeURIComponent(image.proxy_id)}?size=${THUMB_SIZE}`;
    }
    if (image.remotely_accessible && image.path) {
        return image.path;
    }
    if (baseUrl && image.path && image.provider) {
        // the form of older servers: the path encoded twice
        const path = encodeURIComponent(encodeURIComponent(image.path));
        return `${baseUrl}/imageproxy?path=${path}&provider=${encodeURIComponent(image.provider)}&size=${THUMB_SIZE}`;
    }
    return '';
}

/**
 * An item of the library as an entry of the list
 *
 * @param item what `library_items` returned
 * @param baseUrl the address of the server, for the thumbnails
 * @returns null for an item without a URI, which cannot be played
 */
export function toMediaEntry(item: MaLibraryItem, baseUrl: string): MediaEntry | null {
    if (!item?.uri) {
        return null;
    }
    const images = item.metadata?.images || [];
    const image = item.image || images.find(i => i?.type === 'thumb') || images[0];
    const subtitle =
        (item.artists || [])
            .map(a => a?.name)
            .filter(Boolean)
            .join(', ') ||
        item.owner ||
        item.publisher ||
        (item.authors || []).join(', ') ||
        '';
    return {
        uri: item.uri,
        name: item.name || item.uri,
        subtitle,
        image: imageUrl(image, baseUrl),
        type: item.media_type || '',
    };
}

/**
 * `base_url` of the server info without a trailing slash; the address the adapter connects to if there is none
 *
 * @param baseUrl what the server reports
 * @param fallback `http://<host>:<port>` of the connection
 */
export function normalizeBaseUrl(baseUrl: unknown, fallback: string): string {
    const url = typeof baseUrl === 'string' && /^https?:\/\//i.test(baseUrl) ? baseUrl : fallback;
    return url.replace(/\/+$/, '');
}
