<script>

    let { view } = $props();

    let html = $state('');

    export const render = (encoder) => {  
        let result = '';

        if (encoder) {
            let columns = encoder.columns;
            let data = encoder.encode('commands');

            let classes = new Set();
            let size = 'w1h1';
            let font = 'fonta';
            let align = 'left';

            let barcode = {};
            let qrcode = {};
            let pdf417 = {};

            /* Without line spacing a line is fed by the height of its characters and
               nothing more, so that the vertical lines of boxes and tables touch. The
               command applies to the feed of the line it is on, wherever it is on that
               line, and stays in effect until it is changed back */

            let tight = false;

            result += `<div class="receipt" style="--columns: ${columns};">`;

            for (let line of data) {
                let content = '';

                for (let command of line.commands) {
                    if (command.type === 'text') {
                        content += command.value.split('').map(c => `<span class='character ${font} ${size} ${[...classes.keys()].join(' ')}'>${c}</span>`).join('');
                    }

                    if (command.type === 'line-spacing') {
                        tight = command.value === 'none';
                    }

                    if (command.type === 'align') {
                        align = command.value;
                    }

                    if (command.type === 'font') {
                        font = `font${command.value.toLowerCase()}`;
                    }

                    if (command.type === 'style') {
                        if (command.property === 'size') {
                            size = command.value.width > 1 || command.value.height > 1 ? `scale w${command.value.width} h${command.value.height}` : '';
                        }
                        else {
                            if (command.value) {
                                classes.add(command.property);
                            }
                            else {
                                classes.delete(command.property);
                            }
                        }
                    }

                    if (command.type === 'qrcode') {
                        if (command.property) {
                            qrcode[command.property] = command.value;
                        }

                        if (command.command === 'print') {
                            let properties = {
                                bcid: 'qrcode',
                                text: qrcode.data,
                                eclevel: qrcode.errorlevel.toUpperCase(),
                                scale: qrcode.size,
                            }

                            content += `<div class='placeholder ${command.type} ${align}'><img src='https://bwipjs-api.metafloor.com/?${Object.entries(properties).map(i => i[0]+'='+escape(i[1])).join('&')}' onerror="this.style.display='none'"></div>`;

                            qrcode = {};
                        }
                    }

                    if (command.type === 'pdf417') {
                        if (command.property) {
                            pdf417[command.property] = command.value;
                        }

                        if (command.command === 'print') {
                            let properties = {
                                bcid: 'pdf417',
                                text: pdf417.data,
                                eclevel: pdf417.errorlevel,
                                rows: pdf417.rows,
                                columns: pdf417.columns,
                                scaleX: pdf417.width * 2,
                                scaleY: pdf417.height * pdf417.width,
                            }

                            content += `<div class='placeholder ${command.type} ${align}'><img src='https://bwipjs-api.metafloor.com/?${Object.entries(properties).map(i => i[0]+'='+escape(i[1])).join('&')}' onerror="this.style.display='none'"></div>`;

                            pdf417 = {};
                        }
                    }

                    if (command.type === 'barcode') {
                        if (command.property) {
                            barcode[command.property] = command.value;
                        }
                    
                        else {
                            if (command.value) {
                                for (let key in command.value) {
                                    barcode[key] = command.value[key];
                                }
                            }

                            let symbologies = {
                                'upca': 'upca',
                                'upce': 'upce',
                                'ean13': 'ean13',
                                'ean8': 'ean8',
                                'code39': 'code39',
                                'coda39': 'code39',
                                'itf': 'interleaved2of5',
                                'interleaved-2-of-5': 'interleaved2of5',
                                'nw-7': 'rationalizedCodabar',
                                'codabar': 'rationalizedCodabar',
                                'code93': 'code93',
                                'code128': 'code128',
                                'gs1-128': 'gs1-128',
                                'gs1-databar-omni': 'databaromni',
                                'gs1-databar-truncated': 'databartruncated',
                                'gs1-databar-limited': 'databarlimited',
                                'gs1-databar-expanded': 'databarexpanded',
                                'code128-auto': 'code128',
                            }

                            let properties = {
                                bcid: symbologies[barcode.symbology],
                                text: barcode.data,
                                height: (barcode.height / barcode.width) / 4,
                                scale: barcode.width,
                            }

                            if (barcode.text) {
                                properties.includetext = 'true';
                                properties.textsize = 8;
                            }

                            content += `<div class='placeholder ${command.type} ${align}'><img src='https://bwipjs-api.metafloor.com/?${Object.entries(properties).map(i => i[0]+'='+escape(i[1])).join('&')}' onerror="this.style.display='none'"></div>`;

                            barcode = {};
                        }
                    }

                    if (command.type === 'image') {
                        let canvas = document.createElement('canvas');
                        canvas.width = command.width;
                        canvas.height = command.height;

                        let ctx = canvas.getContext('2d');
                        ctx.fillStyle = 'black';

                        for (let x = 0; x < command.width; x++) {
                            for (let y = 0; y < command.height; y++) {
                                let bit = 0;

                                if (command.value == 'raster') {
                                    let byte = (y * (command.width >> 3)) + (x >> 3) + 8;
                                    bit = (command.payload[byte] >> (7 - (x % 8))) & 1;
                                }
                                else {
                                    let skip = 4;

                                    if (encoder.language == 'esc-pos') {
                                        skip = 5;
                                    }

                                    let byte = (x * 3) + Math.floor(y / 8) + skip;
                                    bit = (command.payload[byte] >> (7 - (y % 8))) & 1;
                                }

                                if (bit) {
                                    ctx.fillRect(x, y, 1, 1);
                                }
                            }
                        }

                        content += `<div class='placeholder ${command.type} ${align}'><img src='${canvas.toDataURL()}'  style='width: ${command.width / 4 * 3}px; height: ${command.height / 4 * 3}px;'></div>`;
                    }

                    if (command.type === 'cut') {
                        content += `<div class='cut'></div>`;
                    }
                }
                
                result += `<div class="text${tight ? ' tight' : ''}">${content}</div>`;
            }
        }

        html = result;
    }

</script>

{#if $view === 'text'}
    <pre>{@html html}</pre>
{/if}

<style>

    :global(.receipt) {
        --size-a:   13px; /* 19px; */
        --width-a:  8px; /* 12px; */
        --height-a: 16px; /* 24px; */

        --size-b:   10px; /* 14px; */
        --width-b:  6px; /* 9px;*/
        --height-b: 16px; /* 24px; */

        --columns:  48;

        --text:     #444;
        --paper:    #eee;

        color: var(--text);
        background: var(--paper);
        border-radius: 8px;
        padding: 32px;
        margin: 0 auto;
        width: calc(var(--columns) * var(--width-a));
    }

    :global(.placeholder) {
        width: 100%;
        overflow-x: hidden;
    }
    :global(.placeholder *) { 
        display: block;
    }
    :global(.placeholder.qrcode *) {
        zoom: 33%;
    }
    :global(.placeholder.pdf417 *) {
        zoom: 33%;
    }
    :global(.placeholder.center *) {
        margin: 0 auto;
    }
    :global(.placeholder.right *) {
        margin-left: auto;
    }


    :global(.cut) { 
        border-top: 2px dashed #fff;
        width: calc(100% + 64px);
        margin: 0 -32px;
    }

    :global(.text) {
        --size: var(--size-a);
        --width: var(--width-a);
        --height: var(--height-a);

        display: flex;
        flex-wrap: wrap;
        font-family: var(--font-stack-mono);
        text-wrap: nowrap;
        min-height: var(--height);
        margin-bottom: calc(var(--height-a) / 4);
    }

    :global(.text.tight) {
        margin-bottom: 0;
    }

    :global(.fontb) {
        --size: var(--size-b);
        --width: var(--width-b);
        --height: var(--height-b);
    }

    :global(.character) {
        --scale-x: 1;
        --scale-y: 1;

        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--width);
        font-size: var(--size);
        line-height: var(--height);
    }

    :global(.bold) {
        font-weight: bold;
    }

    :global(.italic) {
        font-style: italic;
    }

    :global(.underline) {
        text-decoration: underline;
    }

    :global(.invert) {
        background: var(--text);
        color: var(--paper);
    }

    :global(.scale) {
        width: calc(var(--width) * var(--scale-x));
        line-height: calc(var(--height) * var(--scale-y));
        transform: scale(var(--scale-x), var(--scale-y));
    }
    :global(.w2) {
        --scale-x: 2;
    }
    :global(.h2) {
        --scale-y: 2;
    }
    :global(.w3) {
        --scale-x: 3;
    }
    :global(.h3) {
        --scale-y: 3;
    }
    :global(.w4) {
        --scale-x: 4;
    }
    :global(.h4) {
        --scale-y: 4;
    }

</style>