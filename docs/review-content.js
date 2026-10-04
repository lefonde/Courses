/* Gates and source references only: the original question remains in its course PDF. */
(function (root, factory) {
  const content = factory();
  if (typeof module === 'object' && module.exports) module.exports = content;
  if (root) root.StudyReviewContent = content;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const item = (problemId, unlockAfter, sourceId, pages) => ({problemId, unlockAfter, sourceRefs: [{sourceId, pages}]});
  return {version: 1, items: [
    item('m11-q1', ['nov26-2026-10-10'], 'maman-11', [1]),
    item('m11-q2', ['nov26-2026-10-10'], 'maman-11', [1]),
    item('m11-q3', ['nov26-2026-10-17'], 'maman-11', [2]),
    item('m12-q1', ['nov26-2026-10-09'], 'maman-12', [1]),
    item('m12-q2', ['nov26-2026-10-07'], 'maman-12', [1]),
    item('m12-q3', ['nov26-2026-10-12'], 'maman-12', [2]),
    item('m12-q4', ['nov26-2026-10-14'], 'maman-12', [2]),
    item('m13-q1', ['nov26-2026-10-23'], 'maman-13', [1]),
    item('m13-q2', ['nov26-2026-10-23'], 'maman-13', [1]),
    item('m13-q3', ['nov26-2026-10-24'], 'maman-13', [2]),
    item('m14-q1', ['nov26-2026-10-28'], 'maman-14', [1]),
    item('m14-q2', ['nov26-2026-10-30'], 'maman-14', [1]),
    item('m15-q1', ['nov26-2026-11-02'], 'maman-15', [1]),
    item('m15-q2', ['nov26-2026-11-06'], 'maman-15', [1]),
    item('sample-q1', ['nov26-2026-10-16'], 'sample', [1]),
    item('sample-q2', ['nov26-2026-10-26'], 'sample', [1]),
    item('sample-q3', ['nov26-2026-11-07'], 'sample', [1])
  ]};
});
