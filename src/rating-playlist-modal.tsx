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

export function RatingPlaylistModal({ playlistName, currentPlaylistUris, onClickCancel, onClickSave }: RatingPlaylistModalProps) {
    const parsed = parseRatingPlaylistName(playlistName);

    const defaultRating: number = parsed?.rating ?? 5.0;
    const [rating, setRating] = React.useState<number>(defaultRating);

    const nextFreeSlot = (currentPlaylistUris[rating] ?? []).length;
    const [version, setVersion] = React.useState<number>(nextFreeSlot);

    const isOccupied = (currentPlaylistUris[rating] ?? [])[version] != null;

    function handleSave() {
        if (isOccupied) {
            Spicetify.showNotification(`Position ${version} for rating ${toRatingString(rating)} is already occupied.`);
            return;
        }
        onClickSave(rating, version);
    }

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
                <input id="rpm-version" type="number" min={0} value={version} onChange={(e) => setVersion((e.target as HTMLInputElement).value)} />
                <p className="rating-playlist-modal-hint">
                    <b>0</b> = base playlist, <b>1,2,etc</b> = first/second/etc spillover playlist.{" "}
                    {`Next free slot for ${toRatingString(rating)}: ${nextFreeSlot}.`}
                </p>
                {isOccupied && (
                    <p className="rating-playlist-modal-error">Version {version} is already occupied. Please choose a different version.</p>
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
