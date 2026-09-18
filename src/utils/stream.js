/*
    The stream a pane renders: the bytes that were sent to a printer and the
    settings of the printer that reads them. A pane never sees an encoder, so
    this is where an encoder becomes one.

    A stream carries `bytes`, the `language` it is read in, the `width` of the
    paper in dots, the `codepageMapping` it was encoded with, and `cutter`, the
    distance between the cutter and the print head in lines, or `false` for a
    printer that has no cutter at all: such a printer ignores the commands that
    cut, so its paper is one strip that is torn off by hand, and a printer that
    has one prints its first line that distance below the cut edge.
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

/* The line spacing a printer of a language uses when a stream sets none, which
   is what the cutter's distance in lines is counted in. The renderer keeps
   these in the profiles it renders with, `lineSpacing` of `generated/profiles.js`
   in that package, 30 dots for the epson profile and 32 for the star one, and
   it exposes neither, so they are written out here */

const spacings = {
    'esc-pos':       30,
    'star-prnt':     32,
    'star-line':     32,
    'star-graphics': 32,
};

/* And how far a printer that names no distance of its own feeds before it cuts,
   which is what the generic widths are read with: four lines on an ESC/POS
   printer and three on a Star one, the usual feed of either */

const feeds = {
    'esc-pos':       4,
    'star-prnt':     3,
    'star-line':     3,
    'star-graphics': 3,
};

/**
 * The cutter's distance in dots, which is what the renderer takes: the lines a
 * printer feeds before it cuts, at the line spacing of its language
 *
 * @param  {number|boolean}   lines      The distance in lines, or false for no cutter
 * @param  {?string}          language   The language the stream is read in
 * @return {number}                      The distance in dots, nought for no cutter
 */
const toDots = (lines, language) => typeof lines === 'number' && lines > 0 ?
    lines * (spacings[language] || spacings['esc-pos']) : 0;

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
        cutter: cutterOf(encoder),
    };
}

/**
 * The cutter of the printer of an encoder: how far it feeds before it cuts, in
 * lines, or false for a printer whose profile has no cutter.
 *
 * A stream that names no printer is read as a printer with the family's usual
 * cutter, the same the inspector's generics have: the encoder feeds nothing in
 * front of a cut then, and the paper shows what that does on such a printer,
 * which is the point. The encoder tells a model from no model by its
 * capabilities, which name a language only when a model was chosen
 *
 * @param  {object}            encoder  The encoder of the printer
 * @return {number|boolean}             The distance in lines, or false
 */
const cutterOf = (encoder) => {
    let capabilities = encoder.printerCapabilities;

    if (!capabilities || !capabilities.language) {
        return feeds[encoder.language] || feeds['esc-pos'];
    }

    return capabilities.cutter ? (capabilities.cutter.feed || 0) : false;
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
 * The settings a model puts behind the bytes: the width of its paper, the
 * codepage mapping it was encoded with and the distance of its cutter. The
 * language is not among them, because
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
            cutter: feeds[language] || feeds['esc-pos'],
        };
    }

    let encoder = new ReceiptPrinterEncoder({printerModel: id});
    let cutter = encoder.printerCapabilities?.cutter;

    return {
        width: encoder.printableWidth,
        codepageMapping: encoder.printerCapabilities?.codepages || mappings[language],
        cutter: cutter ? (cutter.feed || 0) : false,
    };
}

export { toStream, toModel, toDots, modelsFor, GENERICS, DEFAULT_MODEL };
