export type RatingsByTrack = {
    [key: string]: string[];
};

export type TracksByRatings = {
    [key: number]: [Track];
};

export type Track = {
    hasLyrics: boolean;
    link: string;
    name: string;
    length: number;
    playable: boolean;
    isAvailableInMetadataCatalogue: boolean;
    locallyPlayable: boolean;
    playableLocalTrack: boolean;
    discNumber: number;
    trackNumber: number;
    isExplicit: boolean;
    is19PlusOnly: boolean;
    previewId: string;
    isLocal: boolean;
    isPremiumOnly: boolean;
    popularity: number;
    inCollection: boolean;
    canAddToCollection: boolean;
    isBanned: boolean;
    canBan: boolean;
    localFile: boolean;
    offline: string;
    trackPlayState: {
        isPlayable: boolean;
        playabilityRestriction: string;
    };
    album: {
        link: string;
        name: string;
        covers: {
            default: string;
            small: string;
            large: string;
            xlarge: string;
        };
        artist: {
            link: string;
            name: string;
        };
    };
    artists: Array<{
        link: string;
        name: string;
    }>;
    rowId: string;
    addTime: number;
    addedBy: {
        username: string;
        link: string;
        name: string;
        image: string;
        thumbnail: string;
    };
    displayCovers: {
        default: string;
        small: string;
        large: string;
        xlarge: string;
    };
};

export interface PlaylistUris {
    [key: string]: string;
}
export interface Ratings {
    [key: string]: number[];
}
export interface NewRatings {
    [key: string]: number;
}