(() => {
  const course = window.StudyCourses?.current();
  const invalidCourse = Boolean(window.StudyCourses && !course);
  const plannerEnabled = !invalidCourse && (course?.planner ?? true);
  window.STUDY_CONFIG = Object.freeze({
    mode: 'static', course, invalidCourse, plannerEnabled,
    storageKey: course?.storageKey || 'matzpen:22902:2026-s3:progress:v1',
    courseId: course?.id, offeringId: course?.offeringId,
    learningPilot: plannerEnabled, reportImport: plannerEnabled,
    scaffoldPilot: plannerEnabled, mixedPilot: plannerEnabled,
    reviewPilot: plannerEnabled, recommendationPilot: plannerEnabled
  });
})();
