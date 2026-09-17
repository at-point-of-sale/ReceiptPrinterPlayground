/*
    The stream a pane renders: the bytes that were sent to a printer and the
    settings of the printer that reads them. A pane never sees an encoder, so
    this is where an encoder becomes one.
*/

import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

/* The codepage mapping the encoder falls back to when the printer model does
   not name one, which is what the encoder does as well */

const mappings = {
    'esc-pos':       'epson',
    'star-prnt':     'star',
    'star-line':     'star',
    'star-graphics': 'star',
};

/* The width a stream that names no printer is read at: the printable width of
   an eighty millimetre printer, which is what nearly every job is written for */

const WIDTH = 576;

/**
 * Build the stream of an encoder
 *
 * @param  {object}   encoder  The encoder, or null when there is none
 * @return {object}            The stream, or null when there was no encoder
 */
const toStream = (encoder) => {
    if (!encoder) {
        return null;
    }

    let language = encoder.language;

    return {
        bytes: encoder.encode(),
        language,
        width: encoder.printableWidth,
        codepageMapping: encoder.printerCapabilities?.codepages || mappings[language],
    };
}

/**
 * The settings of a printer model, which is what the inspector puts behind the
 * bytes of a file: the same three values a stream carries, read off an encoder
 * built for that model and nothing else
 *
 * @param  {string}   printerModel  The id of the model, out of `printerModels`
 * @return {object}                 The language, the width and the mapping
 */
const toSettings = (printerModel) => {
    let encoder = new ReceiptPrinterEncoder(printerModel ? { printerModel } : {});

    let language = encoder.language;

    return {
        language,
        width: encoder.printableWidth,
        codepageMapping: encoder.printerCapabilities?.codepages || mappings[language],
    };
}

/**
 * The settings of a stream that names no printer, which is what a file read
 * with nothing but a detected language is: that language, at the width of an
 * eighty millimetre printer, with the mapping the encoder falls back to
 *
 * @param  {string}   language  The language the stream is read as
 * @return {object}             The language, the width and the mapping
 */
const toAuto = (language) => ({
    language,
    width: WIDTH,
    codepageMapping: mappings[language],
});

export { toStream, toSettings, toAuto };
