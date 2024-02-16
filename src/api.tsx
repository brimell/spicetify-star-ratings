import axios from "axios";

export function showNotification(text) {
    Spicetify.showNotification(text);
}

export function getLocalStorageData(key) {
    return Spicetify.LocalStorage.get(key);
}

export function setLocalStorageData(key, value) {
    Spicetify.LocalStorage.set(key, value);
}

export async function createPlaylist(name, folderUri) {
    if (navigator.platform.startsWith("Linux") && navigator.userAgent.includes("Spotify/1.1.84.716")) {
        return await Spicetify.Platform.RootlistAPI.createPlaylist(name, {
            after: folderUri,
        });
    } else {
        return await Spicetify.Platform.RootlistAPI.createPlaylist(name, {
            after: {
                uri: folderUri,
            },
        });
    }
}

export async function makePlaylistPrivate(playlistUri) {
    setTimeout(async () => {
        await Spicetify.CosmosAsync.post(`sp://core-playlist/v1/playlist/${playlistUri}/set-base-permission`, {
            permission_level: "BLOCKED",
        });
    }, 1000);
}

export async function createFolder(name: string) {
    await Spicetify.Platform.RootlistAPI.createFolder(name, { before: "" });
}

export async function getAlbum(uri: string) {
    const { queryAlbumTracks } = Spicetify.GraphQL.Definitions;
    const res = await Spicetify.GraphQL.Request(queryAlbumTracks, { uri, offset: 0, limit: 450 });
    return res.data;
}

export async function getContents() {
    return await Spicetify.Platform.RootlistAPI.getContents();
}

function playlistUriToPlaylistId(uri: string): string {
    return uri.replace("spotify:playlist:", "");
}

export async function addTrackToPlaylist(playlistUri: string, trackUri: string) {
    try {
        const playlistId = playlistUriToPlaylistId(playlistUri);
        const trackId = trackUri.replace("spotify:track:", "");

        console.log(`@${playlistId}@`, `@${trackUri}@`);

        // Make POST request to add track to playlist
        await Spicetify.CosmosAsync.post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?uris=spotify%3Atrack%${trackId}`, {
            uris: [trackUri],
        });

        console.log("Added track to playlist");
    } catch (error) {
        console.error("Error adding track to playlist:", error);
        // Handle error appropriately (e.g., show error message to user)
    }
}

// export async function addTrackToPlaylist(playlistUri: string, trackUri: string) {
//     const playlistId = playlistUriToPlaylistId(playlistUri);
//     const trackId = trackUri.replace('spotify:track:', '');
//     const token = Spicetify.Platform.Session.accessToken;
//     await axios.post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?uris=spotify%3Atrack%3A${trackId}`, {}, {
//         headers: {
//             'Authorization': `Bearer ${token}`
//         }
//     });
// }

export async function addTrackToLikedSongs(trackUri: string) {
    const trackId = trackUri.replace("spotify:track:", "");
    await Spicetify.CosmosAsync.put(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`);
}

// export async function addTrackToLikedSongs(trackUri: string) {
//     const trackId = trackUri.replace('spotify:track:', '');
//     const token = Spicetify.Platform.Session.accessToken;
//     await axios.put(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`, {}, {
//         headers: {
//             'Authorization': `Bearer ${token}`
//         }
//     });
// }

export async function deleteTrackFromPlaylist(playlistUri: string, trackUri: string) {
    const playlistId = playlistUriToPlaylistId(playlistUri);
    await Spicetify.CosmosAsync.del(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        tracks: [
            {
                uri: trackUri,
            },
        ],
    });
}

export async function getPlaylistItems(uri: string) {
    const result = await Spicetify.CosmosAsync.get(`sp://core-playlist/v1/playlist/${uri}`);
    return result.items;
}

// TODO: Remove when Linux gets newer release
export async function isAppLaterThan(specifiedVersion) {
    let appInfo = await Spicetify.CosmosAsync.get("sp://desktop/v1/version");
    let result = appInfo.version.localeCompare(specifiedVersion, undefined, { numeric: true, sensitivity: "base" });
    return result === 1;
}

export async function moveTracksBefore(playlistUri, trackUids, beforeUid) {
    const isV2 = await isAppLaterThan("1.2.5.1006.g22820f93");
    await Spicetify.Platform.PlaylistAPI.move(
        playlistUri,
        trackUids.map((uid) => ({ uid: uid })),
        { before: isV2 ? { uid: beforeUid } : beforeUid },
    );
}

export async function moveTracksAfter(playlistUri, trackUids, afterUid) {
    const isV2 = await isAppLaterThan("1.2.5.1006.g22820f93");
    await Spicetify.Platform.PlaylistAPI.move(
        playlistUri,
        trackUids.map((uid) => ({ uid: uid })),
        { after: isV2 ? { uid: afterUid } : afterUid },
    );
}
