<script>

    import ReceiptPrinterRenderer, { stitch, toImageData } from '@point-of-sale/receipt-printer-renderer';

    let { view } = $props();

    let error = $state('');
    let image = $state(null);
    let canvas = $state(null);

    /* The paper is shown at two thirds of its size in dots */

    const SCALE = 0.66;


    /* The renderer speaks the same languages as the encoder */

    const languages = {
        'esc-pos':   'esc-pos',
        'star-prnt': 'star-prnt',
        'star-line': 'star-line',
    };

    /* The codepage mapping the encoder falls back to when the printer model
       does not name one, which is what the encoder does as well */

    const mappings = {
        'esc-pos':   'epson',
        'star-prnt': 'star',
        'star-line': 'star',
    };


    export const render = (encoder) => {
        error = '';
        image = null;

        if (!encoder) {
            return;
        }

        try {
            let language = languages[encoder.language];

            if (!language) {
                throw new Error(`Cannot render ${encoder.language} commands`);
            }

            /* Render the commands the way the selected printer would print them */

            let width = encoder.printableWidth;

            let renderer = new ReceiptPrinterRenderer({
                language,
                width,
                codepageMapping: encoder.printerCapabilities?.codepages || mappings[language],
                commands: [ 'cut', 'pulse', 'feed' ],
            });

            let items = renderer.render(encoder.encode());

            /* And put the paper that comes out of the printer on the canvas */

            let paper = stitch(items, { width, cutMarker: true });

            if (paper.height === 0) {
                return;
            }

            image = toImageData(paper);
        }
        catch (e) {
            error = e.message || String(e);
        }
    }


    /* The canvas only exists while this is the active view, so draw as soon as
       both the image and the canvas are there */

    $effect(() => {
        if (canvas && image) {
            canvas.width = image.width;
            canvas.height = image.height;
            canvas.getContext('2d').putImageData(image, 0, 0);
        }
    });

</script>

{#if $view === 'image'}
    {#if error}
        <div class="error">{error}</div>
    {:else if image}
        <div class="paper">
            <canvas bind:this={canvas} style="width: {Math.round(image.width * SCALE)}px;"></canvas>
        </div>
    {/if}
{/if}

<style>

    .paper {
        background: #fff;
        box-sizing: border-box;
        padding: 32px;
        margin: 24px auto;
        width: max-content;
        max-width: 100%;
    }

    canvas {
        display: block;
        max-width: 100%;
        height: auto;
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
