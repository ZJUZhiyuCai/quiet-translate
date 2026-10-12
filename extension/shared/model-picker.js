import {t} from './i18n.js';

// Editable combobox: manual IDs always work, including IDs absent from a catalog.
// Only the settings page creates this component; article pages load none of it.
export function createModelPicker(root, onSelect = () => {}) {
  const input = root.querySelector('input'), toggle = root.querySelector('button'), list = root.querySelector('[role=listbox]');
  let models = [], shown = [], active = -1, filter = '';
  const close = () => {
    list.hidden = true; input.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant'); active = -1;
  };
  function highlight(index) {
    active = index;
    for (const [i, option] of [...list.querySelectorAll('[role=option]')].entries()) option.setAttribute('aria-selected', String(i === active));
    const option = list.querySelectorAll('[role=option]')[active];
    if (option) { input.setAttribute('aria-activedescendant', option.id); option.scrollIntoView({block: 'nearest'}); }
    else input.removeAttribute('aria-activedescendant');
  }
  function render() {
    const query = filter.toLowerCase().trim();
    shown = models.filter(model => !query || (model.id + ' ' + model.name).toLowerCase().includes(query));
    const fragment = document.createDocumentFragment();
    for (const [index, model] of shown.entries()) {
      const option = document.createElement('div'); option.id = 'model-option-' + index; option.dataset.index = String(index);
      option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false');
      const id = document.createElement('span'); id.textContent = model.id; option.append(id);
      if (model.name) { const name = document.createElement('small'); name.textContent = model.name; option.append(name); }
      fragment.append(option);
    }
    if (!shown.length) { const empty = document.createElement('p'); empty.textContent = t('没有匹配项，仍可直接使用手填的模型 ID。'); fragment.append(empty); }
    list.replaceChildren(fragment); active = -1; input.removeAttribute('aria-activedescendant'); list.scrollTop = 0;
  }
  function position() {
    // Keep the list above the fixed save bar, also in short windows.
    const bounds = input.getBoundingClientRect(), bar = document.querySelector('.save-bar')?.getBoundingClientRect();
    const bottom = Math.min(innerHeight - 12, bar?.top ?? innerHeight - 12), below = bottom - bounds.bottom - 6, above = bounds.top - 12;
    const upward = below < 180 && above > below; root.dataset.upward = String(upward);
    list.style.maxHeight = Math.max(56, Math.min(260, upward ? above : below)) + 'px';
  }
  function open(all = true) {
    if (!models.length) return;
    filter = all ? '' : input.value; render();
    list.hidden = false; input.setAttribute('aria-expanded', 'true'); toggle.setAttribute('aria-expanded', 'true');
    position();
  }
  function choose(index) {
    if (!shown[index]) return;
    input.value = shown[index].id; onSelect(input.value); close(); input.focus({preventScroll: true});
    input.dispatchEvent(new Event('input', {bubbles: true})); input.dispatchEvent(new Event('change', {bubbles: true}));
    close();
  }
  toggle.addEventListener('click', () => { const wasOpen = !list.hidden; input.focus({preventScroll: true}); if (wasOpen) close(); else open(); });
  input.addEventListener('input', event => { if (models.length && !event.isComposing) open(false); });
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (['ArrowDown', 'ArrowUp'].includes(event.key) && models.length) {
      event.preventDefault();
      if (list.hidden) { open(); highlight(event.key === 'ArrowDown' ? 0 : shown.length - 1); }
      else if (shown.length) highlight(active < 0 ? event.key === 'ArrowDown' ? 0 : shown.length - 1 : (active + (event.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length);
    } else if (event.key === 'Enter' && !list.hidden && active >= 0) { event.preventDefault(); choose(active); }
    else if (event.key === 'Escape' && !list.hidden) { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === 'Tab') close();
  });
  list.addEventListener('pointerdown', event => event.preventDefault());
  list.addEventListener('click', event => { const option = event.target.closest('[role=option]'); if (option) choose(Number(option.dataset.index)); });
  document.addEventListener('pointerdown', event => { if (!root.contains(event.target)) close(); });
  root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) close(); });
  // Resize can arrive between ArrowDown and Enter. Keep the highlighted choice
  // so Enter still selects it instead of submitting a partial search query.
  window.addEventListener('resize', () => { if (!list.hidden) position(); });
  // No remote text is interpreted as markup or offered as a navigation target.
  return {close, setModels(next) { models = next; toggle.disabled = !models.length; close(); list.replaceChildren(); }};
}
