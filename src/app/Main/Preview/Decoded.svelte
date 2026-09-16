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

    /* A payload is never shown as a wall of numbers, so a list stays a list */

    const LIMIT = 16;
    const PAYLOAD = 8;

    /* A parameter of one or two bytes is a number to read; anything longer is
       the data behind the numbers */

    const NUMBER = 2;

    /* The line feed, which is where a line of the list ends, and the carriage
       return the encoder writes behind it */

    const LF = 0x0a;
    const CR = 0x0d;


    /* Everything below comes out of the stream, so everything below is escaped */

    const escape = (value) => String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const hex = (bytes, limit) => Array.from(bytes).slice(0, limit).map(i => '0x' + i.toString(16).padStart(2, 0)).join(' ')
        + (bytes.length > limit ? ' …' : '');

    const spaces = (value) => escape(value).replace(/ /g, '<span class="space">&nbsp;</span>');

    const meanings = (parameters) => parameters.map(p => p.meaning || `${p.name}: ${p.value}`).join(', ');


    /* The parameters of a command, in the order the command carries them: the
       bytes each one was read from and what it means, and the data behind them
       last, which is what the numbers are about */

    const parameters = (token) => {
        let result = '';
        let payload = '';
        let list = token.parameters || [];

        for (let i = 0; i < list.length; i++) {
            let parameter = list[i];

            /* A parameter the command did not carry keeps its place in the list of
               the decoder, and has nothing to show here */

            if (parameter.length === 0 || typeof parameter.value === 'undefined') {
                continue;
            }

            /* The string a command prints, the data it stores */

            if (typeof parameter.value === 'string') {
                payload += '<span class="payload"><span class="separator">|</span>'
                    + `<span class="text">${spaces(parameter.value)}</span></span>`;
                continue;
            }

            if (parameter.length > NUMBER) {
                payload += '<span class="payload"><span class="separator">|</span>'
                    + escape(parameter.meaning || `${parameter.value} bytes`)
                    + `<span class="raw">${hex(parameter.bytes, PAYLOAD)}</span></span>`;
                continue;
            }

            /* Two parameters that share a byte, the nibbles of GS !, are the one
               byte they were read from with both meanings behind it */

            let shared = [parameter];

            while (i + 1 < list.length
                && list[i + 1].offset === parameter.offset
                && list[i + 1].length === parameter.length) {
                shared.push(list[++i]);
            }

            /* Parameters that share a byte are told apart by the part of their
               names behind the comma, "n, width" and "n, height", which is
               shown in front of each meaning; a parameter of its own needs no
               such word */

            const label = (p) => shared.length > 1 && p.name.includes(',')
                ? `${p.name.slice(p.name.indexOf(',') + 1).trim()} ` : '';

            result += `<span class="parameter"><span class="raw">${hex(parameter.bytes, NUMBER)}</span>`
                + `${escape(shared.map(p => label(p) + (p.meaning ?? p.value)).join(', '))}</span>`;
        }

        return result + payload;
    }


    /* One token, as the other panes show one command */

    const command = (token) => {
        if (token.type === 'command') {
            /* The family names the command and the parameters say the rest of it,
               so a command nothing is known about is its mnemonic and its bytes */

            let described = parameters(token);

            return `<div class="command" data-type="${token.known === false ? 'unknown' : 'command'}">`
                + `<span class="type">${escape(token.family.mnemonic)}</span>`
                + (token.family.name === token.family.mnemonic ? '' : `<span class="description">${escape(token.family.name)}</span>`)
                + (described || (token.known === false ? `<span class="raw">${hex(token.bytes, LIMIT)}</span>` : ''))
                + '</div>';
        }

        if (token.type === 'text') {
            /* A multibyte run is pairs of a CJK character set that this package does
               not decode, so it is shown by the number of bytes it covers */

            return '<div class="command" data-type="text">'
                + '<span class="type">text</span>'
                + `<span class="text">${token.multibyte ? `${token.length} bytes` : spaces(token.text)}</span>`
                + `<span class="codepage">${escape(token.codepage)}</span>`
                + '</div>';
        }

        if (token.type === 'control' || token.type === 'ignored') {
            return `<div class="command" data-type="${token.type}">`
                + `<span class="type">${escape(token.name)}</span>`
                + (token.parameters?.length ? `<span class="description">${escape(meanings(token.parameters))}</span>` : '')
                + '</div>';
        }

        /* The tail of a stream that ends inside a command, which is the last token */

        return '<div class="command" data-type="incomplete">'
            + '<span class="type">Incomplete</span>'
            + `<span class="raw">${hex(token.bytes, LIMIT)}</span>`
            + '</div>';
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
            let line = '';

            for (let i = 0; i < tokens.length; i++) {
                let item = tokens[i];

                if (item.type === 'control' && item.byte === LF) {
                    /* The encoder ends a line with a line feed and a carriage return,
                       so a carriage return directly behind the line feed is part of
                       the same ending and belongs to the glyph. One anywhere else
                       means something on its own and stays a command of its own */

                    let next = tokens[i + 1];
                    let carriage = next && next.type === 'control' && next.byte === CR;

                    if (carriage) {
                        i++;
                    }

                    result += `<div class="line">${line}<div class="return" title="${carriage ? 'LF CR' : 'LF'}">⏎</div></div>`;
                    line = '';
                    continue;
                }

                line += command(item);
            }

            /* Whatever follows the last line feed is a line without a line feed,
               and a carriage return that was absorbed leaves nothing behind */

            if (line) {
                result += `<div class="line">${line}</div>`;
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
    }

    div :global(.line .command) {
        max-width: calc(100% - 36px);
    }

    /* A parameter is the bytes it was read from and what they mean, the bytes
       small and muted so that the meaning is what is read */

    div :global(.line .command .parameter),
    div :global(.line .command .payload) {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    div :global(.line .command .raw) {
        background: #c9c9c9;
        border-radius: 4px;
        color: #555;
        font-size: 0.65rem;
        padding: 2px 5px;
        text-wrap: nowrap;
    }

    div :global(.line .command .separator) {
        color: #aaa;
        padding: 0;
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
