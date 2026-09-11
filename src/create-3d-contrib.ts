import * as d3 from 'd3';
import * as util from './utils';
import * as type from './type';

const ANGLE = 30;

const toEpochDays = (date: Date): number =>
    Math.floor(date.getTime() / (24 * 60 * 60 * 1000));

type PanelType = 'top' | 'left' | 'right';

const addNormalColor = (
    path: d3.Selection<SVGRectElement, unknown, null, unknown>,
    contribLevel: number,
    panel: PanelType,
): void => {
    path.attr('class', `cont-${panel}-${contribLevel}`);
};

const decideSeasonPatternNo = (date: Date): number => {
    const sunday = new Date(date.getTime());
    sunday.setDate(sunday.getDate() - sunday.getDay());

    const month = sunday.getUTCMonth();
    const dayOfMonth = sunday.getUTCDate();

    const diff =
        dayOfMonth <= 7
            ? 0
            : dayOfMonth <= 14
              ? 1
              : dayOfMonth <= 21
                ? 2
                : dayOfMonth <= 28
                  ? 3
                  : 4;

    switch (month + 1) {
        case 9:
            // summer -> autumn = 0-4
            return 0 + diff;
        case 10:
        case 11:
            // autumn = 4
            return 4;
        case 12:
            // autumn -> winter = 5-9
            return 5 + diff;
        case 1:
        case 2:
            // winter = 9
            return 9;
        case 3:
            // winter -> spring = 10-14
            return 10 + diff;
        case 4:
        case 5:
            // spring = 14
            return 14;
        case 6:
            // spring -> summer = 15-19
            return 15 + diff;
        case 7:
        case 8:
        default:
            // summer = 19
            return 19;
    }
};

const addSeasonColor = (
    path: d3.Selection<SVGRectElement, unknown, null, unknown>,
    contribLevel: number,
    panel: PanelType,
    date: Date,
): void => {
    const pattern = decideSeasonPatternNo(date);
    path.attr('class', `cont-${panel}-p${pattern}-${contribLevel}`);
};

const addRainbowColor = (
    path: d3.Selection<SVGRectElement, unknown, null, unknown>,
    contribLevel: number,
    panel: PanelType,
    settings: type.RainbowColorSettings,
    week: number,
): void => {
    const className = `rb-l${contribLevel}-${panel}`;
    const offsetHue = week * settings.hueRatio;
    const normalizedHue = ((offsetHue % 360) + 360) % 360;
    const durationSeconds = parseFloat(settings.duration);
    const delaySeconds = -(normalizedHue / 360) * durationSeconds;

    path.attr('class', className).attr(
        'style',
        `animation-delay:${delaySeconds.toFixed(3)}s`,
    );
};

const addBitmapPattern = (
    path: d3.Selection<SVGRectElement, unknown, null, unknown>,
    contributionLevel: number,
    panel: PanelType,
): void => {
    path.attr('fill', `url(#pattern_${contributionLevel}_${panel})`);
};

const atan = (value: number) => (Math.atan(value) * 360) / 2 / Math.PI;

const addPatternForBitmap = (
    defs: d3.Selection<SVGDefsElement, unknown, null, unknown>,
    panelPattern: type.PanelPattern,
    contributionLevel: number,
    panel: PanelType,
): void => {
    const width = Math.max(1, panelPattern.width);
    const height = Math.max(1, panelPattern.bitmap.length);
    const pattern = defs
        .append('pattern')
        .attr('id', `pattern_${contributionLevel}_${panel}`)
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', width)
        .attr('height', height)
        .attr('patternUnits', 'userSpaceOnUse');
    pattern
        .append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', width)
        .attr('height', height)
        .attr('class', `cont-${panel}-bg-${contributionLevel}`);
    const path = d3.path();
    for (const [y, bitmapValue] of panelPattern.bitmap.entries()) {
        const bitmap =
            typeof bitmapValue === 'string'
                ? parseInt(bitmapValue, 16)
                : bitmapValue;
        for (let x = 0; x < width; x++) {
            if ((bitmap & (1 << (width - x - 1))) !== 0) {
                path.rect(x, y, 1, 1);
            }
        }
    }
    pattern
        .append('path')
        .attr('stroke', 'none')
        .attr('class', `cont-${panel}-fg-${contributionLevel}`)
        .attr('d', path.toString());
};

const seededRandom = (seed: number): number => {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
};

const addLight = (
    group: d3.Selection<SVGGElement, unknown, null, unknown>,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
): void => {
    group
        .append('rect')
        .attr('x', util.toFixed(x))
        .attr('y', util.toFixed(y))
        .attr('width', util.toFixed(w))
        .attr('height', util.toFixed(h))
        .attr('fill', color)
        .attr('class', 'light-glow');
};

export const addDefines = (
    svg: d3.Selection<SVGSVGElement, unknown, null, unknown>,
    settings: type.Settings,
): void => {
    if (settings.type === 'bitmap') {
        const defs = svg.append('defs');
        for (const [contribLevel, info] of settings.contribPatterns.entries()) {
            addPatternForBitmap(defs, info.top, contribLevel, 'top');
            addPatternForBitmap(defs, info.left, contribLevel, 'left');
            addPatternForBitmap(defs, info.right, contribLevel, 'right');
        }
    }

};

export const create3DContrib = (
    svg: d3.Selection<SVGSVGElement, unknown, null, unknown>,
    userInfo: type.UserInfo,
    x: number,
    y: number,
    width: number,
    height: number,
    settings: type.FullSettings,
    isForcedAnimation = false,
): void => {
    if (userInfo.contributionCalendar.length === 0) {
        return;
    }

    const firstDate = userInfo.contributionCalendar[0].date;
    const sundayOfFirstWeek = toEpochDays(firstDate) - firstDate.getUTCDay();
    const weekcount = Math.ceil(
        (userInfo.contributionCalendar.length + firstDate.getUTCDay()) / 7.0,
    );
    const dx = width / 64;
    const dy = dx * Math.tan(ANGLE * ((2 * Math.PI) / 360));
    const dxx = dx * 0.9;
    const dyy = dy * 0.9;

    const offsetX = dx * 7;
    const offsetY = height - (weekcount + 7) * dy;

    if (settings.fileName === 'profile-city.svg') {
        const starGroup = svg.append('g');
        for (let i = 0; i < 75; i++) {
            const sx = seededRandom(i * 7 + 100) * width;
            const sy = seededRandom(i * 13 + 200) * (height * 0.4);
            const sr = 0.5 + seededRandom(i * 3 + 300) * 0.5;
            const so = 0.2 + seededRandom(i * 11 + 400) * 0.4;
            starGroup.append('circle')
                .attr('cx', util.toFixed(sx))
                .attr('cy', util.toFixed(sy))
                .attr('r', util.toFixed(sr))
                .attr('fill', '#ffffe0')
                .attr('opacity', util.toFixed(so));
        }
    }

    const group = svg.append('g');

    userInfo.contributionCalendar.forEach((cal) => {
        const week = Math.floor(
            (toEpochDays(cal.date) - sundayOfFirstWeek) / 7,
        );
        const dayOfWeek = cal.date.getUTCDay(); // sun = 0, mon = 1, ...

        const baseX = offsetX + (week - dayOfWeek) * dx;
        const baseY = offsetY + (week + dayOfWeek) * dy;
        // ref. https://github.com/yoshi389111/github-profile-3d-contrib/issues/27
        const calHeight = Math.log10(cal.contributionCount / 20 + 1) * 144 + 3;
        const contribLevel = cal.contributionLevel;

        const isAnimate = settings.growingAnimation || isForcedAnimation;

        const bar = group
            .append('g')
            .attr(
                'transform',
                `translate(${util.toFixed(baseX)} ${util.toFixed(
                    baseY - calHeight,
                )})`,
            );
        if (isAnimate && contribLevel !== 0) {
            bar.append('animateTransform')
                .attr('attributeName', 'transform')
                .attr('type', 'translate')
                .attr(
                    'values',
                    `${util.toFixed(baseX)} ${util.toFixed(
                        baseY - 3,
                    )};${util.toFixed(baseX)} ${util.toFixed(
                        baseY - calHeight,
                    )}`,
                )
                .attr('dur', '3s')
                .attr('repeatCount', '1');
        }

        const widthTop =
            settings.type === 'bitmap'
                ? Math.max(1, settings.contribPatterns[contribLevel].top.width)
                : dxx;
        const topPanel = bar
            .append('rect')
            .attr('stroke', 'none')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', util.toFixed(widthTop))
            .attr('height', util.toFixed(widthTop))
            .attr(
                'transform',
                `skewY(${-ANGLE}) skewX(${util.toFixed(
                    atan(dxx / 2 / dyy),
                )}) scale(${util.toFixed(dxx / widthTop)} ${util.toFixed(
                    (2 * dyy) / widthTop,
                )})`,
            );

        if (settings.type === 'normal') {
            addNormalColor(topPanel, contribLevel, 'top');
        } else if (settings.type === 'season') {
            addSeasonColor(topPanel, contribLevel, 'top', cal.date);
        } else if (settings.type === 'rainbow') {
            addRainbowColor(topPanel, contribLevel, 'top', settings, week);
        } else if (settings.type === 'bitmap') {
            addBitmapPattern(topPanel, contribLevel, 'top');
        }

        const widthLeft =
            settings.type === 'bitmap'
                ? Math.max(1, settings.contribPatterns[contribLevel].left.width)
                : dxx;
        const scaleLeft = Math.sqrt(dxx ** 2 + dyy ** 2) / widthLeft;
        const heightLeft = calHeight / scaleLeft;
        const leftPanel = bar
            .append('rect')
            .attr('stroke', 'none')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', util.toFixed(widthLeft))
            .attr('height', util.toFixed(heightLeft))
            .attr(
                'transform',
                `skewY(${ANGLE}) scale(${util.toFixed(
                    dxx / widthLeft,
                )} ${util.toFixed(scaleLeft)})`,
            );

        if (settings.type === 'normal') {
            addNormalColor(leftPanel, contribLevel, 'left');
        } else if (settings.type === 'season') {
            addSeasonColor(leftPanel, contribLevel, 'left', cal.date);
        } else if (settings.type === 'rainbow') {
            addRainbowColor(leftPanel, contribLevel, 'left', settings, week);
        } else if (settings.type === 'bitmap') {
            addBitmapPattern(leftPanel, contribLevel, 'left');
        }
        if (isAnimate && contribLevel !== 0) {
            leftPanel
                .append('animate')
                .attr('attributeName', 'height')
                .attr(
                    'values',
                    `${util.toFixed(3 / scaleLeft)};${util.toFixed(heightLeft)}`,
                )
                .attr('dur', '3s')
                .attr('repeatCount', '1');
        }

        const widthRight =
            settings.type === 'bitmap'
                ? Math.max(
                      1,
                      settings.contribPatterns[contribLevel].right.width,
                  )
                : dxx;
        const scaleRight = Math.sqrt(dxx ** 2 + dyy ** 2) / widthRight;
        const heightRight = calHeight / scaleRight;
        const rightPanel = bar
            .append('rect')
            .attr('stroke', 'none')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', util.toFixed(widthRight))
            .attr('height', util.toFixed(heightRight))
            .attr(
                'transform',
                `translate(${util.toFixed(dxx)} ${util.toFixed(
                    dyy,
                )}) skewY(${-ANGLE}) scale(${util.toFixed(
                    dxx / widthRight,
                )} ${util.toFixed(scaleRight)})`,
            );

        if (settings.type === 'normal') {
            addNormalColor(rightPanel, contribLevel, 'right');
        } else if (settings.type === 'season') {
            addSeasonColor(rightPanel, contribLevel, 'right', cal.date);
        } else if (settings.type === 'rainbow') {
            addRainbowColor(rightPanel, contribLevel, 'right', settings, week);
        } else if (settings.type === 'bitmap') {
            addBitmapPattern(rightPanel, contribLevel, 'right');
        }
        if (isAnimate && contribLevel !== 0) {
            rightPanel
                .append('animate')
                .attr('attributeName', 'height')
                .attr(
                    'values',
                    `${util.toFixed(3 / scaleRight)};${util.toFixed(
                        heightRight,
                    )}`,
                )
                .attr('dur', '3s')
                .attr('repeatCount', '1');
        }

        if (settings.fileName === 'profile-city.svg' && contribLevel !== 0) {
            const winW = 4;
            const winH = 2.5;
            const floorStep = 5;
            const margin = 3;
            const leftCols = 2;
            const rightCols = 2;
            const leftNumRows = Math.max(
                0,
                Math.floor((heightLeft - 2 * margin) / floorStep),
            );
            const rightNumRows = Math.max(
                0,
                Math.floor((heightRight - 2 * margin) / floorStep),
            );
            const leftLightGroup = bar
                .append('g')
                .attr('transform', leftPanel.attr('transform') || '');
            const rightLightGroup = bar
                .append('g')
                .attr('transform', rightPanel.attr('transform') || '');
            let defs = svg.select<SVGDefsElement>('defs');
            if (defs.empty()) {
                defs = svg.append('defs');
            }
            const clipLeftId = `clip-city-L-${week}-${dayOfWeek}`;
            const clipRightId = `clip-city-R-${week}-${dayOfWeek}`;
            const clipLeft = defs.append('clipPath').attr('id', clipLeftId);
            const clipLeftRect = clipLeft
                .append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', util.toFixed(widthLeft))
                .attr(
                    'height',
                    util.toFixed(isAnimate ? 3 / scaleLeft : heightLeft),
                );
            if (isAnimate && contribLevel !== 0) {
                clipLeftRect
                    .append('animate')
                    .attr('attributeName', 'height')
                    .attr(
                        'values',
                        `${util.toFixed(3 / scaleLeft)};${util.toFixed(heightLeft)}`,
                    )
                    .attr('dur', '3s')
                    .attr('repeatCount', '1')
                    .attr('fill', 'freeze');
            }
            const clipRight = defs.append('clipPath').attr('id', clipRightId);
            const clipRightRect = clipRight
                .append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', util.toFixed(widthRight))
                .attr(
                    'height',
                    util.toFixed(isAnimate ? 3 / scaleRight : heightRight),
                );
            if (isAnimate && contribLevel !== 0) {
                clipRightRect
                    .append('animate')
                    .attr('attributeName', 'height')
                    .attr(
                        'values',
                        `${util.toFixed(3 / scaleRight)};${util.toFixed(heightRight)}`,
                    )
                    .attr('dur', '3s')
                    .attr('repeatCount', '1')
                    .attr('fill', 'freeze');
            }
            leftLightGroup.attr('clip-path', `url(#${clipLeftId})`);
            rightLightGroup.attr('clip-path', `url(#${clipRightId})`);
            const leftColWidth = widthLeft / leftCols;
            const rightColWidth = widthRight / rightCols;
            for (let row = 0; row < leftNumRows; row++) {
                for (let col = 0; col < leftCols; col++) {
                    const x = col * leftColWidth + (leftColWidth - winW) / 2;
                    const y =
                        heightLeft -
                        margin -
                        (row + 1) * floorStep +
                        (floorStep - winH) / 2;
                    const seed = week * 1000 + col * 31 + row * 17;
                    const color =
                        seededRandom(seed) < 0.4 ? '#e6d96a' : '#0a0412';
                    if (color === '#e6d96a') {
                        leftLightGroup.append('rect')
                            .attr('x', util.toFixed(x - 0.5))
                            .attr('y', util.toFixed(y - 0.5))
                            .attr('width', util.toFixed(winW + 1))
                            .attr('height', util.toFixed(winH + 1))
                            .attr('fill', '#ffe600')
                            .attr('opacity', '0.35');
                        leftLightGroup.append('rect')
                            .attr('x', util.toFixed(x))
                            .attr('y', util.toFixed(y))
                            .attr('width', util.toFixed(winW))
                            .attr('height', util.toFixed(winH))
                            .attr('fill', '#e6d96a')
                            .attr('class', 'light-glow');
                    } else {
                        addLight(leftLightGroup, x, y, winW, winH, color);
                    }
                }
            }
            for (let row = 0; row < rightNumRows; row++) {
                for (let col = 0; col < rightCols; col++) {
                    const x = col * rightColWidth + (rightColWidth - winW) / 2;
                    const y =
                        heightRight -
                        margin -
                        (row + 1) * floorStep +
                        (floorStep - winH) / 2;
                    const seed = week * 1000 + col * 31 + row * 17 + 1;
                    const color =
                        seededRandom(seed) < 0.4 ? '#e6d96a' : '#0a0412';
                    if (color === '#e6d96a') {
                        rightLightGroup.append('rect')
                            .attr('x', util.toFixed(x - 0.5))
                            .attr('y', util.toFixed(y - 0.5))
                            .attr('width', util.toFixed(winW + 1))
                            .attr('height', util.toFixed(winH + 1))
                            .attr('fill', '#ffe600')
                            .attr('opacity', '0.35');
                        rightLightGroup.append('rect')
                            .attr('x', util.toFixed(x))
                            .attr('y', util.toFixed(y))
                            .attr('width', util.toFixed(winW))
                            .attr('height', util.toFixed(winH))
                            .attr('fill', '#e6d96a')
                            .attr('class', 'light-glow');
                    } else {
                        addLight(rightLightGroup, x, y, winW, winH, color);
                    }
                }
            }
        }

    });
};
