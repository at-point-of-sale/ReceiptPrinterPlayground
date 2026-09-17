<script>

    import { onMount } from 'svelte';

    /*
        The gutter between the editor and the preview.

        The two panes are the first and the third column of the grid of the page
        and this is the second, a few pixels wide and as tall as they are. What
        it drags is `--split`, the width of the first column, which the grid
        clamps to a minimum of its own and which is kept in the browser, so that
        the split a person set is the split they come back to.
    */

    /**
     * @prop {Function} onresize - Called while the split moves, for whatever has to be told
     */
    let { onresize = null } = $props();

    let element = $state(null);
    let dragging = $state(false);

    /* What a pane is never narrower than, which is the minimum of the grid as
       well, and how far an arrow key moves the split */

    const MINIMUM = 240;
    const STEP = 16;
    const KEY = 'split';

    let width = $state(0);

    const limit = (value) => Math.max(MINIMUM,
        Math.min(value, window.innerWidth - MINIMUM - (element?.offsetWidth || 6)));

    const apply = (value, remember = true) => {
        width = limit(value);

        document.body.style.setProperty('--split', `${Math.round(width)}px`);

        if (remember) {
            try {
                localStorage.setItem(KEY, String(Math.round(width)));
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
            stored = localStorage.getItem(KEY);
        }
        catch (error) {
            stored = null;
        }

        if (stored !== null && !Number.isNaN(parseFloat(stored))) {
            apply(parseFloat(stored), false);
        }
        else {
            /* Half the window, which is what the grid does on its own until
               something moves the split */

            width = element ? element.getBoundingClientRect().left : window.innerWidth / 2;
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

    const down = (event) => {
        if (event.button !== 0) {
            return;
        }

        /* Where the split is at this moment, so that a click that drags nothing
           leaves it where it was */

        let box = element.getBoundingClientRect();

        width = box.left;
        offset = event.clientX - box.left;
        dragging = true;

        element.setPointerCapture(event.pointerId);
        document.body.classList.add('dragging');
    }

    const move = (event) => {
        if (!dragging) {
            return;
        }

        apply(event.clientX - offset, false);
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

    const reset = () => apply(window.innerWidth / 2);

    const keys = (event) => {
        let step = event.key === 'ArrowLeft' ? -STEP : event.key === 'ArrowRight' ? STEP : 0;

        if (!step) {
            return;
        }

        event.preventDefault();

        apply((width || window.innerWidth / 2) + step);
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
    aria-label="Resize the editor"
    tabindex="0"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    ondblclick={reset}
    onkeydown={keys}
></div>

<style>

    .gutter {
        grid-row: 3;
        grid-column: 2;

        position: relative;
        cursor: col-resize;
        background: #fafafa;
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
