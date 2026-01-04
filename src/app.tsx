import * as api from "./api";
import { createStars, setRating, getMouseoverRating, findStars } from "./stars";
import { Settings, getSettings, saveSettings, getPlaylistUris, savePlaylistUris, getRatedFolderUri, saveRatedFolderUri } from "./settings";
import { Settings as SettingsUi } from "./settings-ui";
import { SortModal } from "./sort-modal";
import { WeightedPlaylistModal } from "./weighted-playlist-modal";
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
import { PlaylistUris, Ratings, TimestampedRating } from "./types/store";
import { tracklistColumnCss } from "./css/css";
import {
    getTracklistTrackUri,
    isAlbumPage,
    trackUriToTrackId,
    getNowPlayingTrackUri,
    weightedPlaybackEnabled,
    setWeightedPlaybackEnabled,
} from "./utils/utils";

export let settings: Settings | null = null;

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

const PLAYLIST_SIZE_LIMIT = 8000; // Maximum tracks per playlist

interface PlaylistItems {
    length: number;
}

export function getTrackRating(trackUri: string): number | null {
    const rating = ratings[trackUri];

    if (rating && rating.length > 0) {
        // Time-weighted average with half-life of 6 months
        const HALF_LIFE_MS = 6 * (365.25 / 12) * 24 * 60 * 60 * 1000;

        let weightedSum = 0;
        let weightSum = 0;

        for (const { rating: valueStr, time } of rating) {
            const value = parseFloat(valueStr);

            const deltaMs = new Date().getTime() - time.getTime();

            const weight = Math.pow(0.5, deltaMs / HALF_LIFE_MS);

            weightedSum += value * weight;
            weightSum += weight;
        }

        return weightedSum / weightSum;
    } else {
        return null;
    }
}

export function getTrackRatingOrDefault(trackUri: string): number {
    return getTrackRating(trackUri) ?? parseFloat(settings.defaultRating);
}

// --- weighted playback ---

function getTrackWeight(trackUri: string): number {
    const rating = getTrackRatingOrDefault(trackUri);
    switch (settings.ratingToWeight.kind) {
        case "Linear":
            return rating;
        case "Exponential":
            return Math.pow(settings.ratingToWeight.base, rating);

        // Make the switch exhaustive at compile time
        default: {
            const _exhaustive: never = settings.ratingToWeight;
            return _exhaustive;
        }
    }
}

function selectWeightedRandomTrack(): Promise<string | null> {
    return new Promise(async (resolve) => {
        try {
            // Get current context (playlist, album, etc.)
            const currentContext = Spicetify.Player?.data?.context || Spicetify.Player?.data?.item?.context || null;

            if (!currentContext || !currentContext.uri) {
                resolve(null);
                return;
            }

            let availableTracks = [];

            if (currentContext.uri.includes("playlist")) {
                // Get tracks from current playlist
                const playlistUri = currentContext.uri;
                availableTracks = await api.getPlaylistItems(playlistUri);
            } else if (currentContext.uri.includes("album")) {
                // Get tracks from current album
                const albumId = currentContext.uri.split(":").pop();
                const album = await api.getAlbum(albumId);
                availableTracks = album.tracks.items.map((track) => ({
                    uri: track.uri,
                    link: track.uri,
                }));
            } else if (currentContext.uri.includes("collection")) {
                availableTracks = await api.getLikedSongsTracks();
            } else {
                resolve(null);
                return;
            }

            const availableTrackLinks = availableTracks.map((track) => track.link ?? track.uri);

            if (availableTrackLinks.length === 0) {
                resolve(null);
                return;
            }

            // Filter out tracks that are already in queue or currently playing
            const currentTrackUri = Spicetify.Player.data.item?.uri;
            const queuedTracks = getQueuedTracks();

            const eligibleTracks = availableTrackLinks.filter(
                (track) => track !== currentTrackUri && !queuedTracks.some((queued) => queued.uri === track),
            );

            if (eligibleTracks.length === 0) {
                resolve(null);
                return;
            }

            // Calculate weights and perform weighted random selection
            const weights = eligibleTracks.map((track) => getTrackWeight(track));
            const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

            if (totalWeight <= 0) {
                resolve(null);
                return;
            }

            let randomValue = Math.random() * totalWeight;
            for (let i = 0; i < eligibleTracks.length; i++) {
                randomValue -= weights[i];
                if (randomValue <= 0) {
                    resolve(eligibleTracks[i]);
                    return;
                }
            }

            resolve(eligibleTracks[eligibleTracks.length - 1]);
        } catch (error) {
            console.error("Error in weighted track selection:", error);
            resolve(null);
        }
    });
}

function getQueuedTracks(): Array<{ uri: string }> {
    try {
        return Spicetify.Queue.nextTracks
            .filter((track) => track.provider === "queue")
            .map((track) => ({
                uri: track.contextTrack.uri,
            }));
    } catch (e) {
        console.log("Failed to get queued tracks:", e);
        return [];
    }
}

async function addWeightedTrackToQueue(): Promise<boolean> {
    if (!weightedPlaybackEnabled()) return false;

    try {
        const trackUri = await selectWeightedRandomTrack();
        if (!trackUri) return false;

        await Spicetify.addToQueue([{ uri: trackUri }]);

        // ensure track was actually enqueued, work-around for an issue with remote play
        if (settings.reEnqueueWorkaround) {
            await new Promise((r) => setTimeout(r, 1000)); // anything significantly shorter than 1s doesn't seem to work
            if (
                !getQueuedTracks()
                    .map((track) => track.uri)
                    .includes(trackUri)
            ) {
                console.log("Re-enqueueing after 1s:", trackUri);
                await Spicetify.addToQueue([{ uri: trackUri }]);
            }
        }

        return true;
    } catch (error) {
        console.error("Error adding weighted track to queue:", error);
        return false;
    }
}

function shouldAddWeightedTrack(): boolean {
    // Only add weighted tracks if there's no existing queue
    return getQueuedTracks().length == 0;
}

async function weightedLoop() {
    while (true) {
        try {
            if (weightedPlaybackEnabled() && shouldAddWeightedTrack()) {
                await addWeightedTrackToQueue();
            }
        } catch (e) {
            console.error("Weighted loop error:", e);
        }
        let timeout;
        if (settings.reEnqueueWorkaround) {
            timeout = 1500; // avoid interference with re-enqueueing
        } else {
            timeout = 500;
        }
        await new Promise((r) => setTimeout(r, timeout));
    }
}

// --- weighted playlist ---

async function createWeightedShufflePlaylist(originalPlaylistUri: string, trackCount: number): Promise<any> {
    try {
        // Get the original playlist name
        const originalPlaylist = await api.getPlaylist(originalPlaylistUri);
        const originalName = originalPlaylist.name;
        const weightedName = `${originalName} (Weighted ${trackCount})`;

        // Create the new weighted shuffle playlist
        let weightedPlaylist;
        try {
            weightedPlaylist = await api.createPlaylist(weightedName, ratedFolderUri);
        } catch (error) {
            // If playlist already exists, try with a suffix
            let suffix = 1;
            while (suffix <= 100) {
                try {
                    weightedPlaylist = await api.createPlaylist(`${weightedName} (${suffix})`, ratedFolderUri);
                    break;
                } catch (e) {
                    suffix++;
                }
            }
            if (!weightedPlaylist) {
                throw new Error("Unable to create weighted playlist");
            }
        }

        // Get all tracks from the original playlist
        const tracks = await api.getPlaylistItems(originalPlaylistUri);
        if (tracks.length === 0) return weightedPlaylist;

        // Calculate weights for all tracks
        const tracksWithWeights = tracks.map((track) => ({
            uri: track.link ?? track.uri,
            weight: getTrackWeight(track.link ?? track.uri),
        }));

        // Filter out tracks with zero weight (unlikely but possible)
        const validTracks = tracksWithWeights.filter((track) => track.weight > 0);

        if (validTracks.length === 0) {
            throw new Error("No tracks with valid weights found");
        }

        // Select tracks using weighted random selection (same logic as queue)
        const selectedTracks = selectWeightedTracks(validTracks, trackCount);

        if (selectedTracks.length === 0) {
            throw new Error("No tracks could be selected");
        }

        // Add tracks to the weighted playlist in batches
        const batchSize = 50; // Spotify API limit
        for (let i = 0; i < selectedTracks.length; i += batchSize) {
            const batch = selectedTracks.slice(i, i + batchSize);
            const trackUris = batch.map((track) => track.uri);
            await api.addTracksToPlaylist(weightedPlaylist.uri, trackUris);
        }

        return weightedPlaylist;
    } catch (error) {
        console.error("Error creating weighted playlist:", error);
        return null;
    }
}

function selectWeightedTracks(tracks: Array<{ uri: string; weight: number }>, count: number): Array<{ uri: string; weight: number }> {
    const selected: Array<{ uri: string; weight: number }> = [];

    for (let i = 0; i < count; i++) {
        // Calculate total weight of remaining tracks
        const totalWeight = tracks.reduce((sum, track) => sum + track.weight, 0);

        if (totalWeight <= 0) break;

        // Select a random value
        let randomValue = Math.random() * totalWeight;

        // Find the track that corresponds to this random value
        for (const track of tracks) {
            randomValue -= track.weight;
            if (randomValue <= 0) {
                selected.push(track);
                break;
            }
        }
    }

    return selected;
}

function updateAlbumRating() {
    const averageRating = getAlbumRating(ratings, album);

    setRating(albumStarData[1], averageRating, albumStarData[2]);
}

async function handleRemoveRating(trackUri: string, rating: string, uid?: string) {
    const playlistUri = playlistUris[rating];
    const playlistName = playlistNames[playlistUri];
    await api.removeTrackFromPlaylist(playlistUri, trackUri, uid);

    if (uid != null) {
        const index = ratings[trackUri].findIndex((timestampedRating) => timestampedRating.rating === rating && timestampedRating.uid == uid);
        if (index !== -1) {
            ratings[trackUri].splice(index, 1);
        }
        if (ratings[trackUri].length === 0) {
            delete ratings[trackUri];
        }
    } else {
        delete ratings[trackUri];
    }

    api.showNotification(`Removed from ${playlistName}`);
}

async function handleAddRating(trackUri: string, newRating: string) {
    try {
        // Create a 'Rated' folder if it doesn't exist
        if (!ratedFolderUri) {
            await api.createFolder("Rated");
            const contents = await api.getContents();
            const ratedFolder = findFolderByName(contents, "Rated");
            ratedFolderUri = ratedFolder.uri;
            saveRatedFolderUri(ratedFolderUri);
        }

        let playlistUri = playlistUris[newRating];
        let playlistName = newRating;

        // If no playlist exists for this rating, create the first one
        if (!playlistUri) {
            playlistUri = await api.createPlaylist(playlistName, ratedFolderUri);
            await api.makePlaylistPrivate(playlistUri);
            playlistUris[newRating] = playlistUri;
            savePlaylistUris(playlistUris);
            playlistNames[playlistUri] = playlistName;
        } else {
            // Check if current playlist is at capacity
            const items = (await api.getPlaylistItems(playlistUri)) as PlaylistItems;

            if (items.length >= PLAYLIST_SIZE_LIMIT) {
                // Find the next available suffix number
                let suffix = 1;
                let newPlaylistUri;

                while (true) {
                    try {
                        const newPlaylistName = `${newRating}(${suffix})`;
                        newPlaylistUri = await api.createPlaylist(newPlaylistName, ratedFolderUri);
                        await api.makePlaylistPrivate(newPlaylistUri);
                        break;
                    } catch (e) {
                        suffix++;
                        if (suffix > 100) {
                            throw new Error("Unable to create overflow playlist");
                        }
                    }
                }

                // Update playlist mappings
                playlistUri = newPlaylistUri;
                playlistUris[newRating] = newPlaylistUri;
                savePlaylistUris(playlistUris);
                playlistNames[newPlaylistUri] = `${newRating}(${suffix})`;
            }
        }

        // Add the track to the playlist
        await api.addTrackToPlaylist(playlistUri, trackUri);

        // re-fetch ratings to include the newest one and its uid
        const allPlaylistItems = await getAllPlaylistItems(playlistUris);
        ratings = getRatingsByTrack(allPlaylistItems);

        // Show notification
        const displayName = playlistNames[playlistUri];
        api.showNotification(`Added to ${displayName}`);
    } catch (error) {
        console.error("Error in handleAddRating:", error);
        api.showNotification("Error updating rating: " + (error.message || "Unknown error"));
    }
}

function getClickListener(i, ratingOverride, starData, getTrackUri) {
    return () => {
        if (clickListenerRunning || ratingsLoading || isSorting) return;
        clickListenerRunning = true;
        const [stars, starElements] = starData;
        const star = starElements[i][0];
        const trackUri: string = getTrackUri();
        const oldRating = ratings[trackUri];
        let newRating: string = ratingOverride !== null ? ratingOverride : getMouseoverRating(settings, star, i).toFixed(1);

        let removePromise = null;
        let addPromise = null;

        const FIVE_MIN = 5 * 60 * 1000;

        const old = settings.averageRatings ? oldRating?.find((r) => Date.now() - r.time.getTime() <= FIVE_MIN) : oldRating?.[0];

        // remove old rating
        if (old) {
            removePromise = handleRemoveRating(trackUri, old.rating, old.uid);

            // If sync duplicate songs is enabled, remove the rating from all tracks with the same ISRC
            if (settings.syncDuplicateSongs) {
                (async () => {
                    try {
                        const tracksWithSameISRC = await api.getTracksWithSameISRC(trackUri.substring(14));
                        for (const track of tracksWithSameISRC) {
                            const trackUri = track.uri;
                            if (trackUri in ratings) {
                                await handleRemoveRating(trackUri, newRating);
                            }
                        }
                    } catch (error) {
                        console.error(error);
                    }
                })();
            }
        }

        // add new rating
        if (!old || old.rating !== newRating) {
            addPromise = handleAddRating(trackUri, newRating);

            // Like the track if it's rated above the like threshold
            if (settings.likeThreshold !== "disabled" && parseFloat(newRating) >= parseFloat(settings.likeThreshold)) {
                api.addTrackToLikedSongs(trackUri);
            }

            // If sync duplicate songs is enabled, set the rating for all tracks with the same ISRC
            if (settings.syncDuplicateSongs) {
                (async () => {
                    try {
                        const tracksWithSameISRC = await api.getTracksWithSameISRC(trackUri.substring(14));
                        for (const track of tracksWithSameISRC) {
                            const trackUri = track.uri;
                            await handleAddRating(trackUri, newRating);
                        }
                    } catch (error) {
                        console.error(error);
                    }
                })();
            }
        }

        Promise.allSettled([removePromise, addPromise].filter(Boolean)).finally(() => {
            let tracklistStarData = findStars(trackUriToTrackId(trackUri));
            if (tracklistStarData) {
                setRating(tracklistStarData[1], getTrackRating(trackUri), tracklistStarData[2]);
                tracklistStarData[0].style.visibility = !settings.averageRatings && oldRating?.[0]?.rating === newRating ? "hidden" : "visible";
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
                getClickListener(0, parseFloat(rating), nowPlayingWidgetStarData, getNowPlayingTrackUri),
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

function addStarsListeners(starData, getTrackUri) {
    function getCurrentRating(trackUri: string) {
        return getTrackRating(trackUri) ?? 0.0;
    }

    const [stars, starElements, label] = starData;

    stars.addEventListener("mouseout", function () {
        setRating(starElements, getCurrentRating(getTrackUri()), label);
    });

    for (let i = 0; i < 5; i++) {
        const star = starElements[i][0];

        star.addEventListener("mousemove", function () {
            const rating = getMouseoverRating(settings, star, i);
            setRating(starElements, rating, label);
        });

        star.addEventListener("click", getClickListener(i, null, starData, getTrackUri));
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
            const label = starData[2];
            const currentRating = getTrackRating(trackUri) ?? 0.0;

            // Append stars to rating column and set listeners
            ratingColumn.appendChild(stars);
            setRating(starElements, currentRating, label);
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
        addStarsListeners(nowPlayingWidgetStarData, getNowPlayingTrackUri);
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

    // Add weighted shuffle button to player controls
    const shuffleButton =
        document.querySelector('[data-testid="control-button-shuffle"]') || document.querySelector('button[aria-label*="Shuffle" i]');

    if (shuffleButton && !document.querySelector(".weighted-shuffle-button")) {
        const weightedShuffleButton = document.createElement("button");
        weightedShuffleButton.className = "weighted-shuffle-button";
        weightedShuffleButton.style.cssText = `
            margin-left: 8px;
            background: transparent;
            border: 0px solid white;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            color: var(--text-subdued, #6a6a6a);
            font-size: 16px;
            font-weight: bold;
        `;

        weightedShuffleButton.textContent = `W`;

        weightedShuffleButton.title = "Weighted Shuffle";

        function updateButtonStyle() {
            weightedShuffleButton.style.backgroundColor = weightedPlaybackEnabled() ? "var(--background-press, #1db954)" : "transparent";
            weightedShuffleButton.style.borderColor = weightedPlaybackEnabled()
                ? "var(--background-press, #1db954)"
                : "var(--essential-subdued, #878787)";
            weightedShuffleButton.style.color = weightedPlaybackEnabled() ? "#1DB954" : "var(--text-subdued, #6a6a6a)";

            weightedShuffleButton.title = weightedPlaybackEnabled() ? "Disable Weighted Shuffle" : "Enable Weighted Shuffle";
        }

        weightedShuffleButton.addEventListener("click", () => {
            setWeightedPlaybackEnabled(!weightedPlaybackEnabled());
            updateButtonStyle();

            api.showNotification(weightedPlaybackEnabled() ? "Weighted shuffle enabled" : "Weighted shuffle disabled");
        });

        shuffleButton.parentNode.insertBefore(weightedShuffleButton, shuffleButton.nextSibling);

        updateButtonStyle();
    }
}

async function updateAlbumStars() {
    if (!albumStarData) return;

    albumId = isAlbumPage();
    albumStarData[0].style.display = albumId ? "flex" : "none";
    console.log("albumId is:", albumId);

    if (!albumId) return;

    album = await api.getAlbum(albumId);
    updateAlbumRating();
}

function updateNowPlayingWidget() {
    if (!nowPlayingWidgetStarData) return;

    const trackUri = Spicetify.Player.data.item.uri;
    const isTrack = trackUri.includes("track");

    nowPlayingWidgetStarData[0].style.display = isTrack ? "flex" : "none";

    const currentRating = getTrackRating(trackUri) ?? 0.0;
    setRating(nowPlayingWidgetStarData[1], currentRating, nowPlayingWidgetStarData[2]);
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
            content: SettingsUi({
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
        if (trackUri in ratings && settings.skipThreshold !== "disabled" && (getTrackRating(trackUri) ?? 0.0) <= parseFloat(settings.skipThreshold)) {
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

    new Spicetify.ContextMenu.Item(
        "Create weighted Playlist",
        (uri) => {
            const playlistUri = uri[0];
            Spicetify.PopupModal.display({
                title: "Create Weighted Playlist",
                content: Spicetify.React.createElement(WeightedPlaylistModal, {
                    onClickCancel: () => {
                        Spicetify.PopupModal.hide();
                    },
                    onClickCreate: async (trackCount) => {
                        Spicetify.PopupModal.hide();
                        api.showNotification("Creating weighted playlist...");

                        try {
                            const weightedPlaylist = await createWeightedShufflePlaylist(playlistUri, trackCount);
                            if (weightedPlaylist) {
                                api.showNotification(`Weighted Playlist created with ${trackCount} tracks!`);
                            } else {
                                api.showNotification("Failed to create weighted Playlist");
                            }
                        } catch (error) {
                            console.error("Error creating weighted Playlist:", error);
                            api.showNotification("Error creating weighted Playlist");
                        }
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

    weightedLoop();
}

export default main;
