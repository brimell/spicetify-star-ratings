import * as api from "./api";
import { getTrackRating, getTrackRatingOrDefault } from "./app";
import { TracksByRatings, PlaylistUris, Ratings, TimestampedRating } from "./types/store";
interface Contents {
    items: [
        {
            type: string;
            uri: string;
            name: string;
        },
    ];
}

export function findFolderByUri(contents: Contents, uri: string) {
    return contents.items.find((item) => item.type === "folder" && item.uri === uri);
}

export function findFolderByName(contents: Contents, name: string) {
    return contents.items.find((item) => item.type === "folder" && item.name === name);
}

export function removePlaylistUris(playlistUris: PlaylistUris, ratedFolder: Contents): [boolean, PlaylistUris] {
    const newPlaylistUris: PlaylistUris = {};
    let changed = false;
    for (const [rating, playlistUri] of Object.entries(playlistUris)) {
        if (ratedFolder.items.find((item) => item.uri === playlistUri)) newPlaylistUris[rating] = playlistUri;
        else changed = true;
    }
    return [changed, newPlaylistUris];
}

function isFloatPlaylistName(name: string): boolean {
    // Accept plain decimal rating playlist names like 3, 3.5, 4.25, 4.333.
    return /^\d+(?:\.\d+)?$/.test(name);
}

export function addPlaylistUris(playlistUris: PlaylistUris, ratedFolder: Contents): [boolean, PlaylistUris] {
    const newPlaylistUris: PlaylistUris = { ...playlistUris };
    let changed = false;
    ratedFolder.items
        .filter((item) => item.type === "playlist" && isFloatPlaylistName(item.name))
        .forEach((item) => {
            if (newPlaylistUris[item.name] !== item.uri) {
                newPlaylistUris[item.name] = item.uri;
                changed = true;
            }
        });
    return [changed, newPlaylistUris];
}

export function getPlaylistNames(playlistUris: PlaylistUris, ratedFolder: Contents): PlaylistUris {
    const playlistNames: PlaylistUris = {};
    ratedFolder.items
        .filter((item) => Object.values(playlistUris).includes(item.uri))
        .forEach((item) => {
            playlistNames[item.uri] = item.name;
        });
    return playlistNames;
}

export async function getAllPlaylistItems(playlistUris: PlaylistUris): Promise<TracksByRatings> {
    const ratings = Object.keys(playlistUris);
    const allPlaylistItemsArray = await Promise.all(ratings.map((rating) => api.getPlaylistItems(playlistUris[rating])));
    const allPlaylistItems: TracksByRatings = {};
    for (let i = 0; i < ratings.length; i++) allPlaylistItems[ratings[i]] = allPlaylistItemsArray[i];
    return allPlaylistItems;
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

export function getRatingsByTrack(allPlaylistItems: TracksByRatings): Ratings {
    const ratingsByTrack: Ratings = {};

    for (const [rating, tracks] of Object.entries(allPlaylistItems)) {
        for (const track of tracks) {
            const trackUri = track.link ?? track.uri;
            const entry: TimestampedRating = { rating, time: new Date(track.addedAt), uid: track.uid };

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
        .map((item, idx) => ({ uid: item.rowId, rating: getTrackRatingOrDefault(item.link ?? item.uri), idx }))
        .sort((a, b) => b.rating - a.rating || a.idx - b.idx)
        .map((item) => item.uid);

    // create anchor: move top-rated to the start
    const currentFirst = items[0].rowId;
    if (sorted[0] !== currentFirst) {
        await api.moveTracksBefore(playlistUri, [sorted[0]], currentFirst);
    }

    const BATCH_SIZE = 50;
    let anchor = sorted[0];

    for (let i = 1; i < sorted.length; i += BATCH_SIZE) {
        const chunk = sorted.slice(i, i + BATCH_SIZE);
        await api.moveTracksAfter(playlistUri, chunk, anchor);
        anchor = chunk[chunk.length - 1];
    }
}
