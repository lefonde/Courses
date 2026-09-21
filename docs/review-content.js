/* Gates and source references only: the original question remains in its course PDF. */
(function (root, factory) {
  const content = factory();
  if (typeof module === 'object' && module.exports) module.exports = content;
  if (root) root.StudyReviewContent = content;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const item = (problemId, unlockAfter, sourceId, pages) => ({problemId, unlockAfter, sourceRefs: [{sourceId, pages}]});
  return {version: 1, items: [
    item('m11-q1', ['union-coupons-windows'], 'maman-11', [1]),
    item('m11-q2', ['union-coupons-windows'], 'maman-11', [1]),
    item('m11-q3', ['graphs-entry'], 'maman-11', [2]),
    item('m12-q1', ['permutation-indicators'], 'maman-12', [1]),
    item('m12-q2', ['tails-pairwise'], 'maman-12', [1]),
    item('m12-q3', ['amplification'], 'maman-12', [2]),
    item('m12-q4', ['tails-windows'], 'maman-12', [2]),
    item('m13-q1', ['limited-independence'], 'maman-13', [1]),
    item('m13-q2', ['limited-independence'], 'maman-13', [1]),
    item('m13-q3', ['alteration'], 'maman-13', [2]),
    item('m14-q1', ['linear-constraints'], 'maman-14', [1]),
    item('m14-q2', ['multicut-conditional', 'multicut-smallspace'], 'maman-14', [1]),
    item('m15-q1', ['markov-matrix'], 'maman-15', [1]),
    item('m15-q2', ['markov-reset'], 'maman-15', [1]),
    item('sample-q1', ['official-balls'], 'sample', [1]),
    item('sample-q2', ['official-sat'], 'sample', [1]),
    item('sample-q3', ['official-recurrence'], 'sample', [1])
  ]};
});
