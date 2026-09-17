<script>

    import { untrack } from 'svelte';

    /*
        The bytes of a stream as a hex dump.

        A row per sixteen bytes: the offset, the bytes as cells in the style of
        the Decoded pane, and the bytes as text, with a middle dot for the space
        and for everything that is not printable ASCII.

        A print job with images runs to hundreds of kilobytes, which is tens of
        thousands of rows, and no browser draws those. So the pane draws only
        the rows that are in view and a margin around them, worked out from the
        scroll position of the panel it sits in and the height of a row, which
        is fixed; a spacer of the height of every row keeps the scrollbar the
        size it would be if they were all there.
    */

    /**
     * @prop {object} view - The store of the tab that is shown, on a page whose
     *                       panes take turns; a pane given no view is always shown
     * @prop {?Function} onselect - Called with the `{offset}` of the cell that was
     *                       clicked. A pane given none is a pane nothing is
     *                       clicked in
     */
    let { view = null, onselect = null } = $props();

    /* The bytes of a row, the height of a row in pixels, which the stylesheet
       below gives it, and the rows drawn above and below the ones in view, so
       that a scroll of a few rows has nothing to redraw */

    const LIMIT = 16;
    const ROW = 18;
    const MARGIN = 32;


    /* Every byte written once, rather than once per row it appears in: a cell
       of two digits, and the character the text column shows for it */

    const CELLS = [];
    const CHARACTERS = [];

    /* The space and everything that is not printable ASCII are the middle dot
       of the Decoded pane */

    const DOT = '<span class="dot">·</span>';

    for (let value = 0; value < 256; value++) {
        CELLS[value] = `<span class="cell">${value.toString(16).padStart(2, 0).toUpperCase()}</span>`;

        /* A character is a span of its own, as a cell is, so that it can be
           counted from where it sits in the row and clicked like one */

        CHARACTERS[value] = `<span class="char">${value > 0x20 && value < 0x7f ?
            (value === 0x26 ? '&amp;' : value === 0x3c ? '&lt;' : value === 0x3e ? '&gt;' :
                String.fromCharCode(value)) :
            DOT}</span>`;
    }

    /* A last row that is short leaves its missing cells empty, so that the text
       column stays where it is on every other row. A cell of no byte is no
       click target, which is what the class says */

    const EMPTY = '<span class="cell empty"></span>';

    /* And the same cells and characters marked, which is what the bytes of the
       selection wear */

    const MARKED = CELLS.map((cell) => cell.replace('class="cell"', 'class="cell selected"'));
    const MARKED_CHARACTERS = CHARACTERS.map((char) => char.replace('class="char"', 'class="char selected"'));


    let bytes = $state.raw(null);

    let element = $state(null);
    let container = $state(null);

    /* The range of the stream that is marked, which the rows are drawn against
       rather than painted over afterwards: the rows come and go while the pane
       is scrolled, and a mark that is part of a row comes back with it */

    let range = $state.raw(null);

    /* And whether the row it starts on is to be brought into view, which is
       asked for by the page and not by the pane: a pane never scrolls because
       of a click of its own */

    let wanted = false;

    /* The range of rows that is drawn, and where the block of them sits */

    let first = $state(0);
    let last = $state(0);

    let scroller = null;


    let rows = $derived(bytes ? Math.ceil(bytes.length / LIMIT) : 0);

    /* The offset is as wide as the last row needs, an even number of digits and
       never fewer than four */

    let digits = $derived(Math.max(4, Math.ceil(((rows - 1) * LIMIT).toString(16).length / 2) * 2));

    /* The rows that are drawn, as HTML rather than as components: a row is
       thirty odd elements, and a few thousand of those come and go while the
       pane is scrolled */

    let html = $derived.by(() => {
        if (!bytes) {
            return '';
        }

        let result = '';
        let marked = range;

        for (let row = first; row < last; row++) {
            let offset = row * LIMIT;
            let cells = '';
            let text = '';

            for (let index = offset; index < offset + LIMIT; index++) {
                if (index >= bytes.length) {
                    cells += EMPTY;
                    continue;
                }

                /* A byte of the selection is marked in both columns, the hex
                   and the text, so that a run of it reads as one thing */

                if (marked && index >= marked.offset && index < marked.offset + marked.length) {
                    cells += MARKED[bytes[index]];
                    text += MARKED_CHARACTERS[bytes[index]];
                    continue;
                }

                cells += CELLS[bytes[index]];
                text += CHARACTERS[bytes[index]];
            }

            result += '<div class="row">'
                + `<span class="offset">${offset.toString(16).padStart(digits, 0).toUpperCase()}</span>`
                + `<span class="bytes">${cells}</span>`
                + `<span class="text">${text}</span>`
                + '</div>';
        }

        return result;
    });


    /**
     * Show a stream
     *
     * @param  {object}  stream  The bytes and the settings of the printer that
     *                           reads them, or null when there is no stream
     */
    export const render = (stream) => {
        let data = stream && stream.bytes.length ? stream.bytes : null;

        /* The same bytes are the same rows, read where the pane was left off: a
           model that changed, or a panel that came or went, is nothing a hex
           dump depends on, and it is asked to render again for both */

        if (data === bytes) {
            return;
        }

        /* Another file is read from its first byte, wherever the one before it
           was left; the effect below scrolls the panel back up to it */

        bytes = data;

        first = 0;
        last = 0;
    }


    /**
     * Mark a range of the stream, and nothing when there is none
     *
     * @param  {?object}  selection  The `{offset, length}` to mark, or null
     * @param  {object}   options    `scroll`, whether to bring the first row into view
     */
    export const highlight = (selection, { scroll = false } = {}) => {
        range = selection || null;
        wanted = scroll && range !== null;
    }


    /* What scrolls the pane is the panel it was put in, which is whatever
       ancestor scrolls up the page from here */

    const scrolling = (node) => {
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
            let overflow = getComputedStyle(parent).overflowY;

            if (overflow === 'auto' || overflow === 'scroll') {
                return parent;
            }
        }

        return null;
    }

    /* Which rows are in view, from the top of the block of rows against the top
       of what scrolls it. A pane that scrolls with the page rather than in a
       panel of its own is measured against the window */

    const measure = () => {
        if (!container) {
            return;
        }

        let top = 0;
        let height = window.innerHeight;

        if (scroller) {
            top = scroller.getBoundingClientRect().top;
            height = scroller.clientHeight;
        }

        let start = top - container.getBoundingClientRect().top;

        let from = Math.max(0, Math.floor(start / ROW) - MARGIN);
        let to = Math.min(rows, Math.ceil((start + height) / ROW) + MARGIN);

        /* Nothing is redrawn while the rows that are drawn are the rows that
           are wanted, which is every scroll inside the margin */

        if (from !== first || to !== last) {
            first = from;
            last = to;
        }
    }


    /* The pane is measured while it exists, which is while its panel is shown:
       a panel that is switched off and on again is a pane that starts over */

    $effect(() => {
        if (!element) {
            return;
        }

        scroller = scrolling(element);

        let target = scroller || window;
        let observer = null;

        target.addEventListener('scroll', measure, { passive: true });

        if (scroller) {
            observer = new ResizeObserver(measure);
            observer.observe(scroller);
        }
        else {
            window.addEventListener('resize', measure);
        }

        untrack(measure);

        return () => {
            target.removeEventListener('scroll', measure);
            observer?.disconnect();
            window.removeEventListener('resize', measure);

            scroller = null;
        };
    });

    /* And a stream that has just been given to the pane is shown from its first
       row, with the panel scrolled back up to it */

    $effect(() => {
        bytes;
        container;

        if (scroller) {
            scroller.scrollTop = 0;
        }

        /* What the pane measures is state it writes itself, which is no reason
           for either effect to run again */

        untrack(measure);
    });

    /* A range that has just been marked is brought into view, a third of the way
       down the panel, unless the row it starts on is already there. Which rows
       are drawn follows from the scroll, so the marks arrive with them */

    $effect(() => {
        let marked = range;

        container;

        if (!marked || !scroller || !container || !wanted) {
            return;
        }

        wanted = false;

        untrack(() => {
            let row = Math.floor(marked.offset / LIMIT);

            /* Where that row sits in what the panel scrolls, which is where the
               rows begin plus the rows above it */

            let top = container.getBoundingClientRect().top - scroller.getBoundingClientRect().top
                + scroller.scrollTop + row * ROW;

            if (top >= scroller.scrollTop && top + ROW <= scroller.scrollTop + scroller.clientHeight) {
                return;
            }

            scroller.scrollTo({
                top: Math.max(0, top - scroller.clientHeight / 3),
                behavior: 'smooth',
            });

            /* The rows follow the scroll, which fires for every frame of it, so
               the ones that arrive under the pointer are drawn as it goes */

            measure();
        });
    });


    /* The rows are HTML rather than components, so a click on a cell is one
       listener on the pane: which byte it is follows from the offset of the row
       it is in and where the cell sits in that row */

    const click = (event) => {
        if (!onselect) {
            return;
        }

        /* A byte is its cell in the hex column and its character in the text
           column, and the filler of a short last row is neither */

        let cell = event.target.closest?.('.bytes .cell:not(.empty), .text .char');
        let row = cell?.closest('.row');

        if (!cell || !row) {
            return;
        }

        let offset = parseInt(row.querySelector('.offset')?.textContent || '', 16);
        let index = [...cell.parentElement.children].indexOf(cell);

        if (Number.isNaN(offset) || index < 0) {
            return;
        }

        onselect({ offset: offset + index });
    }

</script>

{#if !view || $view === 'hex'}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="hex" class:selectable={!!onselect} bind:this={element} onclick={click}>
        <div class="spacer" bind:this={container} style="height: {rows * ROW}px;">
            <div class="window" style="top: {first * ROW}px;">{@html html}</div>
        </div>
    </div>
{/if}

<style>

    .hex {
        padding-top: 16px;
        padding-bottom: 16px;
    }

    /* The spacer is as tall as every row of the stream, so that the scrollbar
       says how much there is, and the rows that are drawn are put at the height
       of the first of them */

    .spacer {
        position: relative;
    }

    .window {
        position: absolute;
        left: 0;
    }

    /* A row is of a height the pane can count with, and never wraps: a panel
       too narrow for sixteen bytes scrolls sideways, which it allows */

    .hex :global(.row) {
        display: flex;
        gap: 0 12px;
        height: 18px;
        line-height: 18px;
        white-space: nowrap;
        color: #000;
    }

    .hex :global(.offset) {
        color: #888;
    }

    /* The bytes in the cells of the Decoded pane, a cell of two digits wide so
       that a row that is short lines up with the rows above it */

    .hex :global(.bytes) {
        display: flex;
        gap: 0 6px;
    }

    .hex :global(.cell) {
        min-width: 2ch;
        text-align: center;
    }

    .hex :global(.dot) {
        color: #aaa;
    }

    /* The bytes of the selection, in the blue the page connects a printer with,
       in the hex column and in the text column alike */

    .hex :global(.selected) {
        background: #bbdefb;
        color: #1976d2;
    }

    /* A cell of the hex column reaches into the gap beside it and is pulled
       back by as much, so that a run of them is one bar across the row rather
       than a row of separate marks, and nothing moves */

    .hex :global(.bytes .cell.selected) {
        padding: 0 3px;
        margin: 0 -3px;
    }

    .hex :global(.selected .dot) {
        color: #1976d2;
    }

    /* A byte is picked up by a click on a page that selects, in either column;
       the filler of a short last row is not a byte */

    .selectable :global(.bytes .cell:not(.empty)),
    .selectable :global(.text .char) {
        cursor: pointer;
    }

</style>
