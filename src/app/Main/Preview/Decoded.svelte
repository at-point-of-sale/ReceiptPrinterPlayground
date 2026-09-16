<script>

    import { decode, LANGUAGES } from '@point-of-sale/receipt-printer-decoder';

    let { view } = $props();

    let html = $state('');
    let error = $state('');


    /* The codepage mapping the encoder falls back to when the printer model
       does not name one, which is what the encoder does as well */

    const mappings = {
        'esc-pos':   'epson',
        'star-prnt': 'star',
        'star-line': 'star',
    };

    /* A payload is never shown as a wall of numbers, so a row stays a row */

    const LIMIT = 16;

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

    const hex = (bytes) => Array.from(bytes).slice(0, LIMIT).map(byte).join(' ')
        + (bytes.length > LIMIT ? ' …' : '');

    /* A name behind a name is a part of the same sentence */

    const sentence = (names) => names
        .map((name, index) => index === 0 ? name : name.charAt(0).toLowerCase() + name.slice(1))
        .join(', ');


    /* One row of a block: what it is called, the bytes it was read from and
       what they mean */

    const row = (mnemonic, bytes, meaning, header) => {
        let name = header ? ' header' : '';

        return `<span class="mnemonic${name}">${mnemonic}</span>`
            + `<span class="bytes${name}">${bytes}</span>`
            + `<span class="meaning${name}">${meaning}</span>`;
    }

    const block = (type, content) => `<div class="token" data-type="${type}">${content}</div>`;


    /* A command is its family and one row per parameter, every row against the
       bytes it was read from */

    const command = (token) => {
        let list = token.parameters || [];

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

            result += row(
                escape(parameter.name),
                hex(parameter.bytes),
                parameter.meaning ? escape(parameter.meaning) :
                    typeof parameter.value === 'string' ? spaces(parameter.value) : escape(parameter.value),
                false,
            );
        }

        return block(token.known === false ? 'unknown' : 'command', result);
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

        return block(first.type, row(
            tokens.map((token) => spell(token.byte)).join(' '),
            hex(bytes),
            escape(sentence(names)),
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

        if (!encoder) {
            return;
        }

        try {
            let language = encoder.language;

            if (!LANGUAGES.includes(language)) {
                throw new Error(`Cannot decode ${language} commands`);
            }

            /* Read the bytes back the way the selected printer would read them */

            let tokens = decode(encoder.encode(), language, {
                codepageMapping: encoder.printerCapabilities?.codepages || mappings[language],
            });

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

            html = result;
        }
        catch (e) {
            error = e.message || String(e);
        }
    }

</script>

{#if $view === 'decoded'}
    {#if error}
        <div class="error">{error}</div>
    {:else}
        <div>{@html html}</div>
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
        background: #e9e9e9;
        border-left: 4px solid #888;
        border-radius: 0 5px 5px 0;
        color: #000;
        font-size: 0.7rem;
        line-height: 150%;
        margin-bottom: 4px;
        padding: 7px 10px;
    }

    div :global(.token[data-type="command"]) {
        border-color: #3F51B5;
    }
    div :global(.token[data-type="text"]) {
        border-color: #4CAF50;
    }
    div :global(.token[data-type="control"]) {
        border-color: #00BCD4;
    }
    div :global(.token[data-type="ignored"]) {
        border-color: #9e9e9e;
    }
    div :global(.token[data-type="unknown"]) {
        border-color: #D32F2F;
    }
    div :global(.token[data-type="incomplete"]) {
        border-color: #a43d68;
    }


    /* The rows of a block are three columns of the same width in every block,
       so that the names, the bytes and the meanings line up down the pane */

    div :global(.token:not([data-type="text"])) {
        display: grid;
        grid-template-columns: 11ch 26ch minmax(0, 1fr);
        column-gap: 12px;
    }

    div :global(.token .mnemonic),
    div :global(.token .bytes) {
        font-family: var(--font-stack-mono);
        overflow-wrap: anywhere;
    }

    div :global(.token .bytes) {
        color: #888;
    }

    div :global(.token .header) {
        font-weight: 600;
    }


    /* A run of text is a cell per character: the character over the byte it was
       printed with, and the run wraps a character at a time */

    div :global(.token[data-type="text"]) {
        display: flex;
        justify-content: space-between;
        gap: 12px;
    }

    div :global(.token .characters) {
        display: flex;
        flex-wrap: wrap;
        gap: 0 6px;
        padding: 0;
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
