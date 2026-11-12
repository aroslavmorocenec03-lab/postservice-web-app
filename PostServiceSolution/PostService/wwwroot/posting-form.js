export const deliveryLabels = {
  Department: "У відділення",
  Courier: "Кур’єр",
  ExpressCourier: "Експрес-кур’єр"
};

export const fields = [
  { name: "from", label: "Відправник", required: true },
  { name: "to", label: "Отримувач", required: true },
  { name: "content", label: "Вміст", required: true },
  { name: "deliveryType", label: "Тип доставки", required: true },
  { name: "weight", label: "Вага, кг", number: true, required: true },
  { name: "width", label: "Ширина, см", number: true, required: true },
  { name: "height", label: "Висота, см", number: true, required: true },
  { name: "depth", label: "Глибина, см", number: true, required: true },
  { name: "value", label: "Оголошена цінність, грн", number: true },
  { name: "price", label: "Вартість, грн", number: true },
  { name: "description", label: "Опис" }
];

function decimal(raw) {
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/.test(raw)) return NaN;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(Math.fround(value)) ? value : NaN;
}

export function validatePosting(values, editing) {
  const errors = {};
  const data = {};
  for (const field of fields) {
    const { name, required, number } = field;
    if (name === "price" && !editing) continue;
    const raw = String(values.get(name) ?? "").trim();
    if (name === "deliveryType") {
      if (!Object.hasOwn(deliveryLabels, raw)) errors[name] = "Оберіть тип доставки.";
      else data[name] = raw;
    } else if (number) {
      if (!raw && !required && name !== "price") {
        data[name] = null;
        continue;
      }
      const parsed = decimal(raw);
      if (!Number.isFinite(parsed)) errors[name] = "Введіть коректне число.";
      else if (required && Math.fround(parsed) <= 0) errors[name] = "Значення має бути більшим за 0.";
      else if (name === "weight" && Math.fround(parsed) > 1000000) errors[name] = "Вага має бути не більшою за 1 000 000 кг.";
      else if (!required && parsed < 0) errors[name] = "Значення має бути не меншим за 0.";
      else data[name] = parsed;
    } else if (required && !raw) {
      errors[name] = { from: "Укажіть відправника.", to: "Укажіть отримувача.", content: "Укажіть вміст." }[name];
    } else {
      data[name] = name === "description" ? raw || null : raw;
    }
  }
  return { data, errors };
}
