export function getTracklistTrackUri(tracklistElement: Element) {
    let values = Object.values(tracklistElement);
    if (!values) return null;
    const searchFrom = values[0]?.pendingProps?.children[0]?.props?.children;
    return (
        searchFrom?.props?.uri ||
        searchFrom?.props?.children?.props?.uri ||
        searchFrom?.props?.children?.props?.children?.props?.uri ||
        searchFrom[0]?.props?.uri
    );
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

export function getNowPlayingHeart() {
    return document.querySelector(".main-nowPlayingWidget-nowPlaying .control-button-heart");
}

export const getNowPlayingTrackUri = () => {
    return Spicetify.Player.data.item.uri;
};
