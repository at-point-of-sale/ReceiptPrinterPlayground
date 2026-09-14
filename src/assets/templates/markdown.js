encoder
    .initialize()
    .codepage('auto')
    .line(model)
    .rule()
    .line('Markdown')
    .newline()

/*
    markdown() prints a small subset of Markdown through the regular
    commands. Every source line is a line on paper, headings become
    sizes and bold, and the current alignment applies to everything.
*/

encoder
    .align('center')
    .markdown(`# Ichigaya Terminal
1-Y-X Kudan, Chiyoda-ku
02-09-2019 19:00`)
    .align('left')

/*
    Inline styles: **bold**, *italic*, __underline__ and ==invert==.
    Links and images print as their text. A backslash escapes a
    character, but inside a JavaScript template literal it needs to
    be doubled.
*/

encoder
    .markdown(`
---

Some **bold**, some *italic*, some __underlined__ and some ==inverted== text.
A link to [our site](https://example.com) prints as its text.
Literal \\*asterisks\\* and ORDER_123 stay as they are.
`)

/*
    Tables: the header is bold, the delimiter row sets the alignment,
    and the widest column takes the space that is left, so the table
    is as wide as the paper. A header without content is left out.
*/

encoder
    .markdown(`
## Order

| Item    | Qty | Price |
|:--------|----:|------:|
| Beer    |   2 | 13.00 |
| Chidori |   2 | 172.80 |
| **Total** | | **185.80** |

| | |
|-|-:|
| Cash | 200.00 |
| Change | 14.20 |
`)

/*
    Lists: bulleted and numbered, with a hanging indent for lines
    that wrap, and two spaces of indent per nesting level.
*/

encoder
    .markdown(`
## Notes

- Meals and goods at the __reduced__ tax rate
- ==Paid== in cash
  - No change given for amounts under one cent
1. Keep this receipt
2. Visit our site for the full terms and conditions of this purchase
`)

/*
    Markdown works inside boxes and table cells as well.
*/

encoder
    .newline()
    .box(
        { width: encoder.columns - 4, border: 'single', corners: 'rounded', marginLeft: 2, paddingLeft: 1, paddingRight: 1 },
        (encoder) => encoder.markdown(`### Thank you
See you **again** soon!`)
    )
    .newline()

encoder
    .table(
        [
            { align: 'left', marginRight: 1 },
            { width: 12, align: 'right' }
        ],
        [
            [
                (encoder) => encoder.markdown('**Opening hours**\nMon to Fri 9:00 to 18:00\nSat 10:00 to 16:00'),
                (encoder) => encoder.markdown('==Closed==\non Sunday')
            ]
        ],
        { border: 'single', corners: 'rounded' }
    )
    .newline()
