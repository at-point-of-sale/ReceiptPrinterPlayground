
<script>
    
    import { onMount } from 'svelte';

    let { contents } = $props();

    let editor;
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


</script>

<div id="editor"></div>

<style>

    #editor { 
        grid-row: 3;
        grid-column: 1;
        font-size: 11px;
    }

</style>