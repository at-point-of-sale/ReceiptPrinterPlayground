<script>

    import { get } from 'svelte/store';
    import { getEncoder } from '../../utils/encoder.js';

    import Commands from './Preview/Commands.svelte';
    import Encoded from './Preview/Encoded.svelte';
    import Decoded from './Preview/Decoded.svelte';
    import Image from './Preview/Image.svelte';
    import Output from './Preview/Output.svelte';
    import Text from './Preview/Text.svelte';


    let { view, contents, model } = $props();
    
    let errors = $state([]);
    
    let text;
    let commands;
    let encoded;
    let decoded;
    let output;
    let image;

    let render = async () => {
        let encoder;

        let result = await getEncoder({
            printerModel: get(model),
            value: get(contents)
        });

        errors = result.errors || [];
        encoder = result.encoder || null;

        switch($view) {
            case 'text': 
                text.render(encoder);
                break;

            case 'commands':
                commands.render(encoder);
                break;

            case 'encoded':
                encoded.render(encoder);
                break;
            
            case 'decoded':
                decoded.render(encoder);
                break;

            case 'output':
                output.render(encoder);
                break;

            case 'image':
                image.render(encoder);
                break;
        }
    }

    contents.subscribe(() => render()); 
    model.subscribe(() => render()); 
    view.subscribe(() => render()); 

</script>

<div id="preview">
    {#if errors.length > 0}
        <div id="errors">
            {#each errors as error}
                <div>{error}</div>
            {/each}
        </div>
    {/if}

    <main>
        <Text bind:this={text} {view} />
        <Commands bind:this={commands} {view} />
        <Encoded bind:this={encoded} {view} />
        <Decoded bind:this={decoded} {view} />
        <Output bind:this={output} {view} />
        <Image bind:this={image} {view} />
    </main>
</div>

<style>

    #preview {
        grid-row: 3;
        grid-column: 2;
        background: #fafafa;
        border-left: 1px solid #ddd;
        overflow: scroll;
    }

    #errors div {
        background: #f0f0f0;
        border-radius: 6px;
        font-family: var(--font-stack-mono);
        margin: 8px;
        padding: 6px 8px 6px 24px;
        font-size: 11px;

        background-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHg9IjBweCIgeT0iMHB4IiB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCI+CjxwYXRoIGZpbGw9IiNGRkMxMDciIGQ9Ik00MCw0MEg4Yy0wLjcxNywwLTEuMzc3LTAuMzgzLTEuNzM0LTEuMDA0Yy0wLjM1Ni0wLjYyMS0wLjM1NC0xLjM4NSwwLjAwNy0yLjAwNGwxNi0yOEMyMi42MzEsOC4zNzgsMjMuMjg5LDgsMjQsOHMxLjM2OSwwLjM3OCwxLjcyOCwwLjk5MmwxNiwyOGMwLjM2MSwwLjYxOSwwLjM2MywxLjM4MywwLjAwNywyLjAwNFM0MC43MTYsNDAsNDAsNDB6Ij48L3BhdGg+PHBhdGggZmlsbD0iIzVENDAzNyIgZD0iTTIyLDM0LjE0MmMwLTAuMjY5LDAuMDQ3LTAuNTE1LDAuMTQzLTAuNzQ2YzAuMDk0LTAuMjI4LDAuMjI5LTAuNDI2LDAuNDAzLTAuNTkyYzAuMTcxLTAuMTY4LDAuMzgyLTAuMjk5LDAuNjI0LTAuMzkzYzAuMjQ0LTAuMDkyLDAuNTE4LTAuMTQxLDAuODI0LTAuMTQxYzAuMzA2LDAsMC41ODIsMC4wNDksMC44MjgsMC4xNDFjMC4yNSwwLjA5NCwwLjQ2MSwwLjIyNSwwLjYzMiwwLjM5M2MwLjE3NSwwLjE2NiwwLjMxLDAuMzY0LDAuNDAzLDAuNTkyQzI1Ljk1MywzMy42MjcsMjYsMzMuODczLDI2LDM0LjE0MmMwLDAuMjctMC4wNDcsMC41MTYtMC4xNDMsMC43NGMtMC4wOTQsMC4yMjUtMC4yMjksMC40MTktMC40MDMsMC41ODhjLTAuMTcxLDAuMTY2LTAuMzgyLDAuMjk2LTAuNjMyLDAuMzkyQzI0LjU3NiwzNS45NTQsMjQuMywzNiwyMy45OTQsMzZjLTAuMzA3LDAtMC41OC0wLjA0Ni0wLjgyNC0wLjEzOWMtMC4yNDItMC4wOTYtMC40NTMtMC4yMjYtMC42MjQtMC4zOTJjLTAuMTc1LTAuMTY5LTAuMzEtMC4zNjMtMC40MDMtMC41ODhDMjIuMDQ3LDM0LjY1NywyMiwzNC40MTEsMjIsMzQuMTQyIE0yNS40OCwzMGgtMi45NzNsLTAuNDIxLTEySDI1LjlMMjUuNDgsMzB6Ij48L3BhdGg+Cjwvc3ZnPg==);
        background-size: 16px;
        background-repeat: no-repeat;
        background-position: 4px 4px;
    }


    /* Common styles for the encoded and commands view */

    main {
        padding: 0 20px;
        margin: 0;
        font-family: var(--font-stack-mono);
        font-size: 0.75rem;
        color: #888;
    }

    main :global(.line) {
        display: flex;
        flex-wrap: wrap;    
    
        border-bottom: 1px dashed #ccc;
        padding: 14px 20px 6px 20px;
        margin: 0px -20px;
        min-height: 12px;
    }

    main :global(.line:first-of-type) {
        padding-top: 0;
    }

    main :global(.line .return) {
        display: block;
        font-family: sans-serif;
        margin-right: 8px;
        margin-bottom: 16px;
        align-self: end;
    }
    main :global(.line .return:first-child) {
        margin-bottom: 8px;
    }

    main :global(.line .command) {
        display: flex;
        position: relative;
        background: #ddd;
        border-radius: 5px;
        font-family: var(--font-stack-mono);
        margin-right: 8px;
        margin-bottom: 8px;
        color: #000;
        font-size: 0.7rem;
        line-height: 150%;
    }

    main :global(.line .command > *) {
        padding: 6px 8px;
    }

    main :global(.line .command div:empty) {
        padding: 0;
    }

    main :global(.line .command .type) {
        color: #fff;
        background: #888;
        border-radius: 5px;
        max-height: 17px;
    }
    main :global(.line .command .codepage) {
        color: #aaa;
    }
    main :global(.line .command .text) {
        text-wrap: nowrap;
    }
    main :global(.line .command .text .space::before) {
        position: absolute;
        content: '.';
        color: #aaa;
        margin-top: -2px;
    }

    main :global(.line .command > *) {
        padding: 6px 8px;
    }

    main :global(.line .command div:empty) {
        padding: 0;
    }

    main :global(.line .command[data-type="empty"]) {
        display: none;
    }

    main :global(.line .command[data-type="character-mode"] .type),
    main :global(.line .command[data-type="codepage"] .type) {
        background: #00BCD4;
    }

    main :global(.line .command[data-type="text"] .type) {
        background: #4CAF50;
    }

    main :global(.line .command[data-type="line-spacing"] .type),
    main :global(.line .command[data-type="font"] .type),
    main :global(.line .command[data-type="align"] .type) {
        background: #607D8B;
    }

    main :global(.line .command[data-type="style"] .type) {
        background: #3F51B5;
    }

    main :global(.line .command[data-type="image"] .type),
    main :global(.line .command[data-type="qrcode"] .type),
    main :global(.line .command[data-type="barcode"] .type),
    main :global(.line .command[data-type="pdf417"] .type) {
        background: #9C27B0;
    }

    main :global(.line .command[data-type="cut"] .type),
    main :global(.line .command[data-type="pulse"] .type) {
        background: #a43d68;
    }

    main :global(.line .command[data-type="raw"] .type) {
        background: #D85700;
    }

</style>