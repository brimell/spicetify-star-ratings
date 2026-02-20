import { ratings } from "./app";
import { saveSettings, Scaling } from "./settings";
import "./settings-ui.css";

const React = Spicetify.React;

function CheckboxIcon() {
    return (
        <svg
            width={16}
            height={16}
            viewbox="0 0 16 16"
            fill="currentColor"
            dangerouslySetInnerHTML={{
                __html: Spicetify.SVGIcons.check,
            }}
        ></svg>
    );
}

function CheckboxItem({ settings, name, field, onclick }) {
    let [value, setValue] = Spicetify.React.useState(settings[field]);
    const buttonClass = value ? "checkbox" : "checkbox disabled";

    function handleOnClick() {
        let state = !value;
        settings[field] = state;
        setValue(state);
        saveSettings(settings);
        if (onclick) onclick();
    }

    return (
        <div className="popup-row">
            <label className="col description">{name}</label>
            <div className="col action">
                <button className={buttonClass} onClick={handleOnClick}>
                    <CheckboxIcon />
                </button>
            </div>
        </div>
    );
}

function DropdownItem({ settings, name, field, options, onclick }) {
    const [value, setValue] = Spicetify.React.useState(settings[field]);

    function handleOnChange(event) {
        setValue(event.target.value);
        settings[field] = event.target.value;
        saveSettings(settings);
        if (onclick) onclick();
    }

    const optionElements = [];
    for (const [optionName, optionValue] of Object.entries(options)) optionElements.push(<option value={optionValue}>{optionName}</option>);

    return (
        <div className="popup-row">
            <label className="col description">{name}</label>
            <div className="col action">
                <select value={value} onChange={handleOnChange}>
                    {optionElements}
                </select>
            </div>
        </div>
    );
}

function KeyboardShortcutDescription({ label, numberKey }) {
    return (
        <li className="main-keyboardShortcutsHelpModal-sectionItem">
            <span className="Type__TypeElement-goli3j-0 ipKmGr main-keyboardShortcutsHelpModal-sectionItemName">{label}</span>
            <kbd className="Type__TypeElement-goli3j-0 ipKmGr main-keyboardShortcutsHelpModal-key">Ctrl</kbd>
            <kbd className="Type__TypeElement-goli3j-0 ipKmGr main-keyboardShortcutsHelpModal-key">Alt</kbd>
            <kbd className="Type__TypeElement-goli3j-0 ipKmGr main-keyboardShortcutsHelpModal-key">{numberKey}</kbd>
        </li>
    );
}

function Heading({ value }) {
    return <h2 className="Type__TypeElement-goli3j-0 bcTfIx main-keyboardShortcutsHelpModal-sectionHeading">{value}</h2>;
}

function ScalingItem({ settings, name, field, onclick }) {
    const [kind, setKind] = Spicetify.React.useState(settings[field].kind);
    const [base, setBase] = Spicetify.React.useState(settings[field].base ?? 1);

    function commit(next: Scaling) {
        settings[field] = next as any;
        saveSettings(settings);
        if (onclick) onclick();
    }

    function handleKindChange(event) {
        const nextKind = event.target.value as Scaling["kind"];
        setKind(nextKind);

        if (nextKind === "Linear") {
            commit({ kind: "Linear" });
        } else {
            commit({ kind: "Exponential", base: base });
        }
    }

    function handleBaseChange(event) {
        const nextValue = Number(event.target.value);
        setBase(nextValue);
        if (kind === "Exponential") {
            commit({ kind: "Exponential", base: nextValue });
        }
    }

    return (
        <div className="popup-row">
            <label className="col description">{name}</label>
            <div className="col action" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <select value={kind} onChange={handleKindChange}>
                    <option value="Linear">Linear</option>
                    <option value="Exponential">Exponential</option>
                </select>

                <label style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span style={{ opacity: kind === "Exponential" ? 1 : 0.5 }}>Base</span>
                    <input
                        type="number"
                        value={base}
                        step={0.1}
                        min={0}
                        onChange={handleBaseChange}
                        disabled={kind !== "Exponential"}
                        style={{ width: "80px", opacity: kind === "Exponential" ? 1 : 0.5 }}
                    />
                </label>
            </div>
        </div>
    );
}

function download_ratings() {
    const blob = new Blob([JSON.stringify(ratings)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const element = document.createElement("a");
    element.href = url;
    element.download = "ratings-export.json";
    element.click();
    URL.revokeObjectURL(url);
}
async function copy_ratings() {
    await Spicetify.Platform.ClipboardAPI.copy(JSON.stringify(ratings));
}

export function Settings({
    settings,
    registerKeyboardShortcuts,
    deregisterKeyboardShortcuts,
    updateTracklist,
    restoreTracklist,
    redrawNowPlayingStars,
}) {
    function handleEnableKeyboardShortcutsCheckboxClick() {
        if (settings.enableKeyboardShortcuts) registerKeyboardShortcuts();
        else deregisterKeyboardShortcuts();
    }

    function handleShowPlaylistStarsCheckboxClick() {
        if (settings.showPlaylistStars) updateTracklist();
        else restoreTracklist();
    }

    function hanleNowPlayingStarsPositionDropdownClick() {
        redrawNowPlayingStars();
    }

    return (
        <div>
            <Heading value="Settings" />
            <CheckboxItem settings={settings} name="Half star ratings" field="halfStarRatings" />
            <CheckboxItem
                settings={settings}
                name="Enable keyboard shortcuts"
                field="enableKeyboardShortcuts"
                onclick={handleEnableKeyboardShortcutsCheckboxClick}
            />
            <CheckboxItem settings={settings} name="Show playlist stars" field="showPlaylistStars" onclick={handleShowPlaylistStarsCheckboxClick} />
            <DropdownItem
                settings={settings}
                name="Auto-like/dislike threshold"
                field="likeThreshold"
                options={{
                    Disabled: "disabled",
                    "3.0": "3.0",
                    "3.5": "3.5",
                    "4.0": "4.0",
                    "4.5": "4.5",
                    "5.0": "5.0",
                }}
            />
            <DropdownItem
                settings={settings}
                name="Now playing stars position"
                field="nowPlayingStarsPosition"
                options={{
                    Left: "left",
                    Right: "right",
                }}
                onclick={hanleNowPlayingStarsPositionDropdownClick}
            />
            <DropdownItem
                settings={settings}
                name="Skip threshold"
                field="skipThreshold"
                options={{
                    Disabled: "disabled",
                    "0.0": "0.0",
                    "0.5": "0.5",
                    "1.0": "1.0",
                    "1.5": "1.5",
                    "2.0": "2.0",
                    "2.5": "2.5",
                    "3.0": "3.0",
                    "3.5": "3.5",
                    "4.0": "4.0",
                    "4.5": "4.5",
                }}
            />
            <CheckboxItem
                settings={settings}
                name={
                    <>
                        Sync duplicate songs with same rating
                        <br />
                        (Does not apply to songs that have already been rated)
                    </>
                }
                field="syncDuplicateSongs"
            />
            <DropdownItem
                settings={settings}
                name="Default rating for unrated songs"
                field="defaultRating"
                options={{
                    "0.0": "0.0",
                    "0.5": "0.5",
                    "1.0": "1.0",
                    "1.5": "1.5",
                    "2.0": "2.0",
                    "2.5": "2.5",
                    "3.0": "3.0",
                    "3.5": "3.5",
                    "4.0": "4.0",
                    "4.5": "4.5",
                    "5.0": "5.0",
                }}
            />
            <CheckboxItem
                settings={settings}
                name={
                    <>
                        Re-enqueue workaround
                        <br />
                        Workaround for a remote-play issue. Re-enqueues song after 1s, if necessary.
                    </>
                }
                field="reEnqueueWorkaround"
            />
            <CheckboxItem
                settings={settings}
                name={
                    <>
                        Average Ratings
                        <br />
                        Record all ratings (instead of only latest). Uses a time-weighted average for the canonical rating.
                    </>
                }
                field="averageRatings"
            />
            <CheckboxItem
                settings={settings}
                name={
                    <>
                        Show Exact Rating
                        <br />
                        Display 3-digit decimal rating next to stars
                    </>
                }
                field="showExactRating"
            />
            <DropdownItem
                settings={settings}
                name="Play"
                field="play"
                options={{
                    "All Songs": "all",
                    "Only rated Songs": "onlyrated",
                    "Only unrated Songs": "onlyunrated",
                }}
            />
            <ScalingItem
                settings={settings}
                name={
                    <>
                        Rating to weight conversion
                        <br />
                        Used in weighted playback and playlist creation
                    </>
                }
                field="ratingToWeight"
            />
            <div className="popup-row">
                <label className="col description">Export ratings</label>
                <div className="col action" style={{ display: "flex", gap: "8px" }}>
                    <button className="button" onClick={copy_ratings}>
                        Copy Ratings To Clipboard
                    </button>
                    <button className="button" onClick={download_ratings}>
                        Download Ratings
                    </button>
                </div>
            </div>
            <Heading value="Keyboard Shortcuts" />
            <ul>
                <KeyboardShortcutDescription label="Rate current track 0.5 stars" numberKey="1" />
                <KeyboardShortcutDescription label="Rate current track 1 star" numberKey="2" />
                <KeyboardShortcutDescription label="Rate current track 1.5 stars" numberKey="3" />
                <KeyboardShortcutDescription label="Rate current track 2 stars" numberKey="4" />
                <KeyboardShortcutDescription label="Rate current track 2.5 stars" numberKey="5" />
                <KeyboardShortcutDescription label="Rate current track 3 stars" numberKey="6" />
                <KeyboardShortcutDescription label="Rate current track 3.5 stars" numberKey="7" />
                <KeyboardShortcutDescription label="Rate current track 4 stars" numberKey="8" />
                <KeyboardShortcutDescription label="Rate current track 4.5 stars" numberKey="9" />
                <KeyboardShortcutDescription label="Rate current track 5 stars" numberKey="0" />
            </ul>
        </div>
    );
}
