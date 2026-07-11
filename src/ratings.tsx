import * as api from "./api";
import { getTrackRating, getTrackRatingOrDefault } from "./app";
import { PlaylistUris, Ratings, TimestampedRating, Track } from "./types/store";
interface Contents {
    uri?: string;
    items: [
        {
            type: string;
            uri: string;
            name: string;
        },
    ];
}

export function findFolderByUri(contents: Contents, uri: string): Contents | undefined {
    // A folder item in the Spotify rootlist has its own .items sub-array at runtime,
    // so it structurally satisfies Contents even though the interface tuple does not declare it.
    return contents.items.find((item) => item.type === "folder" && item.uri === uri) as Contents | undefined;
}

export function findFolderByName(contents: Contents, name: string): Contents | undefined {
    return contents.items.find((item) => item.type === "folder" && item.name === name) as Contents | undefined;
}

/**
 * Parse a rating playlist name into a base rating and a 1-based version number.
 *
 * Supported formats:
 *   "4.5"    -> { rating: "4.5", version: 1 }   (first / only playlist)
 *   "4.5(1)" -> { rating: "4.5", version: 2 }   (first spillover)
 *   "4.5(2)" -> { rating: "4.5", version: 3 }   (second spillover)
 *
 * Returns null if the name does not match.
 */
export function parseRatingPlaylistName(name: string): { rating: number; version: number } | null {
    // Base name with no suffix: "4.5"
    const baseMatch = name.match(/^(\d+(?:\.\d+)?)$/);
    if (baseMatch) return { rating: parseFloat(baseMatch[1]), version: 1 };
    // Spillover suffix: "4.5(1)", "4.5(2)", …
    const overflowMatch = name.match(/^(\d+(?:\.\d+)?)\((\d+)\)$/);
    if (overflowMatch) return { rating: parseFloat(overflowMatch[1]), version: parseInt(overflowMatch[2]) + 1 };
    return null;
}

/**
 * Build a PlaylistUris map by scanning the contents of the rated folder.
 * Playlists are grouped by base rating and sorted by version (ascending),
 * so the last element in each array is always the newest / highest-version playlist.
 */
export function buildPlaylistUris(ratedFolder: Contents): PlaylistUris {
    const grouped = new Map<number, { uri: string; version: number }[]>();

    for (const item of ratedFolder.items) {
        if (item.type !== "playlist") continue;
        const parsed = parseRatingPlaylistName(item.name);
        if (!parsed) continue;
        if (!grouped.has(parsed.rating)) grouped.set(parsed.rating, []);
        grouped.get(parsed.rating)!.push({ uri: item.uri, version: parsed.version });
    }

    const result: PlaylistUris = {};
    for (const [rating, items] of grouped) {
        result[rating] = items.sort((a, b) => a.version - b.version).map((i) => i.uri);
    }
    return result;
}

export function getPlaylistNames(playlistUris: PlaylistUris, ratedFolder: Contents): Record<string, string> {
    const allUris = new Set(Object.values(playlistUris).flat());
    const playlistNames: Record<string, string> = {};
    ratedFolder.items
        .filter((item) => allUris.has(item.uri))
        .forEach((item) => {
            playlistNames[item.uri] = item.name;
        });
    return playlistNames;
}

type PlaylistItemsEntry = { rating: number; playlistUri: string; tracks: Track[] };

export async function getAllPlaylistItems(playlistUris: PlaylistUris): Promise<PlaylistItemsEntry[]> {
    const entries: { rating: number; playlistUri: string }[] = [];
    // Object.entries always yields string keys; parse back to number.
    for (const [ratingStr, uris] of Object.entries(playlistUris)) {
        const rating = parseFloat(ratingStr);
        for (const playlistUri of uris) {
            entries.push({ rating, playlistUri });
        }
    }
    const trackArrays = await Promise.all(entries.map((e) => api.getPlaylistItems(e.playlistUri)));
    return entries.map((e, i) => ({ ...e, tracks: trackArrays[i] }));
}

function normalizeTrackRatings(entries: TimestampedRating[]): TimestampedRating[] {
    const FIVE_MIN_MS = 5 * 60 * 1000;
    const sortedEntries = [...entries].sort((a, b) => a.time.getTime() - b.time.getTime());
    const normalized: TimestampedRating[] = [];

    for (const entry of sortedEntries) {
        const previous = normalized[normalized.length - 1];
        if (!previous) {
            normalized.push(entry);
            continue;
        }

        if (entry.time.getTime() - previous.time.getTime() <= FIVE_MIN_MS) {
            if (entry.rating === previous.rating) {
                normalized.pop();
            } else {
                normalized[normalized.length - 1] = entry;
            }
            continue;
        }

        normalized.push(entry);
    }

    return normalized.sort((a, b) => b.time.getTime() - a.time.getTime());
}

export function getRatingsByTrack(allPlaylistItems: PlaylistItemsEntry[]): Ratings {
    const ratingsByTrack: { [trackUri: string]: TimestampedRating[] } = {};

    for (const { rating, playlistUri, tracks } of allPlaylistItems) {
        for (const track of tracks) {
            const trackUri = track.link ?? track.uri;
            const entry: TimestampedRating = {
                rating,
                time: new Date(track.addedAt),
                uid: track.uid,
                playlistUri,
            };

            if (!ratingsByTrack[trackUri]) {
                ratingsByTrack[trackUri] = [entry];
            } else {
                ratingsByTrack[trackUri].push(entry);
            }
        }
    }

    const normalizedRatings: Ratings = {};
    for (const [trackUri, entries] of Object.entries(ratingsByTrack)) {
        normalizedRatings[trackUri] = normalizeTrackRatings(entries);
    }

    return normalizedRatings;
}

export function getAlbumRating(ratings: Ratings, album): number {
    console.log("album is:", album);
    if (!album) return 0.0;

    const items = album.tracks.items; // Accessing items directly from album object
    let sumRatings = 0.0;
    let numRatings = 0;

    for (const item of items) {
        const trackUri = item.uri; // Correctly reference the track URI
        const rating = getTrackRating(trackUri);

        if (!rating) continue;

        sumRatings += rating;
        numRatings += 1;
    }

    let averageRating = 0.0;
    if (numRatings > 0) averageRating = sumRatings / numRatings;

    // Round to nearest 0.25 (finest supported granularity)
    averageRating = Math.round(averageRating * 4) / 4;
    return averageRating;
}

export async function sortPlaylistByRating(playlistUri: string, ratings: Ratings) {
    const items = await api.getPlaylistItems(playlistUri);

    if (items.length < 2) return;

    const sorted = items
        .map((item, idx) => ({
            uid: item.uid ?? item.rowId,
            rating: getTrackRatingOrDefault(item.link ?? item.uri),
            idx,
        }))
        .sort((a, b) => b.rating - a.rating || a.idx - b.idx)
        .map((item) => item.uid);

    // Use lowest-rated track as anchor, then insert tracks in descending-rating order before it.
    const anchor = sorted[sorted.length - 1];

    for (let i = 0; i < sorted.length - 1; i++) {
        await api.moveTracksBefore(playlistUri, [sorted[i]], anchor);
    }
}
