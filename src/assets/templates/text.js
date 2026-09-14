encoder
    .initialize()
    .codepage('auto')
    .line(model)
    .rule()
    .line('Text')
    .newline()

    .line('Font A')
    .line('48═════════════════════════════════════════════╣')
    .line('44═════════════════════════════════════════╣')
    .line('42═══════════════════════════════════════╣')
    .line('35════════════════════════════════╣')
    .line('32═════════════════════════════╣')
    .newline()

    .font('A')
    .line('Font B')
    .font('B')
    .line('64═════════════════════════════════════════════════════════════╣')
    .line('56═════════════════════════════════════════════════════╣')
    .line('48═════════════════════════════════════════════╣')
    .line('42═══════════════════════════════════════╣')
    .newline()

    .font('A')
    .text('The quick brown fox jumps over the lazy dog. ')
    .italic()
    .text('The quick brown fox jumps over the lazy dog. ')
    .italic()
    .text('The quick brown fox jumps over the lazy dog. ')
    .bold()
    .text('The quick brown fox jumps over the lazy dog. ')
    .bold()
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox ')
    .size(2, 2)                
    .text('jumps')
    .size(1, 1)
    .text(' over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('€. ')
    .newline()
    .newline()
    .size(2, 2)                
    .text('The quick brown fox jumps over the lazy dog. ')
    .size(1, 1)
    .newline()

encoder
    .align('center').invert().text('Inverted &').invert().align('left').newline()
    .align('center').text('Centered!').align('left').newline()
    .newline()

encoder
    .box(
        { width: encoder.columns - 10, align: 'center', style: 'single', marginLeft: 10 }, 
        'The quick brown fox jumps over the lazy dog'
    )
    .newline()

encoder
    .box(
        { width: encoder.columns - 10, align: 'right', style: 'double' }, 
        (encoder) => encoder
                        .text('The quick brown ')
                        .height(2)
                        .text('fox')
                        .height(1)
                        .text(' jumps over the lazy dog')
    )
    .newline()

    .rule({ style: 'double' })
    .newline()
    .rule({ style: 'single' })
    .newline()
    .align('center')    
    .rule({ style: 'single', width: 10 })
    .align('left')
    .newline()

encoder
    .rule({ style: 'single' })
    .line('ξεσκεπάζω την ψυχοφθόρα βδελυγμία. ξεσκεπάζω την ψυχοφθόρα βδελυγμία. ξεσκεπάζω την ψυχοφθόρα βδελυγμία.')

    .rule({ style: 'single' })
    .line('Я можу їсти скло, і воно мені не зашкодить. Я можу їсти скло, і воно мені не зашкодить.')

    .rule({ style: 'single' })
    .line('くうこうから ホテルまで くるまで １じかんぐらいです。')
    
    .rule({ style: 'single' })
    .line('أنا قادر على أكل الزجاج و هذا لا يؤلمني.')
    
    .rule({ style: 'single' })
    .line('אני יכול לאכול זכוכית וזה לא מזיק לי.')
    
    .rule({ style: 'single' })
    .line('ฉันกินกระจกได้ แต่มันไม่ทำให้ฉันเจ็บ')
    
    .rule({ style: 'single' })
    .line('Pchnąć w tę łódź jeża lub ośm skrzyń fig')
    
    .rule({ style: 'single' })
    .line('Árvíztűrő tükörfúrógép')

    .rule({ style: 'single' })
    .newline();

encoder
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .newline()
    .newline()

    .font('B')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .newline()
    .newline()

    .font('A')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .text('The quick brown fox jumps over the lazy dog. ')
    .newline()
    .newline()

encoder
    .newline()
    .newline()
    .newline()
    .newline()
    .newline()
    .newline()
    .line('How many lines do we need to feed before we cut?')
    .line('8 ----------------------------')
    .line('7 ----------------------------')
    .line('6 ----------------------------')
    .line('5 ----------------------------')
    .line('4 ----------------------------')
    .line('3 ----------------------------')
    .line('2 ----------------------------')
    .line('1 ----------------------------')
    .line('0 Last line, cut below! ------')
    .cut()
    .newline()
    .newline()