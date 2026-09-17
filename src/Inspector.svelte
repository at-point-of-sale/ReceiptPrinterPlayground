<script>

    import { untrack } from 'svelte';

    import { detect } from '@point-of-sale/receipt-printer-decoder';

    import ReceiptPrinterRenderer, { stitch, toPng } from '@point-of-sale/receipt-printer-renderer';

    import { toModel, modelsFor, GENERICS, DEFAULT_MODEL } from './utils/stream.js';
    import { connect, disconnect } from './utils/printer.js';

    import Header from './app/Inspector/Header.svelte';
    import Toolbar from './app/Inspector/Toolbar.svelte';
    import Split from './app/Main/Split.svelte';

    import HexDump from './app/panes/HexDump.svelte';
    import Image from './app/panes/Image.svelte';
    import Decoded from './app/panes/Decoded.svelte';

    import outputIcon from './assets/icons/tabs/output.svg?raw';
    import imageIcon from './assets/icons/tabs/image.svg?raw';
    import decodedIcon from './assets/icons/tabs/decoded.svg?raw';

    /*
        The inspector: the bytes that were sent to a printer, as a hex dump, as
        the commands they are and as the paper the printer would print.

        The three panels are columns of the grid of the page, in that order, and
        every one of them is shown or hidden from the header, with a gutter
        between two that are shown. What they are given is a stream, the bytes
        with the settings of the printer that reads them, which is the file and
        either the language the decoder detected or the model that was chosen.
    */

    const PANELS = [
        { id: 'hex', label: 'Hex dump', icon: outputIcon },
        { id: 'decoded', label: 'Decoded', icon: decodedIcon },
        { id: 'rendered', label: 'Rendered', icon: imageIcon },
    ];

    /* What a panel is never narrower than, and how wide a gutter is, which are
       the two numbers the grid of the page is built out of */

    const MINIMUM = 240;
    const GUTTER = 6;


    /* What is kept between visits: the model and the panels. The stream is not,
       and neither is the fragment it may have come from */

    const remembered = (key) => {
        try {
            return localStorage.getItem(key);
        }
        catch (error) {
            return null;
        }
    }

    const remember = (key, value) => {
        try {
            localStorage.setItem(key, value);
        }
        catch (error) {
            /* A browser that keeps nothing is a browser that starts fresh every
               time, which is no reason to fail */
        }
    }

    const readPanels = () => {
        let value = remembered('inspector-panels');

        try {
            let list = JSON.parse(value).filter((id) => PANELS.some((panel) => panel.id === id));

            if (list.length) {
                return list;
            }
        }
        catch (error) {
            /* Nothing kept, or nothing that reads as a list of panels */
        }

        return PANELS.map((panel) => panel.id);
    }


    /* State */

    /* The model the bytes are read at, which is kept between visits, and the
       language they are read in, which is not: a file names its own language
       through the detector, and the picker is only how that is overruled */

    let model = $state(remembered('inspector-model') || DEFAULT_MODEL);
    let language = $state('');

    let shown = $state(readPanels());

    let bytes = $state(null);
    let detected = $state(null);
    let error = $state('');

    /* What a saved file is named after, which is the file that was loaded
       without its extension, and `receipt` for a stream that came from a link */

    let base = $state('receipt');

    /* What went wrong while a file was being written, which is the one error
       this page has that is not about the stream it holds */

    let trouble = $state('');

    /* The printer, which the Print popover connects and prints over */

    let connected = $state(false);
    let device = $state(null);

    let dropping = $state(false);

    let picker = $state(null);

    /* The panes, which exist only while their panel is shown */

    let hex = $state(null);
    let rendered = $state(null);
    let decoded = $state(null);


    /* What the bytes are read as: the language that was picked, or the one that
       was detected when that is Auto, and the width and the codepage mapping of
       the model. The language is the picker's alone, so a printer of another
       language lends its paper and nothing else */

    let reading = $derived(language || detected);

    let stream = $derived.by(() => {
        if (!bytes) {
            return null;
        }

        try {
            return { bytes, language: reading, ...toModel(model, reading) };
        }
        catch (e) {
            /* A model the encoder cannot build is no reason to show nothing, so
               the bytes are read at the width a file starts on */

            return { bytes, language: reading, ...toModel(DEFAULT_MODEL, reading) };
        }
    });

    let panels = $derived(PANELS.filter((panel) => shown.includes(panel.id)));

    /* The columns of the page, out of the panels that are shown: every one but
       the last is a column that can be dragged and a gutter behind it, and the
       last one takes what is left */

    let template = $derived(panels.map((panel, index) => index === panels.length - 1 ?
        `minmax(${MINIMUM}px, 1fr)` :
        `minmax(${MINIMUM}px, var(--inspector-${panel.id}, 33vw)) ${GUTTER}px`).join(' '));

    /* What has to stay behind a gutter, which is the gutter itself, every pane
       between it and the last one at the width it is at, and the last pane at
       its minimum, since that is all it will give up. The columns are measured
       when a drag begins, because a gutter behind this one may have been moved
       since the page was laid out */

    const reserve = (index) => () => {
        let columns = getComputedStyle(document.body).gridTemplateColumns
            .split(' ').map(parseFloat);

        let behind = columns.slice(index * 2 + 1, -1);

        return behind.reduce((total, size) => total + (size || 0), 0) + MINIMUM;
    }

    /* And where a pane goes back to when its gutter is double clicked, which is
       an equal share of the window for every panel that is shown */

    const initial = () => window.innerWidth / panels.length;

    $effect(() => {
        document.body.style.gridTemplateColumns = template;
    });

    $effect(() => {
        remember('inspector-model', model);
    });

    /* A model that does not speak the language the stream is read in is not a
       model of this stream: the picker falls back to the plain width, which is
       what a file starts on anyway. This is what a language that has just been
       picked does to the model, and what the model kept from the last visit has
       to answer to the moment a file names its language */

    $effect(() => {
        let current = reading;

        if (!current) {
            return;
        }

        let allowed = [
            ...GENERICS.map((generic) => generic.id),
            ...modelsFor(current).map((printer) => printer.id),
        ];

        untrack(() => {
            if (!allowed.includes(model)) {
                model = DEFAULT_MODEL;
            }
        });
    });

    $effect(() => {
        remember('inspector-panels', JSON.stringify(shown));
    });

    /* Every pane that is shown renders the stream, and a pane of a panel that
       has just been shown renders it the moment it exists */

    $effect(() => {
        /* What this depends on is the stream and which panes exist, and nothing
           a pane reads while it renders: a pane keeps state of its own, which it
           reads as well as writes, and an effect that took those reads for its
           own would run for ever */

        let current = stream;
        let list = [hex, rendered, decoded];

        untrack(() => {
            for (let pane of list) {
                pane?.render(current);
            }
        });
    });


    /* Loading */

    const load = (data, name) => {
        /* A file with nothing in it is not a stream, and a page that showed
           three empty panels for it would say nothing about why */

        if (!data.length) {
            error = 'The file holds no bytes';
            bytes = null;
            detected = null;
            return;
        }

        error = '';
        trouble = '';
        bytes = data;
        detected = detect(data);

        /* A new file is a new language, whatever the last one was read as */

        language = '';

        /* What a saved file is named after: the name of the file that was
           loaded, with whatever extension it had taken off */

        base = name.replace(/\.[^.]+$/, '') || 'receipt';

        document.title = `${name} · Receipt printer inspector`;
    }


    /* Saving: the paper of the Rendered panel as a file, which is the stream
       rendered again rather than the canvas of the pane read off, so that the
       image is the paper at its own size whatever the pane shows it at */

    const download = (blob, name, extension) => {
        let url = URL.createObjectURL(blob);

        let anchor = document.createElement('a');

        anchor.href = url;
        anchor.download = `${name}.${extension}`;

        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        /* The browser reads the blob after the click returns, so the URL is let
           go of a moment later rather than straight away */

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    const save = async (format) => {
        trouble = '';

        if (!stream) {
            return;
        }

        try {
            let { bytes: data, language, width, codepageMapping } = stream;

            /* The name of the file is read before the rendering rather than
               after it, so that a file loaded while an image is being made does
               not give that image its name */

            let name = base;

            if (!ReceiptPrinterRenderer.languages.includes(language)) {
                throw new Error(`Cannot render ${language} commands`);
            }

            let renderer = new ReceiptPrinterRenderer({
                language,
                width,
                codepageMapping,
                commands: [ 'cut', 'pulse', 'feed' ],
            });

            if (format === 'png') {
                /* The paper of the whole roll, with a dashed line where it is
                   cut, which is what the Rendered panel shows */

                let paper = stitch(renderer.render(data), { width, cutMarker: true });

                download(new Blob([await toPng(paper)], { type: 'image/png' }), name, 'png');
                return;
            }

            /* And the same roll as one document of outlines and paths, which is
               the display list rather than the pixels. The writer carries the
               outlines of the faces, which is the heaviest thing this page can
               load and the one a reader may never ask for, so it is fetched
               when it is asked for and not before */

            let { toSvg } = await import('@point-of-sale/receipt-printer-renderer/svg');

            let svg = toSvg(renderer.layout(data), { cutMarker: true });

            download(new Blob([svg], { type: 'image/svg+xml' }), name, 'svg');
        }
        catch (e) {
            trouble = e.message || String(e);
        }
    }


    /* Printing: the bytes as they were loaded, nothing added and no cut
       appended, since the file is the job */

    let printer = null;

    const onconnect = ({ driver, baudrate }) => {
        trouble = '';

        printer = connect({
            driver,
            baudrate,
            onconnected: (data) => {
                device = data;
                connected = true;
            },
            ondisconnected: () => {
                device = null;
                connected = false;
                printer = null;
            },
            onerror: (e) => {
                trouble = e.message || String(e);
            },
        });
    }

    const ondisconnect = () => {
        disconnect(printer);

        printer = null;
        device = null;
        connected = false;
    }

    const print = () => {
        if (!printer || !stream) {
            return;
        }

        let failed = (e) => {
            trouble = e.message || String(e);
        };

        try {
            /* A driver prints asynchronously, so a printer that went away in
               the meantime is a promise that rejects rather than a throw */

            let result = printer.print(stream.bytes);

            if (result && typeof result.catch === 'function') {
                result.catch(failed);
            }
        }
        catch (e) {
            failed(e);
        }
    }

    const open = () => picker?.click();

    const chosen = async (event) => {
        let file = event.target.files?.[0];

        /* The picker is emptied, so that the same file chosen twice in a row is
           two loads rather than one */

        event.target.value = '';

        if (file) {
            load(new Uint8Array(await file.arrayBuffer()), file.name);
        }
    }

    const toggle = (id) => {
        if (shown.includes(id)) {
            if (shown.length > 1) {
                shown = shown.filter((value) => value !== id);
            }

            return;
        }

        /* A panel that comes back comes back where it belongs, which is the
           order of the list and not the order it was switched on in */

        shown = PANELS.filter((panel) => panel.id === id || shown.includes(panel.id))
            .map((panel) => panel.id);
    }


    /* A drop anywhere on the page, so that no panel has to be aimed at. The
       depth is what tells a pointer leaving the page from a pointer crossing
       from one element of it to the next, which fires the same event */

    let depth = 0;

    $effect(() => {
        const entered = (event) => {
            event.preventDefault();
            depth++;
            dropping = true;
        };

        const over = (event) => {
            event.preventDefault();

            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = 'copy';
            }
        };

        const left = (event) => {
            event.preventDefault();
            depth = Math.max(0, depth - 1);

            if (depth === 0) {
                dropping = false;
            }
        };

        const dropped = async (event) => {
            event.preventDefault();
            depth = 0;
            dropping = false;

            let file = event.dataTransfer?.files?.[0];

            if (file) {
                load(new Uint8Array(await file.arrayBuffer()), file.name);
            }
        };

        window.addEventListener('dragenter', entered);
        window.addEventListener('dragover', over);
        window.addEventListener('dragleave', left);
        window.addEventListener('drop', dropped);

        return () => {
            window.removeEventListener('dragenter', entered);
            window.removeEventListener('dragover', over);
            window.removeEventListener('dragleave', left);
            window.removeEventListener('drop', dropped);
        };
    });


    /* And the link: `#data=` and the bytes in base64url, read once when the
       page opens and never written back */

    const fromFragment = () => {
        let match = /(?:^|[#&])data=([^&]*)/.exec(window.location.hash || '');

        if (!match || !match[1]) {
            return;
        }

        try {
            /* Base64url is what a link carries, and plain base64 is accepted as
               well, padded or not */

            let value = decodeURIComponent(match[1]).replace(/-/g, '+').replace(/_/g, '/');

            value += '='.repeat((4 - value.length % 4) % 4);

            let binary = atob(value);
            let data = new Uint8Array(binary.length);

            for (let i = 0; i < binary.length; i++) {
                data[i] = binary.charCodeAt(i);
            }

            load(data, 'receipt');
        }
        catch (e) {
            error = 'The link does not hold a stream';
        }
    }

    fromFragment();

</script>

<Header
    onopen={open}
    ontoggle={toggle}
    onsave={save}
    {onconnect}
    {ondisconnect}
    onprint={print}
    bind:model
    language={stream?.language || null}
    loaded={!!stream}
    {connected}
    {device}
    panels={PANELS}
    {shown}
/>

<input type="file" bind:this={picker} onchange={chosen} hidden />

{#if trouble}
    <div class="trouble" role="alert">
        {trouble}

        <button type="button" onclick={() => trouble = ''} aria-label="Dismiss">&times;</button>
    </div>
{/if}

{#if stream}
    {#each panels as panel, index (panel.id)}
        <div
            class="panel"
            class:paper={panel.id === 'rendered'}
            style="grid-column: {index * 2 + 1};"
        >
            {#if panel.id === 'hex'}
                <Toolbar picks="language" bind:language {detected} dark />
            {:else if panel.id === 'rendered'}
                <Toolbar picks="model" bind:model {language} {detected} />
            {:else}
                <Toolbar />
            {/if}

            <main>
                {#if panel.id === 'hex'}
                    <HexDump bind:this={hex} />
                {:else if panel.id === 'rendered'}
                    <Image bind:this={rendered} />
                {:else}
                    <Decoded bind:this={decoded} />
                {/if}
            </main>
        </div>

        {#if index < panels.length - 1}
            <Split
                name="inspector-{panel.id}"
                column={index * 2 + 2}
                row={3}
                minimum={MINIMUM}
                reserve={reserve(index)}
                {initial}
                label="Resize the {panel.label.toLowerCase()} panel"
                background={panels[index + 1].id === 'rendered' ? 'var(--paper)' : 'var(--pane)'}
            />
        {/if}
    {/each}
{:else}
    <div class="empty">
        <div>
            {#if error}
                <p class="error">{error}</p>
            {/if}

            <p class="hint">Load a file, or drop one here</p>
        </div>
    </div>
{/if}

{#if dropping}
    <div class="overlay">
        <div class="target">Drop a file to load it</div>
    </div>
{/if}


<style>

    /* The grid of the inspector: the header and the row of the panels, whose
       columns are worked out from the panels that are shown */

    :global(body) {
        display: grid;
        grid-template-rows: 61px auto 1fr;
        height: 100vh;

        /* The grey of the panes, and the darker grey the paper lies on, which
           the gutter in front of it wears as well */

        --pane: #fafafa;
        --paper: #e4e4e4;
    }

    /* A panel is a column that scrolls, in the grey the panes are shown on */

    .panel {
        grid-row: 3;
        background: var(--pane);
        overflow: scroll;
    }

    .panel main {
        padding: 0 20px;
        margin: 0;
        font-family: var(--font-stack-mono);
        font-size: 0.75rem;
        color: #888;
    }

    /* And the panel the paper is on is darker than the others, so that the white
       of the paper is the receipt and not the panel */

    .panel.paper {
        background: var(--paper);
    }

    /* The page before a file has been loaded */

    .empty {
        grid-row: 3;
        grid-column: 1 / -1;

        display: grid;
        place-items: center;

        background: #fafafa;
        font-family: system-ui;
        font-size: 10pt;
        color: #888;
        text-align: center;
    }

    .empty p {
        margin: 0;
    }

    /* What went wrong, above the line that says what to do about it */

    .empty .error {
        margin-bottom: 6px;
        color: #000;
    }

    /* What went wrong while a file was being written: a row of its own between
       the header and the panels, which pushes them down rather than covering
       them, until it is dismissed or another file is loaded */

    .trouble {
        grid-row: 2;
        grid-column: 1 / -1;

        display: flex;
        align-items: center;
        gap: 8px;
        box-sizing: border-box;
        padding: 8px 15px;

        background: #fff3cd;
        border-bottom: 1px solid #ffe69c;

        font-family: system-ui;
        font-size: 9pt;
        color: #664d03;
    }

    .trouble button {
        height: 20px;
        margin: 0 0 0 auto;
        padding: 0 6px;
        border-radius: 4px;
        background: transparent;

        font-size: 12pt;
        line-height: 1;
        color: #664d03;
        cursor: pointer;
    }

    /* And the page while a file is being dragged over it */

    .overlay {
        position: fixed;
        inset: 0;
        z-index: 200;

        display: grid;
        place-items: center;

        background: rgba(255, 255, 255, 0.85);
    }

    .target {
        border: 2px dashed #2196F3;
        border-radius: 12px;
        padding: 32px 48px;

        font-family: system-ui;
        font-weight: 600;
        font-size: 12pt;
        color: #1976d2;
    }

</style>
