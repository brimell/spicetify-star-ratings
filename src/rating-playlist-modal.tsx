import { PlaylistUris } from "./types/store";
import { parseRatingPlaylistName } from "./ratings";
import "./rating-playlist-modal.css";

const React = Spicetify.React;

interface RatingPlaylistModalProps {
    /** Display name of the playlist being registered. */
    playlistName: string;
    /** Current state of all registered rating→URI mappings. */
    currentPlaylistUris: PlaylistUris;
    onClickCancel: () => void;
    /**
     * Called when the user clicks Save.
     * @param rating  The rating string this playlist should count for (e.g. "4.5").
     * @param version 0-based slot index within that rating's playlist array.
     *                0 = base playlist, 1 = first spillover, etc.
     */
    onClickSave: (rating: string, version: number) => void;
}

export function RatingPlaylistModal({ playlistName, currentPlaylistUris, onClickCancel, onClickSave }: RatingPlaylistModalProps) {
    // Try to pre-fill from the playlist's current name.
    const parsed = parseRatingPlaylistName(playlistName);
    const defaultRating = parsed?.rating ?? "2.5";
    const defaultVersion = parsed ? parsed.version - 1 : 0;

    const [rating, setRating] = React.useState(defaultRating);
    const [versionStr, setVersionStr] = React.useState(String(defaultVersion));

    function handleSave() {
        const version = parseInt(versionStr, 10);
        if (isNaN(version) || version < 0) {
            Spicetify.showNotification("Please enter a valid version number (0 or higher).");
            return;
        }
        onClickSave(rating, version);
    }

    // Suggest the next free slot for the currently selected rating.
    const nextFreeSlot = (currentPlaylistUris[rating] ?? []).length;

    return (
        <div className="rating-playlist-modal">
            <p className="rating-playlist-modal-description">
                Mark <b>{playlistName}</b> as a rating playlist.
            </p>

            <div className="rating-playlist-modal-field">
                <label htmlFor="rpm-rating">Rating</label>
                <input id="rpm-rating" type="number" min={0} value={rating} onChange={(e) => setRating((e.target as HTMLSelectElement).value)} />
            </div>

            <div className="rating-playlist-modal-field">
                <label htmlFor="rpm-version">Spillover version</label>
                <input
                    id="rpm-version"
                    type="number"
                    min={0}
                    value={versionStr}
                    onChange={(e) => setVersionStr((e.target as HTMLInputElement).value)}
                />
                <p className="rating-playlist-modal-hint">
                    <b>0</b> = base playlist, <b>1,2,etc.</b> = first/second/etc. spillover playlsit
                    {` Next free slot for "${rating}": ${nextFreeSlot}.`}
                </p>
            </div>

            <div className="rating-playlist-modal-buttons">
                <button className="rating-playlist-modal-cancel" onClick={onClickCancel}>
                    Cancel
                </button>
                <button className="rating-playlist-modal-save" onClick={handleSave}>
                    Save
                </button>
            </div>
        </div>
    );
}
