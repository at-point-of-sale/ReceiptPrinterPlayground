encoder
    .initialize()
    .codepage('auto')
    .line(model)
    .rule()
    .line('Barcodes')
    .newline()

encoder
    .newline()
    .line('EAN13:')
    .barcode('123456789012', 'ean13', { width: 2 })
    .newline()

encoder
    .line('EAN8:')
    .barcode('12345670', 'ean8', { width: 2 })
    .newline()   

encoder
    .line('UPC-A:')
    .barcode('12345678901', 'upca', { width: 2 })
    .newline()        

encoder
    .line('UPC-E:')
    .barcode('023456000073', 'upce', { width: 2 })
    .newline()        

encoder
    .line('Code 39:')
    .barcode('1234ABCDEF$', 'code39', { width: 1 })
    .newline()      

encoder
    .line('Code 93:')
    .barcode('1234ABCDEF', 'code93', { width: 1 })
    .newline()       

encoder
    .line('Code 128 (CODE128):')
    .barcode('CODE128', 'code128', { width: 1 })
    .line('Code 128 (Code128):')
    .barcode('CODE128', 'code128', { width: 1 })
    .line('Code 128 (50859935):')
    .barcode('50859935', 'code128', { width: 1 })
    .newline()            

encoder
    .line('ITF:')
    .barcode('12345678', 'itf', { width: 2 })
    .newline()            

encoder
    .line('Codabar / NW-7:')
    .barcode('A1234B', 'codabar', { width: 2 })
    .newline()        

encoder
    .line('GS1-128 (0130012345678906):')
    .barcode('0130012345678906', 'gs1-128', { width: 2 })
    .line('GS1-128 ((01)30012345678906):')
    .barcode('(01)30012345678906', 'gs1-128', { width: 2 })
    .newline()            

encoder
    .line('GS1 Databar Omni:')
    .barcode('1234567890123', 'gs1-databar-omni', { width: 2 })
    .newline()            

encoder
    .line('GS1 Databar Truncated:')
    .barcode('1234567890123', 'gs1-databar-truncated', { width: 2 })
    .newline()            

encoder
    .line('GS1 Databar Limited:')
    .barcode('1234567890123', 'gs1-databar-limited', { width: 2 })
    .newline()            

encoder
    .line('GS1 Databar Expanded:')
    .barcode('0130012345678906', 'gs1-databar-expanded', { width: 2 })
    .newline()            

encoder.rule();

encoder
    .newline()
    .line('Without checksum:')
    .barcode('123456789012', 'ean13', 60)
    .newline()

encoder
    .newline()
    .line('With checksum:')
    .barcode('1234567890128', 'ean13', 60)
    .newline()

encoder
    .newline()
    .line('Invalid checksum:')
    .barcode('1234567890124', 'ean13', 60)
    .newline()

encoder.rule();

encoder
    .newline()
    .line('{ width: 1 }')
    .barcode('123456789012', 'ean13', { width: 1 })
    .barcode('12345678', 'itf', { width: 1 })
    .newline()

encoder
    .newline()
    .line('{ width: 2 }')
    .barcode('123456789012', 'ean13', { width: 2 })
    .barcode('12345678', 'itf', { width: 2 })
    .newline()

encoder
    .newline()
    .line('{ width: 3 }')
    .barcode('123456789012', 'ean13', { width: 3 })
    .barcode('12345678', 'itf', { width: 3 })
    .newline()

encoder.rule();

encoder
    .newline()
    .line('{ height: 40 }')
    .barcode('123456789012', 'ean13', { height: 40 })
    .newline()

encoder
    .newline()
    .line('{ height: 60 }')
    .barcode('1234567890128', 'ean13', { height: 60 })
    .newline()

encoder
    .newline()
    .line('{ height: 100 }')
    .barcode('1234567890128', 'ean13', { height: 100 })
    .newline()

encoder.rule();

encoder
    .newline()
    .line('{ text: above }')
    .barcode('123456789012', 'ean13', { text: 'above' })
    .newline()

encoder
    .newline()
    .line('{ text: below }')
    .barcode('1234567890128', 'ean13', { text: 'below' })
    .newline()

encoder
    .newline()
    .line('{ text: both }')
    .barcode('1234567890128', 'ean13', { text: 'both' })
    .newline()

encoder.rule();

encoder
    .newline()
    .line('Left aligned:')
    .align('left')
    .barcode('12345670', 'ean8', 60)
    .align('left')
    .newline()

encoder
    .newline()
    .line('Centered:')
    .align('center')
    .barcode('12345670', 'ean8', 60)
    .align('left')
    .newline()

encoder
    .newline()
    .line('Right aligned:')
    .align('right')
    .barcode('12345670', 'ean8', 60)
    .align('left')
    .newline()
