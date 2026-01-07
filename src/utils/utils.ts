import { getLocalStorageData, setLocalStorageData } from "../api";

export function getTracklistTrackUri(tracklistElement: Element) {
    let values = Object.values(tracklistElement);
    if (!values) return null;

    const searchFrom = values[0]?.pendingProps?.children?.[0]?.props?.children ?? values[0]?.pendingProps?.children?.props?.value?.item;

    return (
        searchFrom?.uri ||
        searchFrom?.props?.uri ||
        searchFrom?.props?.children?.props?.uri ||
        searchFrom?.props?.children?.props?.children?.props?.uri ||
        searchFrom?.[0]?.props?.uri
    );
}

export function isAlbumPage() {
    const pathname = Spicetify.Platform.History.location.pathname;
    const matches = pathname.match(/album\/(.*)/);
    if (!matches) return null;
    return matches[1];
}

export function trackUriToTrackId(trackUri: string): string {
    return trackUri.replace("spotify:track:", "");
}

export const getNowPlayingTrackUri = () => {
    return Spicetify.Player.data.item.uri;
};

const WEIGHTED_PLAYBACK_ENABLED_LOCAL_STORAGE_KEY = "starRatings:weighted-playback-enabled";
export function weightedPlaybackEnabled(): boolean {
    const localstorage = getLocalStorageData(WEIGHTED_PLAYBACK_ENABLED_LOCAL_STORAGE_KEY);
    return localstorage === "true";
}
export function setWeightedPlaybackEnabled(enabled: boolean) {
    setLocalStorageData(WEIGHTED_PLAYBACK_ENABLED_LOCAL_STORAGE_KEY, enabled ? "true" : "false");
}
