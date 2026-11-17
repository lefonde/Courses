/* Course setup only. Registration does not approve educational content. */
(function (root, factory) {
  const manifests = factory();
  if (typeof module === 'object' && module.exports) module.exports = manifests;
  else root.StudyCourseManifests = manifests;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const manifests = [
    {
      id: 'random-algorithms',
      offeringId: '2026-s3',
      offeringKind: 'course-offering',
      title: 'אלגוריתמים אקראיים',
      language: 'he',
      direction: 'rtl',
      defaultHash: '#overview',
      storageKey: 'matzpen:22902:2026-s3:progress:v1',
      sourceDatabase: 'study-compass-course-sources-v1',
      planner: true,
      features: ['overview', 'exam-map', 'exam-problem', 'reference', 'reference-entry', 'lessons', 'lesson', 'schedule', 'questions', 'flashcards', 'readiness', 'library'],
      data: {
        curriculum: './data/curriculum.json',
        schedule: './data/schedule.json',
        flashcards: './data/flashcards.json',
        predictions: './data/predictions.json',
        previousSchedule: './data/history/september-2026-schedule.json',
        examDashboard: './data/exam-dashboard.json',
        examProblemPages: './data/exam-problem-pages.json'
      },
      glossaryFiles: [
        './data/reference-sat.json',
        './data/reference-walk.json',
        './data/reference-probability.json',
        './data/reference-walk-imported.json',
        './data/reference-isolated-imported.json',
        './data/reference-fingerprinting-imported.json',
        './data/reference-gni-imported.json',
        './data/reference-balls-bins-imported.json',
        './data/reference-cover-time-imported.json',
        './data/reference-coin-imported.json',
        './data/reference-vandermonde-imported.json',
        './data/reference-kwise-imported.json',
        './data/reference-links.json'
      ],
      examSummary: {date: '2026-11-23', minutes: 150, questionCount: 3, weights: [40, 40, 20]}
    },
    {
      id: 'advanced-algorithms',
      offeringId: 'exam-prep',
      // A setup namespace, not an assertion about the teaching cohort or exam date.
      offeringKind: 'setup',
      title: 'אלגוריתמים מתקדמים',
      language: 'he',
      direction: 'rtl',
      defaultHash: '#exam-map',
      storageKey: 'erdos:advanced-algorithms:exam-prep:progress:v1',
      sourceDatabase: 'study-erdos-advanced-algorithms-exam-prep-sources-v1',
      planner: false,
      features: ['exam-map', 'library', 'readiness'],
      data: {
        curriculum: './courses/advanced-algorithms/curriculum.json',
        schedule: null,
        flashcards: null,
        predictions: null,
        previousSchedule: null,
        examDashboard: './courses/advanced-algorithms/exam-prep.json',
        examProblemPages: null
      },
      glossaryFiles: [],
      examSummary: null
    }
  ];
  function freeze(value) {
    if (value && typeof value === 'object') {
      for (const item of Object.values(value)) freeze(item);
      Object.freeze(value);
    }
    return value;
  }
  return freeze(manifests);
});
