import assert from 'node:assert/strict'

import { amortizedMonthlyPayment, remainingBalance } from '@/shared/lib/loan-calculations'

function near(actual: number, expected: number, message: string, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`)
}

// Loan helpers
near(amortizedMonthlyPayment(100000, 6, 360), 599.5505251527569, 'payment on a 30-year 6% loan')
near(remainingBalance(100000, 6, 360, 0), 100000, 'no payments made → full principal')
near(remainingBalance(100000, 6, 360, 12), 98771.98828772324, 'one year into a 30-year 6% loan', 1e-4)
assert.equal(remainingBalance(100000, 6, 360, 360), 0, 'paid off at term')
assert.equal(remainingBalance(100000, 6, 360, 500), 0, 'past term → 0')
near(remainingBalance(12000, 0, 12, 6), 6000, '0% APR pays down in a straight line')
near(remainingBalance(12000, 0, 12, -3), 12000, 'negative months → principal')
assert.equal(remainingBalance(0, 6, 60, 10), 0, 'no principal → 0')
assert.equal(remainingBalance(5000, 6, 0, 0), 0, 'no term → 0')
assert.equal(remainingBalance(10000, 6, 20.5, 21), 0, 'fractional term: past it → 0')
assert.ok(remainingBalance(10000, 6, 20.5, 12) > 0 && remainingBalance(10000, 6, 20.5, 12) < 10000, 'fractional term: mid-way balance in range')

console.log('✅ verify-savings-projection passed')
