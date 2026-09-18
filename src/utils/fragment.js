/*
    The fragment of an address, which is how the two pages of this project hand
    something to one another and how a bug report carries a script.

    A fragment is `key=value` pairs joined by `&`, with the value of every key
    that carries bytes or text written as base64url. Nothing is compressed, so
    that both pages read a fragment the same way and one can be made and read by
    hand: `#data=` of the inspector and `#code=&model=&view=` of the playground
    are the same scheme with other keys in it.
*/

/* How much of a stream is turned into characters at a time. A call takes its
   arguments on the stack, so a script of a few hundred kilobytes handed to
   `String.fromCharCode` in one go overflows it; every browser holds tens of
   thousands of arguments, and this is well under that */

const CHUNK = 0x8000;

/**
 * The value of a key, undone as far as it can be: a fragment is written with
 * the percent escapes of an address, and a value that holds a stray percent is
 * not an escape and is taken as it stands
 *
 * @param  {string}   value   The value as the address carries it
 * @return {string}           The value as it was written
 */
const percent = (value) => {
    try {
        return decodeURIComponent(value);
    }
    catch (error) {
        return value;
    }
}

/**
 * An object as the fragment of an address
 *
 * @param  {object}   values   What the fragment is to carry, a value per key;
 *                             a key whose value is null or undefined is left out
 * @return {string}            The fragment, without its leading `#`
 */
const encodeFragment = (values) => Object.entries(values || {})
    .filter(([ key, value ]) => key && value !== null && value !== undefined)
    .map(([ key, value ]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

/**
 * And the fragment of an address as an object
 *
 * @param  {string}   hash   The fragment, with or without its leading `#`
 * @return {object}          A value per key, every one of them a string
 */
const decodeFragment = (hash) => {
    let text = String(hash ?? '').replace(/^#/, '');
    let values = {};

    for (let pair of text.split('&')) {
        if (!pair) {
            continue;
        }

        let split = pair.indexOf('=');

        let key = split === -1 ? pair : pair.slice(0, split);
        let value = split === -1 ? '' : pair.slice(split + 1);

        values[percent(key)] = percent(value);
    }

    return values;
}

/**
 * Bytes as base64url, which is base64 with the two characters an address does
 * not carry well swapped and the padding left off
 *
 * @param  {Uint8Array}   bytes   The bytes
 * @return {string}               The bytes in base64url
 */
const toBase64Url = (bytes) => {
    let data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);

    let binary = '';

    for (let offset = 0; offset < data.length; offset += CHUNK) {
        binary += String.fromCharCode.apply(null, data.subarray(offset, offset + CHUNK));
    }

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * And base64url back as bytes. Plain base64 is accepted as well, padded or not
 * and with the line breaks a base64 tool wraps it in, so that a link put
 * together by hand out of such a tool is read
 *
 * @param  {string}   text   The base64url, or base64
 * @return {Uint8Array}      The bytes
 */
const fromBase64Url = (text) => {
    let value = String(text ?? '').replace(/\s+/g, '')
        .replace(/-/g, '+').replace(/_/g, '/');

    value += '='.repeat((4 - value.length % 4) % 4);

    let binary = atob(value);
    let bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

/**
 * Text as base64url, through its UTF-8 bytes: a script holds whatever a
 * receipt holds, the € of a price and the emoji of a line of it among them
 *
 * @param  {string}   text   The text
 * @return {string}          Its UTF-8 bytes in base64url
 */
const textToBase64Url = (text) => toBase64Url(new TextEncoder().encode(String(text ?? '')));

/**
 * And base64url back as text, read as UTF-8
 *
 * @param  {string}   value   The base64url
 * @return {string}           The text
 */
const base64UrlToText = (value) => new TextDecoder().decode(fromBase64Url(value));


export {
    encodeFragment,
    decodeFragment,
    toBase64Url,
    fromBase64Url,
    textToBase64Url,
    base64UrlToText,
};
