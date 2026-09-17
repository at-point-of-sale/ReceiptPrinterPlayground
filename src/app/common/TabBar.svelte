<script>

    import { Icon } from 'svelte-icon';

    import Popover from './Popover.svelte';

    /*
        A segmented bar of tabs that collapses when it no longer fits.

        The bar sits at the end of a row it shares with whatever the toolbar put
        in front of it, and that row wraps. As long as the whole bar fits behind
        the last thing on the row it is the bar the application has always had,
        one segment per tab. When it does not, it becomes one button with the
        icon and the label of the tab that is current, and a menu of all of them
        under it, which is a tab bar that takes the room of a single tab.

        What it measures is the bar itself, in a copy of it that is laid out and
        not shown, against the room the row leaves beside everything in front of
        it. A bar that has collapsed asks for a little more room than it gives
        up, so that a window resized to exactly the width of the threshold does
        not flicker.
    */

    /**
     * @prop {object[]} items - The tabs, `{value, label, icon}` with the icon an SVG string
     * @prop {string} value - Bindable value of the selected tab
     * @prop {string} name - Name of the radio group of the segments
     * @prop {string} label - Accessible label of the menu of the collapsed bar
     */
    let {
        items = [],
        value = $bindable(),
        name = 'tabs',
        label = 'Views',
    } = $props();

    let element = $state(null);
    let ghost = $state(null);
    let button = $state(null);
    let rows = $state(null);
    let menu = $state(null);

    let collapsed = $state(false);

    /* The room a collapsed bar asks for on top of its own width before it opens
       up again, which is what keeps it from flickering at the threshold */

    const HYSTERESIS = 24;

    let active = $derived(items.find((item) => item.value === value) || items[0]);


    /* Whether the whole bar fits on one line beside what the row carries in
       front of it, which is what the row is measured for: the things in front
       of the bar are laid out before it and their widths do not depend on it,
       so the room they leave is the same whether the bar is wide or narrow and
       a measurement cannot argue with itself */

    const measure = () => {
        let container = element?.parentElement;

        if (!container || !ghost) {
            return;
        }

        let style = getComputedStyle(container);
        let room = container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);

        let used = 0;

        for (let child of container.children) {
            if (child === element) {
                break;
            }

            let box = getComputedStyle(child);

            used += child.offsetWidth + parseFloat(box.marginLeft) + parseFloat(box.marginRight);
        }

        /* What the bar needs is its own width, the gap it keeps in front of it
           and the padding this element keeps behind it */

        let natural = ghost.getBoundingClientRect().width
            + parseFloat(getComputedStyle(ghost).marginLeft)
            + parseFloat(getComputedStyle(element).paddingRight);

        let available = room - used;

        collapsed = collapsed ?
            available < natural + HYSTERESIS :
            available < natural;
    }

    $effect(() => {
        let container = element?.parentElement;

        if (!container || !ghost) {
            return;
        }

        /* The room changes with the window, and with everything the toolbar
           puts in front of the bar, which wraps as the window narrows */

        let observer = new ResizeObserver(() => measure());

        observer.observe(container);
        observer.observe(ghost);

        measure();

        return () => observer.disconnect();
    });


    /* The menu of the collapsed bar */

    const choose = (item) => {
        value = item.value;
        menu?.hide();
    }

    const opened = (open) => {
        if (!open) {
            return;
        }

        /* The tab the menu is showing is the one it opens on */

        requestAnimationFrame(() => {
            let selected = rows?.querySelector('[aria-checked="true"]') || rows?.querySelector('button');

            selected?.focus();
        });
    }

    const keys = (event) => {
        let buttons = [...(rows?.querySelectorAll('button') || [])];
        let index = buttons.indexOf(document.activeElement);

        let target = event.key === 'ArrowDown' ? index + 1 :
            event.key === 'ArrowUp' ? index - 1 :
                event.key === 'Home' ? 0 :
                    event.key === 'End' ? buttons.length - 1 : null;

        if (target === null || !buttons.length) {
            return;
        }

        event.preventDefault();

        buttons[(target + buttons.length) % buttons.length]?.focus();
    }

</script>

<div class="tabs" bind:this={element}>
    {#if collapsed}
        <nav>
            <button
                type="button"
                class="current"
                bind:this={button}
                aria-haspopup="menu"
                onclick={() => menu?.show(button)}
            >
                <Icon data={active.icon} />
                {active.label}

                <svg class="chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                    <path fill="currentColor" d="M43 17.1L39.9 14 24 29.9 8.1 14 5 17.1 24 36z"></path>
                </svg>
            </button>
        </nav>

        <Popover bind:popoverRef={menu} {label} ontoggle={opened}>
            <div class="menu" role="menu" tabindex="-1" bind:this={rows} onkeydown={keys}>
                {#each items as item}
                    <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={item.value === value}
                        onclick={() => choose(item)}
                    >
                        <Icon data={item.icon} />
                        <span>{item.label}</span>
                    </button>
                {/each}
            </div>
        </Popover>
    {:else}
        <nav>
            {#each items as item}
                <label>
                    <input type="radio" {name} value={item.value} bind:group={value}>
                    <Icon data={item.icon} />
                    {item.label}
                </label>
            {/each}
        </nav>
    {/if}

    <!-- The bar as it would be, laid out and not shown, which is what the room
         behind the row is measured against -->

    <div class="measure" aria-hidden="true">
        <nav bind:this={ghost}>
            {#each items as item}
                <label>
                    <Icon data={item.icon} />
                    {item.label}
                </label>
            {/each}
        </nav>
    </div>
</div>

<style>

    .tabs {
        position: relative;
        display: flex;
        align-content: start;
        justify-content: end;
        margin-left: auto;
        padding-right: 10px;
    }

    nav {
        border: none;
        border-radius: 6px;
        background: #eaeaea;
        font-family: system-ui;
        font-size: 10pt;
        margin: 15px 0 0 15px;
        display: flex;
        height: 32px;
        align-items: stretch;
        user-select: none;
        white-space: nowrap;
    }

    label {
        display: flex;
        align-items: center;
        padding: 0px 9px;
    }
    label:first-child {
        border-radius: 6px 0 0 6px;
    }
    label:last-child {
        border-radius: 0 6px 6px 0;
    }
    label:has(:focus-visible) {
        outline: -webkit-focus-ring-color auto 1px;
    }
    label:has(input:checked) {
        background: #d5d5d5;
    }

    label :global(svg) {
        width: 1.5em;
        height: 1.5em;
        margin-right: 4px;
    }

    input {
        position: absolute;
        opacity: 0;
    }


    /* The bar collapsed to the tab it is on: a segment of the bar it was, with
       the chevron of a menu behind the label */

    button.current {
        display: flex;
        align-items: center;
        background: #d5d5d5;
        border: none;
        border-radius: 6px;
        font-family: system-ui;
        font-size: 10pt;
        font-weight: normal;
        color: #000;
        height: auto;
        margin: 0;
        padding: 0 6px 0 9px;
        cursor: pointer;
    }

    button.current :global(svg) {
        width: 1.5em;
        height: 1.5em;
        margin-right: 4px;
    }

    button.current .chevron {
        width: 1em;
        height: 1em;
        margin: 0 0 0 4px;
        color: #777;
    }


    /* The menu under it, one row per tab */

    .menu {
        display: flex;
        flex-direction: column;
        min-width: 180px;
        padding: 4px 0;
    }

    .menu button {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        height: auto;
        margin: 0;
        padding: 8px 12px;
        border: none;
        border-radius: 0;
        background: transparent;

        font-family: system-ui;
        font-weight: 500;
        font-size: 10pt;
        color: #333;
        text-align: left;

        cursor: pointer;
    }

    .menu button:hover {
        background: #f0f0f0;
    }

    .menu button:active {
        background: #e0e0e0;
    }

    .menu button[aria-checked="true"] {
        background: #eaeaea;
        font-weight: 600;
    }

    .menu button :global(svg) {
        width: 20px;
        height: 20px;
        margin: 0;
        flex-shrink: 0;
    }


    /* The copy that is measured: laid out, never shown, and clipped to nothing
       so that it cannot widen the page it is measured on */

    .measure {
        position: absolute;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        overflow: hidden;
    }

    .measure nav {
        position: absolute;
        top: 0;
        left: 0;
        visibility: hidden;
        pointer-events: none;
    }

</style>
