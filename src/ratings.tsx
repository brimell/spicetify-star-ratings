import * as api from "./api";
import { RatingsByTrack, TracksByRatings, PlaylistUris, Ratings } from "./types/store";
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
    const ratings = ["0.0", "0.5", "1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];
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

export function getRatingsByTrack(allPlaylistItems: TracksByRatings): RatingsByTrack {
    const ratings: RatingsByTrack = {};

    for (const [rating, tracks] of Object.entries(allPlaylistItems)) {
        for (const track of tracks) {
            const trackUri = track.link;

            ratings[trackUri] = rating;
        }
    }
    return ratings;
}

export function getAlbumRating(ratings: Ratings, album): string {
    console.log("album is:", album);
    if (!album.albumUnion) return "0.0";

    const items = album.albumUnion.tracks.items;
    let sumRatings = 0.0;
    let numRatings = 0;
    for (const item of items) {
        const rating = parseFloat(ratings[item.track.uri]);
        if (!rating) continue;
        sumRatings += rating;
        numRatings += 1;
    }
    let averageRating = 0.0;
    if (numRatings > 0) averageRating = sumRatings / numRatings;
    // Round to nearest 0.5
    averageRating = (Math.round(averageRating * 2) / 2);
    return averageRating.toFixed(1);
}

export async function sortPlaylistByRating(playlistUri: string, ratings: RatingsByTrack) {
    const ratingKeys = ["5.0", "4.5", "4.0", "3.5", "3.0", "2.5", "2.0", "1.5", "1.0", "0.5", "0.0"];

    const items = await api.getPlaylistItems(playlistUri);

    if (items.length === 0) return;

    // Create map from ratings to list of UIDs
    const ratingToUids = {};
    for (const rating of ratingKeys) ratingToUids[rating] = [];

    for (const item of items) {
        let rating = ratings[item.link] ?? 0.0;
        if (typeof rating === "number") rating = rating.toFixed(1);
        ratingToUids[rating].push(item.rowId);
    }

    function getHighestRatedUid(ratingToUids) {
        for (const rating of ratingKeys) {
            if (ratingToUids[rating].length > 0) return ratingToUids[rating][0];
        }
        return null;
    }

    let previousIterationLastUid = getHighestRatedUid(ratingToUids);
    const firstUid = items[0].rowId;
    const isFirstItemHighestRated = previousIterationLastUid === firstUid;
    let isFirstIteration = true;
    for (const rating of ratingKeys) {
        if (ratingToUids[rating].length === 0) continue;

        if (!isFirstItemHighestRated && isFirstIteration) {
            await api.moveTracksBefore(playlistUri, ratingToUids[rating], previousIterationLastUid);
        } else {
            await api.moveTracksAfter(playlistUri, ratingToUids[rating], previousIterationLastUid);
        }

        isFirstIteration = false;
        previousIterationLastUid = ratingToUids[rating].slice(-1)[0];
    }
}
