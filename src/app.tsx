import * as api from "./api";
import { createStars, setRating, getMouseoverRating, findStars } from "./stars";
import { getSettings, saveSettings, getPlaylistUris, savePlaylistUris, getRatedFolderUri, saveRatedFolderUri } from "./settings";
import { Settings } from "./settings-ui";
import { SortModal } from "./sort-modal";
import {
    findFolderByName,
    findFolderByUri,
    addPlaylistUris,
    removePlaylistUris,
    getAllPlaylistItems,
    getRatingsByTrack,
    getPlaylistNames,
    getAlbumRating,
    sortPlaylistByRating,
} from "./ratings";
import { PlaylistUris, Ratings } from "./types/store";
import { tracklistColumnCss } from "./css/css";
import { getTracklistTrackUri, isAlbumPage, trackUriToTrackId, getNowPlayingHeart, getNowPlayingTrackUri } from "./utils/utils";

let settings = null;

let ratedFolderUri: string | null = null;
let ratings: Ratings = {};
let playlistNames = {};
let playlistUris: PlaylistUris = {};

let originalTracklistHeaderCss = null;
let originalTracklistTrackCss = null;
let oldMainElement = null;
let mainElement = null;
let mainElementObserver = null;
let tracklists: HTMLCollectionOf<Element> = [];
let oldTracklists = [];

let oldNowPlayingWidget = null;
let nowPlayingWidget = null;

let oldPlayButton = null;
let playButton = null;

let albumId = null;
let album = null;
let albumStarData = null;
let nowPlayingWidgetStarData = null;

let clickListenerRunning = false;
let ratingsLoading = false;
let isSorting = false;

function updateAlbumRating() {
    const averageRating = getAlbumRating(ratings, album);

    setRating(albumStarData[1], averageRating);
}

async function handleRemoveRating(trackUri: string, rating: number) {
    delete ratings[trackUri];
    const ratingAsString = rating.toFixed(1);
    const playlistUri = playlistUris[ratingAsString];
    const playlistName = playlistNames[playlistUri];
    await api.removeTrackFromPlaylist(playlistUri, trackUri);
    api.showNotification(`Removed from ${playlistName}`);
}

async function handleSetRating(trackUri: string, oldRating: string | undefined, newRating: string) {
    // Update the rating in the ratings object
    ratings[trackUri] = newRating;

    // If there was a previous rating, remove the track from the old playlist
    if (oldRating) {
        const oldRatingAsString = oldRating;
        const playlistUri = playlistUris[oldRatingAsString];
        await api.removeTrackFromPlaylist(playlistUri, trackUri);
    }

    // Create a 'Rated' folder if it doesn't exist
    if (!ratedFolderUri) {
        await api.createFolder("Rated");
        const contents = await api.getContents();
        const ratedFolder = findFolderByName(contents, "Rated");
        ratedFolderUri = ratedFolder.uri;
        saveRatedFolderUri(ratedFolderUri);
    }

    // Convert the new rating to string format with one decimal place
    let playlistUri = playlistUris[newRating];

    // If the Rated playlist for the new rating doesn't exist, create it
    if (!playlistUri) {
        playlistUri = await api.createPlaylist(newRating, ratedFolderUri);
        await api.makePlaylistPrivate(playlistUri);
        playlistUris[newRating] = playlistUri;
        savePlaylistUris(playlistUris);
        playlistNames[playlistUri] = newRating;
    }

    // Add the track to the playlist for the new rating
    await api.addTrackToPlaylist(playlistUri, trackUri);

    // Get the name of the playlist and show a notification indicating the action
    const playlistName = playlistNames[playlistUri];
    api.showNotification((oldRating ? "Moved" : "Added") + ` to ${playlistName}`);
}

function getClickListener(i, ratingOverride, starData, getTrackUri, getHeart) {
    return () => {
        if (clickListenerRunning || ratingsLoading || isSorting) return;
        clickListenerRunning = true;
        const [stars, starElements] = starData;
        const star = starElements[i][0];
        const trackUri: string = getTrackUri();
        const oldRating = ratings[trackUri];
        let newRating: string = ratingOverride !== null ? ratingOverride : getMouseoverRating(settings, star, i).toFixed(1);

        let promise = null;
        let displayRating = null;

        if (oldRating === newRating) {
            displayRating = 0.0;
            promise = handleRemoveRating(trackUri, newRating);
        } else {
            displayRating = newRating;
            promise = handleSetRating(trackUri, oldRating, newRating);

            // Like the track if it's rated above the like threshold
            if (settings.likeThreshold !== "disabled") {
                if (newRating >= parseFloat(settings.likeThreshold)) api.addTrackToLikedSongs(trackUri);
            }
        }

        promise.finally(() => {
            let tracklistStarData = findStars(trackUriToTrackId(trackUri));
            if (tracklistStarData) {
                setRating(tracklistStarData[1], displayRating);
                tracklistStarData[0].style.visibility = oldRating === newRating ? "hidden" : "visible";
            }

            updateNowPlayingWidget();

            clickListenerRunning = false;
        });
    };
}

function getRegisterKeyboardShortcuts(keys) {
    return () => {
        for (const [rating, key] of Object.entries(keys)) {
            Spicetify.Keyboard.registerShortcut(
                {
                    key: key,
                    ctrl: true,
                    alt: true,
                },
                getClickListener(0, parseFloat(rating), nowPlayingWidgetStarData, getNowPlayingTrackUri, getNowPlayingHeart),
            );
        }
    };
}

function getDeregisterKeyboardShortcuts(keys) {
    return () => {
        for (const key of Object.values(keys)) {
            Spicetify.Keyboard._deregisterShortcut({
                key: key,
                ctrl: true,
                alt: true,
            });
        }
    };
}

function addStarsListeners(starData, getTrackUri, getHeart) {
    function getCurrentRating(trackUri: string) {
        return ratings[trackUri] ?? 0.0;
    }

    const [stars, starElements] = starData;

    stars.addEventListener("mouseout", function () {
        setRating(starElements, getCurrentRating(getTrackUri()));
    });

    for (let i = 0; i < 5; i++) {
        const star = starElements[i][0];

        star.addEventListener("mousemove", function () {
            const rating = getMouseoverRating(settings, star, i);
            setRating(starElements, rating);
        });

        star.addEventListener("click", getClickListener(i, null, starData, getTrackUri, getHeart));
    }
}

function restoreTracklist() {
    const tracklistHeaders = document.querySelectorAll(".main-trackList-trackListHeaderRow");
    tracklistHeaders.forEach((tracklistHeader) => {
        tracklistHeader.style["grid-template-columns"] = originalTracklistHeaderCss;
    });

    for (const tracklist of Array.from(tracklists)) {
        const tracks = tracklist.getElementsByClassName("main-trackList-trackListRow");
        for (const track of Array.from(tracks)) {
            let ratingColumn = track.querySelector(".starRatings");
            if (!ratingColumn) continue;
            track.style["grid-template-columns"] = originalTracklistTrackCss;
            ratingColumn.remove();
            let lastColumn = track.querySelector(".main-trackList-rowSectionEnd");
            let colIndexInt = parseInt(lastColumn.getAttribute("aria-colindex"));
            lastColumn.setAttribute("aria-colindex", (colIndexInt - 1).toString());
        }
    }
}

function updateTracklist() {
    // Check if showing playlist stars is enabled
    if (!settings.showPlaylistStars) return;

    // Store current tracklists as oldTracklists
    oldTracklists = tracklists;
    // Update tracklists
    tracklists = Array.from(document.querySelectorAll(".main-trackList-indexable"));
    // Check if tracklists have changed
    let tracklistsChanged = tracklists.length !== oldTracklists.length;

    // Check if individual tracklists have changed
    for (let i = 0; i < tracklists.length; i++) {
        if (!tracklists[i].isEqualNode(oldTracklists[i])) tracklistsChanged = true;
    }

    // Reset CSS if tracklists have changed
    if (tracklistsChanged) {
        originalTracklistHeaderCss = null;
        originalTracklistTrackCss = null;
    }

    // Define CSS for different tracklist columns

    createStarsForTracklists(tracklists);
}

function createStarsForTracklists(tracklists: HTMLCollectionOf<Element>) {
    // Store new tracklist header CSS
    let newTracklistHeaderCss = null;
    const tracklistHeaders = document.querySelectorAll(".main-trackList-trackListHeaderRow");
    // No tracklist header on Artist page
    tracklistHeaders.forEach((tracklistHeader) => {
        let lastColumn = tracklistHeader.querySelector(".main-trackList-rowSectionEnd");
        let colIndexInt = parseInt(lastColumn.getAttribute("aria-colindex"));

        // Set tracklist header CSS based on column index
        if (!originalTracklistHeaderCss) originalTracklistHeaderCss = getComputedStyle(tracklistHeader).gridTemplateColumns;
        if (originalTracklistHeaderCss && tracklistColumnCss[colIndexInt]) {
            tracklistHeader.style["grid-template-columns"] = tracklistColumnCss[colIndexInt];
            newTracklistHeaderCss = tracklistColumnCss[colIndexInt];
        }
    });

    // Iterate through each tracklist
    for (const tracklist of tracklists) {
        const tracks = tracklist.getElementsByClassName("main-trackList-trackListRow");
        // Iterate through each track
        for (const track of tracks) {
            // Function to get heart element of the track
            const getHeart = () => {
                return (
                    track.getElementsByClassName("main-addButton-button")[0] ??
                    track.querySelector(".main-trackList-rowHeartButton") ??
                    track.querySelector("button[class*='buttonTertiary-iconOnly']") ??
                    track.querySelector("button[aria-label='Add to playlist']")
                );
            };
            const hasStars = track.getElementsByClassName("stars").length > 0;
            const trackUri = getTracklistTrackUri(track);
            const isTrack = trackUri.includes("track");

            let ratingColumn = track.querySelector(".starRatings");
            // Add column for stars if not already present
            if (!ratingColumn) {
                let lastColumn = track.querySelector(".main-trackList-rowSectionEnd");
                let colIndexInt = parseInt(lastColumn.getAttribute("aria-colindex"));

                lastColumn.setAttribute("aria-colindex", (colIndexInt + 1).toString());
                ratingColumn = document.createElement("div");
                ratingColumn.setAttribute("aria-colindex", colIndexInt.toString());
                ratingColumn.role = "gridcell";
                ratingColumn.style.display = "flex";
                ratingColumn.classList.add("main-trackList-rowSectionVariable");
                ratingColumn.classList.add("starRatings");
                track.insertBefore(ratingColumn, lastColumn);

                if (!originalTracklistTrackCss) originalTracklistTrackCss = getComputedStyle(track).gridTemplateColumns;
                if (tracklistColumnCss[colIndexInt])
                    track.style["grid-template-columns"] = newTracklistHeaderCss ? newTracklistHeaderCss : tracklistColumnCss[colIndexInt];
            }

            // Continue to the next track if no heart, no track URI, has stars already, or not a track
            if (!trackUri || hasStars || !isTrack) continue;

            // Create stars for the track and set its rating
            const starData = createStars(trackUriToTrackId(trackUri), 16);
            const stars = starData[0];
            const starElements = starData[1];
            const currentRating = ratings[trackUri] ?? 0.0;

            // Append stars to rating column and set listeners
            ratingColumn.appendChild(stars);
            setRating(starElements, currentRating);
            addStarsListeners(
                starData,
                () => {
                    return trackUri;
                },
                getHeart,
            );

            // Set visibility of stars based on rating
            stars.style.visibility = typeof ratings[trackUri] !== "undefined" ? "visible" : "hidden";

            // Add listeners for hovering over a track in the tracklist
            track.addEventListener("mouseover", () => {
                stars.style.visibility = "visible";
            });

            track.addEventListener("mouseout", () => {
                stars.style.visibility = typeof ratings[trackUri] !== "undefined" ? "visible" : "hidden";
            });
        }
    }
}

function onClickShowPlaylistStars() {
    if (settings.showPlaylistStars) updateTracklist();
    else restoreTracklist();
}

async function observerCallback(keys) {
    oldMainElement = mainElement;
    mainElement = document.querySelector("main");
    if (mainElement && !mainElement.isEqualNode(oldMainElement)) {
        if (oldMainElement) {
            mainElementObserver.disconnect();
        }
        updateTracklist();
        mainElementObserver.observe(mainElement, {
            childList: true,
            subtree: true,
        });
    }

    oldNowPlayingWidget = nowPlayingWidget;
    let selector =
        settings.nowPlayingStarsPosition === "left" ? ".main-nowPlayingWidget-nowPlaying .main-trackInfo-container" : ".main-nowPlayingBar-right div";
    nowPlayingWidget = document.querySelector(selector);
    if (nowPlayingWidget && !nowPlayingWidget.isEqualNode(oldNowPlayingWidget)) {
        nowPlayingWidgetStarData = createStars("now-playing", 16);
        nowPlayingWidgetStarData[0].style.marginLeft = "8px";
        nowPlayingWidgetStarData[0].style.marginRight = "8px";
        if (settings.nowPlayingStarsPosition === "left") nowPlayingWidget.after(nowPlayingWidgetStarData[0]);
        else nowPlayingWidget.prepend(nowPlayingWidgetStarData[0]);
        addStarsListeners(nowPlayingWidgetStarData, getNowPlayingTrackUri, getNowPlayingHeart);
        updateNowPlayingWidget();
        if (settings.enableKeyboardShortcuts) {
            getRegisterKeyboardShortcuts(keys)();
        }
    }

    oldPlayButton = playButton;

    // get album play button in order to add stars to the right of it
    playButton = document.querySelector(".main-actionBar-ActionBar .ix_8kg3iUb9VS5SmTnBY");
    if (playButton && !playButton.isEqualNode(oldPlayButton) && isAlbumPage() !== null) {
        albumStarData = createStars("album", 32);
        playButton.after(albumStarData[0]);
        await updateAlbumStars();
    }
}

async function updateAlbumStars() {
    if (!albumStarData) return;

    albumId = isAlbumPage();
    albumStarData[0].style.display = albumId ? "flex" : "none";

    if (!albumId) return;

    album = await api.getAlbum(`spotify:album:${albumId}`);
    updateAlbumRating();
}

function updateNowPlayingWidget() {
    if (!nowPlayingWidgetStarData) return;

    function getTrackUri(): string {
        return Spicetify.Player.data.item.uri;
    };
    const trackUri = getTrackUri();
    const isTrack = trackUri.includes("track");

    nowPlayingWidgetStarData[0].style.display = isTrack ? "flex" : "none";

    const currentRating = ratings[trackUri] ?? 0.0;
    setRating(nowPlayingWidgetStarData[1], currentRating);
}

function shouldAddContextMenuOnFolders(uri) {
    let uriObj = Spicetify.URI.fromString(uri[0]);
    return uriObj.type === Spicetify.URI.Type.FOLDER;
}

function shouldAddContextMenuOnPlaylists(uri) {
    let uriObj = Spicetify.URI.fromString(uri[0]);
    switch (uriObj.type) {
        case Spicetify.URI.Type.PLAYLIST:
        case Spicetify.URI.Type.PLAYLIST_V2:
            return true;
    }
    return false;
}

async function loadRatings() {
    ratedFolderUri = getRatedFolderUri();
    ratings = {};
    playlistNames = {};
    playlistUris = getPlaylistUris();
    let ratedFolder = null;

    if (ratedFolderUri) {
        const contents = await api.getContents();
        ratedFolder = findFolderByUri(contents, ratedFolderUri);
    } else {
        // TODO: Remove after next release
        const contents = await api.getContents();
        ratedFolder = findFolderByName(contents, "Rated");
        if (ratedFolder) {
            ratedFolderUri = ratedFolder.uri;
            saveRatedFolderUri(ratedFolderUri);
        }
    }

    if (ratedFolder) {
        // Remove any playlist URIs associated with the rated folder
        let playlistUrisRemoved = false;
        [playlistUrisRemoved, playlistUris] = removePlaylistUris(playlistUris, ratedFolder);

        // Add any new playlist URIs associated with the rated folder
        let playlistUrisAdded = false;
        [playlistUrisAdded, playlistUris] = addPlaylistUris(playlistUris, ratedFolder);

        // If any playlist URIs were added or removed, save the updated list
        if (playlistUrisAdded || playlistUrisRemoved) savePlaylistUris(playlistUris);

        const allPlaylistItems = await getAllPlaylistItems(playlistUris);
        ratings = getRatingsByTrack(allPlaylistItems);

        playlistNames = getPlaylistNames(playlistUris, ratedFolder);
    } else if (Object.keys(playlistUris).length > 0) {
        playlistUris = {};
        savePlaylistUris(playlistUris);
        ratedFolderUri = "";
        saveRatedFolderUri(ratedFolderUri);
    }
}

async function main() {
    while (!Spicetify?.showNotification) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    settings = getSettings();
    saveSettings(settings);

    await loadRatings();

    const keys = {
        "5.0": Spicetify.Keyboard.KEYS.NUMPAD_0,
        "0.5": Spicetify.Keyboard.KEYS.NUMPAD_1,
        "1.0": Spicetify.Keyboard.KEYS.NUMPAD_2,
        "1.5": Spicetify.Keyboard.KEYS.NUMPAD_3,
        "2.0": Spicetify.Keyboard.KEYS.NUMPAD_4,
        "2.5": Spicetify.Keyboard.KEYS.NUMPAD_5,
        "3.0": Spicetify.Keyboard.KEYS.NUMPAD_6,
        "3.5": Spicetify.Keyboard.KEYS.NUMPAD_7,
        "4.0": Spicetify.Keyboard.KEYS.NUMPAD_8,
        "4.5": Spicetify.Keyboard.KEYS.NUMPAD_9,
    };

    const registerKeyboardShortcuts = getRegisterKeyboardShortcuts(keys);
    const deregisterKeyboardShortcuts = getDeregisterKeyboardShortcuts(keys);
    const redrawNowPlayingStars = () => {
        if (nowPlayingWidgetStarData) nowPlayingWidgetStarData[0].remove();
        nowPlayingWidget = null;
        observerCallback(keys);
    };

    new Spicetify.Menu.Item("Star Ratings", true, () => {
        Spicetify.PopupModal.display({
            title: "Star Ratings",
            content: Settings({
                settings,
                registerKeyboardShortcuts,
                deregisterKeyboardShortcuts,
                updateTracklist,
                restoreTracklist,
                redrawNowPlayingStars,
            }),
            isLarge: true,
        });
    }).register();

    mainElementObserver = new MutationObserver(() => {
        updateTracklist();
    });

    Spicetify.Player.addEventListener("songchange", () => {
        const trackUri = Spicetify.Player.data.item.uri;
        if (trackUri in ratings && settings.skipThreshold !== "disabled" && ratings[trackUri] <= parseFloat(settings.skipThreshold)) {
            Spicetify.Player.next();
            return;
        }

        updateNowPlayingWidget();
    });

    Spicetify.Platform.History.listen(async () => {
        await updateAlbumStars();
    });

    new Spicetify.ContextMenu.Item(
        "Use as Rated folder",
        (uri) => {
            ratedFolderUri = uri[0];
            saveRatedFolderUri(ratedFolderUri);
            ratingsLoading = true;
            loadRatings().finally(() => {
                ratingsLoading = false;
            });
        },
        shouldAddContextMenuOnFolders,
    ).register();

    new Spicetify.ContextMenu.Item(
        "Sort by rating",
        (uri) => {
            Spicetify.PopupModal.display({
                title: "Modify Custom order?",
                content: SortModal({
                    onClickCancel: () => {
                        Spicetify.PopupModal.hide();
                    },
                    onClickOK: () => {
                        Spicetify.PopupModal.hide();
                        isSorting = true;
                        api.showNotification("Sorting...");
                        sortPlaylistByRating(uri[0], ratings).finally(() => {
                            isSorting = false;
                        });
                    },
                }),
            });
        },
        shouldAddContextMenuOnPlaylists,
    ).register();

    const observer = new MutationObserver(async () => {
        await observerCallback(keys);
    });
    await observerCallback(keys);
    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

export default main;
