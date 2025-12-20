import * as api from "./api";

type HalfIncrementRating = "0.0" | "0.5" | "1.0" | "1.5" | "2.0" | "2.5" | "3.0" | "3.5" | "4.0" | "4.5" | "5.0";

type NowPlayingStarsPosition = "left" | "right";
type Threshold = "disabled" | HalfIncrementRating;

export interface Settings {
    halfStarRatings: boolean;
    likeThreshold: Threshold;
    enableKeyboardShortcuts: boolean;
    showPlaylistStars: boolean;
    nowPlayingStarsPosition: NowPlayingStarsPosition;
    skipThreshold: Threshold;
    syncDuplicateSongs: boolean;
    defaultRating: HalfIncrementRating;
    reEnqueueWorkaround: boolean;
}

const defaultSettings: Settings = {
    halfStarRatings: true,
    likeThreshold: "4.0",
    enableKeyboardShortcuts: true,
    showPlaylistStars: true,
    nowPlayingStarsPosition: "left",
    skipThreshold: "disabled",
    syncDuplicateSongs: false,
    defaultRating: "2.5",
    reEnqueueWorkaround: false,
};

export function getSettings(): Settings {
    let settings: Partial<Settings> = {};
    try {
        const parsed = JSON.parse(api.getLocalStorageData("starRatings:settings"));
        if (parsed && typeof parsed === "object") {
            settings = parsed as Partial<Settings>;
        } else {
            throw "";
        }
    } catch {
        api.setLocalStorageData("starRatings:settings", JSON.stringify(defaultSettings));
        return { ...defaultSettings };
    }
    let modified = false;
    for (const key of Object.keys(defaultSettings) as (keyof Settings)[]) {
        if (!(key in settings)) {
            settings[key] = defaultSettings[key];
            modified = true;
        }
    }
    if (modified) {
        api.setLocalStorageData("starRatings:settings", JSON.stringify(settings));
    }
    return settings as Settings;
}

export function saveSettings(settings: Settings) {
    api.setLocalStorageData("starRatings:settings", JSON.stringify(settings));
}

export function getPlaylistUris() {
    try {
        const parsed = JSON.parse(api.getLocalStorageData("starRatings:playlistUris"));
        if (parsed && typeof parsed === "object") {
            return parsed;
        }
        throw "";
    } catch {
        api.setLocalStorageData("starRatings:playlistUris", `{}`);
        return {};
    }
}

export function savePlaylistUris(playlistUris) {
    api.setLocalStorageData("starRatings:playlistUris", JSON.stringify(playlistUris));
}

export function getRatedFolderUri() {
    return api.getLocalStorageData("starRatings:ratedFolderUri");
}

export function saveRatedFolderUri(ratedFolderUri) {
    api.setLocalStorageData("starRatings:ratedFolderUri", ratedFolderUri);
}
