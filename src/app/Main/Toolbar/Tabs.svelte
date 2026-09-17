<script>

    import TabBar from '../../common/TabBar.svelte';

    import textIcon from '../../../assets/icons/tabs/text.svg?raw';
    import commandsIcon from '../../../assets/icons/tabs/commands.svg?raw';
    import encodedIcon from '../../../assets/icons/tabs/encoded.svg?raw';
    import decodedIcon from '../../../assets/icons/tabs/decoded.svg?raw';
    import outputIcon from '../../../assets/icons/tabs/output.svg?raw';
    import imageIcon from '../../../assets/icons/tabs/image.svg?raw';

    let { view } = $props();

    const tabs = [
        { value: 'text',     label: 'Preview',  icon: textIcon },
        { value: 'commands', label: 'Commands', icon: commandsIcon },
        { value: 'encoded',  label: 'Encoded',  icon: encodedIcon },
        { value: 'output',   label: 'Output',   icon: outputIcon },
        { value: 'decoded',  label: 'Decoded',  icon: decodedIcon },
        { value: 'image',    label: 'Rendered', icon: imageIcon },
    ];

</script>

<TabBar items={tabs} bind:value={$view} name="format" label="Views" />
