
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

        window.addEventListener('beforeunload', () => {
            if (editor) {
                localStorage.setItem('editor', JSON.stringify({
                    value:  editor.getValue(),
                    cursor: editor.selection.getCursor(),
                    range:  editor.getSelectionRange()
                }));
            }
        });

        /* Ace carries drag and drop of its own, for the text in it, and it
           listens on this same element. These listen in front of it, in the
           capture phase, and a drag that carries image files never reaches it */

        container.addEventListener('dragenter', dragenter, true);
        container.addEventListener('dragover', dragover, true);
        container.addEventListener('dragleave', dragleave, true);
        container.addEventListener('drop', dropped, true);

        return () => {
            container.removeEventListener('dragenter', dragenter, true);
            container.removeEventListener('dragover', dragover, true);
            container.removeEventListener('dragleave', dragleave, true);
            container.removeEventListener('drop', dropped, true);
        };
    });

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

    /* A drag that moves over the editor enters and leaves every element under
       it, so what is counted is how deep it is rather than whether it is here */

    let depth = 0;

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

    /* The width of the paper of the selected model, which is what an image is
       never printed wider than. A model that was not selected is the generic
       printer, and whatever the encoder gives for it */

    function printableWidth() {
        try {
            let encoder = new ReceiptPrinterEncoder($model ? { printerModel: $model } : {});

            return encoder.printableWidth;
        }
        catch (error) {
            console.warn(error);

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
       white prints the paper, and the paper is white */

    function render(image, size) {
        let canvas = document.createElement('canvas');

        canvas.width = size.width;
        canvas.height = size.height;

        let context = canvas.getContext('2d');

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, size.width, size.height);
        context.drawImage(image, 0, 0, size.width, size.height);

        return canvas.toDataURL('image/png');
    }

    async function code(file, script) {
        let source = await read(file);

        let image = new Image();
        image.src = source;

        await image.decode();

        /* An SVG that carries no width and height of its own is drawn at the
           width of the paper, and its viewBox says what shape it is. The
           browser reports a size for such an SVG all the same, one it made up
           out of a default of 300 by 150, so the file itself is asked */

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

        return snippet(identifier(file.name, script), render(image, size), size);
    }

    async function dropped(event) {
        if (!images(event.dataTransfer)) {
            return;
        }

        take(event);

        depth = 0;
        dragging = false;

        let files = Array.from(event.dataTransfer.files || [])
            .filter(file => file.type.startsWith('image/'));

        if (files.length === 0) {
            return;
        }

        /* The line under the pointer, which is where the code goes in, in front
           of whatever is on it */

        let row = Math.min(
            editor.renderer.screenToTextCoordinates(event.clientX, event.clientY).row,
            editor.session.getLength() - 1);

        let script = editor.getValue();
        let text = '';

        for (let file of files) {
            try {
                /* Every snippet declares its name, so a second file of the same
                   name is unique against the first one of this very drop */

                text += await code(file, script + text);
            }
            catch (error) {
                console.warn(error);
            }
        }

        if (text === '') {
            return;
        }

        /* One insert is one edit, and one edit is what a single undo takes back */

        editor.session.insert({ row, column: 0 }, text);

        editor.selection.moveCursorToPosition({ row: row + text.split('\n').length - 1, column: 0 });
        editor.selection.clearSelection();
        editor.focus();

        update();
    }


</script>

<div id="editor" class:dragging bind:this={container}></div>

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

</style>
