/*
    How a language is spelled where a person reads it, and which languages are
    one language to whatever reads a stream.

    Two places on the inspector say what a stream is: the model row at the top of
    the Rendered panel, which names the language that was detected, and the Print
    popover, which names the language the connected printer speaks. They say it
    the same way, so they say it from here.
*/

const NAMES = {
    'esc-pos': 'ESC/POS',
    'star-prnt': 'StarPRNT',
    'star-line': 'Star Line',
    'star-graphics': 'Star Graphics',
};

/**
 * The name of a language as it is written out
 *
 * @param  {string}   value   The language, as the decoder and the encoder spell it
 * @return {string}           The name, or the language itself when it has no name
 */
const spell = (value) => NAMES[value] || value;

/**
 * The family a language belongs to
 *
 * StarPRNT and Star Line are one command set to whatever reads a stream, so the
 * detector never answers Star Line and a Star Line model is not a model of
 * another language than the one that was found.
 *
 * @param  {string}   value   The language
 * @return {string}           The language the comparison is made in
 */
const family = (value) => value === 'star-line' ? 'star-prnt' : value;

export { spell, family };
