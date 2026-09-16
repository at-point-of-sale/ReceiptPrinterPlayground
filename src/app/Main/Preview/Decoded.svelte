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

    const hex = (bytes) => Array.from(bytes).slice(0, LIMIT).map(i => i.toString(16).padStart(2, 0)).join(' ')
        + (bytes.length > LIMIT ? ' …' : '');

    const spaces = (value) => escape(value).replace(/ /g, '<span class="space">&nbsp;</span>');

    const meanings = (parameters) => parameters.map(p => p.meaning || `${p.name}: ${p.value}`).join(', ');


    /* One token, as the other panes show one command */

    const command = (token) => {
        if (token.type === 'command') {
            /* A command nothing is known about has its mnemonic as its summary,
               which the type says already */

            return `<div class="command" data-type="${token.known === false ? 'unknown' : 'command'}">`
                + `<span class="type">${escape(token.mnemonic)}</span>`
                + (token.summary === token.mnemonic ? '' : `<span class="description">${escape(token.summary)}</span>`)
                + `<span class="raw">${hex(token.bytes)}</span>`
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
            + `<span class="raw">${hex(token.bytes)}</span>`
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

    div :global(.line .command .raw) {
        color: #666;
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
