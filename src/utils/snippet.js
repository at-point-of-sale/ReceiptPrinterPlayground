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


/* The words a variable cannot be called: the reserved words of the language,
   the names strict code keeps to itself, and the one name the snippet leans on,
   because a `const encoder` would hide the encoder the script prints with */

const RESERVED = new Set([
    'arguments', 'await', 'break', 'case', 'catch', 'class', 'const',
    'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum', 'eval',
    'export', 'extends', 'false', 'finally', 'for', 'function', 'if',
    'implements', 'import', 'in', 'instanceof', 'interface', 'let', 'new',
    'null', 'package', 'private', 'protected', 'public', 'return', 'static',
    'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void',
    'while', 'with', 'yield',
    'Infinity', 'NaN', 'undefined', 'encoder'
]);


/* The letters that carry no accent to take off, and what they are written as
   in the twenty-six letters everybody has */

const TRANSLITERATION = {
    'ß': 'ss', 'æ': 'ae', 'Æ': 'Ae', 'œ': 'oe', 'Œ': 'Oe', 'ø': 'o', 'Ø': 'O',
    'đ': 'd', 'Đ': 'D', 'ð': 'd', 'Ð': 'D', 'þ': 'th', 'Þ': 'Th', 'ł': 'l',
    'Ł': 'L', 'ı': 'i', 'İ': 'I', 'ŉ': 'n', 'ſ': 's'
};


/* A name in plain letters. What carries an accent is taken apart and the accent
   dropped, `café` becoming `cafe`, what has no accent to drop is written out,
   `Größe` becoming `Grosse`, and whatever is left that is not a letter or a
   digit of the plain alphabet is nothing a variable can be named after */

function ascii(text) {
    return text
        .replace(/[ßæÆœŒøØđĐðÐþÞłŁıİŉſ]/g, character => TRANSLITERATION[character])
        .normalize('NFD')
        .replace(/\p{M}+/gu, '');
}


/**
 * The name of the variable an image goes into, from the name of the file.
 *
 * The extension goes, what is left is written in plain letters and cut at
 * everything that is not one of them or a digit, and the pieces are joined up
 * as one word: `Shop Logo-2.png` is `shopLogo2` and `café.png` is `cafe`. A
 * name that would start with a digit, that would be a word of the language, or
 * that would be nothing at all, is prefixed with `image`.
 *
 * What comes out is always a letter followed by letters and digits, which is a
 * name JavaScript takes and a name a search can look for without having to
 * think about what a word boundary is in a language it has never heard of.
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

    /* Anything that is not a plain letter or digit cuts the name in two */

    let parts = ascii(stem).split(/[^A-Za-z0-9]+/).filter(part => part.length > 0);

    let name = parts.map((part, index) => {
        /* A piece that shouts, `IMG`, is read as a word rather than as
           initials, so that `IMG_1234.png` is `img1234` */

        let word = part === part.toUpperCase() ? part.toLowerCase() : part;

        return index === 0
            ? word.charAt(0).toLowerCase() + word.slice(1)
            : word.charAt(0).toUpperCase() + word.slice(1);
    }).join('');

    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name) || RESERVED.has(name)) {
        name = 'image' + name.charAt(0).toUpperCase() + name.slice(1);
    }

    return name;
}


/**
 * Whether a script already has a name.
 *
 * A name counts as taken wherever it stands in the script as a word of its own,
 * in a comment or a string as much as in the code. Looking for the declaration
 * instead would be looking for all the shapes a declaration comes in, a
 * `function`, a `class`, an `import`, a second name behind a comma, a name
 * taken out of an object, and a name that is missed is a name declared twice.
 * A name that is found where it does not count costs a 2 behind it, which costs
 * nobody anything.
 *
 * @param {string} script - The text in the editor
 * @param {string} name - The name to look for
 * @returns {boolean} Whether the script has it
 */
export function taken(script, name) {
    let pattern = new RegExp(`(?<![A-Za-z0-9_$])${name}(?![A-Za-z0-9_$])`);

    return pattern.test(String(script ?? ''));
}


/**
 * The name of the variable an image goes into, made unique against the script.
 *
 * A name the script already has gets a 2 behind it, and if that is taken as
 * well a 3, and so on.
 *
 * @param {string} fileName - The name of the dropped file
 * @param {string} script - The text in the editor, plus whatever is about to go into it
 * @returns {string} A name nothing else in the script has
 */
export function identifier(fileName, script = '') {
    let name = identifierFor(fileName);

    if (!taken(script, name)) {
        return name;
    }

    let counter = 2;

    while (taken(script, name + counter)) {
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
