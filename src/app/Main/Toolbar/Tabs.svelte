<script>

    import { Icon } from 'svelte-icon';
    import textIcon from '../../../assets/icons/tabs/text.svg?raw';
    import commandsIcon from '../../../assets/icons/tabs/commands.svg?raw';
    import encodedIcon from '../../../assets/icons/tabs/encoded.svg?raw';
    import outputIcon from '../../../assets/icons/tabs/output.svg?raw';
    import imageIcon from '../../../assets/icons/tabs/image.svg?raw';

    let { view } = $props();

</script>

<div>
    <nav>
        <label>
            <input type="radio" name="format" value="text" bind:group={$view}>
            <Icon data={textIcon} />
            Text
        </label>

        <label>
            <input type="radio" name="format" value="commands" bind:group={$view}>
            <Icon data={commandsIcon} />
            Commands
        </label>

        <label>
            <input type="radio" name="format" value="encoded" bind:group={$view}>
            <Icon data={encodedIcon} />
            Encoded
        </label>

        <label>
            <input type="radio" name="format" value="output" bind:group={$view}>
            <Icon data={outputIcon} />
            Output
        </label>

        <label>
            <input type="radio" name="format" value="image" bind:group={$view}>
            <Icon data={imageIcon} />
            Image
        </label>
    </nav>
</div>

<style>

    div {
        display: flex;
        flex-wrap: wrap;
        align-content: start;
        justify-content: end;
        margin-left: auto;
        padding-right: 10px;
    }

    nav {
        border: none;
        border-radius: 6px;
        background: #eaeaea;
        font-family: system-ui;
        font-size: 10pt;
        margin: 15px 0 0 15px;
        display: flex;
        height: 32px;
        align-items: stretch;
        user-select: none;
    }   

    label {
        display: flex;
        align-items: center;
        padding: 0px 9px;
    }
    label:first-child {
        border-radius: 6px 0 0 6px;
    }
    label:last-child {
        border-radius: 0 6px 6px 0;
    }
    label:has(:focus-visible) {
        outline: -webkit-focus-ring-color auto 1px;
    }
    label:has(input:checked) {
        background: #d5d5d5;
    }

    label :global(svg) {
        width: 1.5em;
        height: 1.5em;
        margin-right: 4px;
    }

    input {
        position: absolute;
        opacity: 0;
    }

</style>
