<script>

    import { onMount } from 'svelte';

    /*
        The gutter between two panes.

        The panes are columns of the grid of the page and this is a column
        between two of them, a few pixels wide and as tall as they are. What it
        drags is `--split`, or whatever the name of the gutter is, the width of
        everything to the left of it, which the grid clamps to a minimum of its
        own and which is kept in the browser under that same name, so that the
        split a person set is the split they come back to.

        A page with more than one gutter gives every one of them a name and the
        row and column it sits in; the playground, which has one, takes the
        defaults.

        What is dragged is the width of the pane in front of the gutter, which
        is measured from the left edge of that pane rather than from the edge of
        the page: on a page where the gutter is the first one the two are the
        same, and on a page with a gutter further along it is the second one
        that means anything. The pane in front is the element before this one,
        which is where the origin comes from.
    */

    /**
     * @prop {Function} onresize - Called while the split moves, for whatever has to be told
     * @prop {string} name - The name of the variable that is dragged, and the key it is kept under
     * @prop {number} column - The column of the grid the gutter sits in
     * @prop {number} row - The row of the grid the gutter sits in
     * @prop {string} label - What the gutter is called, for whoever cannot see it
     * @prop {string} background - The colour of the gutter, which is the colour of the pane behind it
     * @prop {number} minimum - What a pane beside the gutter is never narrower
     *                          than. The default is the minimum the grid of the
     *                          playground clamps its columns to, and a page that
     *                          gives another has to give its grid the same one
     * @prop {?number|Function} reserve - The room that has to stay behind the
     *                          gutter, or a function that is asked for it. A
     *                          page with one gutter leaves it out and the room
     *                          is the gutter and the pane behind it
     * @prop {?Function} initial - Where the pane in front begins when nothing
     *                          was kept. A page with one gutter leaves it out
     *                          and the pane begins at half the room
     */
    let {
        onresize = null,
        name = 'split',
        column = 2,
        row = 3,
        label = 'Resize the editor',
        background = '#fafafa',
        minimum = 240,
        reserve = null,
        initial = null,
    } = $props();

    let element = $state(null);
    let dragging = $state(false);

    /* How far an arrow key moves the split */

    const STEP = 16;

    let width = $state(0);

    /* Where the pane in front of the gutter begins, which is what its width is
       measured from. The first gutter of a page sits against the edge and the
       origin is nought; a gutter further along starts where the pane before it
       does */

    const origin = () => element?.previousElementSibling?.getBoundingClientRect().left || 0;

    /* What has to stay behind the gutter. A page with one gutter keeps the
       gutter and the pane behind it; a page with more says so itself, and says
       it as a function when the answer depends on where its other gutters have
       got to */

    const room = () => {
        if (reserve === null || reserve === undefined) {
            return minimum + (element?.offsetWidth || 6);
        }

        return typeof reserve === 'function' ? reserve() : reserve;
    }

    /* The room the pane in front of the gutter has, which is what is left of
       the window behind its own edge, less everything behind the gutter */

    const limit = (value, from = origin()) => Math.max(minimum,
        Math.min(value, window.innerWidth - from - room()));

    /* Where the pane in front begins when nothing was kept: half the room on a
       page with one gutter, and whatever the page says on a page with more */

    const begin = () => initial ? initial() : (window.innerWidth - origin()) / 2;

    const apply = (value, remember = true, from = origin()) => {
        width = limit(value, from);

        document.body.style.setProperty(`--${name}`, `${Math.round(width)}px`);

        if (remember) {
            try {
                localStorage.setItem(name, String(Math.round(width)));
            }
            catch (error) {
                /* A browser that keeps nothing is a browser that starts halfway
                   every time, which is no reason to fail */
            }
        }

        onresize?.();
    }

    onMount(() => {
        let stored = null;

        try {
            stored = localStorage.getItem(name);
        }
        catch (error) {
            stored = null;
        }

        if (stored !== null && !Number.isNaN(parseFloat(stored))) {
            apply(parseFloat(stored), false);
        }
        else {
            /* Half the room, which is what the grid does on its own until
               something moves the split */

            width = element ? element.getBoundingClientRect().left - origin() : begin();
        }

        /* A window that narrows past the split takes the split with it */

        const resized = () => {
            if (width) {
                apply(width, false);
            }
        };

        window.addEventListener('resize', resized);

        return () => window.removeEventListener('resize', resized);
    });


    /* The drag. The pointer is captured, so that it can leave the gutter and
       the split still follows it, and the page selects no text while it does */

    let offset = 0;
    let start = 0;

    const down = (event) => {
        if (event.button !== 0) {
            return;
        }

        /* Where the split is at this moment, so that a click that drags nothing
           leaves it where it was. The pane in front does not move while the
           gutter does, so where it begins is read once, here */

        let box = element.getBoundingClientRect();

        start = origin();
        width = box.left - start;
        offset = event.clientX - box.left;
        dragging = true;

        element.setPointerCapture(event.pointerId);
        document.body.classList.add('dragging');
    }

    const move = (event) => {
        if (!dragging) {
            return;
        }

        apply(event.clientX - offset - start, false, start);
    }

    const up = (event) => {
        if (!dragging) {
            return;
        }

        dragging = false;

        element.releasePointerCapture(event.pointerId);
        document.body.classList.remove('dragging');

        apply(width);
    }

    /* Two clicks put the split back where it started */

    const reset = () => apply(begin());

    const keys = (event) => {
        let step = event.key === 'ArrowLeft' ? -STEP : event.key === 'ArrowRight' ? STEP : 0;

        if (!step) {
            return;
        }

        event.preventDefault();

        apply((width || begin()) + step);
    }

</script>

<!-- A separator that can be dragged and stepped with the arrow keys is the
     window splitter of ARIA, which is focusable and takes the events -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
    bind:this={element}
    class="gutter"
    class:dragging
    role="separator"
    aria-orientation="vertical"
    aria-label={label}
    tabindex="0"
    style="grid-row: {row}; grid-column: {column}; background: {background};"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    ondblclick={reset}
    onkeydown={keys}
></div>

<style>

    /* The row and the column the gutter sits in are the ones it was given, as
       an inline style */

    /* The gutter is the colour of the pane behind it, so that the line of the
       split is the border and nothing else */

    .gutter {
        position: relative;
        cursor: col-resize;
        border-left: 1px solid #ddd;
        touch-action: none;
    }

    /* The line of the split, which is the border the preview used to carry,
       and which thickens under the pointer and while it is dragged */

    .gutter::after {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: -1px;
        width: 3px;
        background: transparent;
        transition: background 0.1s ease-out;
    }

    .gutter:hover::after,
    .gutter:focus-visible::after,
    .gutter.dragging::after {
        background: #2196F3;
    }

    .gutter:focus-visible {
        outline: none;
    }

</style>
