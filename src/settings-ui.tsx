import { saveSettings } from "./settings";
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
