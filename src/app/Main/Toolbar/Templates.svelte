<script>

    import { Icon } from 'svelte-icon';
    import newIcon from '../../../assets/icons/templates/new.svg?raw';
    import textIcon from '../../../assets/icons/templates/text.svg?raw';
    import tablesIcon from '../../../assets/icons/templates/tables.svg?raw';
    import markdownIcon from '../../../assets/icons/templates/markdown.svg?raw';
    import receiptlineIcon from '../../../assets/icons/templates/receiptline.svg?raw';
    import imagesIcon from '../../../assets/icons/templates/images.svg?raw';
    import barcodesIcon from '../../../assets/icons/templates/barcodes.svg?raw';
    import qrcodeIcon from '../../../assets/icons/templates/qrcode.svg?raw';
    import pdf417Icon from '../../../assets/icons/templates/pdf417.svg?raw';

    let { onload } = $props();

</script>

<div>
    <button onclick={() => onload('new')}>
        <Icon data={newIcon} />
        New...
    </button>

    <button onclick={() => onload('text')}>
        <Icon data={textIcon} />
        Text
    </button>
    
    <button onclick={() => onload('tables')}>
        <Icon data={tablesIcon} />
        Tables
    </button>

    <button onclick={() => onload('markdown')}>
        <Icon data={markdownIcon} />
        Markdown
    </button>

    <button onclick={() => onload('receiptline')}>
        <Icon data={receiptlineIcon} />
        ReceiptLine
    </button>

    <button onclick={() => onload('images')}>
        <Icon data={imagesIcon} />
        Images
    </button>

    <button onclick={() => onload('barcodes')}>
        <Icon data={barcodesIcon} />
        Barcodes
    </button>

    <button onclick={() => onload('qrcode')}>
        <Icon data={qrcodeIcon} />
        QR Code
    </button>

    <button onclick={() => onload('pdf417')}>
        <Icon data={pdf417Icon} />
        PDF417
    </button>
</div>

<style>

    div {
        display: flex;
        flex-wrap: wrap;
        align-content: start;
        margin-right: auto;
        padding-left: 10px;
    }

    button {
        font-weight: normal;
        background: none;
        margin: 15px 0 0 0;
        padding: 0 6px;
    }
    
    button:first-child {
        margin-right: 15px;
    }

</style>