// Compose the join key used by the in-flight dedupe map.
export const userKey = (form) => `${form.name}|${form.date}|${form.time}|${form.city}`;
