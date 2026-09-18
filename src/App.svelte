<script>

    import { onMount } from 'svelte';

    import { writable, get } from 'svelte/store';

    import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

    import { getEncoder } from './utils/encoder.js';
    import { connect, disconnect } from './utils/printer.js';
    import { decodeFragment, base64UrlToText } from './utils/fragment.js';

    import Header from './app/Header.svelte';
    import Main from './app/Main.svelte';


    /* Stores */

    const contents = writable('');
    const model = writable('');

    /* Which tab of the preview is shown, which the toolbar picks and the Debug
       menu writes into a link, so it is held here rather than in the main */

    const view = writable('text');


    /* State */

    let connected = $state(false);

    let main = $state(null);


    /* The link a bug report carries: the script, the model and the tab. It is
       read when the page opens and taken off the address afterwards, so that a
       reload keeps what was typed since rather than the link's own script.

       A link pasted into the address bar of a page that is already open is a
       fragment that changes and no page that loads, which is the same reading
       over again */

    const VIEWS = [ 'text', 'commands', 'encoded', 'output', 'decoded', 'image' ];

    const fromFragment = () => {
        let { code, model: wanted, view: tab } = decodeFragment(window.location.hash);

        if (code === undefined && wanted === undefined && tab === undefined) {
            return;
        }

        if (code !== undefined) {
            try {
                main?.set(base64UrlToText(code));
            }
            catch (error) {
                /* A link that holds no script says so where the script would
                   have gone, which is the editor */

                console.warn('The link does not hold a script', error);

                main?.note('The link does not hold a script');
            }
        }

        /* A model that is no model of the encoder is left alone: the picker
           keeps whatever it was on, which is what was kept from the last visit */

        if (wanted === '' ||
            ReceiptPrinterEncoder.printerModels.some((printer) => printer.id === wanted)) {
            model.set(wanted);
        }

        if (VIEWS.includes(tab)) {
            view.set(tab);
        }

        history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    onMount(() => {
        /* The editor restores what it held while it mounts, and the header the
           model, so the fragment is read after both of them */

        fromFragment();

        window.addEventListener('hashchange', fromFragment);

        return () => window.removeEventListener('hashchange', fromFragment);
    });


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

<Header {onconnect} {ondisconnect} {onprint} {model} {contents} {view} {connected} />
<Main bind:this={main} {contents} {model} {view} />

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
