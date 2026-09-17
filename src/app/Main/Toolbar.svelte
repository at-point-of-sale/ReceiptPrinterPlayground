<script>

    import Tabs from './Toolbar/Tabs.svelte';
    import Templates from './Toolbar/Templates.svelte';

    let { onload, view } = $props();

</script>

<!-- One row of buttons that wraps: the templates take the room they need and
     the tab bar sits at the end of the last row they leave -->

<div>
    <Templates {onload}/>
    <Tabs {view} />
</div>

<style>

    div {
        grid-row: 2;
        grid-column: 1 / -1;
        padding-left: 10px;
        padding-right: 5px;
        padding-bottom: 15px;

        display: flex;
        flex-wrap: wrap;
        align-content: start;
        box-sizing: border-box;

        background: #fafafa;
        border-bottom: 1px solid #ddd;
    }

</style>
