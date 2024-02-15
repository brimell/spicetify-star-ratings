import * as api from "./api";

export function getSettings() {
    const defaultSettings = {
        halfStarRatings: true,
        likeThreshold: "4.0",
        enableKeyboardShortcuts: true,
        showPlaylistStars: true,
        nowPlayingStarsPosition: "left",
        skipThreshold: "disabled",
    };
    settings = {};
    try {
        const parsed = JSON.parse(api.getLocalStorageData("starRatings:settings"));
        if (parsed && typeof parsed === "object") {
            settings = parsed;
        } else {
            throw "";
        }
    } catch {
        api.setLocalStorageData("starRatings:settings", defaultSettings);
        return defaultSettings;
    }
    let modified = false;
    for (const key of Object.keys(defaultSettings)) {
        if (!settings.hasOwnProperty(key)) {
            settings[key] = defaultSettings[key];
            modified = true;
        }
    }
    if (modified) {
        api.setLocalStorageData("starRatings:settings", settings);
    }
    return settings;
}

export function saveSettings(settings) {
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
