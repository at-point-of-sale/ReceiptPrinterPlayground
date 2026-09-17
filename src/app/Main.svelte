<script>

    import { writable } from 'svelte/store';

    import Toolbar from './Main/Toolbar.svelte';
    import Editor from './Main/Editor.svelte';
    import Split from './Main/Split.svelte';
    import Preview from './Main/Preview.svelte';

    let { contents, model } = $props();


    /* Make view store */

    const view = writable('text');


    /* Link onload callback to editor */

    let editor;

    let onload = (template) => {
        editor.load(template);
    }

</script>

<Toolbar {view} {onload} />
<Editor bind:this={editor} {contents} />
<Split onresize={() => editor?.resize()} />
<Preview {view} {contents} {model} />
