<script>

    import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

    import { Icon } from 'svelte-icon';

    import { isSupported } from '../utils/printer.js';

    import connectIcon from '../assets/icons/connect.svg?raw';
    import disconnectIcon from '../assets/icons/disconnect.svg?raw';
    import printIcon from '../assets/icons/print.svg?raw';

    let { connected, onconnect, ondisconnect, onprint, model } = $props();

    let driver = $state('usb');
    let baudrate = $state('9600');

    let supported = $derived(isSupported(driver));


    let models = ReceiptPrinterEncoder.printerModels;



    /* Retrieve and save state */
  
    let driverValue = localStorage.getItem('printer-driver');

    if (driverValue) {
        driver = driverValue;
    }

    let baudrateValue = localStorage.getItem('printer-baudrate');

    if (baudrateValue) {
        baudrate = baudrateValue;
    }

    let modelValue = localStorage.getItem('printer-model');

    if (modelValue) {
        $model = modelValue;
    }

    window.addEventListener('beforeunload', () => {
        if (driver) {
            localStorage.setItem('printer-driver', driver);
        }

        if (baudrate) {
            localStorage.setItem('printer-baudrate', baudrate);
        }

        if (model) {
            localStorage.setItem('printer-model', $model);
        }
    });

</script>

<header>
    <select id="driver" bind:value={driver} disabled={!!connected}>
        <option value="usb">USB</option>
        <option value="serial">Serial</option>
        <option value="bluetooth">Bluetooth</option>
    </select>

    {#if driver === 'serial'}
      <select id="baudrate" bind:value={baudrate} disabled={!!connected}>
          <option value="9600">9600</option>
          <option value="38400">38400</option>
          <option value="115200">115200</option>
      </select>
    {/if}

    <select id="model" bind:value={$model}>
        <option value="">Generic</option>
        <hr>
        {#each models as model}
            <option value={model.id}>{model.name}</option>
        {/each}
    </select>

    {#if !connected}
      <button id="connect" onclick={() => onconnect({ driver, baudrate })} disabled={!supported}>
          <Icon data={connectIcon} />
          Connect
      </button>
    {:else}
      <button id="disconnect" onclick={() => ondisconnect()}>
          <Icon data={disconnectIcon} />
          Disconnect
      </button>
    {/if}

    <button id="print" onclick={() => onprint()} disabled={!connected}>
        <Icon data={printIcon} />
        Print
    </button>

</header>


<style>
  
    button#connect {
      background-color: #bbdefb;
      color: #1976d2;
    }

    button#disconnect,
    button#connect {
      margin-right: auto;
    }

    button#print {
      margin-left: auto
    }

</style>
