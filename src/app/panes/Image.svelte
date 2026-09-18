<script>

    import ReceiptPrinterRenderer, { rasterize, stitch, pieces, toImageData } from '@point-of-sale/receipt-printer-renderer';

    import { toDots } from '../../utils/stream.js';

    /*
        The paper, as the printer would print it.

        What comes out of a printer is sheets of paper, one per full cut, so that
        is what this pane shows. A sheet is one white block, and the paper on it
        is one canvas per piece the stream was cut into: a partial cut does not
        take the sheet away, so its two pieces stay on one sheet with a gap of
        white between them and a wedge cut out of the middle of that gap. A
        stream that was never cut is one piece on one sheet.

        The pane draws each piece twice over: once as the dots of the paper, on
        a canvas, and once as the boxes those dots were drawn from, which is the
        display list of the renderer. The list is what makes the paper readable:
        every box carries the bytes it came from, so a click on the paper is a
        range of the stream and a range of the stream is a box on the paper.

        The boxes are kept in the dots of the piece they are on, and the overlay
        that draws them is an SVG of that coordinate system, so the scale the
        paper is shown at is the browser's business and not this pane's.
    */

    /**
     * @prop {object} view - The store of the tab that is shown, on a page whose
     *                       panes take turns; a pane given no view is always shown
     * @prop {?Function} onselect - Called with the `{offset}` of the byte that drew
     *                       what was clicked, and with null for a click on paper
     *                       that was drawn by nothing. A pane given none is a
     *                       pane that is looked at and not clicked, which is
     *                       what the playground shows
     */
    let { view = null, onselect = null } = $props();

    let error = $state('');
    let element = $state(null);

    /* The sheets of paper: the panels of each, which are its pieces, and where
       they are cut and gapped */

    let sheets = $state.raw([]);

    /* What is outlined on each panel of each sheet, one rectangle per panel at
       most, and the edges of the cuts that are selected */

    let rects = $state.raw([]);

    /* The paper is shown at two thirds of its size in dots */

    const SCALE = 0.66;

    /* And the edge a cut leaves is drawn as two rows, the height the dashed
       marker of a joined paper has */

    const CUT = 2;

    /* The shape of a piece of paper, in pixels of the screen and not in dots of
       the printer: the white beside the dots, how high the tear at the right of
       a cut rises and how far from the right edge it begins, the wedge a partial
       cut leaves and where its point stops, and how far a stream that was never
       cut runs on before it fades away.

       There is no white above or below the dots: paper begins and ends on the
       row it was cut on, and the only room an edge takes is the room its own
       shape needs */

    const SIDE = 16;

    const TEAR = 6;
    const TEAR_INSET = 14;

    const NOTCH = 6;
    const NOTCH_INSET = 12;

    /* The white between two pieces of one sheet, which is where a partial cut
       is drawn: a gap of the sheet's own paper, with the wedge in the middle of
       it, so that no wedge ever lies over the dots */

    const GAP = 12;

    const RUNS_ON = 48;

    /* And the teeth a strip is torn off with, on a printer that has no cutter:
       how wide one tooth is and how deep it bites into the paper */

    const TOOTH = 8;
    const BITE = 4;

    /* And whether the page asked for the outline to be brought into view: a
       pane never scrolls because of a click of its own */

    let wanted = false;

    /* How many pixels of the screen a dot of the paper is drawn at. It is two
       thirds of a dot until it is measured, and less than that in a panel too
       narrow for the paper, which the canvas is scaled down to fit: the wedges
       and the teeth of a sheet are placed in pixels, so they are placed at the
       scale the paper is actually drawn at and not at the one it asked for */

    let scale = $state(0);


    /* The box of one operation, in the frame of the surface it was laid out on:
       a text cell takes the spacing behind it, so that the cells of a run touch
       and read as one thing */

    const measure = (operation) => ({
        x: operation.x,
        y: operation.y,
        width: operation.width + (operation.type === 'text' ? (operation.spacing || 0) : 0),
        height: operation.height,
    });

    /* A line box that is printed upside down is composed the right way up and
       turned, so the boxes on it are turned with it */

    const flip = (box, width, height) => ({
        x: width - (box.x + box.width),
        y: height - (box.y + box.height),
        width: box.width,
        height: box.height,
    });

    /* And the print direction of a page mode area turns its whole canvas, which
       is `width` by `height` in the frame the boxes were laid out in. The four
       turns are the ones the renderer's bitmap back-end makes: a quarter turn
       counter-clockwise for direction 1, a half turn for 2 and a quarter turn
       clockwise for 3 */

    const turn = (box, direction, width, height) => {
        if (direction === 1) {
            return { x: box.y, y: width - (box.x + box.width), width: box.height, height: box.width };
        }

        if (direction === 2) {
            return flip(box, width, height);
        }

        if (direction === 3) {
            return { x: height - (box.y + box.height), y: box.x, width: box.height, height: box.width };
        }

        return box;
    }


    /**
     * Where everything the list of a piece draws lands on that piece of paper
     *
     * A piece is the paper between two cuts, with its first row at nought and
     * no cut of its own, so the y of an entry is the row it is printed on and
     * nothing has to be shifted.
     *
     * @param  {object}   layout   The display list of the piece
     * @return {object}            The boxes and the bands they belong to
     */
    const collect = (layout) => {
        let found = [];
        let rows = [];

        const band = (top, height) => rows.push({ top, bottom: top + height }) - 1;

        const put = (operation, band, left, top, transform) => {
            if (!operation.source) {
                return;
            }

            let box = transform(measure(operation));

            found.push({
                x: left + box.x,
                y: top + box.y,
                width: box.width,
                height: box.height,
                source: operation.source,
                band,
            });
        };

        for (let entry of layout.entries) {
            if (entry.type === 'line') {
                let index = band(entry.y, entry.height);

                for (let operation of entry.operations || []) {
                    put(operation, index, 0, entry.y, (box) => entry.rotation === 180 ?
                        flip(box, layout.width, entry.height) : box);
                }

                continue;
            }

            if (entry.type === 'page') {
                let index = band(entry.y, entry.height);

                for (let area of entry.areas || []) {
                    /* An area is laid out in the frame of its direction, which
                       is as wide as the area is tall for the two sideways ones */

                    let sideways = area.direction === 1 || area.direction === 3;
                    let width = sideways ? area.height : area.width;
                    let height = sideways ? area.width : area.height;

                    for (let box of area.entries || []) {
                        if (box.type !== 'line') {
                            continue;
                        }

                        for (let operation of box.operations || []) {
                            put(operation, index, area.x, entry.y + area.y, (inner) => turn({
                                x: inner.x,
                                y: box.y + (box.rotation === 180 ?
                                    box.height - (inner.y + inner.height) : inner.y),
                                width: inner.width,
                                height: inner.height,
                            }, area.direction, width, height));
                        }
                    }
                }

                continue;
            }

            /* A feed is paper and nothing else, and a pulse and an unknown
               command take up no room at all: none of them is ever selected */
        }

        return { found, rows };
    }


    /**
     * Show a stream
     *
     * @param  {object}  stream  The bytes and the settings of the printer that
     *                           reads them, or null when there is no stream
     */
    export const render = (stream) => {
        error = '';
        sheets = [];
        rects = [];
        wanted = false;

        if (!stream) {
            return;
        }

        try {
            let language = stream.language;

            if (!ReceiptPrinterRenderer.languages.includes(language)) {
                throw new Error(`Cannot render ${language} commands`);
            }

            /* Render the commands the way the printer they were sent to would
               print them */

            let width = stream.width;

            /* The cutter of a printer sits above its print head, so a job
               prints that far below the cut edge and the paper is cut that far
               above the row the command was given at: the blank the encoder fed
               in front of its cut is the top of the next piece. A printer with
               no cutter, and one that feeds nothing, move nothing */

            let distance = toDots(stream.cutter, language);

            let renderer = new ReceiptPrinterRenderer(Object.assign({
                language,
                width,
                codepageMapping: stream.codepageMapping,
                commands: [ 'cut', 'pulse', 'feed' ],
            }, distance ? { cutterDistance: distance } : {}));

            /* The list first, because it says what was drawn and where; the dots
               are that same list rasterized, so the two agree by construction.
               Split at the cuts, it is the pieces of paper the printer makes */

            let layout = renderer.layout(stream.bytes);

            /* A printer with no cutter ignores every command that cuts, so what
               it prints is one strip of paper, torn off by hand at either end */

            let cutter = stream.cutter !== false;

            let cuts = layout.entries.filter((entry) => entry.type === 'cut');

            let split = cutter ? pieces(layout) : [];
            let list = split.length ? split : [ layout ];

            /* Where every piece begins and ends on the paper, worked out the way
               pieces() works it out: the rows the paper is cut on, inside it,
               each once, and no piece between two cuts on one row */

            let rows = layout.height;
            let clamp = (value) => Math.max(0, Math.min(rows, value));

            let bounds = [0, ...new Set((cutter ? cuts : []).map((entry) =>
                clamp(entry.y)).sort((a, b) => a - b)), rows];

            let spans = [];

            for (let i = 0; i + 1 < bounds.length; i++) {
                if (bounds[i + 1] > bounds[i]) {
                    spans.push({ top: bounds[i], bottom: bounds[i + 1] });
                }
            }

            /* Every piece as a panel: the dots of it, and the boxes they were
               drawn from. A piece with nothing on it, two cuts in a row, is no
               paper and no panel */

            let panels = list.map((piece) => {
                let items = rasterize(piece, { commands: [ 'cut', 'pulse', 'feed' ] });
                let paper = stitch(items, { width: piece.width || width });

                if (paper.height === 0) {
                    return null;
                }

                let collected = collect(piece);

                return {
                    image: toImageData(paper),
                    boxes: collected.found,
                    bands: collected.rows,
                };
            });

            /* And the sheets those panels are on: a full cut ends the sheet and
               takes it away, a partial cut leaves a gap in the one it is on. A
               stream the pane could not split into the pieces it was given is
               drawn as those pieces and nothing more, rather than wrongly */

            let known = spans.length === list.length;

            let drawn = [];
            let sheet = { panels: [], gaps: [], marks: [], cut: null, torn: !cutter };

            for (let i = 0; i < list.length; i++) {
                if (panels[i]) {
                    sheet.panels.push(panels[i]);
                }

                let here = known ? cuts.filter((entry) => clamp(entry.y) === spans[i].bottom) : [];
                let ending = cutter ? here.find((entry) => entry.value === 'full') : null;

                if (ending) {
                    sheet.cut = ending.source;

                    if (sheet.panels.length) {
                        drawn.push(sheet);
                    }

                    sheet = { panels: [], gaps: [], marks: [], cut: null, torn: false };
                    continue;
                }

                if (!here.length || !sheet.panels.length) {
                    continue;
                }

                /* A partial cut between two pieces is the gap between them; one
                   with no paper behind it is a mark on the paper in front of it */

                if (i + 1 < list.length && panels[i + 1]) {
                    sheet.gaps.push({ after: sheet.panels.length - 1, source: here[0].source });
                    continue;
                }

                let last = sheet.panels[sheet.panels.length - 1];

                sheet.marks.push({
                    panel: sheet.panels.length - 1,
                    row: Math.max(0, last.image.height - CUT),
                    source: here[0].source,
                });
            }

            if (sheet.panels.length) {
                drawn.push(sheet);
            }

            /* Without a cutter there is one strip and no edge to draw for a cut,
               but a cut that is selected still shows the row it was made on, so
               every cut of the stream is a mark on that one strip */

            if (!cutter && drawn.length) {
                drawn[0].marks = cuts.map((entry) => ({ panel: 0, row: clamp(entry.y), source: entry.source }));
            }

            sheets = drawn;
            rects = drawn.map((one) => one.panels.map(() => []));
        }
        catch (e) {
            error = e.message || String(e);
        }
    }


    /* The boxes of a range, which are the boxes whose bytes it holds */

    const overlapping = (panel, range) => panel.boxes.filter((box) =>
        box.source.offset < range.offset + range.length &&
        range.offset < box.source.offset + box.source.length);

    /* And what is drawn for them, which is one rectangle: the bars of a barcode
       with the text under them, the modules of a QR code, the cells of a run of
       text are all one thing on the paper, so the outline is around the whole of
       what the bytes drew and not around every box it was drawn out of. A run
       that was cut in two has a rectangle on either piece, which is where it is */

    const extremes = (list) => {
        /* Walked rather than spread: a run of two hundred thousand cells is two
           hundred thousand arguments to Math.min, which is a stack overflow */

        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;

        for (let box of list) {
            left = Math.min(left, box.x);
            top = Math.min(top, box.y);
            right = Math.max(right, box.x + box.width);
            bottom = Math.max(bottom, box.y + box.height);
        }

        return { x: left, y: top, width: right - left, height: bottom - top };
    }

    const bounds = (list) => list.length ? [ extremes(list) ] : [];

    /* A cut draws nothing of its own, so what is shown for it is the row it was
       made on: the bottom of the paper in front of it for a cut that took the
       sheet away or that gapped it, and the row itself for a cut on a strip a
       printer without a cutter never cut at all */

    const at = (panel, row) => ({
        x: 0,
        y: Math.max(0, Math.min(row, panel.image.height - CUT)),
        width: panel.image.width,
        height: Math.min(CUT, panel.image.height),
    });

    const holds = (source, range) => source &&
        source.offset < range.offset + range.length &&
        range.offset < source.offset + source.length;

    /**
     * Outline what a range of the stream drew, and nothing when there is none
     *
     * @param  {?object}   range     The `{offset, length}` of the selection, or null
     * @param  {object}    options   `scroll`, whether to bring the outline into view
     */
    export const select = (range, { scroll = false } = {}) => {
        rects = sheets.map((sheet) => {
            let list = sheet.panels.map((panel) => range ? bounds(overlapping(panel, range)) : []);

            if (!range) {
                return list;
            }

            for (let gap of sheet.gaps) {
                if (holds(gap.source, range)) {
                    list[gap.after].push(at(sheet.panels[gap.after], Infinity));
                }
            }

            if (holds(sheet.cut, range) && list.length) {
                list[list.length - 1].push(at(sheet.panels[list.length - 1], Infinity));
            }

            for (let mark of sheet.marks) {
                if (holds(mark.source, range) && list[mark.panel]) {
                    list[mark.panel].push(at(sheet.panels[mark.panel], mark.row));
                }
            }

            return list;
        });

        wanted = scroll && rects.some((one) => one.some((list) => list.length));
    }


    /* What is under a point of a piece: the band it is in, which is the line or
       the page the pointer is over, and then the box of that band it is in. A
       point beside the boxes of its line, in the white of the paper, is a point
       that drew nothing */

    const pick = (panel, x, y) => {
        let index = -1;

        /* A later entry is printed over an earlier one, which a reverse feed
           makes possible, so the last band that holds the point is the one on
           top of the paper */

        for (let i = 0; i < panel.bands.length; i++) {
            if (y >= panel.bands[i].top && y < panel.bands[i].bottom) {
                index = i;
            }
        }

        if (index < 0) {
            return null;
        }

        let band = panel.boxes.filter((box) => box.band === index);

        let hit = band.find((box) => x >= box.x && x < box.x + box.width &&
            y >= box.y && y < box.y + box.height);

        if (hit) {
            return hit;
        }

        /* The white between two bars of a barcode, or between two modules of a
           QR code, is part of the thing they are: what a click falls back to is
           the whole of what one command drew on this line, which is the
           rectangle the selection would be outlined with */

        let groups = new Map();

        for (let box of band) {
            let key = `${box.source.offset}:${box.source.length}`;
            let group = groups.get(key);

            if (group) {
                group.push(box);
                continue;
            }

            groups.set(key, [ box ]);
        }

        for (let group of groups.values()) {
            let box = extremes(group);

            if (x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height) {
                return group[0];
            }
        }

        return null;
    }

    /* The canvases of the panels, in the order they are on the page, which is
       how the one of a panel is found again */

    const canvasAt = (sheet, panel) => {
        let index = panel;

        for (let i = 0; i < sheet; i++) {
            index += sheets[i].panels.length;
        }

        return element?.querySelectorAll('.dots canvas')[index] || null;
    }

    const click = (event, index, which) => {
        let panel = sheets[index]?.panels[which];
        let canvas = event.currentTarget.querySelector('canvas');

        if (!onselect || !panel || !canvas) {
            return;
        }

        let box = canvas.getBoundingClientRect();

        if (!box.width || !box.height) {
            return;
        }

        let x = (event.clientX - box.left) / box.width * panel.image.width;
        let y = (event.clientY - box.top) / box.height * panel.image.height;

        let hit = pick(panel, x, y);

        onselect(hit ? { offset: hit.source.offset } : null);
    }


    /* The shape of a piece of paper.

       Its top edge is the tear it was pulled off the roll or off the piece
       before it with: straight, and rising to a point at the right. A piece a
       full cut took away ends in the same tear the other way up, the corner
       gone; a piece nothing cut ends where the paper still runs, and fades out
       rather than ending at all. And a partial cut is a wedge out of the left
       edge, tapering to a point that stops short of the right, which is the
       sliver of paper that holds the sheet together. It sits above the row the
       cut was made on, so the line printed after it keeps all of its rows.

       It is a clip path of the sheet, so the grey of the panel shows through
       every edge of it, the overlay of the selection included. */

    const shape = (sheet) => {
        /* A strip that was torn off by hand, from a printer with no cutter, has
           a row of teeth at either end and nothing else: no tear of a cut, and
           no notch, since a cut this printer never made left no edge */

        if (sheet.torn) {
            return `polygon(${[
                ...teeth(sheet, 1),
                ...teeth(sheet, -1).reverse(),
            ].join(', ')})`;
        }

        let points = [
            `0 ${TEAR}px`,
            `calc(100% - ${TEAR_INSET}px) ${TEAR}px`,
            '100% 0',
        ];

        if (sheet.cut) {
            points.push(`100% calc(100% - ${TEAR}px)`, `calc(100% - ${TEAR_INSET}px) 100%`);
        }
        else {
            points.push('100% 100%');
        }

        points.push('0 100%');

        /* And back up the left edge, through the wedge of every partial cut,
           the lowest one first. A wedge sits in the middle of the gap between
           two pieces, so it is white on either side of it and never over the
           dots: it is deepest at the left edge and closes to a point short of
           the right, where the sliver of paper holds the sheet together */

        let list = [...gaps(sheet)].sort((a, b) => b - a);

        for (let middle of list) {
            points.push(
                `0 ${round(middle + NOTCH / 2)}px`,
                `calc(100% - ${NOTCH_INSET}px) ${round(middle)}px`,
                `0 ${round(middle - NOTCH / 2)}px`,
            );
        }

        return `polygon(${points.join(', ')})`;
    }

    /* Where the gaps of a sheet are, in pixels from its top edge: the panels
       above a gap, at the height they are drawn at, and the gaps between them */

    const gaps = (sheet) => {
        let found = [];
        let top = GAP;

        for (let i = 0; i < sheet.panels.length - 1; i++) {
            top += sheet.panels[i].image.height * factor(sheet);

            if (sheet.gaps.some((gap) => gap.after === i)) {
                found.push(top + GAP / 2);
            }

            top += GAP;
        }

        return found;
    }

    /* One edge of a torn strip: a row of teeth across the paper, at the top of
       the sheet or, upside down, at the bottom of it. They are laid out in whole
       teeth across the width of the sheet, so that the row begins and ends on
       the edge however wide the paper is */

    const teeth = (sheet, way) => {
        let edge = way > 0 ? `${BITE}px` : `calc(100% - ${BITE}px)`;
        let point = way > 0 ? '0px' : '100%';

        let across = span(sheet);
        let count = Math.max(1, Math.round(across / TOOTH));
        let step = across / count;

        let list = [ `0 ${edge}` ];

        for (let i = 0; i < count; i++) {
            list.push(`${round((i + 0.5) * step)}px ${point}`);

            list.push(i === count - 1 ? `100% ${edge}` : `${round((i + 1) * step)}px ${edge}`);
        }

        return list;
    }

    /* How wide a sheet is, which is the canvas it holds and the white beside it */

    const span = (sheet) => sheet.panels[0].image.width * factor(sheet) + 2 * SIDE;

    /* How many pixels of the screen a dot of the paper is shown at, which is the
       width the canvas was given over the width it holds */

    const factor = (sheet) => scale || Math.round(sheet.panels[0].image.width * SCALE) / sheet.panels[0].image.width;

    const round = (value) => Math.round(value * 100) / 100;

    /* The white a sheet carries above and below its dots: an edge that is a cut
       carries the same room a partial cut leaves between two pieces, with the
       rise of its tear inside that room, so that paper cut at either end and
       paper gapped in the middle read alike. A strip torn off by hand carries
       the room its teeth need, and the last sheet of a stream that was never cut
       the paper it runs on for before it fades away */

    const padding = (sheet, last) => sheet.torn ?
        `${BITE}px ${SIDE}px ${BITE}px` :
        `${GAP}px ${SIDE}px ${running(sheet, last) ? RUNS_ON : GAP}px`;

    /* A strip that was torn off ends where it was torn, so it never runs on */

    const running = (sheet, last) => last && !sheet.cut && !sheet.torn;

    /* A canvas is painted when it is put in the page, which is what an action is
       for. The list of pieces is keyed by the pieces themselves, so a canvas is
       never handed another piece than the one it was made for */

    const paint = (canvas, image) => {
        const draw = (data) => {
            try {
                canvas.width = data.width;
                canvas.height = data.height;
                canvas.getContext('2d').putImageData(data, 0, 0);
            }
            catch (error) {
                /* A piece of paper taller than the browser will put on a canvas,
                   which is a stream of some hundred thousand rows, is left blank
                   rather than taken for a failure of the page: the boxes of that
                   piece are there all the same, and the piece after it is drawn */
            }
        };

        draw(image);
    }


    /* The scale the paper ends up being drawn at, which is the canvas it was
       given over the dots it holds: a panel too narrow for the paper scales it
       down, and the edges of the sheet follow it */

    $effect(() => {
        sheets;

        if (!element) {
            return;
        }

        const measured = () => {
            let canvas = element.querySelector('.dots canvas');

            if (!canvas || !canvas.width) {
                return;
            }

            let next = canvas.getBoundingClientRect().width / canvas.width;

            if (next && Math.abs(next - scale) > 0.0001) {
                scale = next;
            }
        };

        measured();

        let observer = new ResizeObserver(measured);

        observer.observe(element);

        return () => observer.disconnect();
    });


    /* What scrolls the pane is the panel it was put in, which is whatever
       ancestor scrolls up the page from here, the way the hex dump finds its own */

    const scrolling = (node) => {
        for (let parent = node?.parentElement; parent; parent = parent.parentElement) {
            let overflow = getComputedStyle(parent).overflowY;

            if (overflow === 'auto' || overflow === 'scroll') {
                return parent;
            }
        }

        return null;
    }

    /* An outline that has just been drawn is brought into view, a third of the
       way down the panel, unless it is already there. A selection that is on
       more than one piece is followed to the first of them */

    $effect(() => {
        let list = rects;

        element;

        if (!wanted) {
            return;
        }

        let index = list.findIndex((one) => one.some((panel) => panel.length));
        let which = index < 0 ? -1 : list[index].findIndex((panel) => panel.length);
        let canvas = index < 0 ? null : canvasAt(index, which);

        if (!canvas) {
            return;
        }

        wanted = false;

        let scroller = scrolling(canvas);

        if (!scroller) {
            return;
        }

        let rect = list[index][which][0];
        let box = canvas.getBoundingClientRect();
        let factor = box.height / (sheets[index].panels[which].image.height || 1);

        let top = box.top - scroller.getBoundingClientRect().top + scroller.scrollTop
            + rect.y * factor;

        if (top >= scroller.scrollTop &&
            top + rect.height * factor <= scroller.scrollTop + scroller.clientHeight) {
            return;
        }

        scroller.scrollTo({
            top: Math.max(0, top - scroller.clientHeight / 3),
            behavior: 'smooth',
        });
    });

</script>

{#if !view || $view === 'image'}
    {#if error}
        <div class="error">{error}</div>
    {:else}
        <div class="pieces" bind:this={element}>
            <!-- Keyed by the piece itself: a render builds new pieces, so their
                 canvases are new elements that the action paints as they arrive,
                 rather than elements kept from the piece that was there before -->

            {#each sheets as sheet, index (sheet)}
                <div
                    class="sheet"
                    class:running={running(sheet, index === sheets.length - 1)}
                    style="clip-path: {shape(sheet)}; padding: {padding(sheet, index === sheets.length - 1)};"
                >
                    {#each sheet.panels as panel, which}
                        {#if which > 0}
                            <div class="gap"></div>
                        {/if}

                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div
                            class="dots"
                            class:selectable={!!onselect}
                            onclick={(event) => click(event, index, which)}
                        >
                            <canvas use:paint={panel.image} style="width: {Math.round(panel.image.width * SCALE)}px;"></canvas>

                            {#if onselect}
                                <svg viewBox="0 0 {panel.image.width} {panel.image.height}" aria-hidden="true">
                                    {#each rects[index]?.[which] || [] as rect}
                                        <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx="2" ry="2" />
                                    {/each}
                                </svg>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/each}
        </div>
    {/if}
{/if}

<style>

    /* A piece of paper, with the next one under it: the margins of two of them
       fall together, so the gap between two pieces is the same as the one above
       the first and below the last. Its edges are the clip path of the shape it
       was torn and cut into, which the markup gives it, and so is the white it
       carries around its dots */

    .sheet {
        background: #fff;
        box-sizing: border-box;
        margin: 24px auto;
        width: max-content;
        max-width: 100%;
    }

    /* A stream that was never cut is paper that still runs, so the last piece of
       it fades away rather than ending */

    .sheet.running {
        -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 48px), transparent);
        mask-image: linear-gradient(to bottom, black calc(100% - 48px), transparent);
    }

    .dots.selectable {
        cursor: pointer;
    }

    /* The white between two pieces of one sheet, which a partial cut left */

    .gap {
        height: 12px;
    }

    /* The canvas and the overlay over it are one thing of the same size, which
       is what the canvas is given: the overlay follows it rather than the other
       way round */

    .dots {
        position: relative;
        max-width: 100%;
        line-height: 0;
    }

    canvas {
        display: block;
        max-width: 100%;
        height: auto;
    }

    /* The outline is drawn in the dots of the paper and scaled with it, so the
       rectangles are the boxes of the list and nothing is worked out twice. The
       stroke is not scaled, so it is two pixels wherever the paper is shown at */

    svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
    }

    svg rect {
        fill: rgba(33, 150, 243, 0.15);
        stroke: #2196F3;
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
    }

    .error {
        background: #f0f0f0;
        border-radius: 6px;
        font-family: var(--font-stack-mono);
        font-size: 11px;
        margin: 16px 0;
        padding: 6px 8px;
        color: #000;
    }

</style>
