<script>

    /*
        The bytes of a stream as a hex dump.

        A placeholder until Section 3 writes the pane: it counts the bytes and
        says how many there are, so that the page around it can be built and
        looked at before the rows exist.
    */

    /**
     * @prop {object} view - The store of the tab that is shown, on a page whose
     *                       panes take turns; a pane given no view is always shown
     */
    let { view = null } = $props();

    let count = $state(null);


    /**
     * Show a stream
     *
     * @param  {object}  stream  The bytes and the settings of the printer that
     *                           reads them, or null when there is no stream
     */
    export const render = (stream) => {
        count = stream ? stream.bytes.length : null;
    }

</script>

{#if !view || $view === 'hex'}
    {#if count !== null}
        <div class="count">{count} bytes</div>
    {/if}
{/if}

<style>

    .count {
        padding: 16px 0;
    }

</style>
