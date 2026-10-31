import { describe, expect, it } from 'vitest'

import { ordersToCsv } from './csv'

describe('ordersToCsv', () => {
  it('writes a header and one line per order', () => {
    expect(
      ordersToCsv([
        { player: 'Ana Reyes', design: 'Home', size: 'M', quantity: 1 },
        { player: 'Ben Cruz', design: 'Away', size: 'L', quantity: 2 },
      ]),
    ).toBe('Player,Design,Size,Quantity\nAna Reyes,Home,M,1\nBen Cruz,Away,L,2\n')
  })

  it('quotes commas and doubles embedded quotes', () => {
    expect(
      ordersToCsv([{ player: 'Reyes, Ana', design: 'Home "Classic"', size: 'M', quantity: 1 }]),
    ).toBe('Player,Design,Size,Quantity\n"Reyes, Ana","Home ""Classic""",M,1\n')
  })

  it('quotes newlines so a line break cannot split a row', () => {
    expect(ordersToCsv([{ player: 'Ana\nReyes', design: 'Home', size: 'S', quantity: 1 }])).toBe(
      'Player,Design,Size,Quantity\n"Ana\nReyes",Home,S,1\n',
    )
  })

  it('returns just the header for no orders', () => {
    expect(ordersToCsv([])).toBe('Player,Design,Size,Quantity\n')
  })
})
