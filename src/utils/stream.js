/*
    The stream a pane renders: the bytes that were sent to a printer and the
    settings of the printer that reads them. A pane never sees an encoder, so
    this is where an encoder becomes one.
*/

import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

import { family } from './language.js';

/* The codepage mapping the encoder falls back to when the printer model does
   not name one, which is what the encoder does as well */

const mappings = {
    'esc-pos':       'epson',
    'star-prnt':     'star',
    'star-line':     'star',
    'star-graphics': 'star',
};

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
 * The printers of the encoder by the language they speak, worked out once by
 * building an encoder for every one of them and reading the language off it,
 * which is the only place that knows
 *
 * @type {object}   The language of every model, by its id
 */
const languages = Object.fromEntries(ReceiptPrinterEncoder.printerModels.map((printer) => {
    try {
        return [printer.id, new ReceiptPrinterEncoder({printerModel: printer.id}).language];
    }
    catch (error) {
        /* A model the encoder cannot build is a model of no language, which is
           a model that is never offered */

        return [printer.id, null];
    }
}));

/* The printers that are not a printer: a width in columns and nothing else,
   which is what a stream that was written for no printer in particular is read
   at. Forty-eight columns is an eighty millimetre roll, which is what nearly
   every job is written for, so that is the one a file starts on */

const GENERICS = [
    { id: 'generic-32', name: 'Generic 32 columns', width: 384 },
    { id: 'generic-42', name: 'Generic 42 columns', width: 504 },
    { id: 'generic-48', name: 'Generic 48 columns', width: 576 },
];

const DEFAULT_MODEL = 'generic-48';

/**
 * The printers that speak a language, which is what the model selectors offer
 * beside the generic widths
 *
 * StarPRNT and Star Line are one command set to whatever reads a stream, so a
 * printer of either is offered for both; Star Graphics is a language no printer
 * of the encoder speaks, and a language that is not known yet is no reason to
 * hide anything, so that one offers them all.
 *
 * @param  {?string}    language   The language the stream is read as, or null
 * @return {object[]}              The models, `{id, name}` in the encoder's order
 */
const modelsFor = (language) => ReceiptPrinterEncoder.printerModels.filter((printer) => {
    if (!language) {
        return true;
    }

    return languages[printer.id] && family(languages[printer.id]) === family(language);
});

/**
 * The settings a model puts behind the bytes: the width of its paper and the
 * codepage mapping it was encoded with. The language is not among them, because
 * the language of a stream is the one that was picked for it and a printer of
 * another language is read in that language all the same.
 *
 * @param  {string}   id         The id of the model, a generic or one of `printerModels`
 * @param  {?string}  language   The language the stream is read as
 * @return {object}              The width and the mapping
 */
const toModel = (id, language) => {
    let generic = GENERICS.find((printer) => printer.id === id);

    if (generic) {
        return {
            width: generic.width,
            codepageMapping: mappings[language],
        };
    }

    let encoder = new ReceiptPrinterEncoder({printerModel: id});

    return {
        width: encoder.printableWidth,
        codepageMapping: encoder.printerCapabilities?.codepages || mappings[language],
    };
}

export { toStream, toModel, modelsFor, GENERICS, DEFAULT_MODEL };
