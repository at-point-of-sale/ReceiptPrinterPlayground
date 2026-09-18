<script>

    import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

    import { Icon } from 'svelte-icon';

    import { get } from 'svelte/store';

    import { isSupported } from '../utils/printer.js';
    import { getEncoder } from '../utils/encoder.js';
    import { encodeFragment, textToBase64Url, toBase64Url } from '../utils/fragment.js';

    import Popover from './common/Popover.svelte';

    import connectIcon from '../assets/icons/connect.svg?raw';
    import disconnectIcon from '../assets/icons/disconnect.svg?raw';
    import printIcon from '../assets/icons/print.svg?raw';
    import debugIcon from '../assets/icons/debug.svg?raw';
    import linkIcon from '../assets/icons/debug/link.svg?raw';
    import inspectIcon from '../assets/icons/debug/inspect.svg?raw';

    /*
        The header of the playground.

        Left to right: what to connect over, which printer it is, the connection
        and the printing, and, pushed to the far end, the Debug menu: the page
        as a link for a bug report, and the job as the inspector reads it.
    */

    let { connected, onconnect, ondisconnect, onprint, model, contents, view } = $props();

    let driver = $state('usb');
    let baudrate = $state('9600');

    let supported = $derived(isSupported(driver));


    let models = ReceiptPrinterEncoder.printerModels;



    /* Retrieve and save state */

    let driverValue = localStorage.getItem('printer-driver');

    if (driverValue) {
        driver = driverValue;
    }

    let baudrateValue = localStorage.getItem('printer-baudrate');

    if (baudrateValue) {
        baudrate = baudrateValue;
    }

    let modelValue = localStorage.getItem('printer-model');

    if (modelValue) {
        $model = modelValue;
    }

    window.addEventListener('beforeunload', () => {
        if (driver) {
            localStorage.setItem('printer-driver', driver);
        }

        if (baudrate) {
            localStorage.setItem('printer-baudrate', baudrate);
        }

        if (model) {
            localStorage.setItem('printer-model', $model);
        }
    });


    /* The Debug menu.

       Two things that are useful when something is wrong and somebody else has
       to see it: the page as a link, which holds the script, the model and the
       tab, and the job as the inspector reads it. Both are worked out when the
       menu opens rather than while the script is typed, since neither is asked
       for often and the script can be long. */

    /* What a comment on GitHub holds, which is what a link longer than this
       cannot be pasted into */

    const COMMENT = 65536;

    /* And what a browser opens: addresses far longer than this are refused, by
       the browser or by what it hands them to */

    const ADDRESS = 1500000;

    let debugButton = $state(null);
    let debugMenu = $state(null);
    let debugRows = $state(null);

    let link = $state('');
    let copied = $state(false);
    let timer = null;

    /* The job as the tabs encode it, which is looked up every time the menu
       opens: the row that opens the inspector is disabled until there is one */

    let job = $state(null);
    let checking = $state(false);
    let attempt = 0;

    /* What the inspector row has to say for itself: a job too large for a link,
       or a tab the browser would not open */

    let trouble = $state('');

    /* And whether the menu is open, which the button says out loud */

    let expanded = $state(false);

    let warning = $derived(link.length > COMMENT ?
        `This link is ${link.length} characters, more than a GitHub comment holds. ` +
        `Attach the script as a file instead, or remove the images from it.` : '');

    /* The address of this page without its fragment, which is what a link for a
       bug report is built on */

    const address = () => window.location.href.split('#')[0];

    const toLink = () => `${address()}#${encodeFragment({
        code: textToBase64Url(get(contents) || ''),
        model: get(model) || '',
        view: get(view) || 'text',
    })}`;

    /* Where the inspector is: a page of its own beside this one, and on the
       website the folder beside the playground's */

    const inspector = () => window.location.pathname.endsWith('/playground/') ?
        new URL('../inspector/', window.location.href).href :
        new URL('inspector.html', window.location.href).href;

    const prepare = async () => {
        let ticket = ++attempt;

        job = null;
        checking = true;

        try {
            let result = await getEncoder({
                printerModel: get(model),
                value: get(contents),
            });

            if (ticket !== attempt) {
                return;
            }

            /* A script that threw has no encoder and no job. What the encoder
               complained about is another matter: a warning is a job that
               prints all the same, and looking at it is what this row is for */

            job = result?.encoder ? result.encoder.encode() : null;
        }
        catch (error) {
            if (ticket === attempt) {
                job = null;
            }
        }
        finally {
            if (ticket === attempt) {
                checking = false;
            }
        }
    }

    /* The clipboard of a browser that has one, and the selected textarea every
       other browser has instead */

    const write = (text) => {
        let area = document.createElement('textarea');

        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        area.style.opacity = '0';

        document.body.appendChild(area);
        area.select();

        try {
            document.execCommand('copy');
        }
        catch (error) {
            /* A browser that copies neither way is a browser the link is read
               out of the address bar in */
        }

        area.remove();
    }

    const copy = async () => {
        let text = link || toLink();

        try {
            await navigator.clipboard.writeText(text);
        }
        catch (error) {
            write(text);
        }

        copied = true;

        clearTimeout(timer);
        timer = setTimeout(() => copied = false, 2000);
    }

    const inspect = () => {
        if (!job) {
            return;
        }

        let url = `${inspector()}#${encodeFragment({
            data: toBase64Url(job),
            model: get(model) || '',
        })}`;

        if (url.length > ADDRESS) {
            trouble = 'This job is too large to open in a link';
            return;
        }

        trouble = '';

        /* A browser that refuses the tab hands back nothing, and a menu that
           closed on that would have said nothing at all.

           The tab is asked for without `noopener`, because a window opened with
           it hands back nothing either and the two would be one thing. What
           comes back is used to cut the way back to this page, which is what
           `noopener` would have done, and for nothing else */

        let tab = window.open(url, '_blank');

        if (!tab) {
            trouble = 'The browser blocked the new tab. Allow pop-ups for this page and try again.';
            return;
        }

        try {
            tab.opener = null;
        }
        catch (error) {
            /* A browser that will not have its windows written to is a browser
               that keeps the opener, which is a page of this same site */
        }

        debugMenu?.hide();
    }

    /* Where the focus goes when the menu opens, and what it holds: the link is
       built and the script is run the moment it is asked for */

    const opened = (open) => {
        expanded = open;

        if (!open) {
            return;
        }

        copied = false;
        trouble = '';
        link = toLink();

        prepare();

        requestAnimationFrame(() => {
            debugRows?.querySelector('button:not(:disabled)')?.focus();
        });
    }

    /* Up and down walk the rows of a menu, as they do in a menu of the system
       and in the menus of the inspector */

    const keys = (event) => {
        let buttons = [...(debugRows?.querySelectorAll('button:not(:disabled)') || [])];
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
    <select id="driver" bind:value={driver} disabled={!!connected}>
        <option value="usb">USB</option>
        <option value="serial">Serial</option>
        <option value="bluetooth">Bluetooth</option>
    </select>

    {#if driver === 'serial'}
      <select id="baudrate" bind:value={baudrate} disabled={!!connected}>
          <option value="9600">9600</option>
          <option value="38400">38400</option>
          <option value="115200">115200</option>
      </select>
    {/if}

    <select id="model" bind:value={$model}>
        <option value="">Generic</option>
        <hr>
        {#each models as model}
            <option value={model.id}>{model.name}</option>
        {/each}
    </select>

    {#if !connected}
      <button id="connect" onclick={() => onconnect({ driver, baudrate })} disabled={!supported}>
          <Icon data={connectIcon} />
          Connect
      </button>
    {:else}
      <button id="disconnect" onclick={() => ondisconnect()}>
          <Icon data={disconnectIcon} />
          Disconnect
      </button>
    {/if}

    <button id="print" onclick={() => onprint()} disabled={!connected}>
        <Icon data={printIcon} />
        <span class="name">Print</span>
    </button>

    <button
        id="debug"
        bind:this={debugButton}
        aria-haspopup="menu"
        aria-expanded={expanded}
        onclick={() => debugMenu?.show(debugButton)}
    >
        <Icon data={debugIcon} />
        <span class="name">Debug</span>

        <svg class="chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
            <path fill="currentColor" d="M43 17.1L39.9 14 24 29.9 8.1 14 5 17.1 24 36z"></path>
        </svg>
    </button>

    <Popover bind:popoverRef={debugMenu} label="Debug" ontoggle={opened}>
        <div class="menu" role="menu" tabindex="-1" bind:this={debugRows} onkeydown={keys}>
            <button type="button" role="menuitem" id="copy-link" onclick={() => copy()}>
                <Icon data={linkIcon} />
                <span class="label">{copied ? 'Link copied' : 'Copy link for a bug report'}</span>
            </button>

            {#if warning}
                <p class="warning">{warning}</p>
            {/if}

            <button
                type="button"
                role="menuitem"
                id="open-inspector"
                disabled={checking || !job}
                onclick={() => inspect()}
            >
                <Icon data={inspectIcon} />
                <span class="label">View in the inspector</span>
            </button>

            {#if trouble}
                <p class="warning">{trouble}</p>
            {/if}
        </div>
    </Popover>

</header>


<style>

    button#connect {
      background-color: #bbdefb;
      color: #1976d2;
    }

    /* Connecting and printing are one group at the near end, and the Debug menu
       stands alone at the far end, where Print used to be */

    button#debug {
      margin-left: auto
    }

    /* A narrow window is a window the header has to fit in: the two buttons at
       the far end keep their icons and give up their names, which is what the
       tab bar of the toolbar does a little lower down the page */

    @media (max-width: 640px) {
        button#print .name,
        button#debug .name {
            display: none;
        }

        /* And the room between the things of the header is the room a narrow
           window has to spare */

        :global(header > select),
        :global(header > button) {
            margin-right: 8px;
        }

        button#print :global(svg),
        button#debug :global(svg) {
            margin-right: 0;
        }
    }

    /* The chevron of a button that opens a menu, as the inspector's header and
       the collapsed tab bar carry it */

    .chevron {
        width: 1em;
        height: 1em;
        margin: 0 0 0 4px;
        color: #777;
    }

    button:disabled .chevron {
        opacity: 0.5;
    }


    /* The menu itself, a row with an icon per thing that can be picked, which
       is the menu of the inspector's header */

    .menu {
        display: flex;
        flex-direction: column;
        min-width: 240px;
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

    .menu button :global(svg) {
        width: 20px;
        height: 20px;
        margin: 0;
        flex-shrink: 0;
    }

    .menu .label {
        flex: 1;
    }

    /* What is wrong with the link a row makes, under that row: the amber the
       inspector says its troubles in */

    .menu .warning {
        max-width: 320px;
        margin: 0;
        padding: 0 12px 8px 40px;

        font-family: system-ui;
        font-size: 9pt;
        line-height: 1.4;
        color: #b26500;
    }

</style>
