import { initialMemories } from "../data/mockData"

const KEY = "mindlog_memories"
const read = () =>
  JSON.parse(localStorage.getItem(KEY) || "null") || initialMemories
const write = (items) => (
  localStorage.setItem(KEY, JSON.stringify(items)), items
)
const wait = (value, ms = 180) =>
  new Promise((r) => setTimeout(() => r(value), ms))

export const memoryService = {
  getMemories: () => wait(read()),
  getMemoryById: (id) => wait(read().find((x) => x.id === String(id))),
  createMemory: (data) => {
    const item = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    write([item, ...read()])
    return wait(item)
  },
  updateMemory: (id, data) => {
    const item = {
      ...read().find((x) => x.id === id),
      ...data,
      updatedAt: new Date().toISOString(),
    }
    write(read().map((x) => (x.id === id ? item : x)))
    return wait(item)
  },
  deleteMemory: (id) => wait(write(read().filter((x) => x.id !== id))),
  searchMemories: (query) => {
    const q = query
      .toLowerCase()
      .replace("vacances", "voyages")
      .replace("université", "études")
    return wait(
      read().filter((x) =>
        [x.title, x.description, x.location, x.category, ...x.tags]
          .join(" ")
          .toLowerCase()
          .includes(q),
      ),
    )
  },
  getMemoriesByPeriod: (start, end) =>
    wait(read().filter((x) => x.eventDate >= start && x.eventDate <= end)),
  getSimilarMemories: (id) => {
    const all = read(),
      current = all.find((x) => x.id === id)
    return wait(
      all
        .filter(
          (x) =>
            x.id !== id &&
            (x.category === current?.category ||
              x.tags.some((t) => current?.tags.includes(t))),
        )
        .slice(0, 4),
    )
  },
  suggestMemoryCategory: (text) =>
    wait(
      /campus|étude|examen|projet/i.test(text)
        ? "Études"
        : /plage|voyage|mer/i.test(text)
          ? "Voyages"
          : "Événements personnels",
      650,
    ),
  suggestMemoryTags: (text) =>
    wait(
      [
        ...new Set(
          (text.toLowerCase().match(/[a-zà-ÿ]{5,}/g) || []).slice(0, 4),
        ),
      ],
      650,
    ),
}
