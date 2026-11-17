/* Resolve a course before config/storage boot. This module never reads or writes learner data. */
(function (root, factory) {
  const commonJS = typeof module === 'object' && module.exports;
  const api = factory(commonJS ? require('./course-manifests.js') : root.StudyCourseManifests);
  if (commonJS) module.exports = api;
  else root.StudyCourses = api.createContext(root.location ? root.location.search : '');
})(typeof window === 'undefined' ? globalThis : window, function (manifests) {
  'use strict';
  if (!Array.isArray(manifests) || !manifests.length) throw new Error('Course manifests must load before course context.');
  const defaultId = 'random-algorithms';
  const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const failure = (code, message) => ({course: null, error: Object.freeze({code, message})});
  const find = (id, offeringId) => manifests.find(course => course.id === id && (offeringId === undefined || course.offeringId === offeringId));

  function resolve(search = '') {
    if (typeof search !== 'string' || /[\u0000-\u0020\u007f#]/.test(search)) {
      return failure('invalid_query', 'כתובת הקורס אינה תקינה. אפשר לבחור קורס מחדש.');
    }
    // URLSearchParams tolerates malformed escapes; reject them instead of guessing an identity.
    try { decodeURIComponent(search.replace(/\+/g, ' ')); }
    catch { return failure('invalid_query', 'כתובת הקורס אינה תקינה. אפשר לבחור קורס מחדש.'); }
    const params = new URLSearchParams(search);
    for (const key of params.keys()) {
      if (['course', 'offering'].includes(key.toLowerCase()) && !['course', 'offering'].includes(key)) {
        return failure('invalid_query', 'כתובת הקורס אינה תקינה. אפשר לבחור קורס מחדש.');
      }
    }
    if (params.getAll('course').length > 1 || params.getAll('offering').length > 1) {
      return failure('duplicate_context', 'הכתובת מציינת יותר מקורס או מחזור אחד. אפשר לבחור קורס מחדש.');
    }
    if (!params.has('course')) {
      if (params.has('offering')) return failure('missing_course', 'חסר קורס בכתובת. אפשר לבחור קורס מחדש.');
      return {course: find(defaultId), error: null};
    }
    const id = params.get('course'), offeringId = params.has('offering') ? params.get('offering') : undefined;
    if (!slug.test(id) || (offeringId !== undefined && !slug.test(offeringId))) {
      return failure('invalid_context', 'זיהוי הקורס או המחזור אינו תקין. אפשר לבחור קורס מחדש.');
    }
    if (!find(id)) return failure('unknown_course', 'הקורס שבכתובת אינו נמצא באתר. אפשר לבחור קורס אחר.');
    const course = find(id, offeringId);
    if (!course) return failure('unknown_offering', 'המחזור שבכתובת אינו נמצא באתר. אפשר לבחור קורס מחדש.');
    return {course, error: null};
  }

  function href(courseId, hash = '#exam-map', offeringId) {
    const course = find(courseId, offeringId);
    if (!course) throw new TypeError('Unknown course or offering.');
    if (typeof hash !== 'string' || !/^#[A-Za-z0-9_/-]*$/.test(hash)) throw new TypeError('Expected a local route fragment.');
    return './?course=' + encodeURIComponent(course.id) + '&offering=' + encodeURIComponent(course.offeringId) + hash;
  }

  function createContext(search = '') {
    // Course identity stays fixed for this page lifetime. Switching requires a complete reload.
    const resolved = resolve(search);
    return Object.freeze({
      current: () => resolved.course,
      error: () => resolved.error,
      resolve,
      all: () => manifests,
      href,
      dataPath: key => resolved.course && own(resolved.course.data, key) ? resolved.course.data[key] : null,
      supports: page => typeof page === 'string' && !!resolved.course && resolved.course.features.includes(page.replace(/^#/, '').split('/')[0])
    });
  }
  return Object.freeze({...createContext(), createContext});
});
