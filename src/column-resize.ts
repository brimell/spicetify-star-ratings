/**
 * Drag-to-resize for an injected tracklist column.
 *
 * Spotify's own column separators are React controls bound to its native column indexes, so they
 * can't resize an extension column. This adds a separator of our own to the column header. It reuses
 * Spotify's separator class so it looks native, and has its own pointer/keyboard logic:
 *   - drag the handle (pointer capture keeps the drag alive outside the window)
 *   - arrow keys nudge the width (Shift = bigger step), Home resets, double-click resets
 *   - the width is clamped between a user-configurable minimum and a fixed maximum
 *   - the width is remembered in localStorage
 * Cells declare their minimum with `data-ext-col-min` so the shared grid coordinator (version 3)
 * lets the track shrink below its built-in default width.
 */

const NATIVE_SEPARATOR_CLASS = "VJ6bK4WKtyILTdvBAkHv";

/**
 * ---- Where to nudge the drag handle (px) ----
 * The handle copies the position, height and width of Spotify's own column separators, so these should
 * normally stay 0. Positive X moves the handle to the right, positive Y moves it down.
 * Without editing code, the same can be done from user.css, for example:
 *   .starRatingsResizeHandle { transform: translateY(-2px) !important; }
 */
export const HANDLE_OFFSET_X = 0;
export const HANDLE_OFFSET_Y = 0;

/**
 * ---- Header label alignment ----
 * "left": labels start at the left edge of their column, like Spotify's own headers (Date added, BPM...).
 * "center": labels are centred over the column.
 */
export const HEADER_LABEL_ALIGN: "left" | "center" = "left";

const OUR_HEADER_SELECTOR = ".djInfoHeaderCol, .starRatingsHeader, .djprep-header-wrapper, .spicetify-ext-separate-col, .spicetify-ext-lastcol-host";

function setStyleProp(el: HTMLElement, prop: string, value: string) {
    if (value === "") {
        if (el.style.getPropertyValue(prop) !== "") el.style.removeProperty(prop);
    } else if (el.style.getPropertyValue(prop) !== value) el.style.setProperty(prop, value);
}

/** Distance between the left edge of one of Spotify's header cells and its label (usually 0). */
function nativeLabelInset(header: HTMLElement): number {
    const row = header.parentElement;
    if (!row) return 0;
    for (const cell of Array.from(row.children) as HTMLElement[]) {
        if (cell.getAttribute("role") !== "columnheader" || cell.matches(OUR_HEADER_SELECTOR)) continue;
        const label = cell.querySelector("span");
        if (!label) continue;
        const d = label.getBoundingClientRect().left - cell.getBoundingClientRect().left;
        if (d >= 0 && d < 60) return Math.round(d);
    }
    return 0;
}

/** Aligns the label of a single-label header cell (call once the header is inside its grid row). */
export function alignHeaderLabel(header: HTMLElement) {
    const left = HEADER_LABEL_ALIGN === "left";
    setStyleProp(header, "justify-content", left ? "flex-start" : "center");
    setStyleProp(header, "padding-left", left ? nativeLabelInset(header) + "px" : "");
}

/** Aligns the content of a row cell with the header label above it (same rule as alignHeaderLabel). */
export function alignRowCell(cell: HTMLElement, headerSelector: string) {
    const left = HEADER_LABEL_ALIGN === "left";
    setStyleProp(cell, "justify-content", left ? "flex-start" : "center");
    const header = document.querySelector<HTMLElement>(headerSelector);
    setStyleProp(cell, "padding-left", left ? (header?.style.paddingLeft || "0px") : "");
}

export interface ColumnResizerOptions {
    /** localStorage key that remembers the chosen width */
    storageKey: string;
    /** accessible name of the handle */
    ariaLabel: string;
    /** CSS class given to the handle element */
    handleClass: string;
    /** selector matching every header and row cell of the column */
    cellSelector: string;
    /** width used when nothing is stored, and on reset */
    defaultWidth: number;
    /** widest the column can be dragged (never below the minimum) */
    maxWidth: number;
    /** current minimum width, read from the extension's settings */
    getMin: () => number;
    /** called after every width change so the grids can be refitted */
    refit: () => void;
}

export interface ColumnResizer {
    /** current width, always inside [min, max] */
    width: () => number;
    /** writes the current width and minimum onto a header/row cell */
    applyToCell: (el: HTMLElement) => void;
    /** adds the drag handle to a header cell (idempotent) */
    attachHandle: (header: HTMLElement) => void;
    /** removes the drag handle and ends any drag in progress */
    detachHandle: (header: HTMLElement) => void;
    /** re-clamps the width after the minimum setting changed */
    applyLimits: () => void;
}

export function createColumnResizer(o: ColumnResizerOptions): ColumnResizer {
    // Settings aren't loaded when the module is evaluated, so the stored width is read lazily.
    let stored: number | null = null;
    let drag: { id: number; startX: number; startW: number; moved: boolean; handle: HTMLElement } | null = null;

    const getMin = () => Math.max(1, Math.round(o.getMin()));
    const getMax = () => Math.max(o.maxWidth, getMin());
    const clamp = (px: number) => Math.min(getMax(), Math.max(getMin(), Math.round(px)));
    const load = (): number => {
        try {
            const v = parseFloat(window.localStorage.getItem(o.storageKey) ?? "");
            return Number.isFinite(v) ? v : o.defaultWidth;
        } catch {
            return o.defaultWidth;
        }
    };
    const width = () => {
        if (stored === null) stored = load();
        return clamp(stored);
    };

    function applyToCell(el: HTMLElement) {
        const w = width() + "px";
        if (el.style.width !== w) el.style.width = w;
        if (el.style.minWidth !== w) el.style.minWidth = w;
        const min = String(getMin());
        if (el.getAttribute("data-ext-col-min") !== min) el.setAttribute("data-ext-col-min", min);
    }

    function syncHandles() {
        document.querySelectorAll<HTMLElement>("." + o.handleClass).forEach((h) => {
            h.setAttribute("aria-valuemin", String(getMin()));
            h.setAttribute("aria-valuemax", String(getMax()));
            h.setAttribute("aria-valuenow", String(width()));
        });
    }

    function setWidth(px: number, persist: boolean) {
        stored = clamp(px);
        document.querySelectorAll<HTMLElement>(o.cellSelector).forEach(applyToCell);
        syncHandles();
        o.refit();
        if (persist) {
            try {
                window.localStorage.setItem(o.storageKey, String(stored));
            } catch {}
        }
    }

    function onMove(e: PointerEvent) {
        if (!drag || e.pointerId !== drag.id) return;
        // The handle can be re-rendered or removed mid-drag, and lostpointercapture isn't guaranteed then
        if (!drag.handle.isConnected) {
            endDrag();
            return;
        }
        if (e.clientX !== drag.startX) drag.moved = true;
        setWidth(drag.startW + (e.clientX - drag.startX), false);
    }

    function onEnd(e?: Event) {
        if (e && drag && (e as PointerEvent).pointerId !== undefined && (e as PointerEvent).pointerId !== drag.id) return;
        endDrag();
    }

    function endDrag() {
        if (!drag) return;
        const { moved } = drag;
        drag = null;
        document.body.classList.remove("extColResizing");
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
        window.removeEventListener("blur", onEnd);
        if (moved) setWidth(width(), true);
    }

    function ensureStyles() {
        if (document.getElementById("ext-col-resize-styles")) return;
        const st = document.createElement("style");
        st.id = "ext-col-resize-styles";
        st.textContent = `
            body.extColResizing, body.extColResizing * { cursor: col-resize !important; user-select: none !important; }
            .extColResizeHandle:hover, .extColResizeHandle:focus-visible { background: rgba(255, 255, 255, 0.2); }
        `;
        document.head.appendChild(st);
    }

    /** One of Spotify's own column separators in the same header row (we copy its geometry). */
    function nativeSeparator(header: HTMLElement): HTMLElement | null {
        const row = header.parentElement;
        if (!row) return null;
        const list = row.querySelectorAll<HTMLElement>('[role="separator"][aria-label="Resize columns"]');
        for (const s of Array.from(list)) {
            if (s.getBoundingClientRect().height > 0) return s;
        }
        return null;
    }

    function setStyle(el: HTMLElement, prop: string, value: string) {
        if (el.style.getPropertyValue(prop) !== value) el.style.setProperty(prop, value);
    }

    /**
     * Gives our handle the same vertical position, height, width and distance from the column edge as
     * Spotify's own separators. Returns false while the header isn't laid out yet (or no native separator exists).
     */
    function alignHandle(header: HTMLElement, h: HTMLElement): boolean {
        const n = nativeSeparator(header);
        const cell = n?.parentElement;
        const hr = header.getBoundingClientRect();
        if (!n || !cell || hr.height <= 0) return false;
        const nr = n.getBoundingClientRect();
        const cr = cell.getBoundingClientRect();
        setStyle(h, "top", Math.round(nr.top - hr.top + HANDLE_OFFSET_Y) + "px");
        setStyle(h, "height", Math.round(nr.height) + "px");
        setStyle(h, "bottom", "auto");
        setStyle(h, "width", (Math.round(nr.width) || 8) + "px");
        setStyle(h, "right", Math.round(cr.right - nr.right - HANDLE_OFFSET_X) + "px");
        return true;
    }

    function alignHandleSoon(header: HTMLElement, h: HTMLElement, tries: number) {
        if (tries <= 0) return;
        requestAnimationFrame(() => {
            if (h.isConnected && !alignHandle(header, h)) alignHandleSoon(header, h, tries - 1);
        });
    }

    function attachHandle(header: HTMLElement) {
        // The header's inline style may have been rewritten since the last call, so check every time
        if (getComputedStyle(header).position === "static") header.style.position = "relative";
        const existing = header.querySelector<HTMLElement>("." + o.handleClass);
        if (existing) {
            alignHandle(header, existing);
            return;
        }
        ensureStyles();
        const h = document.createElement("div");
        h.className = `${o.handleClass} extColResizeHandle ${NATIVE_SEPARATOR_CLASS}`;
        h.setAttribute("role", "separator");
        h.setAttribute("aria-orientation", "horizontal");
        h.setAttribute("aria-label", o.ariaLabel);
        h.setAttribute("aria-valuemin", String(getMin()));
        h.setAttribute("aria-valuemax", String(getMax()));
        h.setAttribute("aria-valuenow", String(width()));
        h.draggable = false;
        h.tabIndex = 0;
        h.style.cssText = "position: absolute; top: 0; right: 0; bottom: 0; width: 8px; cursor: col-resize; z-index: 12;";

        h.addEventListener("pointerdown", (e: PointerEvent) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            endDrag(); // never stack a second drag on a stuck one
            drag = { id: e.pointerId, startX: e.clientX, startW: width(), moved: false, handle: h };
            // Capture keeps pointermove/pointerup coming even when the mouse leaves the window
            try {
                h.setPointerCapture(e.pointerId);
            } catch {}
            document.body.classList.add("extColResizing");
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onEnd);
            window.addEventListener("pointercancel", onEnd);
            window.addEventListener("blur", onEnd);
        });
        h.addEventListener("lostpointercapture", onEnd);
        h.addEventListener("keydown", (e: KeyboardEvent) => {
            const step = e.shiftKey ? 24 : 8;
            if (e.key === "ArrowRight") setWidth(width() + step, true);
            else if (e.key === "ArrowLeft") setWidth(width() - step, true);
            else if (e.key === "Home") setWidth(o.defaultWidth, true);
            else return;
            e.preventDefault();
            e.stopPropagation();
        });
        h.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            setWidth(o.defaultWidth, true);
        });
        header.appendChild(h);
        if (!alignHandle(header, h)) alignHandleSoon(header, h, 8);
    }

    function detachHandle(header: HTMLElement) {
        endDrag();
        header.querySelector("." + o.handleClass)?.remove();
    }

    return { width, applyToCell, attachHandle, detachHandle, applyLimits: () => setWidth(width(), true) };
}
