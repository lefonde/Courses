/* Tutor preference is transient UI state, separate from learning progress. */
window.StudyTeaching = (() => {
  'use strict';
  let selected = 'guided', preview = null;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const policy = () => window.StudyTeachingPolicy;
  function setMode(value) {
    selected = policy().normalizeMode(value);
    document.querySelectorAll('[data-teaching-mode]').forEach(input => { input.checked = input.value === selected; });
    if (preview && document.getElementById('prompt-text') === preview.element) {
      const text = preview.getText();
      if (preview.element.tagName === 'TEXTAREA') preview.element.value = text;
      else preview.element.textContent = text;
    }
    return selected;
  }
  function selector() {
    return `<fieldset class="teaching-modes"><legend>איך ללמוד בשיחה הזאת?</legend>${policy().modes.map(item => `<label class="teaching-mode"><input type="radio" name="teaching-mode" data-teaching-mode value="${item.id}" ${selected === item.id ? 'checked' : ''}><span><strong>${escape(item.label)}</strong><small>${escape(item.description)}</small></span></label>`).join('')}</fieldset>`;
  }
  function bindRefresh(getText) {
    const element = document.getElementById('prompt-text');
    preview = element ? {element, getText} : null;
  }
  document.addEventListener('change', event => {
    if (event.target?.hasAttribute?.('data-teaching-mode')) setMode(event.target.value);
  });
  return {mode: () => selected, setMode, selector, bindRefresh};
})();
