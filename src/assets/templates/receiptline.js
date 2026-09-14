encoder
    .initialize()
    .codepage('auto')
    .line(model)
    .rule()
    .line('ReceiptLine')
    .newline()

/*
    ReceiptLine.transform() prints a receiptline document onto the
    encoder. The document positions everything itself, so the encoder
    is set to left alignment while it runs, and the final cut is left
    to you. Rounded corners need a code page with the glyphs, which
    codepage('auto') finds by itself on Epson compatible and Star
    printers.

    The documents below are the receipt and the guest check of the
    receiptline examples, Apache License 2.0, copyright 2019 Open
    Foodservice System Consortium and 2026 OpenReceipt Project.
*/

await ReceiptLine.transform(encoder, `{image:iVBORw0KGgoAAAANSUhEUgAAAIAAAAAwAgMAAACkmpotAAAADFBMVEVlLWdzAGcAAAD///98qlo+AAAAAXRSTlMAQObYZgAAAEhJREFUOMtjYBgFowAFcK0CgQVcK4BsrQUwHoSiloIVCEprASpFLQUothKtAIsvcCoAA3TLCStYgRbe+BRgD0mqKhgFo4B4AACanYyrOJrmgQAAAABJRU5ErkJggg==}
          Ichigaya Terminal
       1-Y-X Kudan, Chiyoda-ku
-------------------------------------
02-09-2019 19:00
{border:line}
^RECEIPT
{border:space}
{width:*,2,10}
BEER                   | 2|     13.00
CHIDORI                | 2|    172.80
-------------------------------------
{width:*,20}
^TOTAL             |          ^185.80
CASH               |           200.00
CHANGE             |            14.20`, { corners: 'rounded' })

encoder
    .newline()
    .newline()

await ReceiptLine.transform(encoder, `|                      \`~~New Order~~|
{image:iVBORw0KGgoAAAANSUhEUgAAAIAAAAAwAgMAAACkmpotAAAADFBMVEVlLWdzAGcAAAD///98qlo+AAAAAXRSTlMAQObYZgAAAEhJREFUOMtjYBgFowAFcK0CgQVcK4BsrQUwHoSiloIVCEprASpFLQUothKtAIsvcCoAA3TLCStYgRbe+BRgD0mqKhgFo4B4AACanYyrOJrmgQAAAABJRU5ErkJggg==}
|Table |    A05|Order #    |  0003-01|
|Time  |  19:00|Party Size |        2|
{width:3,*,4,9; border:line}
--------------------------------------
|     |    ITEM     | QTY |  AMOUNT  |
--------------------------------------
|^^[ ]|^^BEER       | ^^^2|   ^^13.00|
|^^[ ]|^^CHIDORI    | ^^^2|  ^^172.80|
--------------------------------------
{width:14,18; align:right}
       |    SUBTOTAL    |      185.80|
       | SERVICE CHARGE |        0.00|
       -------------------------------
       | ^^^TOTAL |         ^^^185.80|
       -------------------------------
{width:*; border:none; align:center}
{code:0003; option:code39,48}`, { corners: 'rounded' })

encoder
    .newline()
    .cut()
