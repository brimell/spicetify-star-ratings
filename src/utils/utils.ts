import { getLocalStorageData, setLocalStorageData } from "../api";

export function getTracklistTrackUri(tracklistElement: Element): string | null {
    const fiberKey = Object.keys(tracklistElement).find((k) => k.startsWith("__reactFiber$"));
    if (!fiberKey) return null;

    const isTrackUri = (v: unknown): v is string => typeof v === "string" && v.startsWith("spotify:track:");

    const seen = new Set<object>();

    // Walk a node's subtree via child/sibling. Never crosses above the root
    // because the root's own siblings are other rows.
    const search = (node: any): string | null => {
        if (!node || seen.has(node)) return null;
        seen.add(node);

        const props = node.memoizedProps ?? node.pendingProps;
        if (isTrackUri(props?.uri)) return props.uri;

        return search(node.child) ?? search(node.sibling);
    };

    const root = (tracklistElement as any)[fiberKey];
    if (!root) return null;

    // Check the row fiber's own props first (usually absent, but cheap).
    const rootProps = root.memoizedProps ?? root.pendingProps;
    if (isTrackUri(rootProps?.uri)) return rootProps.uri;

    // Walk the root's children chain only. Do NOT call search(root) directly,
    // because search() follows sibling links — which from the root would leak
    // into the next row's fiber subtree.
    for (let child = root.child; child; child = child.sibling) {
        const found = search(child);
        if (found) return found;
    }

    return null;
}

/**
 * Resolve a tracklist row's track URI: React fiber first (fast path), then DOM attributes and
 * links, which survive markup changes where the fiber layout does not.
 */
export function getRowTrackUri(row: Element): string | null {
    const fromFiber = getTracklistTrackUri(row);
    if (fromFiber) return fromFiber;

    const attr = row.getAttribute("data-uri") || row.getAttribute("data-context-item-uri");
    if (attr && attr.startsWith("spotify:track:")) return attr;

    for (const a of Array.from(row.querySelectorAll('a[href*="/track/"]'))) {
        const m = a.getAttribute("href")?.match(/\/track\/([a-zA-Z0-9]{22})/);
        if (m) return "spotify:track:" + m[1];
    }
    return null;
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

// Get current player context (playlist, album, etc.)
export function getPlayerContext(): Spicetify.PlayerContext | null {
    return Spicetify.Player?.data?.context || Spicetify.Player?.data?.item?.context || null;
}

const WEIGHTED_PLAYBACK_ENABLED_LOCAL_STORAGE_KEY = "starRatings:weighted-playback-enabled";
function getWeightedPlaybackEnabledRecord(): Record<string, boolean> {
    const localstorage = getLocalStorageData(WEIGHTED_PLAYBACK_ENABLED_LOCAL_STORAGE_KEY);

    if (localstorage) {
        const parsed = JSON.parse(localstorage);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        } else {
            return parsed;
        }
    } else {
        return {};
    }
}
export function weightedPlaybackEnabledForPlaylist(): boolean {
    const context = getPlayerContext();
    if (!context) {
        return false;
    }

    const record = getWeightedPlaybackEnabledRecord();
    return record[context.uri] ?? false;
}
export function setWeightedPlaybackEnabledForPlaylist(enabled: boolean) {
    const context = getPlayerContext();
    if (!context) {
        return;
    }

    let record = getWeightedPlaybackEnabledRecord();
    record[context.uri] = enabled;
    setLocalStorageData(WEIGHTED_PLAYBACK_ENABLED_LOCAL_STORAGE_KEY, JSON.stringify(record));
}
