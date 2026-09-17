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
     */
    let { view = null } = $props();

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

        CHARACTERS[value] = value > 0x20 && value < 0x7f ?
            (value === 0x26 ? '&amp;' : value === 0x3c ? '&lt;' : value === 0x3e ? '&gt;' :
                String.fromCharCode(value)) :
            DOT;
    }

    /* A last row that is short leaves its missing cells empty, so that the text
       column stays where it is on every other row */

    const EMPTY = '<span class="cell"></span>';


    let bytes = $state.raw(null);

    let element = $state(null);
    let container = $state(null);

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

        for (let row = first; row < last; row++) {
            let offset = row * LIMIT;
            let cells = '';
            let text = '';

            for (let index = offset; index < offset + LIMIT; index++) {
                if (index < bytes.length) {
                    cells += CELLS[bytes[index]];
                    text += CHARACTERS[bytes[index]];
                }
                else {
                    cells += EMPTY;
                }
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

</script>

{#if !view || $view === 'hex'}
    <div class="hex" bind:this={element}>
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

</style>
