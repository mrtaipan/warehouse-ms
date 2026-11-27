import test from 'node:test'
import assert from 'node:assert/strict'
import { DELIVERY_ACCESS_CONFIGURED, DELIVERY_PERMISSION_ITEMS, getDeliveryAccess } from '../utils/delivery-access.mjs'

test('legacy Delivery Report access retains every existing module and summary section', () => {
  assert.ok(Object.values(getDeliveryAccess(['delivery_report.view'])).every(Boolean))
})

test('configured roles can hide only Order Chart without losing other summary sections', () => {
  const codes = DELIVERY_PERMISSION_ITEMS.map(({ code }) => code).filter((code) => code !== 'delivery_report.summary.order_chart.view')
  const access = getDeliveryAccess(['delivery_report.view', DELIVERY_ACCESS_CONFIGURED, ...codes])
  assert.equal(access['summary.order_chart'], false)
  assert.equal(access['summary.matrix'], true)
  assert.equal(access['summary.metrics'], true)
  assert.equal(access['summary.courier'], true)
  assert.equal(access.orders, true)
})

test('module access cannot be bypassed by child section grants', () => {
  assert.ok(Object.values(getDeliveryAccess(['delivery_report.summary.order_chart.view'])).every((value) => !value))
  const access = getDeliveryAccess(['delivery_report.view', DELIVERY_ACCESS_CONFIGURED, 'delivery_report.summary.order_chart.view'])
  assert.equal(access['summary.order_chart'], false)
  assert.equal(access.orders, false)
})

test('all disabled remains disabled after save while admin retains full access', () => {
  assert.ok(Object.values(getDeliveryAccess(['delivery_report.view', DELIVERY_ACCESS_CONFIGURED])).every((value) => !value))
  assert.ok(Object.values(getDeliveryAccess([], true)).every(Boolean))
})
