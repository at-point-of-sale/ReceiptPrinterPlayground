<script>

    import { decode, LANGUAGES } from '@point-of-sale/receipt-printer-decoder';
    import ReceiptPrinterRenderer, { toImageData } from '@point-of-sale/receipt-printer-renderer';

    let { view } = $props();

    let html = $state('');
    let error = $state('');

    /* The bytes of the images of the stream, in the order of their canvases,
       and how to render them: the HTML never carries bytes of its own */

    let previews = $state([]);
    let settings = $state(null);

    let container = $state(null);
    let generation = 0;

    /* The images found while the HTML of a render is built */

    let pending = [];


    /* The codepage mapping the encoder falls back to when the printer model
       does not name one, which is what the encoder does as well */

    const mappings = {
        'esc-pos':   'epson',
        'star-prnt': 'star',
        'star-line': 'star',
    };

    /* A payload is never shown as a wall of numbers, so a row stays a row, and
       the bytes of a payload are cut off where a page of them ends */

    const LIMIT = 16;
    const CAP = 8192;

    /* Number of images drawn between two frames, so that a receipt of many of
       them does not hold the page */

    const BATCH = 4;

    /* The renderer speaks the same languages as the encoder */

    const languages = {
        'esc-pos':   'esc-pos',
        'star-prnt': 'star-prnt',
        'star-line': 'star-line',
    };

    /* The line feed, which the encoder writes a carriage return behind */

    const LF = 0x0a;
    const CR = 0x0d;

    /* How a byte is written where a mnemonic goes, which is the spelling the
       command references use. The decoder spells its own mnemonics with this
       table and does not export it */

    const ABBREVIATIONS = [
        'NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL',
        'BS', 'HT', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI',
        'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB',
        'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US', 'SP',
    ];

    const DELETE = 0x7f;


    /* Everything below comes out of the stream, so everything below is escaped */

    const escape = (value) => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const spaces = (value) => escape(value).replace(/ /g, '<span class="space">·</span>');

    const spell = (byte) => {
        if (byte < ABBREVIATIONS.length) {
            return ABBREVIATIONS[byte];
        }

        if (byte === DELETE) {
            return 'DEL';
        }

        if (byte < DELETE) {
            return String.fromCharCode(byte);
        }

        return `0x${byte.toString(16).padStart(2, 0)}`;
    }

    const byte = (value) => value.toString(16).padStart(2, 0).toUpperCase();

    /* The bytes of a row are cells of two digits with the gap the characters of
       a run of text keep, so that the hex of a command and the hex under a run
       of text line up byte for byte down the pane */

    const hex = (bytes) => Array.from(bytes).slice(0, LIMIT).map((value) => `<span class="cell">${byte(value)}</span>`).join('')
        + (bytes.length > LIMIT ? '<span class="cell">…</span>' : '');

    /* A name behind a name is a part of the same sentence */

    const sentence = (names) => names
        .map((name, index) => index === 0 ? name : name.charAt(0).toLowerCase() + name.slice(1))
        .join(', ');


    /* One row of a block: what it is called, the bytes it was read from and
       what they mean */

    const row = (mnemonic, bytes, meaning, header, extra = '') => {
        let name = header ? ' header' : '';

        return `<span class="mnemonic${name}">${mnemonic}</span>`
            + `<span class="meaning${name}">${meaning}</span>`
            + `<span class="bytes${name}${extra}">${bytes}</span>`;
    }

    /* A payload is the data behind the numbers of a command, which the decoder
       reports as the bytes it covers: its bytes are the whole of it and say
       what it is, so there is no meaning to put beside them. One row of them is
       shown, and the toggle under it, which carries the count, opens the rest */

    const isData = (parameter) => typeof parameter.value === 'number'
        && parameter.length > 2
        && parameter.length === parameter.value;

    const payload = (bytes) => {
        let shown = Math.min(bytes.length, CAP);
        let cells = '';

        for (let i = 0; i < shown; i++) {
            cells += `<span class="cell">${byte(bytes[i])}</span>`;
        }

        if (bytes.length > CAP) {
            cells += '<span class="cell">…</span>';
        }

        let count = bytes.length > CAP ? `${CAP} of ${bytes.length} bytes` : `${bytes.length} bytes`;

        return `<span class="cells">${cells}</span><span class="toggle">${count}</span>`;
    }

    /* The colour of a block is the colour the Encoded tab gives the same kind
       of command, by the category the decoder puts it in */

    const KINDS = {
        'Codepages and character sets': 'codepage',
        'Styles and sizes': 'style',
        'Two colour printing': 'style',
        'Line spacing and feeds': 'layout',
        'Alignment and position': 'layout',
        'Page mode': 'layout',
        'Barcodes': 'graphics',
        'QR codes': 'graphics',
        'PDF417': 'graphics',
        'Images': 'graphics',
        'Graphics': 'graphics',
        'Raster mode': 'graphics',
        'Cut and drawer': 'cut',
        'Printer state and status': 'status',
        'Text and control': 'control',
    };

    const block = (type, content, kind = type) => `<div class="token" data-type="${type}" data-kind="${kind}">${content}</div>`;


    /* A command is its family and one row per parameter, every row against the
       bytes it was read from */

    const command = (token) => {
        let list = token.parameters || [];

        /* The font is a style to the decoder and a layout matter to the Encoded
           tab, which colours it with the alignment and the line spacing */

        let kind = token.known === false ? 'unknown' :
            (token.family.name === 'Font' ? 'layout' : (KINDS[token.category] || 'other'));

        /* The head of the command is whatever is in front of its first
           parameter, which is the prefix and the command byte */

        let head = list.length ? token.bytes.subarray(0, list[0].offset) : token.bytes;

        let result = row(
            escape(token.family.mnemonic),
            hex(head),
            token.family.name === token.family.mnemonic ? '' : escape(token.family.name),
            true,
        );

        for (let parameter of list) {
            /* A parameter the command did not carry keeps its place in the list
               of the decoder, and has nothing to show here */

            if (parameter.length === 0 || typeof parameter.value === 'undefined') {
                continue;
            }

            if (isData(parameter)) {
                /* A command that draws carries the picture of what it draws,
                   under the bytes it draws it from */

                let preview = '';

                if (kind === 'graphics' && settings) {
                    preview = `<canvas class="preview" data-index="${pending.length}"></canvas>`;
                    pending.push(token.bytes);
                }

                result += row(escape(parameter.name), payload(parameter.bytes) + preview, '', false, ' payload');
                continue;
            }

            result += row(
                escape(parameter.name),
                hex(parameter.bytes),
                parameter.meaning ? escape(parameter.meaning) :
                    typeof parameter.value === 'string' ? spaces(parameter.value) : escape(parameter.value),
                false,
            );
        }

        return block(token.known === false ? 'unknown' : 'command', result, kind);
    }


    /* A run of text is its characters over the bytes they were printed with. A
       multibyte run is pairs of a CJK character set that this package does not
       decode, so it is the bytes alone */

    const text = (token) => {
        let characters = token.multibyte ? null : Array.from(token.text);
        let result = '';

        for (let i = 0; i < token.bytes.length; i++) {
            let character = characters ? characters[i] : '';

            result += '<span class="cell">'
                + `<span class="character${character === ' ' ? ' space' : ''}">${character === ' ' ? '·' : character ? escape(character) : '&nbsp;'}</span>`
                + `<span class="byte">${byte(token.bytes[i])}</span>`
                + '</span>';
        }

        return block('text', `<span class="mnemonic"></span><div class="characters">${result}</div>`);
    }


    /* A control byte is one row, and so are the two of a line ending. A row of
       dots of Star raster mode is the one that carries a count */

    const control = (tokens) => {
        let first = tokens[0];

        let bytes = tokens.length > 1 ?
            tokens.reduce((result, token) => result.concat(Array.from(token.bytes)), []) :
            first.bytes;

        let names = tokens.map((token) => token.parameters?.length ?
            sentence([token.name, ...token.parameters.map((parameter) => parameter.meaning || `${parameter.value}`)]) :
            token.name);

        /* A line ending is the return glyph the other panes end a line with,
           rather than its name in words */

        let meaning = first.byte === LF ?
            '<span class="return">⏎</span>' :
            escape(sentence(names));

        return block(first.type, row(
            tokens.map((token) => spell(token.byte)).join(' '),
            hex(bytes),
            meaning,
            false,
        ));
    }


    /* One token, as a block of its own */

    const token = (item) => {
        if (item.type === 'command') {
            return command(item);
        }

        if (item.type === 'text') {
            return text(item);
        }

        if (item.type === 'control' || item.type === 'ignored') {
            return control([item]);
        }

        /* The tail of a stream that ends inside a command, which is the last token */

        return block('incomplete', row('', hex(item.bytes), 'Incomplete command', false));
    }


    export const render = (encoder) => {
        error = '';
        html = '';
        previews = [];
        settings = null;
        pending = [];

        if (!encoder) {
            return;
        }

        try {
            let language = encoder.language;

            if (!LANGUAGES.includes(language)) {
                throw new Error(`Cannot decode ${language} commands`);
            }

            let codepageMapping = encoder.printerCapabilities?.codepages || mappings[language];

            /* What the images of the stream are drawn with, which is what the
               Image tab draws the whole receipt with */

            if (languages[language]) {
                settings = {
                    language: languages[language],
                    width: encoder.printableWidth,
                    codepageMapping,
                };
            }

            /* Read the bytes back the way the selected printer would read them */

            let tokens = decode(encoder.encode(), language, {codepageMapping});

            let result = '';

            for (let i = 0; i < tokens.length; i++) {
                let item = tokens[i];

                /* The encoder ends a line with a line feed and a carriage return,
                   which is one ending and one block */

                if (item.type === 'control' && item.byte === LF) {
                    let next = tokens[i + 1];

                    if (next && next.type === 'control' && next.byte === CR) {
                        result += control([item, tokens[++i]]);
                        continue;
                    }
                }

                result += token(item);
            }

            previews = pending;
            html = result;
        }
        catch (e) {
            error = e.message || String(e);
        }
    }


    /* The images a stream sends, out of the display list of the renderer: an
       image operation is the bitmap that was sent, at the size it was sent at,
       the whitespace inside it included */

    const operations = (entries) => {
        let found = [];

        for (let entry of entries || []) {
            if (entry.type === 'line') {
                found.push(...(entry.operations || []).filter((operation) => operation.type === 'image'));
            }

            if (entry.type === 'page') {
                for (let area of entry.areas || []) {
                    found.push(...operations(area.entries));
                }
            }
        }

        return found;
    }

    const pictures = (bytes, feed) => {
        let renderer = new ReceiptPrinterRenderer(settings);
        let stream = feed ? Uint8Array.from([...bytes, LF]) : bytes;

        return operations(renderer.layout(stream).entries);
    }


    /* The images of a command, drawn the way the printer would print them. A
       command that lays out no image, a graphic the printer stored earlier for
       one, keeps no canvas */

    const draw = async (list, current) => {
        for (let i = 0; i < list.length; i++) {
            if (current !== generation) {
                return;
            }

            let canvas = container?.querySelector(`canvas[data-index="${i}"]`);

            if (!canvas) {
                continue;
            }

            try {
                let images = pictures(list[i]);

                /* A column mode image is put on the line it is on when that line
                   is fed, so a command that lays out nothing on its own is asked
                   once more with the feed behind it */

                if (!images.length) {
                    images = pictures(list[i], true);
                }

                if (!images.length) {
                    canvas.remove();
                    continue;
                }

                /* The images of one command, below each other */

                canvas.width = Math.max(...images.map((image) => image.width));
                canvas.height = images.reduce((total, image) => total + image.height, 0);

                let context = canvas.getContext('2d');

                context.fillStyle = '#fff';
                context.fillRect(0, 0, canvas.width, canvas.height);

                let y = 0;

                for (let image of images) {
                    context.putImageData(toImageData({width: image.width, height: image.height, data: image.data}), 0, y);
                    y += image.height;
                }

                canvas.classList.add('drawn');
            }
            catch (e) {
                canvas.remove();
            }

            /* A receipt of many images is drawn a few at a time, so that the
               page stays the page while it happens */

            if ((i + 1) % BATCH === 0) {
                await new Promise((resolve) => requestAnimationFrame(resolve));
            }
        }
    }


    /* The canvases exist once the HTML of a render is in the page */

    $effect(() => {
        html;

        let list = previews;
        let current = ++generation;

        if (container && list.length && settings) {
            draw(list, current);
        }
    });


    /* The list is HTML rather than components, so the toggle of a payload is
       one listener on the pane */

    const click = (event) => {
        let toggle = event.target.closest?.('.toggle');

        toggle?.closest('.bytes')?.classList.add('open');
    }

</script>

{#if $view === 'decoded'}
    {#if error}
        <div class="error">{error}</div>
    {:else}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div bind:this={container} onclick={click}>{@html html}</div>
    {/if}
{/if}

<style>

    div {
        padding-top: 16px;
        padding-bottom: 16px;
    }


    /* Every token is a block of its own, and the colour of the border is what
       kind of token it is, the colours the other panes give those kinds */

    div :global(.token) {
        --colour: #888;
        background: #e9e9e9;
        border-radius: 6px;
        overflow: hidden;
        color: #000;
        font-size: 0.7rem;
        line-height: 150%;
        margin-bottom: 12px;
        padding: 0 10px 0 0;
    }

    div :global(.token[data-kind="text"]) {
        --colour: #4CAF50;
    }
    div :global(.token[data-kind="codepage"]) {
        --colour: #00BCD4;
    }
    div :global(.token[data-kind="style"]),
    div :global(.token[data-kind="other"]) {
        --colour: #3F51B5;
    }
    div :global(.token[data-kind="layout"]) {
        --colour: #607D8B;
    }
    div :global(.token[data-kind="graphics"]) {
        --colour: #9C27B0;
    }
    div :global(.token[data-kind="cut"]) {
        --colour: #a43d68;
    }
    div :global(.token[data-kind="status"]) {
        --colour: #D85700;
    }
    div :global(.token[data-kind="ignored"]) {
        --colour: #9e9e9e;
    }

    /* A line ending and the other control bytes are the quiet blocks of the
       list, a lighter grey with the mnemonic in black */

    div :global(.token[data-kind="control"]) {
        --colour: #d4d4d4;
    }

    div :global(.token[data-kind="control"] > .mnemonic) {
        color: #000;
    }
    div :global(.token[data-kind="unknown"]) {
        --colour: #D32F2F;
    }
    div :global(.token[data-kind="incomplete"]) {
        --colour: #a43d68;
    }


    /* The rows of a block are three columns of the same width in every block,
       the names, the meanings and the bytes, so that they line up down the
       pane; a run of text is a block of the same columns with its characters
       and their bytes in the third, under the bytes of the commands */

    div :global(.token) {
        display: grid;
        grid-template-columns: calc(8ch + 14px) 22ch minmax(0, 1fr);
    }

    /* The first column is the colour of the kind of token, hugging its
       contents, and the rows carry the padding of the block so that the colour
       reaches its top and bottom edges */

    div :global(.token > .mnemonic) {
        background: var(--colour);
        color: #fff;
        padding-left: 6px;
        padding-right: 8px;
    }

    div :global(.token > .meaning),
    div :global(.token > .bytes),
    div :global(.token > .characters) {
        padding-left: 12px;
    }

    div :global(.token > :nth-child(-n+3)) {
        padding-top: 7px;
    }

    div :global(.token > :nth-last-child(-n+3)) {
        padding-bottom: 7px;
    }

    div :global(.token .mnemonic) {
        font-family: var(--font-stack-mono);
        overflow-wrap: anywhere;
    }

    div :global(.token .bytes) {
        font-family: var(--font-stack-mono);
        display: flex;
        flex-wrap: wrap;
        gap: 0 6px;
        align-content: flex-start;
    }


    div :global(.token .bytes) {
        color: #888;
    }

    div :global(.token .header) {
        font-weight: 600;
    }


    /* The bytes of a payload are one row of the column until the toggle under
       them opens the rest, and the count of them lives on that toggle */

    div :global(.token .bytes.payload) {
        display: block;
    }

    div :global(.token .bytes.payload .cells) {
        display: flex;
        flex-wrap: wrap;
        gap: 0 6px;
        height: 1.5em;
        overflow: hidden;
    }

    div :global(.token .bytes.payload.open .cells) {
        height: auto;
        overflow: visible;
    }

    /* The toggle opens the bytes and goes away with them open: what it had to
       say is what the bytes say once they are all there */

    div :global(.token .toggle) {
        color: #aaa;
        cursor: pointer;
        display: inline-block;
        font-size: 0.75rem;
        user-select: none;
    }

    div :global(.token .toggle::before) {
        content: '▸ ';
    }

    div :global(.token .bytes.payload.open .toggle) {
        display: none;
    }


    /* What a command that draws puts on the paper, a dot of the printer to a
       pixel of the screen, no wider than the column it is in, and shown with
       the bytes it was drawn from */

    div :global(.token .preview) {
        display: none;
        margin: 16px 0 12px;
        max-width: 100%;
        height: auto;
    }

    div :global(.token .bytes.payload.open .preview.drawn) {
        display: block;
    }


    /* A run of text is a cell per character: the character over the byte it was
       printed with, and the run wraps a character at a time */

    div :global(.token .characters) {
        grid-column: 3;
        display: flex;
        flex-wrap: wrap;
        gap: 0 6px;
    }

    div :global(.token .cell) {
        display: flex;
        flex-direction: column;
        align-items: center;
        font-family: var(--font-stack-mono);
        min-width: 2ch;
    }

    div :global(.token .byte) {
        color: #888;
    }

    div :global(.token .space) {
        color: #aaa;
    }

    div :global(.token .return) {
        font-family: sans-serif;
    }

    div :global(.token .codepage) {
        color: #aaa;
        flex: none;
    }


    .error {
        background: #f0f0f0;
        border-radius: 6px;
        font-family: var(--font-stack-mono);
        font-size: 11px;
        margin: 16px 0;
        padding: 6px 8px;
        color: #000;
    }

</style>
