export interface PlayerMedia {
    uri?: string;
    title?: string;
    artist?: string;
    album?: string;
    image_url?: string;
    duration?: number;
    elapsed_time?: number;
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
    active_source: string | null;
    source_list?: string[];
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
