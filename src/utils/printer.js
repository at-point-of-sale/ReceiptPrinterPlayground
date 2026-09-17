/*
    The connection to a printer: the three drivers, what they are built with and
    what they report when they are connected.

    Both pages of this project talk to a printer, the playground from its header
    and the inspector from the Print popover, and they talk to it in exactly the
    same way: a driver is chosen, USB, serial or Bluetooth, and the USB and the
    Bluetooth driver are handed the renderer, so that a printer that speaks
    nothing but pictures, a Star TSP100 or a cat printer, prints the receipt as
    a picture. That is what lives here, so that a quirk of a driver is handled
    once rather than on either page.

    What does not live here is the state: a page keeps its own, because the
    playground shows a connected printer in its header and the inspector shows
    it in a popover, and the shapes of those are not the same. Everything this
    module reports is a call back.
*/

import WebUSBReceiptPrinter from '@point-of-sale/webusb-receipt-printer';
import WebSerialReceiptPrinter from '@point-of-sale/webserial-receipt-printer';
import WebBluetoothReceiptPrinter from '@point-of-sale/webbluetooth-receipt-printer';
import ReceiptPrinterRenderer from '@point-of-sale/receipt-printer-renderer';

/* Which driver a browser has: the API each of them is built on, by the name the
   page knows the driver under */

const APIS = {
    'usb':       'usb',
    'serial':    'serial',
    'bluetooth': 'bluetooth',
};

/**
 * Whether the browser has the API a driver needs, which is what tells Connect
 * from a Connect that cannot do anything
 *
 * @param  {string}    driver   usb, serial or bluetooth
 * @return {boolean}            Whether the browser can talk to it
 */
const isSupported = (driver) => APIS[driver] ? APIS[driver] in navigator : false;

/**
 * Build the driver of a connection, unconnected
 *
 * @param  {object}   options   The driver and, for serial, the baud rate
 * @return {?object}            The driver, or null when there is no such driver
 */
const create = ({ driver, baudrate }) => {

    /* The USB and the Bluetooth driver take the renderer, so that a printer
       that only prints pictures prints the receipt as one. The serial driver
       takes the speed of the line instead, which is the one thing a serial
       printer cannot be asked for */

    if (driver === 'usb') {
        return new WebUSBReceiptPrinter({ renderer: ReceiptPrinterRenderer });
    }

    if (driver === 'serial') {
        return new WebSerialReceiptPrinter({
            baudRate: parseInt(baudrate, 10)
        });
    }

    if (driver === 'bluetooth') {
        return new WebBluetoothReceiptPrinter({ renderer: ReceiptPrinterRenderer });
    }

    return null;
}

/**
 * Connect to a printer
 *
 * The driver asks the user to pick a device and reports what it found: the name
 * of the device, the language it speaks and, for a printer the driver renders
 * for, the codepage mapping and the number of columns it has. Those win over
 * whatever model the page has selected, which is why they are handed on whole.
 *
 * @param  {object}     options            The driver and, for serial, the baud rate
 * @param  {Function}   options.onconnected    Called with what the driver reports
 * @param  {Function}   [options.ondisconnected]  Called when the printer is gone,
 *                                             whether it was asked to go or unplugged
 * @param  {Function}   [options.onerror]      Called with what connecting threw; without
 *                                             it a failure is left to the caller
 * @return {?object}                        The printer, to print on and to disconnect
 */
const connect = ({ driver, baudrate, onconnected, ondisconnected, onerror }) => {
    let printer = create({ driver, baudrate });

    if (!printer) {
        return null;
    }

    printer.addEventListener('connected', (device) => onconnected?.(device));

    if (ondisconnected) {
        printer.addEventListener('disconnected', () => ondisconnected());
    }

    /* A driver swallows what the user does, such as cancelling the dialog, and
       throws what the application did wrong. A page that wants to hear about
       the second passes an onerror; a page that does not is left as it was */

    let result = printer.connect();

    if (onerror && result && typeof result.catch === 'function') {
        result.catch(onerror);
    }

    return printer;
}

/**
 * Disconnect, from whichever end the page holds
 *
 * @param  {?object}   printer   The printer connect() returned, or null
 */
const disconnect = (printer) => {
    printer?.disconnect();
}

export { connect, disconnect, isSupported };
