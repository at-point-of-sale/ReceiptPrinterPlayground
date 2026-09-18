
<script>

    import { onMount } from 'svelte';

    import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

    import { identifier, printedSize, snippet, svgSize } from '../../utils/snippet.js';

    let { contents, model } = $props();

    let editor;
    let container;
    let dirty = $state(false);

    onMount(() => {
        editor = ace.edit("editor");
        editor.setTheme("ace/theme/chrome");
        editor.session.setMode("ace/mode/javascript");
        editor.setShowPrintMargin(false);
        editor.setHighlightActiveLine(false);

        editor.on('change', () => {
            dirty = true;
        });

        let session = localStorage.getItem('editor');
        if (session) {
            session = JSON.parse(session);

            editor.setValue(session.value);
            editor.selection.moveCursorToPosition(session.cursor);
            editor.selection.setSelectionRange(session.range);

            update();
        }
        else {
            load('new');
        }

        window.addEventListener('beforeunload', save);

        /* Ace carries drag and drop of its own, for the text in it, and it
           listens on this same element. These listen in front of it, in the
           capture phase, and a drag that carries image files never reaches it */

        container.addEventListener('dragenter', dragenter, true);
        container.addEventListener('dragover', dragover, true);
        container.addEventListener('dragleave', dragleave, true);
        container.addEventListener('drop', dropped, true);

        /* A drag that ends anywhere else is a drag that is over as far as the
           editor is concerned: dropped on another pane, let go halfway, or
           taken out of the window, which is the leave with nothing on the
           other side of it */

        window.addEventListener('dragend', over);
        window.addEventListener('drop', over);
        window.addEventListener('dragleave', left);

        return () => {
            container.removeEventListener('dragenter', dragenter, true);
            container.removeEventListener('dragover', dragover, true);
            container.removeEventListener('dragleave', dragleave, true);
            container.removeEventListener('drop', dropped, true);

            window.removeEventListener('beforeunload', save);
            window.removeEventListener('dragend', over);
            window.removeEventListener('drop', over);
            window.removeEventListener('dragleave', left);
        };
    });

    /* What is in the editor, kept for the next time the page is opened.

       A script with photographs in it can be larger than the browser is willing
       to keep, and then nothing is kept at all: this says so rather than
       throwing, which would take the rest of the unloading with it and leave
       yesterday's script to come back in its place without a word */

    function save() {
        if (!editor) {
            return true;
        }

        try {
            localStorage.setItem('editor', JSON.stringify({
                value:  editor.getValue(),
                cursor: editor.selection.getCursor(),
                range:  editor.getSelectionRange()
            }));

            return true;
        }
        catch (error) {
            return false;
        }
    }

    setInterval(() => {
        if (dirty) {
            update();
        }
    }, 1000);




    import newTemplate from '../../assets/templates/new.js?raw';
    import textTemplate from '../../assets/templates/text.js?raw';
    import tablesTemplate from '../../assets/templates/tables.js?raw';
    import imagesTemplate from '../../assets/templates/images.js?raw';
    import barcodesTemplate from '../../assets/templates/barcodes.js?raw';
    import qrcodeTemplate from '../../assets/templates/qrcode.js?raw';
    import pdf417Template from '../../assets/templates/pdf417.js?raw';
    import markdownTemplate from '../../assets/templates/markdown.js?raw';
    import receiptlineTemplate from '../../assets/templates/receiptline.js?raw';

    export function load(template) {
        switch (template) {
            case 'text':        editor.setValue(textTemplate); break;
            case 'tables':      editor.setValue(tablesTemplate); break;
            case 'images':      editor.setValue(imagesTemplate); break;
            case 'barcodes':    editor.setValue(barcodesTemplate); break;
            case 'qrcode':      editor.setValue(qrcodeTemplate); break;
            case 'pdf417':      editor.setValue(pdf417Template); break;
            case 'markdown':    editor.setValue(markdownTemplate); break;
            case 'receiptline': editor.setValue(receiptlineTemplate); break;
            default:            editor.setValue(newTemplate); break;
        }

        editor.selection.clearSelection();
        update();
    }

    /* The script of somewhere else, a link to a bug report among them, put in
       the editor as if it were typed */

    export function set(value) {
        if (!editor) {
            return;
        }

        editor.setValue(value ?? '');
        editor.selection.clearSelection();
        editor.selection.moveCursorToPosition({ row: 0, column: 0 });
        editor.renderer.scrollToRow(0);

        update();
    }

    function update() {
        let value = editor.getValue();
        $contents = value;
        dirty = false;
    }

    /* Ace lays itself out again when the window changes and not when the pane
       it sits in does, so the split tells it */

    export function resize() {
        editor?.resize();
    }




    /*
        Images dropped on the editor.

        A file dropped on the editor is the code that loads it: the file becomes
        an `Image` with a data URL for a source, and an `encoder.image()` call
        behind it. The image is drawn to a canvas at the size it is printed at
        and embedded as a PNG of that size, so that a photograph of ten
        megapixels does not put ten megapixels in the script.
    */

    let dragging = $state(false);
    let trouble = $state(null);

    /* A drag that moves over the editor enters and leaves every element under
       it, so what is counted is how deep it is rather than whether it is here */

    let depth = 0;

    /* A canvas of more rows than this is one no browser will draw, and a
       receipt of two metres is not one anybody meant to print */

    const ROWS = 16384;

    /* How long what went wrong stays up */

    const SHOWN = 5000;

    let timer = null;

    function warn(message) {
        trouble = message;

        clearTimeout(timer);
        timer = setTimeout(() => { trouble = null; }, SHOWN);
    }

    function dismiss() {
        clearTimeout(timer);
        trouble = null;
    }

    /* The image types the browser can draw, which is what can be dropped. A
       drag carrying anything else is somebody else's */

    function images(transfer) {
        if (!transfer) {
            return false;
        }

        if (transfer.items && transfer.items.length) {
            return Array.from(transfer.items).some(
                item => item.kind === 'file' && item.type.startsWith('image/'));
        }

        /* Some browsers hand out nothing but the kinds of the drag while it is
           still in the air, and a file is all they say */

        return Array.from(transfer.types || []).includes('Files');
    }

    /* A drag that is taken is a drag Ace never hears about */

    function take(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    function dragenter(event) {
        if (!images(event.dataTransfer)) {
            return;
        }

        take(event);

        depth++;
        dragging = true;
    }

    function dragover(event) {
        if (!images(event.dataTransfer)) {
            return;
        }

        take(event);

        event.dataTransfer.dropEffect = 'copy';
        dragging = true;
    }

    function dragleave(event) {
        if (!images(event.dataTransfer)) {
            return;
        }

        take(event);

        depth = Math.max(0, depth - 1);

        if (depth === 0) {
            dragging = false;
        }
    }

    /* The drag is over, wherever it ended */

    function over() {
        depth = 0;
        dragging = false;
    }

    /* A leave with nothing on the other side of it is a drag that left the
       window */

    function left(event) {
        if (event.relatedTarget === null) {
            over();
        }
    }

    /* The width of the paper of the selected model, which is what an image is
       never printed wider than. A model that was not selected is the generic
       printer, and whatever the encoder gives for it */

    function printableWidth() {
        try {
            let encoder = new ReceiptPrinterEncoder($model ? { printerModel: $model } : {});

            return encoder.printableWidth;
        }
        catch (error) {
            return 384;
        }
    }

    /* The file as a data URL, which is what an `Image` is given to decode */

    function read(file) {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();

            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    /* The image at the size it is printed at, as a PNG. The canvas is white
       before the image is drawn on it, because a printer that cannot print
       white prints the paper, and the paper is white.

       A canvas larger than the browser is prepared to make hands back a data
       URL of `data:,`, which is not an image and not something to put in a
       script, so what comes out is looked at rather than trusted */

    function render(image, size) {
        try {
            let canvas = document.createElement('canvas');

            canvas.width = size.width;
            canvas.height = size.height;

            let context = canvas.getContext('2d');

            if (!context || canvas.width !== size.width || canvas.height !== size.height) {
                return null;
            }

            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, size.width, size.height);
            context.drawImage(image, 0, 0, size.width, size.height);

            let url = canvas.toDataURL('image/png');

            return url.startsWith('data:image/png;base64,') ? url : null;
        }
        catch (error) {
            return null;
        }
    }

    /* The code for one file, or what was the matter with it */

    async function code(file, script) {
        let image = new Image();

        try {
            image.src = await read(file);

            await image.decode();
        }
        catch (error) {
            /* A file the browser will not draw: a HEIC out of a telephone, a
               TIFF, or a PNG that is one in name only */

            return { trouble: `${file.name} could not be read as an image` };
        }

        try {
            /* An SVG that carries no width and height of its own is drawn at
               the width of the paper, and its viewBox says what shape it is.
               The browser reports a size for such an SVG all the same, one it
               made up out of a default of 300 by 150, so the file itself is
               asked */

            let intrinsic = image.naturalWidth > 0 && image.naturalHeight > 0;

            let natural = { width: image.naturalWidth, height: image.naturalHeight };

            if (file.type === 'image/svg+xml') {
                let declared = svgSize(await file.text());

                intrinsic = declared ? declared.intrinsic : false;

                if (declared) {
                    natural = { width: declared.width, height: declared.height };
                }
            }

            let size = printedSize(natural.width, natural.height, printableWidth(), intrinsic);

            if (size.height > ROWS) {
                return { trouble: `${file.name} is too tall to print as one image` };
            }

            let url = render(image, size);

            if (!url) {
                return { trouble: `${file.name} could not be drawn at ${size.width} by ${size.height}` };
            }

            return { text: snippet(identifier(file.name, script), url, size) };
        }
        catch (error) {
            return { trouble: `${file.name} could not be read as an image` };
        }
    }

    /* One drop at a time. A drop reads the script and works out its names when
       its turn comes, and not while another drop is still busy putting its own
       code in */

    let queue = Promise.resolve();

    function dropped(event) {
        /* Whatever comes of it, the drag is over */

        over();

        if (!images(event.dataTransfer)) {
            return;
        }

        take(event);

        /* The files are read now: what the drag carries is gone the moment this
           returns */

        let files = Array.from(event.dataTransfer.files || [])
            .filter(file => file.type.startsWith('image/'));

        if (files.length === 0) {
            return;
        }

        let point = place(Math.min(
            editor.renderer.screenToTextCoordinates(event.clientX, event.clientY).row,
            editor.session.getLength() - 1));

        /* An anchor moves along with everything typed or dropped in front of
           it, so a drop that has to wait for the one before it still lands
           where it was dropped */

        let anchor = editor.session.doc.createAnchor(point.row, point.column);

        queue = queue
            .then(() => insert(files, anchor, point.prefix))
            .catch(() => warn('The image could not be added to the script'));
    }

    /* Where the code goes in: the start of the line under the pointer, unless
       that line is inside a comment, which the code would cut in half. The rows
       of the comment are passed over, and a script that is comment all the way
       down gets the code on a line of its own behind it */

    function place(row) {
        let session = editor.session;
        let length = session.getLength();

        /* Ace reads a row against the state the row in front of it ended in, so
           the rows in front are read first: without them the comment that
           started on one of them is not there */

        for (let scan = 0; scan <= row; scan++) {
            session.getTokens(scan);
        }

        let comment = (scan) => {
            session.getTokens(scan);

            /* The state a row begins in, which is what tells a blank line
               inside a comment from a blank line outside one */

            if (scan > 0 && String(session.getState(scan - 1)).includes('comment')) {
                return true;
            }

            let token = session.getTokenAt(scan, 0);

            return !!token && String(token.type).includes('comment');
        };

        let target = row;

        while (target < length && comment(target)) {
            target++;
        }

        if (target < length) {
            return { row: target, column: 0, prefix: '' };
        }

        return {
            row: length - 1,
            column: session.getLine(length - 1).length,
            prefix: '\n'
        };
    }

    async function insert(files, anchor, prefix) {
        let troubles = [];
        let text = '';

        try {
            /* The script as it stands at this moment, which is what the names
               are made unique against: a drop that waited for another one
               waited for its names as well */

            let script = editor.getValue();

            for (let file of files) {
                let result = await code(file, script + text);

                if (result.trouble) {
                    troubles.push(result.trouble);
                }
                else {
                    text += result.text;
                }
            }

            if (text !== '') {
                /* One insert is one edit, and one edit is what a single undo
                   takes back */

                let end = editor.session.insert(anchor.getPosition(), prefix + text);

                editor.selection.moveCursorToPosition(end);
                editor.selection.clearSelection();
                editor.focus();

                update();

                /* A script with photographs in it can outgrow what the browser
                   keeps, and the moment to say so is now, rather than when the
                   page is closed and the script is gone */

                if (!save()) {
                    troubles.push('This script is too large to be kept when the page is closed');
                }
            }
        }
        finally {
            anchor.detach();
        }

        if (troubles.length) {
            warn(troubles.join('\n'));
        }
    }


</script>

<div id="editor" class:dragging bind:this={container}></div>

<!-- What was the matter with a dropped image, at the foot of the editor, which
     goes away on its own or when it is clicked -->

{#if trouble}
    <button class="trouble" type="button" onclick={dismiss}>{trouble}</button>
{/if}

<style>

    #editor {
        grid-row: 3;
        grid-column: 1;
        font-size: 11px;
    }

    /* While an image is over the editor, the editor says it takes it: a line
       just inside the pane, over everything Ace puts in it, where a border
       would move the text and a shadow would sit behind it.

       It is drawn as a layer of its own rather than as an outline, because the
       layers Ace stacks in the pane, the gutter and the text among them, are
       painted over an outline of the element that holds them */

    #editor {
        position: relative;
    }

    #editor.dragging::after {
        content: '';
        position: absolute;
        inset: 0;
        border: 2px solid #2196F3;
        pointer-events: none;
        z-index: 20;
    }

    /* The amber of the trouble the inspector shows, in a note that sits over
       the foot of the editor rather than in a row of its own, because the
       editor is one pane of a page that has no room for another row */

    .trouble {
        grid-row: 3;
        grid-column: 1;
        align-self: end;
        justify-self: center;
        z-index: 30;

        box-sizing: border-box;
        max-width: calc(100% - 32px);
        margin: 0 0 16px 0;
        padding: 8px 15px;
        border: 1px solid #ffe69c;
        border-radius: 6px;

        background: #fff3cd;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);

        appearance: none;
        font-family: system-ui;
        font-size: 9pt;
        font-weight: normal;
        color: #664d03;
        text-align: left;
        white-space: pre-line;

        cursor: pointer;
    }

</style>
