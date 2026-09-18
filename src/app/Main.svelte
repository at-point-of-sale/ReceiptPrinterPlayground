<script>

    import Toolbar from './Main/Toolbar.svelte';
    import Editor from './Main/Editor.svelte';
    import Split from './Main/Split.svelte';
    import Preview from './Main/Preview.svelte';

    let { contents, model, view } = $props();


    /* Link onload callback to editor */

    let editor;

    let onload = (template) => {
        editor.load(template);
    }

    /* The script of a link, which the page hands down to the editor once it
       exists */

    export function set(value) {
        editor?.set(value);
    }

    /* And what the page has to say about the link it came from, which the
       editor shows at its foot */

    export function note(message) {
        editor?.note(message);
    }

</script>

<Toolbar {view} {onload} />
<Editor bind:this={editor} {contents} {model} />
<!-- The gutter is the colour of the preview behind it, which is the darker
     grey of the paper while the rendered view is shown, as in the inspector -->
<Split onresize={() => editor?.resize()} background={$view === 'image' ? '#e4e4e4' : '#fafafa'} />
<Preview {view} {contents} {model} />
