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
            return 0 + diff;
        case 10:
        case 11:
            return 4;
        case 12:
            return 5 + diff;
        case 1:
        case 2:
            return 9;
        case 3:
            return 10 + diff;
        case 4:
        case 5:
            return 14;
        case 6:
            return 15 + diff;
        case 7:
        case 8:
        default:
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

const renderStars = (
    svg: d3.Selection<SVGSVGElement, unknown, null, unknown>,
    width: number,
    height: number,
    settings: type.FullSettings,
): void => {
    if (settings.fileName !== 'profile-city.svg') return;
    const starColor = settings.weakColor || '#ffffe0';
    const starGroup = svg.append('g');
    for (let i = 0; i < 75; i++) {
        const sx = seededRandom(i * 7 + 100) * width;
        const sy = seededRandom(i * 13 + 200) * (height * 0.4);
        const sr = 0.5 + seededRandom(i * 3 + 300) * 0.5;
        const so = 0.2 + seededRandom(i * 11 + 400) * 0.4;
        starGroup
            .append('circle')
            .attr('cx', util.toFixed(sx))
            .attr('cy', util.toFixed(sy))
            .attr('r', util.toFixed(sr))
            .attr('fill', starColor)
            .attr('opacity', util.toFixed(so));
    }
};

const createWindowClipPath = (
    defs: d3.Selection<SVGDefsElement, unknown, null, unknown>,
    id: string,
    faceWidth: number,
    faceHeight: number,
    animStartHeight: number,
    isAnimate: boolean,
    contribLevel: number,
): void => {
    const clip = defs.append('clipPath').attr('id', id);
    const clipRect = clip
        .append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', util.toFixed(faceWidth))
        .attr(
            'height',
            util.toFixed(isAnimate ? animStartHeight : faceHeight),
        );
    if (isAnimate && contribLevel !== 0) {
        clipRect
            .append('animate')
            .attr('attributeName', 'height')
            .attr(
                'values',
                `${util.toFixed(animStartHeight)};${util.toFixed(faceHeight)}`,
            )
            .attr('dur', '3s')
            .attr('repeatCount', '1')
            .attr('fill', 'freeze');
    }
};

const renderWindows = (
    group: d3.Selection<SVGGElement, unknown, null, unknown>,
    faceWidth: number,
    faceHeight: number,
    week: number,
    settings: type.FullSettings,
    isRight: boolean,
): void => {
    const winW = 4;
    const winH = 2.5;
    const floorStep = 5;
    const margin = 3;
    const cols = 2;
    const numRows = Math.max(
        0,
        Math.floor((faceHeight - 2 * margin) / floorStep),
    );
    const colWidth = faceWidth / cols;
    const litColor = settings.windowLitColor || '#e6d96a';
    const darkColor = settings.windowDarkColor || '#0a0412';
    const haloColor = settings.radarColor || '#ffe600';
    const haloOpacity = settings.windowHaloOpacity || '0.35';
    const seedOffset = isRight ? 1 : 0;

    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = col * colWidth + (colWidth - winW) / 2;
            const y =
                faceHeight -
                margin -
                (row + 1) * floorStep +
                (floorStep - winH) / 2;
            const seed = week * 1000 + col * 31 + row * 17 + seedOffset;
            const color =
                seededRandom(seed) < 0.4 ? litColor : darkColor;
            if (color === litColor) {
                group
                    .append('rect')
                    .attr('x', util.toFixed(x - 0.5))
                    .attr('y', util.toFixed(y - 0.5))
                    .attr('width', util.toFixed(winW + 1))
                    .attr('height', util.toFixed(winH + 1))
                    .attr('fill', haloColor)
                    .attr('opacity', haloOpacity);
                group
                    .append('rect')
                    .attr('x', util.toFixed(x))
                    .attr('y', util.toFixed(y))
                    .attr('width', util.toFixed(winW))
                    .attr('height', util.toFixed(winH))
                    .attr('fill', litColor)
                    .attr('class', 'light-glow');
            } else {
                addLight(group, x, y, winW, winH, color);
            }
        }
    }
};

const renderCityWindows = (
    svg: d3.Selection<SVGSVGElement, unknown, null, unknown>,
    bar: d3.Selection<SVGGElement, unknown, null, unknown>,
    leftPanel: d3.Selection<SVGRectElement, unknown, null, unknown>,
    rightPanel: d3.Selection<SVGRectElement, unknown, null, unknown>,
    widthLeft: number,
    heightLeft: number,
    scaleLeft: number,
    widthRight: number,
    heightRight: number,
    scaleRight: number,
    week: number,
    dayOfWeek: number,
    isAnimate: boolean,
    contribLevel: number,
    settings: type.FullSettings,
): void => {
    let defs = svg.select<SVGDefsElement>('defs');
    if (defs.empty()) {
        defs = svg.append('defs');
    }

    const leftLightGroup = bar
        .append('g')
        .attr('transform', leftPanel.attr('transform') || '');
    const rightLightGroup = bar
        .append('g')
        .attr('transform', rightPanel.attr('transform') || '');

    createWindowClipPath(
        defs,
        `clip-city-L-${week}-${dayOfWeek}`,
        widthLeft,
        heightLeft,
        3 / scaleLeft,
        isAnimate,
        contribLevel,
    );
    createWindowClipPath(
        defs,
        `clip-city-R-${week}-${dayOfWeek}`,
        widthRight,
        heightRight,
        3 / scaleRight,
        isAnimate,
        contribLevel,
    );

    leftLightGroup.attr(
        'clip-path',
        `url(#clip-city-L-${week}-${dayOfWeek})`,
    );
    rightLightGroup.attr(
        'clip-path',
        `url(#clip-city-R-${week}-${dayOfWeek})`,
    );

    renderWindows(leftLightGroup, widthLeft, heightLeft, week, settings, false);
    renderWindows(
        rightLightGroup,
        widthRight,
        heightRight,
        week,
        settings,
        true,
    );
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

    renderStars(svg, width, height, settings);

    const group = svg.append('g');

    userInfo.contributionCalendar.forEach((cal) => {
        const week = Math.floor(
            (toEpochDays(cal.date) - sundayOfFirstWeek) / 7,
        );
        const dayOfWeek = cal.date.getUTCDay();

        const baseX = offsetX + (week - dayOfWeek) * dx;
        const baseY = offsetY + (week + dayOfWeek) * dy;
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
            renderCityWindows(
                svg,
                bar,
                leftPanel,
                rightPanel,
                widthLeft,
                heightLeft,
                scaleLeft,
                widthRight,
                heightRight,
                scaleRight,
                week,
                dayOfWeek,
                isAnimate,
                contribLevel,
                settings,
            );
        }
    });
};
