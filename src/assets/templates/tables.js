encoder
    .initialize()
    .codepage('auto')
    .line(model)
    .rule()
    .line('Tables')
    .newline()

let widePaper = encoder.columns >= 42

if (!widePaper) {
    encoder.font('B');
}

encoder.table(
    [
        { width: 15, align: 'left', marginRight: 1 },
        { width: 9, align: 'left', marginRight: 1 },
        { width: 16, align: 'right' }
    ],    
    [
        [
            (encoder) => encoder.bold(true).text('Name').bold(false),
            (encoder) => encoder.bold(true).text('Quantity').bold(false),
            (encoder) => encoder.bold(true).text('Description').bold(false)
        ],
        [
            (encoder) => encoder.rule({ width: 6 }),
            (encoder) => encoder.rule(),
            (encoder) => encoder.rule({ style: 'double' }),
        ],
        ['Banana', '5', 'Ripe Yellow Bananas'],
        ['Cherry', '250000000', 'Delicious Sweet Cherries'],
        [
            (encoder) => encoder.text('Cherry'),
            (encoder) => encoder.width(2).text('250000000').width(1),
            (encoder) => encoder.text('Delicious Sweet Cherries')
        ],
        [
            (encoder) => encoder.bold(true).text('Cherry').bold(false),
            (encoder) => encoder.text('250000000'),
            (encoder) => encoder.bold(true).text('Delicious Sweet Cherries').bold(false)
        ],
        ['[-------------]', '[-------]', '[--------------]']
    ]
)

if (!widePaper) {
    encoder.font('A');
}

encoder.newline()

const firstColumnWidth = Math.round(encoder.columns * 0.1);
const secondColumnWidth = Math.round(encoder.columns * 0.5);

encoder
    .width(2)
    .line("-".repeat(encoder.columns / 2))
    .width(1);

encoder.table(
    [
        { width: firstColumnWidth, marginRight: 1, align: "right" },
        { width: secondColumnWidth, align: "left" },
        {
            width: encoder.columns - firstColumnWidth - secondColumnWidth - 1,
            align: "right",
        },
    ],
    [
        ["1x", "Spaghetti Bolognese", "€ 10,00"],
        ["10x", "Spagetti alla carbonara", "€ 100,00"],
    ],
);

encoder
    .width(2)
    .line("-".repeat(encoder.columns / 2))
    .width(1);

encoder
    .newline()
    .line('Borders and rule rows')
    .newline()

/* A bordered table with a rule row under the header, a rule row above
   the total and a total that spans the first two columns */

encoder.table(
    [
        { align: 'left' },
        { width: 4, align: 'right' },
        { width: 8, align: 'right' }
    ],
    [
        ['Item', 'Qty', 'Price'],
        { rule: true },
        ['Beer', '2', '13.00'],
        ['Chidori', '2', '172.80'],
        { rule: true },
        [{ span: 2, content: 'Total', align: 'right' }, '185.80']
    ],
    { border: 'single' }
)

encoder.newline()

/* A grid: a border and a rule between every pair of rows, with rounded
   corners on printers that have them (Epson compatible and Star) */

encoder.table(
    [
        { width: 3, align: 'right' },
        { align: 'left' },
        { width: 8, align: 'right' }
    ],
    [
        ['1x', 'Spaghetti Bolognese', '€ 10,00'],
        ['10x', 'Spaghetti alla carbonara', '€ 100,00'],
        [{ span: 2, content: 'Total', align: 'right' }, '€ 110,00']
    ],
    { border: 'single', corners: 'rounded', rules: 'all' }
)

encoder.newline()

/* A double border, with margins inside the border */

encoder.table(
    [
        { align: 'left', marginLeft: 1 },
        { width: 6, align: 'right', marginRight: 1 }
    ],
    [
        [(encoder) => encoder.bold(true).text('Table 12').bold(false), '19:00'],
        { rule: true },
        ['Party of', '4']
    ],
    { border: 'double' }
)

encoder.newline()

/* A narrow table, centred on the paper, with a double height cell */

encoder
    .align('center')
    .table(
        [
            { width: 10, align: 'left' },
            { width: 8, align: 'right' }
        ],
        [
            ['Total', (encoder) => encoder.size(1, 2).text('185.80')],
        ],
        { border: 'single', corners: 'rounded', width: 21 }
    )
    .align('left')

encoder.newline()

/* A cell can turn its border off, entirely or per side. An edge is
   drawn when either of the cells next to it wants it, so the rules
   of the neighbours stay and the junctions follow */

encoder.table(
    [
        { align: 'left' },
        { width: 10, align: 'right' }
    ],
    [
        ['Item', 'Price'],
        { rule: true },
        ['Beer', '13.00'],
        ['Chidori', '172.80'],
        { rule: true },
        [{ content: 'Total', align: 'right', border: 'none' }, '185.80'],
        { rule: true },
        [{ content: 'Paid in cash', align: 'right', border: 'none' }, '200.00']
    ],
    { border: 'single', corners: 'rounded' }
)

encoder.newline()
