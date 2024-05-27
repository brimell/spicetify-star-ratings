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
    const options = navigator.platform.startsWith("Linux") && navigator.userAgent.includes("Spotify/1.1.84.716") 
        ? { after: folderUri } 
        : { after: { uri: folderUri } };
        
    return await Spicetify.CosmosAsync.post(`https://api.spotify.com/v1/users/${Spicetify.User.getUsername()}/playlists`, {
        name: name,
        ...options
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
        limit: 450
    };

    return await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/albums/${uri}`, query);
}

export async function getContents() {
    return await Spicetify.Platform.RootlistAPI.getContents();
}

export async function addTrackToLikedSongs(trackUri: string) {
    const isLiked = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/me/tracks/contains?ids=${trackUri}`);
    if (isLiked[0]) {
        return;
    }
    
    await Spicetify.CosmosAsync.put(`https://api.spotify.com/v1/me/tracks`, { ids: [trackUri] });
}

export async function removeTrackFromLikedSongs(trackUri: string) {
    await Spicetify.CosmosAsync.del(`https://api.spotify.com/v1/me/tracks`, { ids: [trackUri] });
}

export async function addTrackToPlaylist(playlistUri: string, trackUri: string) {
    await Spicetify.CosmosAsync.post(`https://api.spotify.com/v1/playlists/${playlistUri}/tracks`, { uris: [trackUri], position: 0 });
}

export async function removeTrackFromPlaylist(playlistUri: string, trackUri: string) {
    await Spicetify.CosmosAsync.del(`https://api.spotify.com/v1/playlists/${playlistUri}/tracks`, { tracks: [{ uri: trackUri }] });
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
        before: isV2 ? { uid: beforeUid } : beforeUid
    });
}

export async function moveTracksAfter(playlistUri: string, trackUids, afterUid: string) {
    const isV2 = await isAppLaterThan("1.2.5.1006.g22820f93");
    await Spicetify.CosmosAsync.put(`https://api.spotify.com/v1/playlists/${playlistUri}/tracks`, {
        uris: trackUids.map((uid) => ({ uid: uid })),
        after: isV2 ? { uid: afterUid } : afterUid
    });
}
