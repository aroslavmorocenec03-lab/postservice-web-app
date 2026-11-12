import { postingsApi } from "./api.js";
import { fields, deliveryLabels, validatePosting } from "./posting-form.js";

const main = document.querySelector("main");
const money = new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH" });
const date = new Intl.DateTimeFormat("uk-UA", { dateStyle: "short" });
let navigation;
let selectedId;
let nextNotice;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function link(label, href, style = "") {
  const node = element("a", label, `btn ${style}`);
  node.href = href;
  return node;
}

function button(label, style = "") {
  const node = element("button", label, `btn ${style}`);
  node.type = "button";
  return node;
}

function notice(message, error = false) {
  const node = element("p", message, error ? "notice error" : "notice");
  node.setAttribute("role", error ? "alert" : "status");
  return node;
}

function panel(title, text, action) {
  const node = element("section", undefined, "panel");
  node.append(element("h2", title), element("p", text, "muted"));
  if (action) node.append(action);
  return node;
}

function home() {
  const intro = element("div", undefined, "intro");
  intro.append(element("h2", "Усі відправлення — в одному місці"),
    element("p", "Переглядайте дані та керуйте поштовими відправленнями.", "muted"));
  const cards = element("div", undefined, "home-cards");
  cards.append(panel("Поштові відправлення", "Список, деталі, створення, редагування та видалення.", link("Відкрити список", "#/list", "primary")),
    panel("Про програму", "Призначення застосунку та доступні операції.", link("Дізнатися більше", "#/about")));
  main.append(intro, cards);
}

function about() {
  main.append(panel("Облік поштових відправлень",
    "PostService допомагає операторові вести облік відправлень. У списку можна переглянути маршрут, вміст і вартість, відкрити деталі або змінити запис. Дані зберігаються на сервері.",
    link("До відправлень", "#/list", "primary")));
}

function shipmentDate(value) {
  const parsed = new Date(value);
  return value && Number.isFinite(parsed.valueOf()) ? date.format(parsed) : "—";
}

function shipmentPrice(value) {
  return typeof value === "number" ? money.format(value) : "—";
}

function showLoadFailure(error, loading, signal) {
  if (signal.aborted) return;
  const retry = button("Спробувати ще раз");
  retry.addEventListener("click", route);
  loading.replaceWith(notice(error.message, true), retry, link("До списку", "#/list"));
}

async function confirmRemoval(record, signal, opener) {
  const dialog = element("dialog");
  dialog.setAttribute("aria-labelledby", "delete-heading");
  const heading = element("h2", "Видалити відправлення?");
  heading.id = "delete-heading";
  const actions = element("div", undefined, "actions");
  const cancel = button("Скасувати");
  const remove = button("Видалити", "danger");
  const errorArea = element("div");
  actions.append(cancel, remove);
  dialog.append(heading, element("p", `№ ${record.id} · ${record.from} → ${record.to}`), errorArea, actions);
  main.append(dialog);
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (opener.isConnected) opener.focus();
  });
  cancel.addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", event => { if (remove.disabled) event.preventDefault(); });
  remove.addEventListener("click", async () => {
    if (remove.disabled) return;
    remove.disabled = cancel.disabled = true;
    errorArea.replaceChildren();
    try {
      await postingsApi.remove(record.id, signal);
      if (signal.aborted) return;
      nextNotice = `Відправлення № ${record.id} видалено.`;
      selectedId = undefined;
      dialog.close();
      route();
    } catch (error) {
      if (signal.aborted) return;
      if (error.status === 404) {
        nextNotice = "Відправлення вже відсутнє. Список оновлено.";
        selectedId = undefined;
        dialog.close();
        route();
      } else {
        errorArea.replaceChildren(notice(error.message, true));
      }
    } finally {
      remove.disabled = cancel.disabled = false;
    }
  });
  dialog.showModal();
  cancel.focus();
}

async function list(signal) {
  const loading = element("p", "Завантаження відправлень…", "muted");
  loading.setAttribute("role", "status");
  main.append(loading);
  let records;
  try {
    records = await postingsApi.list(signal);
  } catch (error) {
    showLoadFailure(error, loading, signal);
    return;
  }
  if (signal.aborted) return;
  loading.remove();
  if (nextNotice) {
    main.append(notice(nextNotice));
    nextNotice = undefined;
  }
  const actions = element("div", undefined, "actions list-actions");
  const details = button("Деталі");
  const edit = button("Редагувати");
  const remove = button("Видалити", "danger");
  actions.append(link("+ Нове відправлення", "#/new", "primary"), details, edit, remove);
  const selection = element("p", undefined, "selection");
  selection.setAttribute("role", "status");
  main.append(actions, selection);
  const entries = new Map();
  const tableWrap = element("div", undefined, "table-wrap");
  const table = element("table");
  table.setAttribute("aria-label", "Поштові відправлення");
  const header = table.createTHead().insertRow();
  for (const title of ["№", "Маршрут", "Вміст", "Вартість", "Створено"]) {
    const th = element("th", title);
    th.scope = "col";
    header.append(th);
  }
  const rows = table.createTBody();
  const cards = element("div", undefined, "mobile-records");
  let current;
  function select(id) {
    current = entries.get(id)?.record;
    selectedId = current?.id;
    selection.textContent = current ? `Вибрано відправлення № ${current.id}` : "Виберіть відправлення зі списку";
    for (const control of [details, edit, remove]) control.disabled = !current;
    for (const { record, row, pick, card } of entries.values()) {
      const active = record.id === selectedId;
      row.dataset.selected = card.dataset.selected = String(active);
      pick.setAttribute("aria-pressed", String(active));
      card.setAttribute("aria-pressed", String(active));
    }
  }
  for (const record of records) {
    const row = rows.insertRow();
    const pick = button(String(record.id), "row-pick");
    pick.className = "row-pick";
    pick.setAttribute("aria-label", `Вибрати відправлення № ${record.id}`);
    row.insertCell().append(pick);
    const shipmentRoute = `${record.from} → ${record.to}`;
    for (const value of [shipmentRoute, record.content, shipmentPrice(record.price), shipmentDate(record.createdAt)]) {
      row.insertCell().textContent = value;
    }
    row.addEventListener("click", () => select(record.id));
    const card = button("", "");
    card.className = "record-card";
    card.append(element("strong", `№ ${record.id} · ${shipmentRoute}`),
      element("span", record.content),
      element("small", `${shipmentPrice(record.price)} · ${shipmentDate(record.createdAt)}`));
    card.addEventListener("click", () => select(record.id));
    cards.append(card);
    entries.set(record.id, { record, row, pick, card });
  }
  tableWrap.append(table);
  if (records.length) main.append(tableWrap, cards, element("p", `Кількість відправлень: ${records.length}`, "muted"));
  else main.append(panel("Відправлень ще немає", "Створіть перший запис кнопкою «Нове відправлення»."));
  if (!records.length) selection.hidden = true;
  select(selectedId);
  details.addEventListener("click", () => { if (current) location.hash = `/details/${current.id}`; });
  edit.addEventListener("click", () => { if (current) location.hash = `/edit/${current.id}`; });
  remove.addEventListener("click", () => { if (current) confirmRemoval(current, signal, remove); });
}

async function details(id, signal) {
  const loading = element("p", "Завантаження відправлення…", "muted");
  main.append(loading);
  try {
    const record = await postingsApi.get(id, signal);
    if (signal.aborted) return;
    loading.remove();
    const dl = element("dl", undefined, "details");
    const pairs = [
      ["Номер", record.id],
      ...fields.map(({ name, label }) => [label, name === "deliveryType" ? deliveryLabels[record[name]] :
        ["value", "price"].includes(name) ? shipmentPrice(record[name]) : record[name]]),
      ["Створено", shipmentDate(record.createdAt)]
    ];
    for (const [label, value] of pairs) {
      const row = element("div");
      row.append(element("dt", label), element("dd", value ?? "—"));
      dl.append(row);
    }
    main.append(dl, link("До списку", "#/list"), " ", link("Редагувати", `#/edit/${id}`, "primary"));
  } catch (error) {
    showLoadFailure(error, loading, signal);
  }
}

async function postingForm(id, signal) {
  const editing = id !== undefined;
  let record = {};
  if (editing) {
    const loading = element("p", "Завантаження даних…", "muted");
    main.append(loading);
    try {
      record = await postingsApi.get(id, signal);
    } catch (error) {
      showLoadFailure(error, loading, signal);
      return;
    }
    if (signal.aborted) return;
    loading.remove();
  }
  main.append(element("p", "* Обов’язкові поля", "muted"));
  const form = element("form");
  form.noValidate = true;
  const banner = element("div");
  const formFields = element("div", undefined, "fields");
  const controls = new Map();
  const errors = new Map();
  form.append(banner, formFields);
  for (const { name, label, number, required } of fields) {
    const row = element("div", undefined, "field");
    const caption = element("label", label + (required ? " *" : ""));
    const input = element(name === "deliveryType" ? "select" : name === "description" ? "textarea" : "input");
    input.name = name;
    input.id = `field-${name}`;
    caption.htmlFor = input.id;
    input.required = required || (name === "price" && editing);
    if (number) input.inputMode = "decimal";
    if (name === "description") input.rows = 2;
    if (name === "deliveryType") {
      const empty = element("option", "Оберіть тип доставки");
      empty.value = "";
      input.append(empty);
      for (const [value, display] of Object.entries(deliveryLabels)) {
        const option = element("option", display);
        option.value = value;
        input.append(option);
      }
    }
    const hint = name === "price" && !editing ? "Розраховується автоматично" : "";
    input.value = record[name] ?? "";
    if (hint) {
      input.readOnly = true;
      input.placeholder = "—";
    }
    const note = element("span", hint, "field-note");
    note.id = `note-${name}`;
    input.setAttribute("aria-describedby", note.id);
    controls.set(name, { input, note, hint });
    row.append(caption, input, note);
    formFields.append(row);
    input.addEventListener("input", () => {
      if (errors.delete(name)) {
        showErrors();
      } else if (!errors.size) banner.replaceChildren();
    });
  }
  function showErrors(message) {
    for (const [name, { input, note, hint }] of controls) {
      const error = errors.get(name);
      if (error) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
      note.textContent = error ? `! ${error}` : hint;
      note.classList.toggle("invalid", Boolean(error));
    }
    banner.replaceChildren();
    if (message || errors.size) {
      banner.append(notice(message ?? `Перевірте позначені поля. Помилок: ${errors.size}.`, true));
    }
  }
  if (!editing) form.append(element("p", "Остаточну вартість визначає сервіс після збереження відправлення.", "muted form-hint"));
  const actions = element("div", undefined, "actions");
  const save = button("Зберегти", "primary");
  save.type = "submit";
  const cancel = button("Скасувати");
  cancel.addEventListener("click", () => { location.hash = "/list"; });
  actions.append(save, cancel);
  form.append(actions);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (save.disabled) return;
    const result = validatePosting(new FormData(form), editing);
    errors.clear();
    for (const [name, message] of Object.entries(result.errors)) errors.set(name, message);
    showErrors();
    if (errors.size) {
      controls.get(errors.keys().next().value).input.focus();
      return;
    }
    save.disabled = cancel.disabled = true;
    save.textContent = "Збереження…";
    for (const { input } of controls.values()) input.disabled = true;
    try {
      const saved = editing ? await postingsApi.update(id, result.data, signal) : await postingsApi.create(result.data, signal);
      if (signal.aborted) return;
      selectedId = saved.id;
      nextNotice = editing ? `Відправлення № ${saved.id} оновлено.` : `Відправлення № ${saved.id} створено.`;
      location.hash = "/list";
    } catch (error) {
      if (signal.aborted) return;
      for (const [key, messages] of Object.entries(error.fields ?? {})) {
        const name = key.charAt(0).toLowerCase() + key.slice(1);
        if (controls.has(name)) errors.set(name, Array.isArray(messages) ? messages.join(" ") : String(messages));
      }
      showErrors(error.message);
      banner.scrollIntoView({ block: "nearest" });
    } finally {
      for (const { input } of controls.values()) input.disabled = false;
      save.textContent = "Зберегти";
      save.disabled = cancel.disabled = false;
    }
  });
  main.append(form);
}

function route() {
  navigation?.abort();
  navigation = new AbortController();
  const signal = navigation.signal;
  const hash = location.hash.slice(1) || "/";
  const recordRoute = /^\/(edit|details)\/([1-9]\d*)$/.exec(hash);
  const id = recordRoute ? Number(recordRoute[2]) : undefined;
  let title, section, render;
  if (hash === "/") {
    [title, section, render] = ["Головна", "home", home];
  } else if (hash === "/about") {
    [title, section, render] = ["Про програму", "about", about];
  } else if (hash === "/list") {
    [title, section, render] = ["Список поштових відправлень", "list", () => list(signal)];
  } else if (hash === "/new") {
    [title, section, render] = ["Нове відправлення", "list", () => postingForm(undefined, signal)];
  } else if (recordRoute && id <= 2147483647) {
    section = "list";
    if (recordRoute[1] === "edit") {
      title = `Редагування відправлення № ${id}`;
      render = () => postingForm(id, signal);
    } else {
      title = `Деталі відправлення № ${id}`;
      render = () => details(id, signal);
    }
  } else {
    title = "Сторінку не знайдено";
    render = () => main.append(link("На головну", "#/", "primary"));
  }
  for (const node of document.querySelectorAll("[data-nav]")) {
    if (node.dataset.nav === section) node.setAttribute("aria-current", "page");
    else node.removeAttribute("aria-current");
  }
  document.title = `${title} — PostService`;
  main.replaceChildren(element("h1", title));
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
  render();
}

document.querySelector(".skip").addEventListener("click", event => {
  event.preventDefault();
  main.focus();
});
window.addEventListener("hashchange", route);
route();
