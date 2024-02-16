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

export async function addTrackToPlaylist(playlistUri: string, trackUri: string) {
    await Spicetify.Platform.PlaylistAPI.add(playlistUri, [trackUri]);
}

export async function addTrackToLikedSongs(trackUri: string) {
    const trackId = trackUri.replace("spotify:track:", "");
    // console.log('this',await Spicetify.Platform.LibraryAPI.add())
    await Spicetify.CosmosAsync.put(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`);
}

export async function removeTrackFromPlaylist(playlistUri: string, trackUri: string) {
    console.log(Spicetify.Platform);
    const trackId = trackUri.replace("spotify:track:", "");
    const res = await Spicetify.Platform.PlaylistAPI.remove(playlistUri, [{uri: trackUri}]);
    console.log(res);
}

export async function getPlaylistItems(uri: string) {
    const result = await Spicetify.CosmosAsync.get(`sp://core-playlist/v1/playlist/${uri}`);
    return result.items;
}

// TODO: Remove when Linux gets newer release
export async function isAppLaterThan(specifiedVersion: string) {
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
