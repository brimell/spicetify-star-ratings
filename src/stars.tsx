export function findStars(idSuffix: string) {
    const starsId = `stars-${idSuffix}`;
    const stars = document.getElementById(starsId);
    if (!stars) return null;
    const starElements = [];
    for (let i = 1; i <= 5; i++) {
        const id = `${starsId}-${i}`;
        const star = document.getElementById(id);
        const stopFirst = document.getElementById(`${id}-gradient-first`);
        const stopSecond = document.getElementById(`${id}-gradient-second`);
        starElements.push([star, stopFirst, stopSecond]);
    }
    return [stars, starElements];
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

    const gradient = document.createElementNS(xmlns, "linearGradient");
    defs.append(gradient);
    gradient.id = `${id}-gradient`;

    const stopFirst = document.createElementNS(xmlns, "stop");
    gradient.append(stopFirst);
    stopFirst.id = `${id}-gradient-first`;
    stopFirst.setAttributeNS(null, "offset", "50%");
    stopFirst.setAttributeNS(null, "stop-color", "var(--spice-button-disabled)");

    const stopSecond = document.createElementNS(xmlns, "stop");
    gradient.append(stopSecond);
    stopSecond.id = `${id}-gradient-second`;
    stopSecond.setAttributeNS(null, "offset", "50%");
    stopSecond.setAttributeNS(null, "stop-color", "var(--spice-button-disabled)");

    const path = document.createElementNS(xmlns, "path");
    star.append(path);
    path.setAttributeNS(null, "fill", `url(#${gradient.id})`);
    path.setAttributeNS(
        null,
        "d",
        "M20.388,10.918L32,12.118l-8.735,7.749L25.914,31.4l-9.893-6.088L6.127,31.4l2.695-11.533L0,12.118l11.547-1.2L16.026,0.6L20.388,10.918z",
    );

    return [star, stopFirst, stopSecond];
}

export function createStars(trackURI: string, size: number): [HTMLSpanElement, (SVGSVGElement | SVGStopElement)[][]] {
    const stars = document.createElement("span");
    const id = `stars-${trackURI}`;
    stars.className = "stars";
    stars.id = id;
    stars.style.whiteSpace = "nowrap";
    stars.style.alignItems = "center";
    stars.style.display = "flex";

    const starElements = [];
    for (let i = 0; i < 5; i++) {
        const [star, stopFirst, stopSecond] = createStar(id, i + 1, size);
        stars.append(star);
        starElements.push([star, stopFirst, stopSecond]);
    }

    return [stars, starElements];
}

export function setRating(starElements: (SVGSVGElement | SVGStopElement)[][], rating: number) {
    const halfStars = (rating /= 0.5);
    for (let i = 0; i < 5; i++) {
        const stopFirst = starElements[i][1];
        const stopSecond = starElements[i][2];
        stopFirst.setAttributeNS(null, "stop-color", "var(--spice-button-disabled)");
        stopSecond.setAttributeNS(null, "stop-color", "var(--spice-button-disabled)");
    }
    for (let i = 0; i < halfStars; i++) {
        const j = Math.floor(i / 2);
        const stopFirst = starElements[j][1];
        const stopSecond = starElements[j][2];
        if (i % 2 === 0) {
            stopFirst.setAttributeNS(null, "stop-color", "var(--spice-button)");
        } else {
            stopSecond.setAttributeNS(null, "stop-color", "var(--spice-button)");
        }
    }
}

export function getMouseoverRating(settings, star, i) {
    const rect = star.getBoundingClientRect();
    const offset = event.clientX - rect.left;
    const half = offset > 8 || !settings.halfStarRatings;
    const zeroStars = i === 0 && offset < 3;
    let rating = i + 1;
    if (!half) rating -= 0.5;
    if (zeroStars) {
        rating -= settings.halfStarRatings ? 0.5 : 1.0;
    }
    return rating;
}
