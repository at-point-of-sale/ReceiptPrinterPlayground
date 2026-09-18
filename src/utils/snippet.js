/*
    The code an image dropped on the editor turns into.

    Everything here is a plain function over strings and numbers: what an image
    is printed at, what the variable that holds it is called and what the lines
    of code look like. The drawing, which needs a canvas and a browser, stays in
    the component that calls these.
*/


/* Images are sent to a printer in bands of eight dots, so a width or a height
   that is not a multiple of eight is padded by the printer or the encoder and
   the padding is what the paper shows. The sizes here are multiples of eight
   from the start */

const BLOCK = 8;


/**
 * The size an image is printed at.
 *
 * The width is the image's own, and never wider than the paper: an image
 * smaller than the printable width is printed at the size it is, a larger one
 * is brought back to the width of the paper. That width is rounded down to a
 * multiple of eight, so that it never grows past what fits, and the height
 * follows the aspect ratio to the nearest multiple of eight, up or down,
 * whichever is closer. Neither is ever less than eight dots.
 *
 * An image without a size of its own, an SVG that carries only a viewBox, is
 * drawn at the full printable width: there is no size to keep, so the paper
 * decides. Its viewBox, if there is one, still gives the shape.
 *
 * @param {number} naturalWidth - The width the image reports, or the width of its viewBox
 * @param {number} naturalHeight - The height the image reports, or the height of its viewBox
 * @param {number} printableWidth - The width of the paper of the selected model, in dots
 * @param {boolean} intrinsic - Whether the image has a size of its own
 * @returns {{width: number, height: number}} The size in dots, both multiples of eight
 */
export function printedSize(naturalWidth, naturalHeight, printableWidth, intrinsic = true) {
    let paper = Math.max(BLOCK, Math.floor(printableWidth / BLOCK) * BLOCK);

    /* The shape of the image. An image that reports neither a width nor a
       height is square, for want of anything better to go on */

    let ratio = naturalWidth > 0 && naturalHeight > 0 ? naturalHeight / naturalWidth : 1;

    let width = intrinsic && naturalWidth > 0
        ? Math.min(naturalWidth, printableWidth)
        : printableWidth;

    width = Math.max(BLOCK, Math.floor(width / BLOCK) * BLOCK);
    width = Math.min(width, paper);

    let height = Math.max(BLOCK, Math.round((width * ratio) / BLOCK) * BLOCK);

    return { width, height };
}


/* The words a variable cannot be called, which are the reserved words of the
   language and the one name the snippet leans on: a `const encoder` would hide
   the encoder the script prints with */

const RESERVED = new Set([
    'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
    'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
    'finally', 'for', 'function', 'if', 'implements', 'import', 'in',
    'instanceof', 'interface', 'let', 'new', 'null', 'package', 'private',
    'protected', 'public', 'return', 'static', 'super', 'switch', 'this',
    'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
    'encoder'
]);


/**
 * The name of the variable an image goes into, from the name of the file.
 *
 * The extension goes, what is left is cut at everything that is not a letter or
 * a digit and the pieces are joined up as one word: `Shop Logo-2.png` is
 * `shopLogo2`. A name that would start with a digit, that would be a word of
 * the language, or that would be nothing at all, is prefixed with `image`.
 *
 * @param {string} fileName - The name of the dropped file
 * @returns {string} The name, before it is made unique
 */
export function identifierFor(fileName) {
    let stem = String(fileName ?? '');

    /* The extension, which is what follows the last dot of a name that has
       something in front of it */

    let dot = stem.lastIndexOf('.');

    if (dot > 0) {
        stem = stem.slice(0, dot);
    }

    /* Anything that is not a letter or a digit cuts the name in two, letters
       and digits of any language among them, which a variable may be named
       after as much as the plain ones */

    let parts = stem.split(/[^\p{L}\p{N}]+/u).filter(part => part.length > 0);

    let name = parts.map((part, index) => {
        /* A piece that shouts, `IMG`, is read as a word rather than as
           initials, so that `IMG_1234.png` is `img1234` */

        let word = part === part.toUpperCase() ? part.toLowerCase() : part;

        return index === 0
            ? word.charAt(0).toLowerCase() + word.slice(1)
            : word.charAt(0).toUpperCase() + word.slice(1);
    }).join('');

    if (name === '' || /^\p{N}/u.test(name) || RESERVED.has(name)) {
        name = 'image' + name.charAt(0).toUpperCase() + name.slice(1);
    }

    return name;
}


/**
 * Whether a script already declares a name.
 *
 * Only declarations count: a `const`, a `let` or a `var` of that name. A name
 * that is merely used somewhere is no reason to pick another.
 *
 * @param {string} script - The text in the editor
 * @param {string} name - The name to look for
 * @returns {boolean} Whether the script declares it
 */
export function declares(script, name) {
    let pattern = new RegExp(`(?:^|[^.\\w$])(?:const|let|var)\\s+${name}\\b`);

    return pattern.test(String(script ?? ''));
}


/**
 * The name of the variable an image goes into, made unique against the script.
 *
 * A name the script already declares gets a 2 behind it, and if that is taken
 * as well a 3, and so on.
 *
 * @param {string} fileName - The name of the dropped file
 * @param {string} script - The text in the editor, plus whatever is about to go into it
 * @returns {string} A name nothing else in the script has
 */
export function identifier(fileName, script = '') {
    let name = identifierFor(fileName);

    if (!declares(script, name)) {
        return name;
    }

    let counter = 2;

    while (declares(script, name + counter)) {
        counter++;
    }

    return name + counter;
}


/**
 * The lines of code that load an image and print it.
 *
 * @param {string} name - The name of the variable
 * @param {string} url - The image as a data URL
 * @param {{width: number, height: number}} size - The size it is printed at, in dots
 * @returns {string} The snippet, with a blank line behind it
 */
export function snippet(name, url, size) {
    return `const ${name} = new Image();\n` +
           `${name}.src = '${url}';\n` +
           `await ${name}.decode();\n` +
           `\n` +
           `encoder\n` +
           `    .image(${name}, { width: ${size.width}, height: ${size.height} })\n` +
           `\n`;
}


/**
 * The size an SVG carries, read out of the SVG itself.
 *
 * The browser is no help here: an SVG that carries no width and height of its
 * own is still reported as 300 by 150, or as whatever that becomes once the
 * viewBox has had its say, which is a size the drawing never asked for. So the
 * file is read instead.
 *
 * The width and height attributes come first, when both are plain numbers of
 * pixels, and that is a size of its own. The viewBox comes after them, which
 * gives the shape and not the size: an SVG with nothing but a viewBox is drawn
 * at the width of the paper. An SVG with neither is nothing we can measure.
 *
 * @param {string} source - The text of the SVG
 * @returns {?{width: number, height: number, intrinsic: boolean}} The size and
 *          whether it is a size of its own, or null
 */
export function svgSize(source) {
    let text = String(source ?? '');

    let tag = text.match(/<svg\b[^>]*>/i);

    if (!tag) {
        return null;
    }

    let attribute = (name) => {
        let match = tag[0].match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'));

        return match ? match[1].trim() : null;
    };

    let number = (value) => {
        if (value === null) {
            return null;
        }

        let match = value.match(/^([0-9]*\.?[0-9]+)(px)?$/i);

        return match ? parseFloat(match[1]) : null;
    };

    let width = number(attribute('width'));
    let height = number(attribute('height'));

    if (width > 0 && height > 0) {
        return { width, height, intrinsic: true };
    }

    let box = attribute('viewBox');

    if (box) {
        let values = box.split(/[\s,]+/).map(parseFloat);

        if (values.length === 4 && values[2] > 0 && values[3] > 0) {
            return { width: values[2], height: values[3], intrinsic: false };
        }
    }

    return null;
}
