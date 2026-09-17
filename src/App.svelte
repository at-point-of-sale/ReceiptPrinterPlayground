<script>

    import { writable, get } from 'svelte/store';
    import { getEncoder } from './utils/encoder.js';
    import { connect, disconnect } from './utils/printer.js';

    import Header from './app/Header.svelte';
    import Main from './app/Main.svelte';


    /* Stores */

    const contents = writable('');
    const model = writable('');


    /* State */

    let connected = $state(false);


    /* Functions */

    let receiptPrinter;
    let device = null;

    function onconnect(data) {
        let { driver, baudrate } = data;

        /* The driver, what it is built with and the device it reports are the
           same on both pages of this project, so they live in utils/printer.js */

        receiptPrinter = connect({
            driver,
            baudrate,
            onconnected: data => {
                console.log('Connected', data);
                device = data;
                connected = true;
            }
        });
    }

    function ondisconnect() {
        disconnect(receiptPrinter);
        device = null;
        connected = false;
    }

    async function onprint() {
        /* A graphics printer, such as the Star TSP100 or a cat printer, reports the
           language, codepage mapping and columns of the renderer that the driver
           wraps around it, and those win over the selected printer model */

        let result = await getEncoder({
            printerModel: get(model),
            language: device?.language,
            codepageMapping: device?.codepageMapping,
            columns: device?.columns,
            value: get(contents)
        });

        if (result.encoder) {
            result.encoder.cut();
            receiptPrinter.print(result.encoder.encode());
        }
    }

</script>

<Header {onconnect} {ondisconnect} {onprint} {model} {connected} />
<Main {contents} {model} />

<style>

    /* The grid of the playground: the header, the toolbar and the row of the
       editor and the preview, with the gutter between them */

    :global(body) {
        display: grid;
        grid-template-rows: 61px min-content 1fr;
        grid-template-columns: minmax(240px, var(--split, 50vw)) 6px minmax(240px, 1fr);
        height: 100vh;
    }

</style>
