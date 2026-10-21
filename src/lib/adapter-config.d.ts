// This file extends the AdapterConfig type from "@iobroker/types"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            host: string;
            port: number;
            token: string;
            username: string;
            password: string;
            dockerMusicAssistant?: {
                enabled?: boolean;
                stopIfInstanceStopped?: boolean;
                autoImageUpdate?: boolean;
                /** Folders of the host mounted into the container: `/path/on/host:/path/in/container[:ro]` */
                mediaFolder1?: string;
                mediaFolder2?: string;
                mediaFolder3?: string;
            };
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};