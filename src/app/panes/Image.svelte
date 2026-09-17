<script>

    import ReceiptPrinterRenderer, { rasterize, stitch, pieces, toImageData } from '@point-of-sale/receipt-printer-renderer';

    /*
        The paper, as the printer would print it.

        What comes out of a printer is pieces of paper, one per cut, so that is
        what this pane shows: the stream is split at its cuts and every piece is
        drawn on a sheet of its own. A stream that was never cut is one piece.

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

    /* The pieces of paper: the image of each, and what was drawn where on it */

    let sheets = $state.raw([]);

    /* What is outlined on each of them, one rectangle per piece at most */

    let rects = $state.raw([]);

    /* The paper is shown at two thirds of its size in dots */

    const SCALE = 0.66;

    /* And the edge a cut leaves is drawn as two rows, the height the dashed
       marker of a joined paper has */

    const CUT = 2;

    /* And whether the page asked for the outline to be brought into view: a
       pane never scrolls because of a click of its own */

    let wanted = false;


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

            let renderer = new ReceiptPrinterRenderer({
                language,
                width,
                codepageMapping: stream.codepageMapping,
                commands: [ 'cut', 'pulse', 'feed' ],
            });

            /* The list first, because it says what was drawn and where; the dots
               are that same list rasterized, so the two agree by construction.
               Split at the cuts, it is the pieces of paper that leave the
               printer, and a stream that was never cut is one of them */

            let layout = renderer.layout(stream.bytes);
            let split = pieces(layout);
            let list = split.length ? split : [ layout ];

            /* Which piece every cut ended, so that a cut that is selected can be
               shown on the paper it took away. A cut that came before any paper
               was printed, and the second of two cuts on one row, ended no piece
               and is drawn nowhere */

            let ends = [];

            if (split.length) {
                let paper = 0;
                let index = 0;

                for (let entry of layout.entries) {
                    if (entry.type !== 'cut') {
                        continue;
                    }

                    if (entry.y > paper && index < split.length) {
                        ends[index] = entry.source;

                        paper = entry.y;
                        index++;
                    }
                }
            }

            let drawn = [];

            for (let piece of list) {
                let items = rasterize(piece, { commands: [ 'cut', 'pulse', 'feed' ] });
                let paper = stitch(items, { width: piece.width || width });

                /* A piece with nothing on it, two cuts in a row, is no paper */

                if (paper.height === 0) {
                    continue;
                }

                let collected = collect(piece);

                drawn.push({
                    image: toImageData(paper),
                    boxes: collected.found,
                    bands: collected.rows,
                    cut: ends[drawn.length] || null,
                });
            }

            sheets = drawn;
            rects = drawn.map(() => []);
        }
        catch (e) {
            error = e.message || String(e);
        }
    }


    /* The boxes of a range, which are the boxes whose bytes it holds */

    const overlapping = (sheet, range) => sheet.boxes.filter((box) =>
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


    /**
     * Outline what a range of the stream drew, and nothing when there is none
     *
     * @param  {?object}   range     The `{offset, length}` of the selection, or null
     * @param  {object}    options   `scroll`, whether to bring the outline into view
     */
    const holds = (source, range) => source &&
        source.offset < range.offset + range.length &&
        range.offset < source.offset + source.length;

    export const select = (range, { scroll = false } = {}) => {
        rects = sheets.map((sheet) => {
            if (!range) {
                return [];
            }

            let list = bounds(overlapping(sheet, range));

            /* A cut draws nothing of its own, so what is shown for it is the
               edge the paper was cut on, which is the bottom of this piece */

            if (holds(sheet.cut, range)) {
                list.push({
                    x: 0,
                    y: Math.max(0, sheet.image.height - CUT),
                    width: sheet.image.width,
                    height: Math.min(CUT, sheet.image.height),
                });
            }

            return list;
        });

        wanted = scroll && rects.some((list) => list.length);
    }


    /* What is under a point of a piece: the band it is in, which is the line or
       the page the pointer is over, and then the box of that band it is in. A
       point beside the boxes of its line, in the white of the paper, is a point
       that drew nothing */

    const pick = (sheet, x, y) => {
        let index = -1;

        /* A later entry is printed over an earlier one, which a reverse feed
           makes possible, so the last band that holds the point is the one on
           top of the paper */

        for (let i = 0; i < sheet.bands.length; i++) {
            if (y >= sheet.bands[i].top && y < sheet.bands[i].bottom) {
                index = i;
            }
        }

        if (index < 0) {
            return null;
        }

        let band = sheet.boxes.filter((box) => box.band === index);

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

    /* The canvas of a piece, which is the one in its sheet */

    const sheetCanvas = (index) => element?.querySelectorAll('.sheet canvas')[index] || null;

    const click = (event, index) => {
        let sheet = sheets[index];
        let canvas = sheetCanvas(index);

        if (!onselect || !sheet || !canvas) {
            return;
        }

        let box = canvas.getBoundingClientRect();

        if (!box.width || !box.height) {
            return;
        }

        let x = (event.clientX - box.left) / box.width * sheet.image.width;
        let y = (event.clientY - box.top) / box.height * sheet.image.height;

        let hit = pick(sheet, x, y);

        onselect(hit ? { offset: hit.source.offset } : null);
    }


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

        let index = list.findIndex((one) => one.length);
        let canvas = index < 0 ? null : sheetCanvas(index);

        if (!canvas) {
            return;
        }

        wanted = false;

        let scroller = scrolling(canvas);

        if (!scroller) {
            return;
        }

        let rect = list[index][0];
        let box = canvas.getBoundingClientRect();
        let factor = box.height / (sheets[index].image.height || 1);

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
                <div class="paper">
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div class="sheet" class:selectable={!!onselect} onclick={(event) => click(event, index)}>
                        <canvas use:paint={sheet.image} style="width: {Math.round(sheet.image.width * SCALE)}px;"></canvas>

                        {#if onselect}
                            <svg viewBox="0 0 {sheet.image.width} {sheet.image.height}" aria-hidden="true">
                                {#each rects[index] || [] as rect}
                                    <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx="2" ry="2" />
                                {/each}
                            </svg>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/if}
{/if}

<style>

    /* A piece of paper, with the next one under it: the margins of two of them
       fall together, so the gap between two pieces is the same as the one above
       the first and below the last */

    .paper {
        background: #fff;
        box-sizing: border-box;
        padding: 32px;
        margin: 24px auto;
        width: max-content;
        max-width: 100%;
    }

    /* The canvas and the overlay over it are one thing of the same size, which
       is what the canvas is given: the overlay follows it rather than the other
       way round */

    .sheet {
        position: relative;
        max-width: 100%;
        line-height: 0;
    }

    .sheet.selectable {
        cursor: pointer;
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
