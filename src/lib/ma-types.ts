/** What a player currently plays, as reported by Music Assistant */
export interface PlayerMedia {
    /** URI of the media item */
    uri?: string;
    /** Title of the track or stream */
    title?: string;
    /** Name of the artist */
    artist?: string;
    /** Name of the album */
    album?: string;
    /** URL of the cover image */
    image_url?: string;
    /** Length in seconds */
    duration?: number;
    /** Position in seconds */
    elapsed_time?: number;
}

/** A native source of a player, e.g. Spotify Connect, AirPlay or a line input */
export interface PlayerSource {
    /** What `players/cmd/select_source` takes */
    id: string;
    /** Shown to the user */
    name: string;
    /** Cannot be selected by Music Assistant or the user, only be active */
    passive?: boolean;
}

/** A player of Music Assistant */
export interface Player {
    /** Unique id of the player */
    player_id: string;
    /** Display name of the player */
    name: string;
    /** Whether the player can be reached */
    available: boolean;
    /** Whether the player is switched on, `null` if the player cannot tell */
    powered: boolean | null;
    /** Playback state of the player */
    playback_state: 'idle' | 'paused' | 'playing' | 'unknown';
    /** Position in seconds, `null` if nothing plays */
    elapsed_time: number | null;
    /** Volume from 0 to 100, `null` if the player has no volume control */
    volume_level: number | null;
    /** Whether the player is muted, `null` if the player has no mute control */
    volume_muted: boolean | null;
    /** A source of `source_list`, or the ID of the queue that plays (the own queue has the ID of the player) */
    active_source: string | null;
    /** The native sources the player offers */
    source_list?: PlayerSource[];
    /** The media the player currently plays, `null` if nothing plays */
    current_media: PlayerMedia | null;
    /** Id of the leader this player is synced to, `null` or unset if it is not a sync member */
    synced_to?: string | null;
    /** Ids of the players in the sync group of this player */
    group_members?: string[];
}

/** The media item behind a queue item */
export interface QueueItemMediaItem {
    /** Name of the media item */
    name?: string;
    /** Metadata of the media item */
    metadata?: {
        /** Cover image of the media item */
        image?: {
            /** Path or URL of the image */
            path?: string;
        } | null;
    };
}

/** An entry of a player queue */
export interface QueueItem {
    /** Unique id of the entry in its queue */
    queue_item_id: string;
    /** Display name of the entry */
    name: string;
    /** Length in seconds, `null` if it is not known (e.g. a radio stream) */
    duration: number | null;
    /** The media item behind the entry */
    media_item?: QueueItemMediaItem | null;
}

/** An entry of a search result list; MediaItem and ItemMapping both carry these */
export interface SearchResultItem {
    /** Id of the item at its provider */
    item_id: string;
    /** Display name of the item */
    name: string;
    /** URI to play or queue the item */
    uri: string;
    /** Type of the item, e.g. `track` or `album` */
    media_type: string;
}

/** Result of the `music/search` command */
export interface SearchResults {
    /** Matching artists */
    artists?: SearchResultItem[];
    /** Matching albums */
    albums?: SearchResultItem[];
    /** Matching genres */
    genres?: SearchResultItem[];
    /** Matching tracks */
    tracks?: SearchResultItem[];
    /** Matching playlists */
    playlists?: SearchResultItem[];
    /** Matching radio stations */
    radio?: SearchResultItem[];
    /** Matching audiobooks */
    audiobooks?: SearchResultItem[];
    /** Matching podcasts */
    podcasts?: SearchResultItem[];
    /** Matching sound effects */
    sound_effects?: SearchResultItem[];
}

/** The queue of a player */
export interface PlayerQueue {
    /** Unique id of the queue, the same as the id of its player */
    queue_id: string;
    /** Display name of the queue */
    display_name: string;
    /** Whether the queue can be used */
    available: boolean;
    /** Whether the queue is the active one of its player */
    active: boolean;
    /** Whether the queue plays in random order */
    shuffle_enabled: boolean;
    /** Repeat mode of the queue */
    repeat_mode: 'off' | 'one' | 'all' | 'unknown';
    /** Whether tracks are cross-faded */
    crossfade_enabled: boolean;
    /** Position in the current item in seconds, `null` if nothing plays */
    elapsed_time: number | null;
    /** Playback state of the queue */
    state: 'idle' | 'paused' | 'playing' | 'unknown';
    /** The item that is currently played, `null` if there is none */
    current_item: QueueItem | null;
}
