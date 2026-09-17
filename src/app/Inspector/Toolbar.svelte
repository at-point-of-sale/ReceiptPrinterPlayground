<script>

    import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

    import { spell, family } from '../../utils/language.js';

    /*
        The toolbar of the Rendered panel: the model the bytes are read as.

        It belongs to that panel rather than to the header, because what it
        changes is what the paper looks like, and it sits still at the top of the
        panel while the paper scrolls underneath it. The Print popover holds the
        same selector bound to the same value, so a printer can be chosen where
        the printing happens as well.
    */

    /**
     * @prop {string} model - Bindable id of the printer model, empty for Auto
     * @prop {?string} detected - The language the decoder found, or null
     * @prop {?string} language - The language the stream is read as, or null
     */
    let {
        model = $bindable(''),
        detected = null,
        language = null,
    } = $props();

    let models = ReceiptPrinterEncoder.printerModels;

    /* What the first option of the selector says: the detected language once a
       file has been read, and nothing at all before that */

    let auto = $derived(detected ? `Auto (${spell(detected)})` : 'Auto');

    /* A model whose language is not the one that was detected is allowed, since
       detection can be wrong, and this is where the page says so */

    let note = $derived(detected && language && family(language) !== family(detected) ?
        `Detected ${spell(detected)}` : '');

</script>

<div class="toolbar">
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
</div>


<style>

    /* A row of its own at the top of the panel, half the height of the header
       and with the panel's background, so that it reads as the top of the panel
       rather than as a second bar of the page */

    .toolbar {
        display: flex;
        align-items: center;
        box-sizing: border-box;
        height: 46px;
        padding: 0 20px;
        flex-shrink: 0;
    }

    /* The selects of this application carry the margin of the header, which is
       the margin of a 61px bar and not of this row */

    .toolbar select {
        margin: 0;
        max-width: 100%;
    }

    /* What was detected, beside the model that is not it */

    .toolbar .note {
        margin-left: 12px;
        overflow: hidden;

        font-family: system-ui;
        font-size: 9pt;
        color: #888;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

</style>
