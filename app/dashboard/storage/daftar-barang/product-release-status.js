export function getProductReleaseState(states) {
  if (!states || states.size === 0) return ''
  if (states.has('partial') || (states.has('draft') && states.has('released'))) return 'partial'
  return states.has('released') ? 'released' : 'draft'
}

export function getDisplayedReleaseCount(releaseState, releaseCount) {
  if (releaseState !== 'released') return 0
  return Math.max(1, Number(releaseCount) || 0)
}

export function matchesProductReleaseFilter(releaseState, filter) {
  return filter === 'all' || releaseState === filter
}
