import "./weighted-playlist-modal.css";

const React = Spicetify.React;

interface WeightedPlaylistModalProps {
    onClickCancel: () => void;
    onClickCreate: (trackCount: number) => void;
}

export function Button({ name, className, onButtonClick }) {
    return (
        <button className={className} onClick={onButtonClick}>
            {name}
        </button>
    );
}

function NumberInput({ value, onChange }) {
    return (
        <div className="weighted-playlist-input-container">
            <input
                type="text"
                value={value}
                onChange={onChange}
                className="weighted-playlist-input"
                placeholder="Enter number of tracks (e.g., 100, 500, 1000)"
            />
        </div>
    );
}

export function WeightedPlaylistModal({ onClickCancel, onClickCreate }: WeightedPlaylistModalProps) {
    const [trackCountInput, setTrackCountInput] = React.useState("10");

    function handleTrackCountChange(value: string) {
        setTrackCountInput(value);
    }

    function handleCreate() {
        const count = parseInt(trackCountInput);
        if (isNaN(count) || count <= 0) {
            alert("Please enter a valid positive number");
            return;
        }
        onClickCreate(count);
    }

    // Generate suggested numbers including larger options
    const suggestedCounts = [10, 25, 50, 100, 250, 500, 1000, 2000, 5000];

    return (
        <div className="weighted-playlist-modal">
            <div className="weighted-playlist-modal-content">
                <h3 className="weighted-playlist-modal-title">Create Weighted Playlist</h3>
                <p className="weighted-playlist-modal-description">
                    Select how many tracks you want in your weighted playlist. Tracks will be chosen randomly, weighted by their rating.
                </p>

                <div className="weighted-playlist-input-section">
                    <label className="weighted-playlist-label">Number of tracks:</label>
                    <NumberInput value={trackCountInput} onChange={handleTrackCountChange} />
                </div>

                <div className="weighted-playlist-suggested">
                    <span className="weighted-playlist-suggested-label">Suggested:</span>
                    <div className="weighted-playlist-suggested-buttons">
                        {suggestedCounts.map((count) => (
                            <button
                                key={count}
                                className={`weighted-playlist-suggested-btn ${trackCountInput === count.toString() ? "active" : ""}`}
                                onClick={() => setTrackCountInput(count.toString())}
                            >
                                {count}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="weighted-playlist-preview">
                    <span className="weighted-playlist-preview-text">
                        Preview: Your playlist will contain {trackCountInput} tracks, selected randomly, weighted by their rating.
                    </span>
                </div>

                <div className="weighted-playlist-button-div">
                    <Button name="Cancel" className="weighted-playlist-cancel-button" onButtonClick={onClickCancel} />
                    <Button name="Create Playlist" className="weighted-playlist-create-button" onButtonClick={handleCreate} />
                </div>
            </div>
        </div>
    );
}
