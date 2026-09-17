<script>

    import { spell, LANGUAGES } from '../../utils/language.js';
    import { modelsFor, GENERICS } from '../../utils/stream.js';

    /*
        The toolbar of a panel: one picker, at the top of the panel it belongs
        to.

        The hex dump carries the language, because the bytes are what a language
        is read out of, and the Rendered panel carries the model, because what a
        model changes is the width of the paper. Both sit still at the top of
        their panel while what is under them scrolls, and both look the same.

        The two are one component because the row is the same row; what differs
        is the one select in it. A panel with nothing to pick has the row all the
        same, empty, so that the three columns of the page start at one height.
    */

    /**
     * @prop {string} picks - Which picker this is, `language`, `model`, or
     *                        nothing at all for a row that only keeps the height
     * @prop {string} language - Bindable language the stream is read as, empty for Auto
     * @prop {string} model - Bindable id of the model, a generic or a printer
     * @prop {?string} detected - The language the decoder found, or null
     */
    let {
        picks = '',
        language = $bindable(''),
        model = $bindable(''),
        detected = null,
    } = $props();

    /* What the first option of the language says: the language that was found
       in the bytes, which is what Auto reads them as */

    let auto = $derived(detected ? `Auto (${spell(detected)})` : 'Auto');

    /* And which printers the model offers, which are the printers that speak the
       language the stream is read in */

    let models = $derived(modelsFor(language || detected));

</script>

<div class="toolbar">
    {#if picks === 'language'}
        <select id="language" bind:value={language} aria-label="Language">
            <option value="">{auto}</option>
            <hr>
            {#each LANGUAGES as value}
                <option {value}>{spell(value)}</option>
            {/each}
        </select>
    {:else if picks === 'model'}
        <select id="model" bind:value={model} aria-label="Printer model">
            {#each GENERICS as generic}
                <option value={generic.id}>{generic.name}</option>
            {/each}

            {#if models.length}
                <hr>
                {#each models as printer}
                    <option value={printer.id}>{printer.name}</option>
                {/each}
            {/if}
        </select>
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

</style>
