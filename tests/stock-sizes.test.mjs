import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveUploadSize, selectStockRowsForSize, stockSizesMatch } from '../app/dashboard/storage/stock-sizes.js'

test('keeps explicit alphabetic/numeric size aliases from an upload', () => {
  for (const value of ['XS/90', 'S/95', 'M/100', 'L/105', 'XL/110']) {
    const [letter, numeric] = value.split('/')
    assert.equal(resolveUploadSize(value), value)
    assert.ok(stockSizesMatch(numeric, value))
    assert.ok(stockSizesMatch(letter, value))
    assert.ok(stockSizesMatch(value, letter))
  }
  assert.equal(resolveUploadSize('Black, S / 95'), 'S/95')
})

test('retry matches numeric stock using the original variation of an old line', () => {
  assert.ok(stockSizesMatch('95', 'S', 'S/95'))
  assert.ok(stockSizesMatch('100', 'M', 'M/100'))
  assert.equal(stockSizesMatch('100', 'S', 'S/95'), false)
  assert.equal(stockSizesMatch('95', 'M', 'S/95'), false)
})

test('does not invent letter to number conversions or split pants dimensions', () => {
  assert.equal(stockSizesMatch('95', 'S'), false)
  assert.equal(stockSizesMatch('32', '32/30'), false)
  assert.equal(resolveUploadSize('32x30'), '32X30')
  assert.equal(stockSizesMatch('XL', 'L'), false)
  assert.ok(stockSizesMatch(null, '-'))
  assert.equal(stockSizesMatch('-', 'S/95'), false)
  assert.equal(resolveUploadSize('BLACK / XL'), 'XL')
})

test('keeps the complete uploaded size instead of cutting its suffix', () => {
  for (const [input, expected] of [
    ['LTall', 'LTALL'],
    ['L Tall', 'LTALL'],
    ['MTall', 'MTALL'],
    ['XLTall', 'XLTALL'],
    ['XXLTall', 'XXLTALL'],
    ['4XLTall', '4XLTALL'],
    ['38S', '38S'],
    ['Black, LTall', 'LTALL'],
  ]) {
    assert.equal(resolveUploadSize(input), expected)
    assert.equal(stockSizesMatch(expected, expected), true)
    assert.equal(stockSizesMatch('L', expected), false)
  }
})

test('NS and dash are the same unsized stock, not a wildcard', () => {
  assert.equal(stockSizesMatch('NS', '-'), true)
  assert.equal(stockSizesMatch('-', 'NS'), true)
  assert.equal(stockSizesMatch('NS', 'M'), false)
  assert.equal(stockSizesMatch('S', '-'), false)
})

test('repeated X and numeric XL sizes match, including Tall, without mixing adjacent sizes', () => {
  for (const [numeric, repeated] of [
    ['2XL', 'XXL'],
    ['3XL', 'XXXL'],
    ['4XL', 'XXXXL'],
    ['3XLTALL', 'XXXLTALL'],
    ['4XLTALL', 'XXXXLTALL'],
  ]) {
    assert.ok(stockSizesMatch(numeric, repeated))
    assert.ok(stockSizesMatch(repeated, numeric))
  }
  assert.equal(stockSizesMatch('3XL', '4XL'), false)
  assert.equal(stockSizesMatch('3XL', '3XLTALL'), false)
  assert.equal(stockSizesMatch('LTALL', 'XLTALL'), false)
  assert.deepEqual(selectStockRowsForSize([
    { id: 1, size: '3XL' },
    { id: 2, size: 'XXXL' },
    { id: 3, size: '4XL' },
    { id: 4, size: 'XXXLTALL' },
  ], 'XXXL').map((row) => row.id), [1, 2])
})
