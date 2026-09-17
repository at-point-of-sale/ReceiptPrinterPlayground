/*
    The stream a pane renders: the bytes that were sent to a printer and the
    settings of the printer that reads them. A pane never sees an encoder, so
    this is where an encoder becomes one.
*/

/* The codepage mapping the encoder falls back to when the printer model does
   not name one, which is what the encoder does as well */

const mappings = {
    'esc-pos':   'epson',
    'star-prnt': 'star',
    'star-line': 'star',
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

export { toStream };
