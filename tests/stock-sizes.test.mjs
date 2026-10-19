import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveUploadSize, stockSizesMatch } from '../app/dashboard/storage/stock-sizes.js'

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

test('NS and dash are the same unsized stock, not a wildcard', () => {
  assert.equal(stockSizesMatch('NS', '-'), true)
  assert.equal(stockSizesMatch('-', 'NS'), true)
  assert.equal(stockSizesMatch('NS', 'M'), false)
  assert.equal(stockSizesMatch('S', '-'), false)
})
