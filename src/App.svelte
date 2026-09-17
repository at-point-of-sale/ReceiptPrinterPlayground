<script>

    import { writable, get } from 'svelte/store';
    import { getEncoder } from './utils/encoder.js';

    import WebUSBReceiptPrinter from '@point-of-sale/webusb-receipt-printer';
    import WebSerialReceiptPrinter from '@point-of-sale/webserial-receipt-printer';
    import WebBluetoothReceiptPrinter from '@point-of-sale/webbluetooth-receipt-printer';
    import ReceiptPrinterRenderer from '@point-of-sale/receipt-printer-renderer';

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

        /* Setup driver */

        if (driver === 'usb') {
            receiptPrinter = new WebUSBReceiptPrinter({ renderer: ReceiptPrinterRenderer });
        }

        if (driver === 'serial') {
            receiptPrinter = new WebSerialReceiptPrinter({
                baudRate: parseInt(baudrate, 10)
            });
        }

        if (driver === 'bluetooth') {
            receiptPrinter = new WebBluetoothReceiptPrinter({ renderer: ReceiptPrinterRenderer });
        }


        /* Event listeners */

        receiptPrinter.addEventListener('connected', data => {
            console.log('Connected', data);
            device = data;
            connected = true;
        });

        /* Connect */

        receiptPrinter.connect();
    }

    function ondisconnect() {
        receiptPrinter.disconnect();
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
