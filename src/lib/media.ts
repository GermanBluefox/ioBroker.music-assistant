/*
 * The library of Music Assistant for the players of the UIs: favorites, artists, albums, tracks, playlists, radio
 * stations, podcasts and audiobooks, as the message `getMedia` lists them. A UI plays an entry by writing its URI
 * into `players.<id>.playMedia`.
 */

/** An image of a media item, as Music Assistant serializes it */
export interface MaImage {
    /** `thumb`, `fanart`, `logo`, ... */
    type?: string;
    /** URL or provider specific path of the image */
    path?: string;
    /** Instance of the provider that can load the path */
    provider?: string;
    /** The path is a URL that a browser can load */
    remotely_accessible?: boolean;
    /** Opaque id of the image proxy of the server, set by current servers */
    proxy_id?: string | null;
}

/** The part of a media item (or summary item) of the library that a list shows */
export interface MaLibraryItem {
    /** Id of the item in the library */
    item_id?: string | number;
    /** Name of the item */
    name?: string;
    /** URI to play it, e.g. `library://album/12` */
    uri?: string;
    /** `track`, `album`, `artist`, ... */
    media_type?: string;
    /** The image of a summary item (`ItemMapping`) */
    image?: MaImage | null;
    /** The images of a full media item */
    metadata?: { images?: MaImage[] | null } | null;
    /** Artists of a track or an album */
    artists?: { name?: string }[] | null;
    /** Album of a track */
    album?: { name?: string } | null;
    /** Owner of a playlist */
    owner?: string | null;
    /** Publisher of a podcast or an audiobook */
    publisher?: string | null;
    /** Authors of an audiobook */
    authors?: string[] | null;
}

/** One entry of the list `getMedia` answers with */
export interface MediaEntry {
    /** Written into `players.<id>.playMedia` to play it */
    uri: string;
    /** Name of the item */
    name: string;
    /** Artists (and the album of a track), owner of a playlist, publisher of a podcast - or empty */
    subtitle: string;
    /** URL of a thumbnail, or empty */
    image: string;
    /** `track`, `album`, `artist`, `playlist`, `radio`, `podcast`, `audiobook` */
    type: string;
}

/** The lists a UI can ask for: the favorites of all types, or the library items of one media type */
export const MEDIA_LISTS = [
    'favorites',
    'artists',
    'albums',
    'tracks',
    'playlists',
    'radios',
    'podcasts',
    'audiobooks',
] as const;

/** One of {@link MEDIA_LISTS} */
export type MediaList = (typeof MEDIA_LISTS)[number];

/** The media type of a list of one type */
const LIST_TYPE: Record<Exclude<MediaList, 'favorites'>, string> = {
    artists: 'artist',
    albums: 'album',
    tracks: 'track',
    playlists: 'playlist',
    radios: 'radio',
    podcasts: 'podcast',
    audiobooks: 'audiobook',
};

/** What the message `getMedia` takes */
export interface MediaRequest {
    /** Which list */
    list: MediaList;
    /** Only entries whose name contains it */
    search?: string;
    /** Entries at most */
    limit: number;
    /** Entries to skip, to load the next page */
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
 * The media type of a list, or undefined for the favorites (all types)
 *
 * @param list a list of {@link MEDIA_LISTS}
 */
export function listType(list: MediaList): string | undefined {
    return list === 'favorites' ? undefined : LIST_TYPE[list];
}

/**
 * Checks what a UI sent with `getMedia`
 *
 * @param message the message
 * @returns the request, or a text why it is not one
 */
export function parseMediaRequest(message: unknown): MediaRequest | string {
    const msg = (message && typeof message === 'object' ? message : {}) as Record<string, unknown>;
    const list = msg.list as MediaList;
    if (!MEDIA_LISTS.includes(list)) {
        return `Unknown list "${String(msg.list)}", use one of ${MEDIA_LISTS.join(', ')}`;
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
    const artists = (item.artists || [])
        .map(a => a?.name)
        .filter(Boolean)
        .join(', ');
    // a track: its artists and its album
    const byArtists = [artists, item.media_type === 'track' ? item.album?.name : ''].filter(Boolean).join(' · ');
    const subtitle = byArtists || item.owner || item.publisher || (item.authors || []).join(', ') || '';
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
