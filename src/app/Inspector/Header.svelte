<script>

    import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

    import { Icon } from 'svelte-icon';

    import { isSupported } from '../../utils/printer.js';

    import Popover from '../common/Popover.svelte';

    import loadIcon from '../../assets/icons/inspector/load.svg?raw';
    import saveIcon from '../../assets/icons/inspector/save.svg?raw';
    import panelsIcon from '../../assets/icons/inspector/panels.svg?raw';
    import printIcon from '../../assets/icons/print.svg?raw';
    import connectIcon from '../../assets/icons/connect.svg?raw';
    import disconnectIcon from '../../assets/icons/disconnect.svg?raw';

    /*
        The header of the inspector.

        Left to right: the file, the model the bytes are read as, and, pushed to
        the far end, the panels that are shown and the printer. Everything that
        needs a stream is disabled until one is loaded, which is everything but
        Load and the panels.

        Three of the buttons open a panel under themselves. Panels and Save are
        menus, a row per thing that can be picked; Print is a form, the printer
        connection the playground keeps in its own header, with the model of
        this header in the middle of it so that it is preselected and can be
        changed where the printing is about to happen.
    */

    /**
     * @prop {Function} onopen - Called when Load is pressed
     * @prop {Function} ontoggle - Called with the id of the panel a menu row was clicked on
     * @prop {Function} onsave - Called with 'png' or 'svg', the format that was picked
     * @prop {Function} onconnect - Called with `{driver, baudrate}` when Connect is pressed
     * @prop {Function} ondisconnect - Called when Disconnect is pressed
     * @prop {Function} onprint - Called when the stream is to be printed
     * @prop {string} model - Bindable id of the printer model, empty for Auto
     * @prop {?string} detected - The language the decoder found, or null
     * @prop {?string} language - The language the stream is read as, or null
     * @prop {boolean} loaded - Whether there is a stream
     * @prop {boolean} connected - Whether a printer is connected
     * @prop {?object} device - What the driver reported about the printer, or null
     * @prop {object[]} panels - The panels, `{id, label, icon}` with the icon an SVG string
     * @prop {string[]} shown - The ids of the panels that are shown
     */
    let {
        onopen,
        ontoggle,
        onsave,
        onconnect,
        ondisconnect,
        onprint,
        model = $bindable(''),
        detected = null,
        language = null,
        loaded = false,
        connected = false,
        device = null,
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


    /* What is kept between visits, which is what the playground keeps as well,
       under keys of this page */

    const remembered = (key, fallback) => {
        try {
            return localStorage.getItem(key) || fallback;
        }
        catch (error) {
            return fallback;
        }
    }

    const remember = (key, value) => {
        try {
            localStorage.setItem(key, value);
        }
        catch (error) {
            /* A browser that keeps nothing starts fresh every time, which is no
               reason to fail */
        }
    }


    /* The printer */

    let driver = $state(remembered('inspector-driver', 'usb'));
    let baudrate = $state(remembered('inspector-baudrate', '9600'));

    let supported = $derived(isSupported(driver));

    $effect(() => {
        remember('inspector-driver', driver);
    });

    $effect(() => {
        remember('inspector-baudrate', baudrate);
    });

    /* What the driver said about the printer it found: the name of the device
       where it has one, a USB printer by its manufacturer and its product and a
       Bluetooth one by the name it advertises, and the language it speaks. A
       serial printer is a line and not a device, so it has neither */

    let described = $derived.by(() => {
        if (!connected || !device) {
            return '';
        }

        let name = device.name ||
            [device.manufacturerName, device.productName].filter(Boolean).join(' ');

        let parts = [name, device.language ? spell(device.language) : ''].filter(Boolean);

        return parts.length ? parts.join(' · ') : 'Connected';
    });

    /* And whether that language is the one the stream is read as, which is the
       one thing about a connected printer that is worth a warning */

    let mismatch = $derived(connected && device?.language && language &&
        family(device.language) !== family(language) ?
        `The printer speaks ${spell(device.language)}, the stream is ${spell(language)}` : '');


    /* The panels that popovers hold, and where the focus goes when one opens */

    let button = $state(null);
    let menu = $state(null);
    let rows = $state(null);

    let saveButton = $state(null);
    let saveMenu = $state(null);
    let saveRows = $state(null);

    let printButton = $state(null);
    let printMenu = $state(null);
    let printForm = $state(null);

    const opened = (get, selector = 'button:not(:disabled)') => (open) => {
        if (!open) {
            return;
        }

        requestAnimationFrame(() => {
            get()?.querySelector(selector)?.focus();
        });
    }

    /* Up and down walk the rows of a menu, as they do in a menu of the system */

    const keys = (get) => (event) => {
        let buttons = [...(get()?.querySelectorAll('button:not(:disabled)') || [])];
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

    /* A format picked from the Save menu is a menu that has done its work */

    const save = (format) => {
        saveMenu?.hide();
        onsave(format);
    }

</script>

<header>
    <button id="load" onclick={() => onopen()}>
        <Icon data={loadIcon} />
        Load
    </button>

    <button
        id="save"
        bind:this={saveButton}
        aria-haspopup="menu"
        disabled={!loaded}
        onclick={() => saveMenu?.show(saveButton)}
    >
        <Icon data={saveIcon} />
        Save

        <svg class="chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
            <path fill="currentColor" d="M43 17.1L39.9 14 24 29.9 8.1 14 5 17.1 24 36z"></path>
        </svg>
    </button>

    <Popover bind:popoverRef={saveMenu} label="Save" ontoggle={opened(() => saveRows)}>
        <div class="menu" role="menu" tabindex="-1" bind:this={saveRows} onkeydown={keys(() => saveRows)}>
            <button type="button" role="menuitem" onclick={() => save('png')}>
                <span class="label">PNG</span>
            </button>

            <button type="button" role="menuitem" onclick={() => save('svg')}>
                <span class="label">SVG</span>
            </button>
        </div>
    </Popover>

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

    <Popover bind:popoverRef={menu} label="Panels" ontoggle={opened(() => rows)}>
        <div class="menu" role="menu" tabindex="-1" bind:this={rows} onkeydown={keys(() => rows)}>
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

    <!-- The connection outlives the stream, so the popover opens whether or not
         there is one; the button that sends is the one that waits for it -->

    <button
        id="print"
        bind:this={printButton}
        aria-haspopup="dialog"
        onclick={() => printMenu?.show(printButton)}
    >
        <Icon data={printIcon} />
        Print

        <svg class="chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
            <path fill="currentColor" d="M43 17.1L39.9 14 24 29.9 8.1 14 5 17.1 24 36z"></path>
        </svg>
    </button>

    <Popover bind:popoverRef={printMenu} label="Print" ontoggle={opened(() => printForm, 'select, button')}>
        <div class="form" bind:this={printForm}>
            <label class="row">
                <span>Driver</span>

                <select id="printer-driver" bind:value={driver} disabled={connected}>
                    <option value="usb">USB</option>
                    <option value="serial">Serial</option>
                    <option value="bluetooth">Bluetooth</option>
                </select>
            </label>

            {#if driver === 'serial'}
                <label class="row">
                    <span>Baud rate</span>

                    <select id="printer-baudrate" bind:value={baudrate} disabled={connected}>
                        <option value="9600">9600</option>
                        <option value="38400">38400</option>
                        <option value="115200">115200</option>
                    </select>
                </label>
            {/if}

            <label class="row">
                <span>Model</span>

                <select id="printer-model" bind:value={model}>
                    <option value="">{auto}</option>
                    <hr>
                    {#each models as printer}
                        <option value={printer.id}>{printer.name}</option>
                    {/each}
                </select>
            </label>

            {#if !connected}
                <button
                    type="button"
                    id="connect"
                    disabled={!supported}
                    onclick={() => onconnect({ driver, baudrate })}
                >
                    <Icon data={connectIcon} />
                    Connect
                </button>
            {:else}
                <button type="button" id="disconnect" onclick={() => ondisconnect()}>
                    <Icon data={disconnectIcon} />
                    Disconnect
                </button>
            {/if}

            {#if described}
                <p class="status">{described}</p>
            {/if}

            {#if mismatch}
                <p class="warning">{mismatch}</p>
            {/if}

            <button
                type="button"
                id="send"
                disabled={!connected || !loaded}
                onclick={() => onprint()}
            >
                <Icon data={printIcon} />
                Print
            </button>
        </div>
    </Popover>
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


    /* And the printer, which is not a menu but the connection of the
       playground's header in a column: what to connect over, what the printer
       is, the connection itself and the button that prints over it */

    .form {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 260px;
        padding: 12px;
    }

    .form .row {
        display: flex;
        align-items: center;
        gap: 8px;

        font-family: system-ui;
        font-size: 10pt;
        color: #333;
    }

    .form .row span {
        flex: 1;
    }

    /* The selects and the buttons of the header carry the margin of the header,
       which is not the spacing of a panel */

    .form select {
        width: 150px;
        margin: 0;
        background-color: #f0f0f0;
    }

    .form button {
        justify-content: center;
        width: 100%;
        margin: 0;
    }

    .form button#connect {
        background-color: #bbdefb;
        color: #1976d2;
    }

    .form button#send {
        background-color: #f0f0f0;
    }

    /* What the driver reported, and the one thing about it worth a warning */

    .form .status,
    .form .warning {
        margin: 0;

        font-family: system-ui;
        font-size: 9pt;
        color: #888;
        text-align: center;
    }

    .form .warning {
        color: #b26500;
    }

</style>
