import { settings } from "./app";

// Each star element tuple: [svgElement, tlPath, blPath, trPath, brPath]
// Quarter fill order within each star: TL (0.25), BL (0.50), TR (0.75), BR (1.00)

/**
 * Format a rating number as a canonical string key.
 * Multiples of 0.5 use one decimal place  → "0.5", "1.0", "2.5"
 * Quarter-step values use two decimal places → "0.25", "1.75", "3.75"
 */
export function toRatingString(rating: number): string {
    if ((rating * 100) % 50 === 0) return rating.toFixed(1);
    return rating.toFixed(2);
}

export function findStars(idSuffix: string) {
    const starsId = `stars-${idSuffix}`;
    const stars = document.getElementById(starsId);
    if (!stars) return null;

    const starElements = [];
    for (let i = 1; i <= 5; i++) {
        const id = `${starsId}-${i}`;
        const star = document.getElementById(id);
        const tl = document.getElementById(`${id}-tl`);
        const bl = document.getElementById(`${id}-bl`);
        const tr = document.getElementById(`${id}-tr`);
        const br = document.getElementById(`${id}-br`);
        starElements.push([star, tl, bl, tr, br]);
    }

    const label = stars.querySelector(".stars-rating-label") as HTMLSpanElement | null;
    return [stars, starElements, label];
}

function createStar(starsId: string, n: number, size: number) {
    const xmlns = "http://www.w3.org/2000/svg";
    const star = document.createElementNS(xmlns, "svg");
    const id = `${starsId}-${n}`;
    star.id = id;
    star.style.minHeight = `${size}px`;
    star.style.minWidth = `${size}px`;
    star.setAttributeNS(null, "width", `${size}px`);
    star.setAttributeNS(null, "height", `${size}px`);
    star.setAttributeNS(null, "viewBox", `0 0 32 32`);

    const defs = document.createElementNS(xmlns, "defs");
    star.append(defs);

    const starPathD =
        "M20.388,10.918L32,12.118l-8.735,7.749L25.914,31.4l-9.893-6.088L6.127,31.4l2.695-11.533L0,12.118l11.547-1.2L16.026,0.6L20.388,10.918z";

    // Split vertically at x=16 and horizontally at y=16 (in 32×32 viewBox space)
    const quadrants = [
        { name: "tl", x: 0, y: 0, w: 16, h: 16 },
        { name: "bl", x: 0, y: 16, w: 16, h: 16 },
        { name: "tr", x: 16, y: 0, w: 16, h: 16 },
        { name: "br", x: 16, y: 16, w: 16, h: 16 },
    ] as const;

    const paths: SVGPathElement[] = [];

    for (const q of quadrants) {
        const clipId = `${id}-clip-${q.name}`;

        const clipPath = document.createElementNS(xmlns, "clipPath");
        clipPath.id = clipId;

        const rect = document.createElementNS(xmlns, "rect");
        rect.setAttributeNS(null, "x", `${q.x}`);
        rect.setAttributeNS(null, "y", `${q.y}`);
        rect.setAttributeNS(null, "width", `${q.w}`);
        rect.setAttributeNS(null, "height", `${q.h}`);
        clipPath.append(rect);
        defs.append(clipPath);

        const path = document.createElementNS(xmlns, "path");
        path.id = `${id}-${q.name}`;
        path.setAttributeNS(null, "clip-path", `url(#${clipId})`);
        path.setAttributeNS(null, "fill", "var(--spice-button-disabled)");
        path.setAttributeNS(null, "d", starPathD);
        star.append(path);
        paths.push(path);
    }

    // paths order: [tl, bl, tr, br]
    return [star, paths[0], paths[1], paths[2], paths[3]] as const;
}

export function createStars(trackURI: string, size: number): [HTMLSpanElement, (SVGSVGElement | SVGPathElement)[][], HTMLSpanElement | undefined] {
    const stars = document.createElement("span");
    const id = `stars-${trackURI}`;
    stars.className = "stars";
    stars.id = id;
    stars.style.whiteSpace = "nowrap";
    stars.style.alignItems = "center";
    stars.style.display = "flex";

    const starElements = [];
    for (let i = 0; i < 5; i++) {
        const [star, tl, bl, tr, br] = createStar(id, i + 1, size);
        stars.append(star);
        starElements.push([star, tl, bl, tr, br]);
    }

    let label: HTMLSpanElement | undefined = undefined;
    if (settings?.showExactRating) {
        label = document.createElement("span");
        label.className = "stars-rating-label";
        label.style.marginLeft = "6px";
        label.style.fontSize = "0.9em";
        label.style.opacity = "0.9";
        stars.append(label);
    }

    return [stars, starElements, label];
}

export function setRating(starElements: (SVGSVGElement | SVGPathElement)[][], rating: number, label?: HTMLElement) {
    if (settings?.showExactRating && label && rating) label.textContent = rating.toFixed(2);

    // Express the rating as a count of quarter-unit increments (0–20 for a 5-star system)
    const totalQUnits = Math.round(rating * 4);

    const lit = "var(--spice-button)";
    const dim = "var(--spice-button-disabled)";

    for (let i = 0; i < 5; i++) {
        const [, tlPath, blPath, trPath, brPath] = starElements[i];
        const starBase = i * 4;

        // Quarter-units filled within this individual star (0–4)
        const filled = Math.max(0, Math.min(4, totalQUnits - starBase));

        if (settings?.quarterStarRatings) {
            // Fill order: TL → BL → TR → BR
            (tlPath as SVGPathElement).setAttributeNS(null, "fill", filled >= 1 ? lit : dim);
            (blPath as SVGPathElement).setAttributeNS(null, "fill", filled >= 2 ? lit : dim);
            (trPath as SVGPathElement).setAttributeNS(null, "fill", filled >= 3 ? lit : dim);
            (brPath as SVGPathElement).setAttributeNS(null, "fill", filled >= 4 ? lit : dim);
        } else if (settings?.halfStarRatings) {
            // Left half = TL+BL, right half = TR+BR
            // Snap filled to nearest even count (i.e. nearest half-star boundary)
            const halfFilled = Math.round(filled / 2);
            (tlPath as SVGPathElement).setAttributeNS(null, "fill", halfFilled >= 1 ? lit : dim);
            (blPath as SVGPathElement).setAttributeNS(null, "fill", halfFilled >= 1 ? lit : dim);
            (trPath as SVGPathElement).setAttributeNS(null, "fill", halfFilled >= 2 ? lit : dim);
            (brPath as SVGPathElement).setAttributeNS(null, "fill", halfFilled >= 2 ? lit : dim);
        } else {
            // Whole stars
            const isLit = i < Math.round(rating);
            (tlPath as SVGPathElement).setAttributeNS(null, "fill", isLit ? lit : dim);
            (blPath as SVGPathElement).setAttributeNS(null, "fill", isLit ? lit : dim);
            (trPath as SVGPathElement).setAttributeNS(null, "fill", isLit ? lit : dim);
            (brPath as SVGPathElement).setAttributeNS(null, "fill", isLit ? lit : dim);
        }
    }
}

export function getMouseoverRating(settings, star, i) {
    const rect = star.getBoundingClientRect();
    const offsetX = (event as MouseEvent).clientX - rect.left;
    const offsetY = (event as MouseEvent).clientY - rect.top;

    const isRight = offsetX > rect.width / 2;
    const isTop = offsetY < rect.height / 2;

    if (settings.quarterStarRatings) {
        // Very left edge of the first star → 0 stars
        if (i === 0 && offsetX < 3) return 0;

        // Quadrant → rating offset within star
        // TL = +0.25, BL = +0.50, TR = +0.75, BR = +1.00
        if (!isRight && isTop) return i + 0.25;
        if (!isRight && !isTop) return i + 0.5;
        if (isRight && isTop) return i + 0.75;
        return i + 1.0;
    } else {
        const half = isRight || !settings.halfStarRatings;
        const zeroStars = i === 0 && offsetX < 3;
        let rating = i + 1;
        if (!half) rating -= 0.5;
        if (zeroStars) {
            rating -= settings.halfStarRatings ? 0.5 : 1.0;
        }
        return rating;
    }
}
