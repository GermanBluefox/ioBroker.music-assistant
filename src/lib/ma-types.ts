export interface PlayerMedia {
    uri?: string;
    title?: string;
    artist?: string;
    album?: string;
    image_url?: string;
    duration?: number;
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

export interface Player {
    player_id: string;
    name: string;
    available: boolean;
    powered: boolean | null;
    playback_state: 'idle' | 'paused' | 'playing' | 'unknown';
    elapsed_time: number | null;
    volume_level: number | null;
    volume_muted: boolean | null;
    /** A source of `source_list`, or the ID of the queue that plays (the own queue has the ID of the player) */
    active_source: string | null;
    source_list?: PlayerSource[];
    current_media: PlayerMedia | null;
    synced_to?: string | null;
    group_members?: string[];
}

export interface QueueItemMediaItem {
    name?: string;
    metadata?: {
        image?: {
            path?: string;
        } | null;
    };
}

export interface QueueItem {
    queue_item_id: string;
    name: string;
    duration: number | null;
    media_item?: QueueItemMediaItem | null;
}

/** An entry of a search result list; MediaItem and ItemMapping both carry these */
export interface SearchResultItem {
    item_id: string;
    name: string;
    uri: string;
    media_type: string;
}

/** Result of the `music/search` command */
export interface SearchResults {
    artists?: SearchResultItem[];
    albums?: SearchResultItem[];
    genres?: SearchResultItem[];
    tracks?: SearchResultItem[];
    playlists?: SearchResultItem[];
    radio?: SearchResultItem[];
    audiobooks?: SearchResultItem[];
    podcasts?: SearchResultItem[];
    sound_effects?: SearchResultItem[];
}

export interface PlayerQueue {
    queue_id: string;
    display_name: string;
    available: boolean;
    active: boolean;
    shuffle_enabled: boolean;
    repeat_mode: 'off' | 'one' | 'all' | 'unknown';
    crossfade_enabled: boolean;
    elapsed_time: number | null;
    state: 'idle' | 'paused' | 'playing' | 'unknown';
    current_item: QueueItem | null;
}
