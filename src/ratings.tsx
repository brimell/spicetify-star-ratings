import * as api from "./api";

export function findFolderByUri(contents, uri) {
    return contents.items.find((item) => item.type === "folder" && item.uri === uri);
}

export function findFolderByName(contents, name) {
    return contents.items.find((item) => item.type === "folder" && item.name === name);
}

// Remove playlist URIs from settings when they no longer exist
export function removePlaylistUris(playlistUris, ratedFolder) {
    const newPlaylistUris = {};
    let changed = false;
    for (const [rating, playlistUri] of Object.entries(playlistUris)) {
        if (ratedFolder.items.find((item) => item.uri === playlistUri)) newPlaylistUris[rating] = playlistUri;
        else changed = true;
    }
    return [changed, newPlaylistUris];
}

// Add playlist URIs of numbered rated playlists when they currently don't exist in settings
export function addPlaylistUris(playlistUris, ratedFolder) {
    const newPlaylistUris = { ...playlistUris };
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

export function getPlaylistNames(playlistUris, ratedFolder) {
    const playlistNames = {};
    ratedFolder.items
        .filter((item) => Object.values(playlistUris).includes(item.uri))
        .forEach((item) => {
            playlistNames[item.uri] = item.name;
        });
    return playlistNames;
}

export async function getAllPlaylistItems(playlistUris) {
    const ratings = Object.keys(playlistUris);
    const allPlaylistItemsArray = await Promise.all(ratings.map((rating) => api.getPlaylistItems(playlistUris[rating])));
    const allPlaylistItems = {};
    for (let i = 0; i < ratings.length; i++) allPlaylistItems[ratings[i]] = allPlaylistItemsArray[i];
    return allPlaylistItems;
}

export function getRatings(allPlaylistItems) {
    const ratings = {};
    for (const [rating, items] of Object.entries(allPlaylistItems)) {
        for (const item of items) {
            const trackUri = item.link;
            let trackRatings = [];
            if (ratings[trackUri]) trackRatings = ratings[trackUri];
            trackRatings.push(rating);
            ratings[trackUri] = trackRatings;
        }
    }
    return ratings;
}

export function takeHighestRatings(ratings) {
    const newRatings = {};
    for (const [trackUri, trackRatings] of Object.entries(ratings)) newRatings[trackUri] = Math.max(...trackRatings);
    return newRatings;
}

export async function deleteLowestRatings(playlistUris, ratings) {
    const promises = [];
    for (const [trackUri, trackRatings] of Object.entries(ratings)) {
        if (trackRatings.length <= 1) continue;
        const highestRating = Math.max(...trackRatings);
        trackRatings
            .filter((rating) => rating != highestRating)
            .forEach((rating) => {
                const playlistUri = playlistUris[rating];
                console.log(
                    `Removing track ${trackUri} with lower rating ${rating} and higher rating ${highestRating} from lower rated playlist ${playlistUri}.`,
                );
                promises.push(api.deleteTrackFromPlaylist(playlistUri, trackUri));
            });
    }
    await Promise.all(promises);
}

export function getAlbumRating(ratings, album) {
    console.log("album is:", album);
    if (!album.albumUnion) return 0

    const items = album.albumUnion.tracks.items;
    let sumRatings = 0.0;
    let numRatings = 0;
    for (const item of items) {
        const rating = ratings[item.track.uri];
        if (!rating) continue;
        sumRatings += parseFloat(rating);
        numRatings += 1;
    }
    let averageRating = 0.0;
    if (numRatings > 0) averageRating = sumRatings / numRatings;
    // Round to nearest 0.5
    averageRating = (Math.round(averageRating * 2) / 2).toFixed(1);
    return averageRating;
}

export async function sortPlaylistByRating(playlistUri, ratings) {
    const ratingKeys = ["5.0", "4.5", "4.0", "3.5", "3.0", "2.5", "2.0", "1.5", "1.0", "0.5", "0.0"];

    const items = await api.getPlaylistItems(playlistUri);

    if (items.length === 0) return;

    // Create map from ratings to list of UIDs
    const ratingToUids = {};
    for (const rating of ratingKeys) ratingToUids[rating] = [];
    for (const item of items) {
        const rating = ratings[item.link] ?? 0.0;
        const ratingAsString = rating.toFixed(1);
        ratingToUids[ratingAsString].push(item.rowId);
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
