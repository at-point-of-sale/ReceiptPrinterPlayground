/*
    The ranges of a stream: which bytes are one thing.

    A selection on the inspector is a range of the stream, and three panels ask
    the same question about it. The hex dump asks which token a byte belongs to,
    the paper asks it of the byte an operation was drawn from, and the Decoded
    panel shows one block per token. The Decoded panel builds its blocks out of
    the decoder, which is the heavy path, and a panel that is hidden builds
    nothing at all, so the page reads the ranges for itself out of the
    tokenizer, which is the light one: it walks the bytes and says where every
    token begins and how long it is, without working out what any of them means.

    It comes out of the main entry of the decoder, which re-exports it, rather
    than out of the sub-entry it lives in: the two are self-contained bundles of
    the same tables, and the Decoded pane already brings the main one in.
*/

import { tokenize } from '@point-of-sale/receipt-printer-decoder';

/* The line feed, which a stream may write a carriage return behind: the two are
   one line ending, as the Decoded panel shows them */

const LF = 0x0a;
const CR = 0x0d;

/**
 * The ranges of a stream, in the order of the stream
 *
 * @param  {?Uint8Array}   bytes      The stream, or null when there is none
 * @param  {?string}       language   The language it is read as
 * @return {object[]}                 The ranges, `{offset, length}`
 */
const ranges = (bytes, language) => {
    if (!bytes || !bytes.length || !language) {
        return [];
    }

    let tokens;

    try {
        tokens = tokenize(bytes, language);
    }
    catch (error) {
        /* A language the tokenizer does not read is a stream with no ranges in
           it, which is a page where nothing can be selected rather than a page
           that fails */

        return [];
    }

    let list = [];

    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i];
        let length = token.length;

        /* A line feed and the carriage return behind it are one ending and one
           range, the way the Decoded panel shows them as one block */

        if (token.type === 'control' && token.byte === LF) {
            let next = tokens[i + 1];

            if (next && next.type === 'control' && next.byte === CR) {
                length += next.length;
                i++;
            }
        }

        list.push({ offset: token.offset, length });
    }

    return list;
}

/**
 * The range that covers a byte
 *
 * The ranges are in the order of the stream and do not overlap, so the one that
 * covers a byte is found by halving the list rather than by walking it: a
 * stream of a few hundred kilobytes is tens of thousands of ranges.
 *
 * @param  {object[]}   list     The ranges
 * @param  {number}     offset   The byte
 * @return {?object}             The range, or null when the byte is in none
 */
const at = (list, offset) => {
    let low = 0;
    let high = list.length - 1;

    while (low <= high) {
        let middle = (low + high) >> 1;
        let range = list[middle];

        if (offset < range.offset) {
            high = middle - 1;
            continue;
        }

        if (offset >= range.offset + range.length) {
            low = middle + 1;
            continue;
        }

        return range;
    }

    return null;
}

export { ranges, at };
