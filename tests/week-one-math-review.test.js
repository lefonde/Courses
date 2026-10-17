'use strict';

// Independent finite checks for the source and answer-key review. These are
// counterexample/edge-case witnesses, not proofs of the asymptotic statements.
const test = require('node:test');
const assert = require('node:assert/strict');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
const mean = xs => xs.reduce((sum, x) => sum + x, 0) / xs.length;
const variance = xs => mean(xs.map(x => (x - mean(xs)) ** 2));

function permutations(values) {
  if (!values.length) return [[]];
  return values.flatMap((value, index) => permutations(values.filter((_, i) => i !== index)).map(rest => [value, ...rest]));
}

test('new card and coin examples demonstrate two distinct forms of dependence', () => {
  const cards = ['red', 'blue', 'green', 'yellow'];
  const draws = cards.flatMap(first => cards.filter(second => second !== first).map(second => [first, second]));
  assert.equal(draws.length, 12);
  const firstRed = draws.filter(([first]) => first === 'red');
  close(firstRed.length / draws.length, 1 / 4);
  close(draws.filter(([, second]) => second === 'blue').length / draws.length, 1 / 4);
  close(draws.filter(([first, second]) => first === 'red' && second === 'blue').length / draws.length, 1 / 12);
  close(firstRed.filter(([, second]) => second === 'blue').length / firstRed.length, 1 / 3);

  const coins = [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => [a, b, Number(a !== b)]);
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
    for (const a of [0, 1]) for (const b of [0, 1]) {
      close(coins.filter(row => row[i] === a && row[j] === b).length / coins.length, 1 / 4);
    }
  }
  assert.equal(coins.filter(row => row.every(value => value === 1)).length, 0);
  close([0, 1, 2].reduce((product, i) => product * coins.filter(row => row[i] === 1).length / coins.length, 1), 1 / 8);
});

test('fixed-point and transposition moments retain their different small-n exceptions', () => {
  for (let n = 1; n <= 6; n++) {
    const outcomes = permutations(Array.from({length: n}, (_, i) => i));
    const fixed = outcomes.map(p => p.filter((value, i) => value === i).length);
    const transpositions = outcomes.map(p => p.filter((value, i) => value > i && p[value] === i).length);
    close(mean(fixed), 1);
    close(variance(fixed), n === 1 ? 0 : 1);
    close(mean(transpositions), n === 1 ? 0 : 1 / 2);
    close(variance(transpositions), n === 1 ? 0 : n < 4 ? 1 / 4 : 1 / 2);
    // The source assumes n >= 7; the given variance 1/2 is valid there.
    if (n >= 4) close(mean(transpositions.map(y => y * (y - 1))), 1 / 4);
  }
});

test('permutation joint events distinguish overlapping and disjoint transpositions', () => {
  for (let n = 4; n <= 6; n++) {
    const outcomes = permutations(Array.from({length: n}, (_, i) => i));
    const probability = condition => outcomes.filter(condition).length / outcomes.length;
    const swap01 = p => p[0] === 1 && p[1] === 0;
    const swap02 = p => p[0] === 2 && p[2] === 0;
    const swap23 = p => p[2] === 3 && p[3] === 2;
    close(probability(swap01), 1 / (n * (n - 1)));
    close(probability(p => swap01(p) && swap02(p)), 0);
    close(probability(p => swap01(p) && swap23(p)), 1 / (n * (n - 1) * (n - 2) * (n - 3)));
    assert.notEqual(probability(p => p[0] === 0 && p[1] === 1), 1 / n ** 2);
    assert.ok(probability(swap01) * probability(swap02) > 0);
  }
});

test('zero covariance is not independence for general random variables', () => {
  const x = [-1, 0, 1], y = x.map(value => value ** 2);
  close(mean(x.map((value, i) => value * y[i])) - mean(x) * mean(y), 0);
  close(variance(x.map((value, i) => value + y[i])), variance(x) + variance(y));
  // X=0 forces Y=0, although P(Y=0)=1/3.
  assert.equal(y[x.indexOf(0)], 0);
  close(y.filter(value => value === 0).length / y.length, 1 / 3);
});

test('pairwise-independent hashing has real overloads and is not a binomial model', () => {
  for (const n of [11, 13, 17]) {
    // Uniform affine hashes over F_n: h(i)=a*i+b, with all (a,b) equally likely.
    const outcomes = [];
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      outcomes.push(Array.from({length: n}, (_, i) => (a * i + b) % n));
    }
    // Every pair of distinct ball choices is jointly uniform.
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const pairCounts = Array(n * n).fill(0);
      for (const outcome of outcomes) pairCounts[outcome[i] * n + outcome[j]]++;
      assert.ok(pairCounts.every(count => count === 1));
    }
    const loads = outcomes.map(outcome => outcome.filter(bin => bin === 0).length);
    close(mean(loads), 1);
    close(variance(loads), 1 - 1 / n);
    const allInBinZero = loads.filter(load => load === n).length / outcomes.length;
    close(allInBinZero, 1 / n ** 2);
    assert.notEqual(allInBinZero, (1 / n) ** n);
    const maximums = outcomes.map(outcome => Math.max(...Array.from({length: n}, (_, bin) => outcome.filter(value => value === bin).length)));
    const failure = maximums.filter(maximum => maximum > 3 * Math.sqrt(n)).length / outcomes.length;
    close(failure, 1 / n);
    assert.ok(failure > 0 && failure < 1 / 2);
    for (const delta of [1 / 4, 1 / 2]) {
      const threshold = 1 + Math.sqrt(n / delta);
      assert.ok(maximums.filter(maximum => maximum >= threshold).length / outcomes.length <= delta);
    }
  }
});

function couponCompletionProbability(n, purchases) {
  let distribution = Array(n + 1).fill(0);
  distribution[0] = 1;
  for (let purchase = 0; purchase < purchases; purchase++) {
    const next = Array(n + 1).fill(0);
    for (let collected = 0; collected <= n; collected++) {
      next[collected] += distribution[collected] * collected / n;
      if (collected < n) next[collected + 1] += distribution[collected] * (n - collected) / n;
    }
    distribution = next;
  }
  return distribution[n];
}

test('coupon union bound is a sufficient guarantee and does not identify a minimum', () => {
  for (let n = 2; n <= 8; n++) for (let purchases = 1; purchases <= 30; purchases++) {
    const failure = 1 - couponCompletionProbability(n, purchases);
    const union = n * (1 - 1 / n) ** purchases;
    assert.ok(failure <= union + 1e-12);
    assert.ok(union <= n * Math.exp(-purchases / n) + 1e-12);
  }
  const sufficient = Math.ceil(100 * Math.log(2000));
  assert.equal(sufficient, 761);
  assert.ok(100 * Math.exp(-sufficient / 100) <= 0.05);
  assert.ok(couponCompletionProbability(100, sufficient) >= 0.95);
  // A smaller value can meet the actual probability target even when the
  // exponential upper bound cannot certify it.
  assert.ok(100 * Math.exp(-(sufficient - 1) / 100) > 0.05);
  assert.ok(couponCompletionProbability(100, sufficient - 1) >= 0.95);
});

test('run bounds handle overlap, integer lengths and both rounding conventions', () => {
  for (let n = 1; n <= 12; n++) {
    const longestRuns = Array.from({length: 2 ** n}, (_, bits) => {
      let longest = 0, current = 0;
      for (let i = 0; i < n; i++) {
        current = bits >> i & 1 ? current + 1 : 0;
        longest = Math.max(longest, current);
      }
      return longest;
    });
    for (let length = 1; length <= n + 2; length++) {
      const actual = longestRuns.filter(longest => longest >= length).length / longestRuns.length;
      const bound = Math.max(0, n - length + 1) * 2 ** (-length);
      assert.ok(actual <= bound + 1e-12);
      if (length > n) assert.equal(actual, 0);
    }
  }
  for (const c of [1.25, 1.5, 2, 3]) for (let n = 2; n <= 1000; n++) {
    const realLength = c * Math.log2(n);
    assert.ok(n * 2 ** (-Math.ceil(realLength)) <= n ** (1 - c) + 1e-12);
    assert.ok(n * 2 ** (-Math.floor(realLength)) <= 2 * n ** (1 - c) + 1e-12);
  }
});
