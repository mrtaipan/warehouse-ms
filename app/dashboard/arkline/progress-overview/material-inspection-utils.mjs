export function gradeFromScore(score) {
  if (score < 20) return 'A'
  if (score < 30) return 'B'
  if (score <= 40) return 'C'
  return 'X'
}

export function calculateRollSummary(roll) {
  const yards = Number(roll?.actualYards || 0)
  const widthIn = Number(roll?.actualWidthIn || 0)
  let totalPoints = 0

  for (const defect of roll?.defects || []) {
    const position = Number(defect.positionYards)
    const points = Number(defect.points)
    if (!(position > 0) || !Number.isInteger(points) || points < 1 || points > 4) continue
    totalPoints += points
  }

  const scoredPoints = totalPoints
  const areaSqYd = yards > 0 && widthIn > 0 ? yards * widthIn / 36 : 0
  const pointsPer100SqYd = areaSqYd > 0 ? Math.ceil(totalPoints * 100 / areaSqYd) : null

  return {
    totalPoints,
    scoredPoints,
    areaSqYd,
    pointsPer100SqYd,
    grade: pointsPer100SqYd === null ? null : gradeFromScore(pointsPer100SqYd),
  }
}

export function calculateDocumentSummary(rolls) {
  const summaries = (rolls || []).map(calculateRollSummary)
  const totalPoints = summaries.reduce((sum, row) => sum + row.totalPoints, 0)
  const scoredPoints = summaries.reduce((sum, row) => sum + row.scoredPoints, 0)
  const areaSqYd = summaries.reduce((sum, row) => sum + row.areaSqYd, 0)
  const pointsPer100SqYd = areaSqYd > 0 ? Math.ceil(totalPoints * 100 / areaSqYd) : null

  return {
    totalPoints,
    scoredPoints,
    areaSqYd,
    pointsPer100SqYd,
    grade: pointsPer100SqYd === null ? null : gradeFromScore(pointsPer100SqYd),
  }
}
