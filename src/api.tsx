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
    const options =
        navigator.platform.startsWith("Linux") && navigator.userAgent.includes("Spotify/1.1.84.716")
            ? { after: folderUri }
            : { after: { uri: folderUri } };

    return await Spicetify.CosmosAsync.post(`https://api.spotify.com/v1/users/${Spicetify.User.getUsername()}/playlists`, {
        name: name,
        ...options,
    });
}

export async function makePlaylistPrivate(playlistUri) {
    setTimeout(async () => {
        await Spicetify.CosmosAsync.post(`sp://core-playlist/v1/playlist/${playlistUri}/set-base-permission`, {
            permission_level: "BLOCKED",
        });
    }, 1000);
}

export async function createFolder(name: string) {
    await Spicetify.CosmosAsync.post(`https://api.spotify.com/v1/me/folders`, { name: name, before: "" });
}

export async function getAlbum(uri: string) {
    const query = {
        offset: 0,
        limit: 450,
    };

    return await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/albums/${uri}`, query);
}

export async function getContents() {
    return await Spicetify.Platform.RootlistAPI.getContents();
}

export async function addTrackToLikedSongs(trackUri: string) {
    const trackId = trackUri.split(":").pop(); // Extract the track ID from the URI

    // Check if the track is already liked
    try {
        const isLikedResponse = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/me/tracks/contains?ids=${trackId}`);
        if (isLikedResponse[0]) {
            return;
        }
    } catch (error) {
        console.error("Error checking if track is liked:", error);
        return;
    }

    try {
        await Spicetify.CosmosAsync.put(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`);
    } catch (error) {
        if (error instanceof SyntaxError) {
            console.log('getting weird syntax error here... not sure what to do about it but it seems to be working fine', error)
        } else {
            // Log other types of errors
            console.error("Error adding track to liked songs:", error);
        }
    }
}

export async function removeTrackFromLikedSongs(trackUri: string) {
    await Spicetify.CosmosAsync.del(`https://api.spotify.com/v1/me/tracks`, { ids: [trackUri] });
}

export async function addTrackToPlaylist(playlistUri: string, trackUri: string) {
    const playlistId = playlistUri.split(":").pop(); // Extract the playlist ID from the URI

    const body = {
        uris: [trackUri],
    };

    try {
        await Spicetify.CosmosAsync.post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, body);
    } catch (error) {
        console.error("Error adding track to playlist:", error);
    }
}

export async function removeTrackFromPlaylist(playlistUri: string, trackUri: string) {
    const playlistId = playlistUri.split(":").pop(); // Extract the playlist ID from the URI

    const body = {
        tracks: [{ uri: trackUri }],
    };

    try {
        await Spicetify.CosmosAsync.del(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, body);
    } catch (error) {
        console.error("Error removing track from playlist:", error);
    }
}

export async function getPlaylistItems(uri: string) {
    const result = await Spicetify.CosmosAsync.get(`sp://core-playlist/v1/playlist/${uri}`);
    return result.items;
}

export async function isAppLaterThan(specifiedVersion: string) {
    let appInfo = await Spicetify.CosmosAsync.get("sp://desktop/v1/version");
    let result = appInfo.version.localeCompare(specifiedVersion, undefined, { numeric: true, sensitivity: "base" });
    return result === 1;
}

export async function moveTracksBefore(playlistUri: string, trackUids, beforeUid: string) {
    const isV2 = await isAppLaterThan("1.2.5.1006.g22820f93");
    await Spicetify.CosmosAsync.put(`https://api.spotify.com/v1/playlists/${playlistUri}/tracks`, {
        uris: trackUids.map((uid) => ({ uid: uid })),
        before: isV2 ? { uid: beforeUid } : beforeUid,
    });
}

export async function moveTracksAfter(playlistUri: string, trackUids, afterUid: string) {
    const isV2 = await isAppLaterThan("1.2.5.1006.g22820f93");
    await Spicetify.CosmosAsync.put(`https://api.spotify.com/v1/playlists/${playlistUri}/tracks`, {
        uris: trackUids.map((uid) => ({ uid: uid })),
        after: isV2 ? { uid: afterUid } : afterUid,
    });
}
