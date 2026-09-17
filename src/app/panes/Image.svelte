<script>

    import ReceiptPrinterRenderer, { stitch, toImageData } from '@point-of-sale/receipt-printer-renderer';

    /**
     * @prop {object} view - The store of the tab that is shown, on a page whose
     *                       panes take turns; a pane given no view is always shown
     */
    let { view = null } = $props();

    let error = $state('');
    let image = $state(null);
    let canvas = $state(null);

    /* The paper is shown at two thirds of its size in dots */

    const SCALE = 0.66;


    /**
     * Show a stream
     *
     * @param  {object}  stream  The bytes and the settings of the printer that
     *                           reads them, or null when there is no stream
     */
    export const render = (stream) => {
        error = '';
        image = null;

        if (!stream) {
            return;
        }

        try {
            let language = stream.language;

            if (!ReceiptPrinterRenderer.languages.includes(language)) {
                throw new Error(`Cannot render ${language} commands`);
            }

            /* Render the commands the way the printer they were sent to would
               print them */

            let width = stream.width;

            let renderer = new ReceiptPrinterRenderer({
                language,
                width,
                codepageMapping: stream.codepageMapping,
                commands: [ 'cut', 'pulse', 'feed' ],
            });

            let items = renderer.render(stream.bytes);

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


    /* The canvas only exists while the pane is shown, so draw as soon as both
       the image and the canvas are there */

    $effect(() => {
        if (canvas && image) {
            canvas.width = image.width;
            canvas.height = image.height;
            canvas.getContext('2d').putImageData(image, 0, 0);
        }
    });

</script>

{#if !view || $view === 'image'}
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
