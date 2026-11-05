import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateDocumentSummary,
  calculateRollSummary,
  gradeFromScore,
} from '../app/dashboard/arkline/progress-overview/material-inspection-utils.mjs'

test('grade boundaries are distinct at 20, 30, and 40', () => {
  assert.equal(gradeFromScore(19), 'A')
  assert.equal(gradeFromScore(20), 'B')
  assert.equal(gradeFromScore(29), 'B')
  assert.equal(gradeFromScore(30), 'C')
  assert.equal(gradeFromScore(40), 'C')
  assert.equal(gradeFromScore(41), 'X')
})

test('total points sum every defect even in the same yard', () => {
  const result = calculateRollSummary({
    actualYards: 50,
    actualWidthIn: 60,
    defects: [
      { positionYards: 2, points: 4 },
      { positionYards: 1.7, points: 2 },
      { positionYards: 3, points: 1 },
    ],
  })

  assert.equal(result.totalPoints, 7)
  assert.equal(result.scoredPoints, 7)
  assert.equal(result.pointsPer100SqYd, 9)
  assert.equal(result.grade, 'A')
})

test('document score is weighted by roll area, not average of rounded roll scores', () => {
  const result = calculateDocumentSummary([
    { actualYards: 10, actualWidthIn: 36, defects: [{ positionYards: 1, points: 4 }] },
    { actualYards: 90, actualWidthIn: 36, defects: [] },
  ])

  assert.equal(result.pointsPer100SqYd, 4)
  assert.equal(result.grade, 'A')
})
