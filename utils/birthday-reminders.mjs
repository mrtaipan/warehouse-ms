const jakartaDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function getJakartaDateParts(now) {
  const parts = Object.fromEntries(
    jakartaDateFormatter.formatToParts(now).map(({ type, value }) => [type, value])
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  }
}

export function getJakartaTodayDateString(now = new Date()) {
  const { year, month, day } = getJakartaDateParts(now)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function getBirthdayClaimWindow(birthdate, now = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthdate || ''))
  if (!match) return null

  const month = Number(match[2])
  const day = Number(match[3])
  const original = new Date(Date.UTC(Number(match[1]), month - 1, day))
  if (original.getUTCMonth() !== month - 1 || original.getUTCDate() !== day) return null

  const today = getJakartaTodayDateString(now)
  const year = Number(today.slice(0, 4))
  const birthdayInYear = (targetYear) => new Date(Date.UTC(targetYear, month - 1, day))
  let birthday = birthdayInYear(year)
  let windowEnd = new Date(birthday)
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 14)

  if (today < birthday.toISOString().slice(0, 10)) {
    const previousBirthday = birthdayInYear(year - 1)
    const previousEnd = new Date(previousBirthday)
    previousEnd.setUTCDate(previousEnd.getUTCDate() + 14)
    if (today <= previousEnd.toISOString().slice(0, 10)) {
      birthday = previousBirthday
      windowEnd = previousEnd
    }
  }

  const birthdayDate = birthday.toISOString().slice(0, 10)
  const windowEndDate = windowEnd.toISOString().slice(0, 10)
  return {
    birthday: birthdayDate,
    windowEnd: windowEndDate,
    isOpen: today >= birthdayDate && today <= windowEndDate,
  }
}

export function getUpcomingBirthdayOffset(birthdate, now = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthdate || ''))
  if (!match) return null

  const month = Number(match[2])
  const day = Number(match[3])
  const validDate = new Date(Date.UTC(Number(match[1]), month - 1, day))
  if (validDate.getUTCMonth() !== month - 1 || validDate.getUTCDate() !== day) return null

  const today = getJakartaDateParts(now)
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day)
  let birthdayUtc = Date.UTC(today.year, month - 1, day)
  if (birthdayUtc < todayUtc) birthdayUtc = Date.UTC(today.year + 1, month - 1, day)

  return Math.round((birthdayUtc - todayUtc) / 86_400_000)
}
