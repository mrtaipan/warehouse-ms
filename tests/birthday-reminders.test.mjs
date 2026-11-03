import assert from 'node:assert/strict'
import test from 'node:test'
import { getBirthdayClaimWindow, getJakartaTodayDateString, getUpcomingBirthdayOffset } from '../utils/birthday-reminders.mjs'

test('birthday reminders run from H-3 through the birthday in Jakarta', () => {
  const birthday = '2000-10-20'

  assert.equal(getUpcomingBirthdayOffset(birthday, new Date('2026-10-16T17:00:00Z')), 3)
  assert.equal(getUpcomingBirthdayOffset(birthday, new Date('2026-10-18T12:00:00Z')), 2)
  assert.equal(getUpcomingBirthdayOffset(birthday, new Date('2026-10-19T17:00:00Z')), 0)
  assert.equal(getUpcomingBirthdayOffset(birthday, new Date('2026-10-20T17:00:00Z')), 364)
})

test('Jakarta date changes at local midnight, not UTC midnight', () => {
  assert.equal(getJakartaTodayDateString(new Date('2026-10-19T16:59:59Z')), '2026-10-19')
  assert.equal(getJakartaTodayDateString(new Date('2026-10-19T17:00:00Z')), '2026-10-20')
})

test('invalid or missing birthdates do not create reminders', () => {
  assert.equal(getUpcomingBirthdayOffset(null), null)
  assert.equal(getUpcomingBirthdayOffset('2026-02-30'), null)
  assert.equal(getBirthdayClaimWindow('2026-02-30'), null)
})

test('birthday gift is claimable through H+14 in Jakarta', () => {
  const birthdate = '2000-10-20'
  assert.deepEqual(getBirthdayClaimWindow(birthdate, new Date('2026-10-19T17:00:00Z')), {
    birthday: '2026-10-20',
    windowEnd: '2026-11-03',
    isOpen: true,
  })
  assert.equal(getBirthdayClaimWindow(birthdate, new Date('2026-11-03T16:59:59Z')).isOpen, true)
  assert.equal(getBirthdayClaimWindow(birthdate, new Date('2026-11-03T17:00:00Z')).isOpen, false)
})

test('birthday gift window stays open across New Year', () => {
  assert.deepEqual(getBirthdayClaimWindow('2000-12-28', new Date('2027-01-05T12:00:00Z')), {
    birthday: '2026-12-28',
    windowEnd: '2027-01-11',
    isOpen: true,
  })
})
