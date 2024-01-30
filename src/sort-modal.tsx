import "./sort-modal.css";

const React = Spicetify.React;

export function Button({ name, className, onButtonClick }) {
    return (
        <button className={className} onClick={onButtonClick}>
            {name}
        </button>
    );
}

export function SortModal({ onClickCancel, onClickOK }) {
    return (
        <div className="parent-div">
            <p>
                This will modify the <b>Custom order</b> of the playlist.
            </p>
            <div className="button-div">
                <Button name="Cancel" className="cancel-button" onButtonClick={onClickCancel} />
                <Button name="Sort" className="ok-button" onButtonClick={onClickOK} />
            </div>
        </div>
    );
}
