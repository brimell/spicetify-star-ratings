import { PlaylistUris } from "./types/store";
import { parseRatingPlaylistName } from "./ratings";
import { toRatingString } from "./stars";
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
     * @param rating  The numeric rating this playlist should count for (e.g. 4.5).
     * @param version 0-based slot index within that rating's playlist array.
     *                0 = base playlist, 1 = first spillover, etc.
     */
    onClickSave: (rating: number, version: number) => void;
}

// All half-step ratings the plugin supports.
const HALF_RATINGS: number[] = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];

export function RatingPlaylistModal({ playlistName, currentPlaylistUris, onClickCancel, onClickSave }: RatingPlaylistModalProps) {
    // Try to pre-fill from the playlist's current name.
    const parsed = parseRatingPlaylistName(playlistName);
    // parseRatingPlaylistName version is 1-based; UI uses 0-based.
    const defaultRating: number = parsed?.rating ?? 5.0;
    const defaultVersion = parsed ? parsed.version - 1 : 0;

    // Keep rating as a number; version as string because it comes from a text input.
    const [rating, setRating] = React.useState<number>(defaultRating);
    const [versionStr, setVersionStr] = React.useState(String(defaultVersion));

    const version = parseInt(versionStr, 10);
    const versionValid = !isNaN(version) && version >= 0;
    // A slot is occupied when it already holds a playlist URI.
    const isOccupied = versionValid && (currentPlaylistUris[rating] ?? [])[version] != null;

    function handleSave() {
        if (!versionValid) {
            Spicetify.showNotification("Please enter a valid version number (0 or higher).");
            return;
        }
        if (isOccupied) {
            Spicetify.showNotification(`Position ${version} for rating ${toRatingString(rating)} is already occupied.`);
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
                    min={nextFreeSlot}
                    value={versionStr}
                    onChange={(e) => setVersionStr((e.target as HTMLInputElement).value)}
                />
                <p className="rating-playlist-modal-hint">
                    <b>0</b> = base playlist, <b>1,2,etc</b> = first/second/etc spillover playlist.{" "}
                    {`Next free slot for ${toRatingString(rating)}: ${nextFreeSlot}.`}
                </p>
                {isOccupied && (
                    <p className="rating-playlist-modal-error">Error: position {version} is already occupied — choose a different slot.</p>
                )}
            </div>

            <div className="rating-playlist-modal-buttons">
                <button className="rating-playlist-modal-cancel" onClick={onClickCancel}>
                    Cancel
                </button>
                <button className="rating-playlist-modal-save" onClick={handleSave} disabled={isOccupied}>
                    Save
                </button>
            </div>
        </div>
    );
}
