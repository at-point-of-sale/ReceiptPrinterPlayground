<script>

    /*
        Ported from ReceiptPrinterFontEditor, src/app/common/Popover.svelte,
        with the colours and the fonts of this application.

        What came over unchanged is the shape of the thing: the popover
        attribute, so the browser puts it in the top layer and dismisses it on
        an outside click and on Escape; the CSS anchor positioning that pins it
        under the button that opened it; the arrow that points at that button;
        the fallback position above the button when there is no room below it;
        and the opening and closing animation.

        CSS anchor positioning is Chromium and Safari; Firefox has it behind a
        flag and not in a release. Where it is missing every anchor() falls back
        to nothing and the panel would sit in the corner of the window, so the
        position is worked out here instead, from the rectangle of the button:
        under the button and right aligned to it, above it when there is no room
        below, held inside the window. The arrow is left off there, because an
        arrow that cannot follow the button points at the wrong thing.
    */

    /**
     * Popover - a panel anchored to the button that opened it
     *
     * Usage:
     *   <Popover bind:popoverRef={menu} label="Views">...rows...</Popover>
     *
     *   menu.show(buttonElement)
     *
     * @prop {object} popoverRef - Bindable handle: show(), hide() and toggle()
     * @prop {string} label - Accessible label for the panel
     * @prop {Function} ontoggle - Called with true when it opens and false when it closes
     */
    let {
        popoverRef = $bindable(null),
        label = null,
        ontoggle = null,
        children,
    } = $props();

    let element = $state(null);
    let anchor = $state(null);
    let isOpen = $state(false);
    let closedAt = 0;

    /* Whether the panel was dismissed by a pointer going down on the button
       that opened it, which is the one dismissal the click that follows must
       not open again. Escape, a click anywhere else and a hide() by hand are
       all dismissals too, and after any of those the very next click on the
       button is a click that means to open it. */

    let dismissedByAnchor = false;

    const anchorName = '--popover-anchor';
    const animationDuration = 150;

    /* How far the panel sits from the button, and from the edge of the window
       where it is placed by hand; the same ten pixels the CSS uses */

    const distance = 10;

    /* Whether the browser can pin an element to another one. Everything below
       that works the position out by hand is for the browsers that cannot. */

    const anchored = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' &&
        CSS.supports('position-anchor: --a');

    function handleToggle(event) {
        isOpen = event.newState === 'open';

        if (ontoggle) {
            ontoggle(isOpen);
        }

        /* The anchor is forgotten after the animation, and only while the panel
           is still closed: it can have been opened again in the meantime, under
           the same button or another one, and forgetting the anchor then would
           leave show() unable to tell that the panel it is being asked for is
           the one that is already open */

        if (event.newState === 'closed') {
            closedAt = Date.now();

            if (anchor) {
                setTimeout(() => {
                    if (anchor && !isOpen) {
                        anchor.style.anchorName = '';
                        anchor = null;
                    }
                }, animationDuration);
            }
        }
    }

    /**
     * Where the panel goes in a browser that cannot pin it to the button:
     * under the button, right aligned to it, above it when there is no room
     * below, and never past the edge of the window
     */
    function place() {
        if (!element || !anchor) {
            return;
        }

        const button = anchor.getBoundingClientRect();
        const panel = element.getBoundingClientRect();

        const below = button.bottom + distance;
        const room = below + panel.height <= window.innerHeight;

        const top = room ? below : Math.max(distance, button.top - distance - panel.height);
        const left = Math.max(distance,
            Math.min(window.innerWidth - panel.width - distance, button.right - panel.width));

        element.style.top = `${Math.round(top)}px`;
        element.style.left = `${Math.round(left)}px`;
    }

    /**
     * Show the panel under a button, or close it again when it is already open
     * under that button
     *
     * @param  {?HTMLElement}   anchorElement   The button that opened it
     */
    function show(anchorElement = null) {
        if (isOpen && anchor === anchorElement) {
            element?.hidePopover();
            return;
        }

        /* The browser dismisses an open panel on the pointer down of the click
           that reaches the button, so by the time the button is clicked the
           panel is closed and opening it again would leave it open for ever. A
           click that lands on the button it was opened from, a moment after
           that pointer down closed it, is that click and not a new one. */

        if (!isOpen && anchor === anchorElement && dismissedByAnchor &&
            Date.now() - closedAt < 250) {
            dismissedByAnchor = false;
            return;
        }

        dismissedByAnchor = false;

        if (anchorElement) {
            if (anchor && anchor !== anchorElement) {
                anchor.style.anchorName = '';
            }

            anchor = anchorElement;

            if (anchored) {
                anchorElement.style.anchorName = anchorName;
            }
        }

        element?.showPopover();

        if (!anchored) {
            place();
        }
    }

    function hide() {
        element?.hidePopover();
    }

    /* While the panel is open two things outside it are watched: the pointer,
       to tell the dismissal the button itself caused from every other one, and
       the size of the window, because a panel that was placed by hand under a
       button does not follow it when the window is resized */

    $effect(() => {
        if (!isOpen) {
            return;
        }

        const down = (event) => {
            if (anchor && event.composedPath().includes(anchor)) {
                dismissedByAnchor = true;
            }
        };

        const resized = () => {
            if (!anchored) {
                place();
            }
        };

        document.addEventListener('pointerdown', down, true);
        window.addEventListener('resize', resized);

        return () => {
            document.removeEventListener('pointerdown', down, true);
            window.removeEventListener('resize', resized);
        };
    });

    $effect(() => {
        popoverRef = {show, hide, toggle: show};
    });

</script>

<div
    bind:this={element}
    class="popover"
    class:unanchored={!anchored}
    popover="auto"
    aria-label={label}
    style="--anchor: {anchorName}; --menu: {anchorName}-menu;"
    ontoggle={handleToggle}
>
    {@render children()}
</div>

<style>

    .popover {
        --d: 10px;
        --s: 14px;

        position: absolute;
        position-anchor: var(--anchor);
        position-try-fallbacks: --popover-top;

        top: calc(var(--d) + anchor(bottom));
        justify-self: anchor-center;

        padding: 0;
        border: none;
        border-radius: 6px;
        background: #fff;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);

        font-family: system-ui;
        font-size: 10pt;

        margin: 0 var(--d);
        z-index: 100;
        overflow: visible;

        opacity: 1;
        transition:
            opacity 0.15s ease-out,
            margin-top 0.1s ease-out,
            display 0.15s allow-discrete,
            overlay 0.15s allow-discrete;
    }

    @starting-style {
        .popover:popover-open {
            opacity: 0;
            margin-top: -10px;
        }
    }

    .popover:not(:popover-open) {
        opacity: 0;
        margin-top: -10px;
    }

    /* The panel is an anchor itself, for the arrow, and only while it is open:
       Safari hangs when a panel that carries an anchor name closes while its
       own arrow is pinned to that name */

    .popover:popover-open {
        anchor-name: var(--menu);
    }

    @position-try --popover-top {
        top: auto;
        bottom: calc(anchor(top) + var(--d));
        margin: 0;
    }

    .popover::backdrop {
        background: transparent;
    }

    /* The arrow that points at the button */

    .popover::before {
        content: '';
        display: block;
        position: fixed;
        z-index: -1;
        width: var(--s);
        background: inherit;

        position-anchor: var(--anchor);
        position-try-fallbacks: --popover-tip-top;

        top: calc(anchor(bottom));
        bottom: anchor(var(--menu) bottom);
        justify-self: anchor-center;

        clip-path: polygon(50% .2em, 100% var(--d), 100% calc(100% - var(--d)), 50% calc(100% - .2em), 0 calc(100% - var(--d)), 0 var(--d));
    }

    @position-try --popover-tip-top {
        top: anchor(var(--menu) top);
        bottom: calc(anchor(top));
    }

    /* And the same panel in a browser with no anchor positioning: fixed where
       place() put it, with no arrow to point at a button it cannot follow.

       Every property the anchored panel is placed by has to be given back,
       `justify-self` as much as `top` and `margin`: a popover is laid out in
       the top layer as the one item of its own grid, so an `anchor-center`
       that cannot resolve still centres the panel in the window and the left
       that place() sets is ignored. */

    .popover.unanchored {
        position: fixed;
        margin: 0;
        justify-self: auto;
        align-self: auto;
    }

    .popover.unanchored::before {
        display: none;
    }

</style>
