const names = [
  "Amina Diallo",
  "Lucas Martin",
  "Sofia Benali",
  "Noah Bernard",
  "Emma Leroy",
  "Hugo Petit",
  "Lina Moreau",
  "Adam Roux",
  "Chloé Fontaine",
  "Yanis Girard",
  "Jade Mercier",
  "Louis Dupont",
  "Maya Fournier",
  "Arthur Lambert",
  "Inès Robert",
  "Gabriel Simon",
  "Léa Michel",
  "Rayan André",
  "Manon Lefèvre",
  "Eliott Garcia",
]

export const users = names.map((name, index) => ({
  id: `USR-${String(index + 1).padStart(3, "0")}`,
  name,
  username: name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(" ", "."),
  email: `${name.split(" ")[0].toLowerCase()}@example.edu`,
  registeredAt: `2025-${String((index % 10) + 1).padStart(2, "0")}-${String((index % 24) + 1).padStart(2, "0")}`,
  lastActivity: index % 5 === 0 ? "2 days ago" : `${index + 2} min ago`,
  status: ["Active", "Active", "Active", "Pending verification", "Inactive"][
    index % 5
  ],
  role: index === 0 ? "Moderator" : "Member",
  journals: 4 + (index % 9),
  memories: 2 + (index % 7),
  media: 1 + (index % 6),
  moods: 8 + (index % 12),
  goals: 2 + (index % 5),
}))

export const journalEntries = Array.from({ length: 30 }, (_, i) => ({
  id: `JRN-${1001 + i}`,
  ownerId: users[i % users.length].id,
  title: i % 7 === 0 ? "Restricted — reported entry" : `Journal entry ${i + 1}`,
  createdAt: `2025-${String((i % 10) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`,
  tags: i % 4,
  favorite: i % 5 === 0,
  aiStatus: i % 9 === 0 ? "Failed" : "Completed",
  reportStatus: i % 7 === 0 ? "Pending" : "None",
}))

export const media = Array.from({ length: 30 }, (_, i) => ({
  id: `MED-${2001 + i}`,
  ownerId: users[i % users.length].id,
  title: `${["Campus photo", "Voice reflection", "Travel clip"][i % 3]} ${i + 1}`,
  type: ["Image", "Audio", "Video"][i % 3],
  size: `${(1.2 + i * 0.17).toFixed(1)} MB`,
  uploadedAt: `2025-10-${String((i % 27) + 1).padStart(2, "0")}`,
  status: i % 11 === 0 ? "Failed" : i % 8 === 0 ? "Processing" : "Completed",
  linkedTo: i % 2 ? `Memory MEM-${3000 + (i % 25)}` : `Journal JRN-${1001 + i}`,
}))

export const memories = Array.from({ length: 25 }, (_, i) => ({
  id: `MEM-${3000 + i}`,
  ownerId: users[i % users.length].id,
  title:
    i % 8 === 0
      ? "Restricted preview"
      : `${["A day with family", "Campus milestone", "Weekend journey"][i % 3]} ${i + 1}`,
  eventDate: `2025-${String((i % 10) + 1).padStart(2, "0")}-${String((i % 26) + 1).padStart(2, "0")}`,
  category: ["Famille", "Études", "Voyages", "Amis"][i % 4],
  importance: ["Normal", "Important", "Favorite"][i % 3],
  mediaCount: i % 5,
  createdAt: `2025-10-${String((i % 25) + 1).padStart(2, "0")}`,
  reportStatus: i % 8 === 0 ? "Pending" : "None",
  aiStatus: i % 6 === 0 ? "Queued" : "Completed",
}))

export const aiJobs = Array.from({ length: 24 }, (_, i) => ({
  id: `AI-${4001 + i}`,
  feature: [
    "Journal summarization",
    "Sentiment analysis",
    "Speech transcription",
    "Image description",
    "Memory categorization",
    "Tag suggestions",
    "Natural-language search",
    "Goals suggestions",
  ][i % 8],
  module: [
    "Journal",
    "Journal",
    "Multimedia",
    "Multimedia",
    "Memories",
    "Memories",
    "Memories",
    "Goals",
  ][i % 8],
  createdAt: `2025-10-${String((i % 24) + 1).padStart(2, "0")} ${String(8 + (i % 10)).padStart(2, "0")}:20`,
  status: i % 9 === 0 ? "Failed" : i % 7 === 0 ? "Processing" : "Completed",
  duration: i % 9 === 0 ? "—" : `${(1.1 + i * 0.13).toFixed(1)}s`,
  provider: "Simulated provider",
  error: i % 9 === 0 ? "PROCESSING_TIMEOUT" : "—",
}))

export const reports = Array.from({ length: 10 }, (_, i) => ({
  id: `RPT-${5001 + i}`,
  type: ["Journal entry", "Memory", "Multimedia metadata", "User profile"][
    i % 4
  ],
  reference:
    i % 4 === 0
      ? `JRN-${1001 + i}`
      : i % 4 === 1
        ? `MEM-${3000 + i}`
        : i % 4 === 2
          ? `MED-${2001 + i}`
          : users[i].id,
  reporter: `User ${String(i + 3).padStart(3, "0")}`,
  reason: [
    "Privacy concern",
    "Inappropriate content",
    "Copyright concern",
    "Spam",
  ][i % 4],
  reportedAt: `2025-10-${String(20 + (i % 8)).padStart(2, "0")}`,
  status: ["Pending Review", "Under Review", "Resolved", "Dismissed"][i % 4],
  moderator: i % 4 === 0 ? "Unassigned" : "Amina Diallo",
  explanation: "The reporter requested an authorized review of this record.",
}))

export const categories = [
  "Famille",
  "Amis",
  "Voyages",
  "Études",
  "Travail",
  "Événements personnels",
  "Célébrations",
  "Autres",
  "Bien-être",
  "Réussites",
].map((name, i) => ({
  id: `CAT-${i + 1}`,
  name,
  description: `Shared taxonomy for ${name.toLowerCase()}.`,
  usage: 8 + i * 7,
  status: i === 9 ? "Inactive" : "Active",
  createdAt: `2025-0${(i % 9) + 1}-12`,
}))

export const notifications = Array.from({ length: 15 }, (_, i) => ({
  id: `NOT-${i + 1}`,
  type: [
    "Moderation",
    "AI failure",
    "Media failure",
    "Milestone",
    "Configuration",
  ][i % 5],
  title: [
    "New moderation report",
    "AI job needs attention",
    "Media processing failed",
    "1,000 activity milestone",
    "Configuration review recommended",
  ][i % 5],
  message: "Operational notification with no sensitive personal content.",
  read: i > 4,
  createdAt: `${i + 2} hours ago`,
  href: [
    "/admin/content",
    "/admin/ai-monitoring",
    "/admin/multimedia",
    "/admin/dashboard",
    "/admin/settings",
  ][i % 5],
}))

export const auditLogs = Array.from({ length: 30 }, (_, i) => ({
  id: `AUD-${6001 + i}`,
  timestamp: `2025-10-${String(28 - (i % 20)).padStart(2, "0")} ${String(9 + (i % 8)).padStart(2, "0")}:15`,
  admin: i % 3 ? "Amina Diallo" : "System",
  action: [
    "Administrator login",
    "Moderation decision",
    "AI job retry",
    "Category modification",
    "User role change",
  ][i % 5],
  target: ["Session", "Report", "AI Job", "Category", "User"][i % 5],
  reference: [
    "ADM-001",
    `RPT-${5001 + (i % 10)}`,
    `AI-${4001 + (i % 20)}`,
    `CAT-${1 + (i % 10)}`,
    users[i % 20].id,
  ][i % 5],
  reason:
    i % 5 === 0
      ? "Verified administrator access"
      : "Authorized operational action",
  result: "Success",
}))

export const activityTrend = [
  { day: "Mon", users: 218, memories: 56, media: 42, ai: 128, failures: 4 },
  { day: "Tue", users: 242, memories: 62, media: 51, ai: 146, failures: 6 },
  { day: "Wed", users: 231, memories: 71, media: 47, ai: 155, failures: 5 },
  { day: "Thu", users: 278, memories: 68, media: 59, ai: 172, failures: 7 },
  { day: "Fri", users: 291, memories: 84, media: 64, ai: 188, failures: 4 },
  { day: "Sat", users: 254, memories: 78, media: 57, ai: 164, failures: 3 },
  { day: "Sun", users: 267, memories: 91, media: 69, ai: 196, failures: 5 },
]

export const roles = [
  { name: "Super Admin", members: 2, permissions: [1, 1, 1, 1, 1, 1, 1, 1, 1] },
  {
    name: "Administrator",
    members: 4,
    permissions: [1, 1, 0, 1, 1, 1, 1, 1, 1],
  },
  { name: "Moderator", members: 7, permissions: [1, 0, 0, 1, 0, 1, 0, 0, 0] },
  {
    name: "Support Agent",
    members: 9,
    permissions: [1, 0, 0, 0, 0, 1, 0, 0, 0],
  },
]
