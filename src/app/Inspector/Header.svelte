<script>

    import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

    import { Icon } from 'svelte-icon';

    import Popover from '../common/Popover.svelte';

    import loadIcon from '../../assets/icons/inspector/load.svg?raw';
    import saveIcon from '../../assets/icons/inspector/save.svg?raw';
    import panelsIcon from '../../assets/icons/inspector/panels.svg?raw';
    import printIcon from '../../assets/icons/print.svg?raw';

    /*
        The header of the inspector.

        Left to right: the file, the model the bytes are read as, and, pushed to
        the far end, the panels that are shown and the printer. Everything that
        needs a stream is disabled until one is loaded, which is everything but
        Load and the panels.
    */

    /**
     * @prop {Function} onopen - Called when Load is pressed
     * @prop {Function} ontoggle - Called with the id of the panel a menu row was clicked on
     * @prop {string} model - Bindable id of the printer model, empty for Auto
     * @prop {?string} detected - The language the decoder found, or null
     * @prop {?string} language - The language the stream is read as, or null
     * @prop {boolean} loaded - Whether there is a stream
     * @prop {object[]} panels - The panels, `{id, label, icon}` with the icon an SVG string
     * @prop {string[]} shown - The ids of the panels that are shown
     */
    let {
        onopen,
        ontoggle,
        model = $bindable(''),
        detected = null,
        language = null,
        loaded = false,
        panels = [],
        shown = [],
    } = $props();

    /* How a language is spelled where a person reads it */

    const NAMES = {
        'esc-pos': 'ESC/POS',
        'star-prnt': 'StarPRNT',
        'star-line': 'Star Line',
        'star-graphics': 'Star Graphics',
    };

    const spell = (value) => NAMES[value] || value;

    /* StarPRNT and Star Line are one command set to whatever reads a stream, so
       the detector never answers Star Line and a Star Line model is not a model
       of another language than the one that was found */

    const family = (value) => value === 'star-line' ? 'star-prnt' : value;

    let models = ReceiptPrinterEncoder.printerModels;

    /* What the first option of the selector says: the detected language once a
       file has been read, and nothing at all before that */

    let auto = $derived(detected ? `Auto (${spell(detected)})` : 'Auto');

    /* A model whose language is not the one that was detected is allowed, since
       detection can be wrong, and this is where the page says so */

    let note = $derived(detected && language && family(language) !== family(detected) ?
        `Detected ${spell(detected)}` : '');


    /* The menu of the panels */

    let button = $state(null);
    let menu = $state(null);
    let rows = $state(null);

    const opened = (open) => {
        if (!open) {
            return;
        }

        requestAnimationFrame(() => {
            let row = rows?.querySelector('button:not(:disabled)');

            row?.focus();
        });
    }

    const keys = (event) => {
        let buttons = [...(rows?.querySelectorAll('button:not(:disabled)') || [])];
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

<header>
    <button id="load" onclick={() => onopen()}>
        <Icon data={loadIcon} />
        Load
    </button>

    <button id="save" aria-haspopup="menu" disabled={!loaded}>
        <Icon data={saveIcon} />
        Save

        <svg class="chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
            <path fill="currentColor" d="M43 17.1L39.9 14 24 29.9 8.1 14 5 17.1 24 36z"></path>
        </svg>
    </button>

    <select id="model" bind:value={model}>
        <option value="">{auto}</option>
        <hr>
        {#each models as printer}
            <option value={printer.id}>{printer.name}</option>
        {/each}
    </select>

    {#if note}
        <span class="note">{note}</span>
    {/if}

    <button id="panels" bind:this={button} aria-haspopup="menu" onclick={() => menu?.show(button)}>
        <Icon data={panelsIcon} />
        Panels

        <svg class="chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
            <path fill="currentColor" d="M43 17.1L39.9 14 24 29.9 8.1 14 5 17.1 24 36z"></path>
        </svg>
    </button>

    <Popover bind:popoverRef={menu} label="Panels" ontoggle={opened}>
        <div class="menu" role="menu" tabindex="-1" bind:this={rows} onkeydown={keys}>
            {#each panels as panel}
                <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={shown.includes(panel.id)}
                    disabled={shown.length === 1 && shown.includes(panel.id)}
                    onclick={() => ontoggle(panel.id)}
                >
                    <Icon data={panel.icon} />
                    <span class="label">{panel.label}</span>
                    <span class="check" aria-hidden="true">{shown.includes(panel.id) ? '✓' : ''}</span>
                </button>
            {/each}
        </div>
    </Popover>

    <button id="print" aria-haspopup="menu" disabled={!loaded}>
        <Icon data={printIcon} />
        Print
    </button>
</header>


<style>

    /* The chevron of a button that opens a menu, as the collapsed tab bar
       carries it */

    .chevron {
        width: 1em;
        height: 1em;
        margin: 0 0 0 4px;
        color: #777;
    }

    button:disabled .chevron {
        opacity: 0.5;
    }

    /* What was detected, beside the model that is not it */

    .note {
        display: flex;
        align-items: center;
        height: 32px;
        margin: 15px 15px 0 0;

        font-family: system-ui;
        font-size: 9pt;
        color: #888;
    }

    /* The panels and the printer sit at the far end of the bar */

    button#panels {
        margin-left: auto;
    }


    /* The menu of the panels, one row per panel, which is the menu of the
       collapsed tab bar with a check mark behind the name */

    .menu {
        display: flex;
        flex-direction: column;
        min-width: 200px;
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

    .menu button:hover:not(:disabled) {
        background: #f0f0f0;
    }

    .menu button:active:not(:disabled) {
        background: #e0e0e0;
    }

    .menu button:disabled {
        cursor: default;
    }

    .menu button[aria-checked="true"] {
        font-weight: 600;
    }

    .menu button :global(svg) {
        width: 20px;
        height: 20px;
        margin: 0;
        flex-shrink: 0;
    }

    .menu .label {
        flex: 1;
    }

    .menu .check {
        width: 1em;
        color: #1976d2;
        text-align: right;
    }

</style>
