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

export function addPlaylistUris(playlistUris: PlaylistUris, ratedFolder: Contents): [boolean, PlaylistUris] {
    const newPlaylistUris: PlaylistUris = { ...playlistUris };
    let changed = false;
    const ratings = [
        "0.0",
        "0.25",
        "0.5",
        "0.75",
        "1.0",
        "1.25",
        "1.5",
        "1.75",
        "2.0",
        "2.25",
        "2.5",
        "2.75",
        "3.0",
        "3.25",
        "3.5",
        "3.75",
        "4.0",
        "4.25",
        "4.5",
        "4.75",
        "5.0",
    ];
    const unmappedRatings = ratings.filter((rating) => !playlistUris.hasOwnProperty(rating));
    ratedFolder.items
        .filter((item) => unmappedRatings.includes(item.name))
        .forEach((item) => {
            newPlaylistUris[item.name] = item.uri;
            changed = true;
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

export function getRatingsByTrack(allPlaylistItems: TracksByRatings): Ratings {
    const ratings: Ratings = {};

    for (const [rating, tracks] of Object.entries(allPlaylistItems)) {
        for (const track of tracks) {
            const trackUri = track.link ?? track.uri;
            const entry: TimestampedRating = { rating, time: new Date(track.addedAt), uid: track.uid };

            if (!ratings[trackUri]) {
                ratings[trackUri] = [entry];
            } else {
                ratings[trackUri].push(entry);
            }
        }
    }
    return ratings;
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
