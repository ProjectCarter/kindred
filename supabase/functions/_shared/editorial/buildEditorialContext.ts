import type {
  BuildEditorialContextInput,
  EditorialNote,
  EditionEditorialContext,
  SectionEditorialNotes,
} from "./types.ts";

function note(
  code: string,
  label: string,
  category: EditorialNote["category"],
  weight = 1
): EditorialNote {
  return { code, label, category, weight };
}

function holidayNameOn(date: Date): string | null {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month === 1 && day === 1) return "New Year's Day";
  if (month === 2 && day === 14) return "Valentine's Day";
  if (month === 3 && day === 17) return "St. Patrick's Day";
  if (month === 7 && day === 4) return "Independence Day";
  if (month === 10 && day === 31) return "Halloween";
  if (month === 12 && day === 25) return "Christmas";
  if (month === 12 && day === 31) return "New Year's Eve";
  return null;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function parseEditionDate(editionDate: string, fallback: Date): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(editionDate)) {
    const [y, m, d] = editionDate.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return fallback;
}

function inferLocalEventNotes(
  event: { name: string; startDateTime: string; venue: string },
  interests: string[]
): EditorialNote[] {
  const notes: EditorialNote[] = [];
  const hay = `${event.name} ${event.startDateTime} ${event.venue}`.toLowerCase();

  if (/\b(sat|sun|saturday|sunday|weekend)\b/i.test(hay)) {
    notes.push(note("weekend_activity", "Weekend activity", "lifestyle", 2));
  }
  if (
    /\b([5-9]|1[0-1])\s*(:\d{2})?\s*p\.?m\.?\b/i.test(hay) ||
    /\bevening\b/i.test(hay)
  ) {
    notes.push(note("evening_activity", "Evening activity", "lifestyle", 2));
  }
  if (
    /\b(park|outdoor|hike|beach|garden|farmers|trail|picnic|open.?air)\b/i.test(
      hay
    )
  ) {
    notes.push(note("outdoor", "Outdoor", "lifestyle", 2));
  }
  if (
    /\b(family|kids|children|all ages|family.?friendly)\b/i.test(hay)
  ) {
    notes.push(note("family_friendly", "Family friendly", "lifestyle", 2));
  }

  for (const interest of interests) {
    const token = interest.toLowerCase().split(/[^a-z0-9]+/)[0];
    if (token && token.length > 3 && hay.includes(token)) {
      notes.push(
        note(
          "matches_interest",
          `Matches user interests (${interest})`,
          "interest",
          3
        )
      );
      break;
    }
  }

  if (!notes.length) {
    notes.push(note("local_listing", "Local listing for the edition", "local", 1));
  }

  return notes;
}

function lookingAheadNotes(input: BuildEditorialContextInput): EditorialNote[] {
  const notes: EditorialNote[] = [];
  const now = input.now ?? new Date();
  const editionDay = parseEditionDate(input.editionDate, now);
  const tomorrow = addDays(editionDay, 1);
  const holidayTomorrow = holidayNameOn(tomorrow);
  const tomorrowIso = formatDateKey(tomorrow);

  const w = input.weather;
  if (
    w?.todayHighC != null &&
    w?.tomorrowHighC != null &&
    Math.abs(w.tomorrowHighC - w.todayHighC) >= 4
  ) {
    notes.push(
      note(
        "weather_change",
        w.tomorrowHighC > w.todayHighC
          ? "Warmer weather tomorrow"
          : "Cooler weather tomorrow",
        "weather",
        3
      )
    );
  }

  if (holidayTomorrow) {
    notes.push(
      note(
        "holiday_tomorrow",
        `Holiday tomorrow (${holidayTomorrow})`,
        "calendar",
        4
      )
    );
  }

  // Soft traffic heuristic around Monday mornings / holiday eves — editorial, not traffic API.
  const tomorrowWeekday = tomorrow.getDay();
  if (tomorrowWeekday === 1) {
    notes.push(
      note(
        "busy_traffic_expected",
        "Busy traffic expected (Monday morning)",
        "traffic",
        2
      )
    );
  }

  const eventsTomorrow = eventsOnTomorrow(
    input.localEvents ?? [],
    tomorrowIso
  );
  if (eventsTomorrow.length) {
    notes.push(
      note(
        "major_local_event_tomorrow",
        `Local event tomorrow (${eventsTomorrow[0].name})`,
        "event",
        3
      )
    );
  }

  if (!notes.length) {
    notes.push(
      note("forecast_outlook", "Tomorrow’s practical outlook", "weather", 1)
    );
  }

  return notes;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function eventsOnTomorrow(
  events: Array<{ name: string; startDateTime: string; venue?: string }>,
  tomorrowIso: string
): Array<{ name: string; startDateTime: string; venue?: string }> {
  return events.filter((e) => {
    if (/\b(tomorrow|tmw)\b/i.test(e.startDateTime)) return true;
    if (e.startDateTime.includes(tomorrowIso)) return true;
    return false;
  });
}

/**
 * Grounding facts for the Looking Ahead writer — the paper’s closing glance at tomorrow.
 * Uses the same intelligence as editorial notes, with enough detail to write a specific close.
 */
export function buildLookingAheadGrounding(input: {
  editionDate: string;
  now?: Date;
  city: string | null;
  tempUnit: string;
  tomorrowHighLabel: string | null;
  tomorrowLowLabel: string | null;
  todayHighC: number | null;
  tomorrowHighC: number | null;
  localEvents?: Array<{ name: string; startDateTime: string; venue?: string }>;
}): string {
  const now = input.now ?? new Date();
  const editionDay = parseEditionDate(input.editionDate, now);
  const tomorrow = addDays(editionDay, 1);
  const tomorrowIso = formatDateKey(tomorrow);
  const holiday = holidayNameOn(tomorrow);
  const facts: string[] = [];

  if (holiday) {
    facts.push(`Holiday tomorrow: ${holiday}.`);
  }

  const eventsTomorrow = eventsOnTomorrow(input.localEvents ?? [], tomorrowIso);
  for (const event of eventsTomorrow.slice(0, 2)) {
    const venue = event.venue?.trim();
    facts.push(
      venue
        ? `Local event tomorrow: ${event.name} at ${venue}.`
        : `Local event tomorrow: ${event.name}.`
    );
  }

  if (
    input.todayHighC != null &&
    input.tomorrowHighC != null &&
    Math.abs(input.tomorrowHighC - input.todayHighC) >= 4
  ) {
    facts.push(
      input.tomorrowHighC > input.todayHighC
        ? "Weather shift: noticeably warmer tomorrow than today."
        : "Weather shift: noticeably cooler tomorrow than today."
    );
  }

  if (tomorrow.getDay() === 1) {
    facts.push("Calendar note: Monday morning — expect a busier start to the week.");
  }

  if (input.tomorrowHighLabel || input.tomorrowLowLabel) {
    facts.push(
      `Tomorrow’s forecast in ${input.city ?? "your area"}: high ${input.tomorrowHighLabel ?? "—"}, low ${input.tomorrowLowLabel ?? "—"}. Temperature unit: ${input.tempUnit}.`
    );
  }

  if (!facts.length) {
    facts.push("Tomorrow’s practical outlook — keep the note brief and useful.");
  }

  return [
    "Looking Ahead grounding (use only these facts; do not invent):",
    ...facts.map((f, i) => `${i + 1}. ${f}`),
  ].join("\n");
}

function mapStoryReasonCode(code: string): EditorialNote["category"] {
  if (code.includes("breaking")) return "breaking";
  if (code.includes("interest") || code.includes("followed")) return "interest";
  if (code.includes("local")) return "local";
  if (code.includes("feature")) return "feature";
  if (code.includes("quality") || code.includes("national")) return "editorial";
  return "editorial";
}

function buildEditorBrief(ctx: EditionEditorialContext): string {
  const lines: string[] = [
    `Edition ${ctx.editionDate} — editorial brief (internal).`,
    `Place: ${ctx.location.city ?? "unspecified"}.`,
    `Interests: ${ctx.profile.interests.join(", ") || "none"}.`,
  ];

  for (const section of ctx.sections) {
    const top = section.notes
      .slice()
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
      .slice(0, 3)
      .map((n) => n.label);
    lines.push(`${section.sectionType}: ${top.join("; ") || "present"}`);
    for (const item of section.items ?? []) {
      const why = item.notes
        .slice(0, 2)
        .map((n) => n.label)
        .join("; ");
      lines.push(`  - ${item.title}${why ? ` — ${why}` : ""}`);
    }
  }

  const s = ctx.signals;
  lines.push(
    `Signals: breaking=${s.hasBreakingNews}; localEvents=${s.hasLocalEvents}; weatherChange=${s.weatherChange}; holidayTomorrow=${s.holidayTomorrow ?? "none"}; sourceDiversity=${s.sourceDiversity ?? false}; topicDiversity=${s.topicDiversity ?? false}; geoBalance=${s.geoBalance ?? false}.`
  );

  return lines.join("\n");
}

/**
 * Assemble invisible editorial intelligence for an edition.
 * Does not write newspaper copy — only structured editor notes.
 */
export function buildEditionEditorialContext(
  input: BuildEditorialContextInput
): EditionEditorialContext {
  const now = input.now ?? new Date();
  const editionDay = parseEditionDate(input.editionDate, now);
  const tomorrow = addDays(editionDay, 1);
  const holidayTomorrow = holidayNameOn(tomorrow);
  const interests = input.interests ?? [];
  const followedTopics = input.followedTopics ?? [];
  const favoriteSources = input.favoriteSources ?? [];
  const skippedTopics = input.skippedTopics ?? [];
  const sections: SectionEditorialNotes[] = [];

  sections.push({
    sectionType: "greeting",
    notes: [
      note("masthead", "Opens the morning edition", "greeting", 1),
      note("date_anchor", "Anchors the reader in today’s date", "calendar", 1),
    ],
  });

  if (input.weather) {
    sections.push({
      sectionType: "weather",
      notes: [
        note("daily_conditions", "Practical weather for the day ahead", "weather", 2),
        ...(input.weather.todayHighC != null
          ? [
              note(
                "temperature_range",
                "Includes today’s high and low",
                "weather",
                1
              ),
            ]
          : []),
      ],
    });
  }

  if (input.frontPage?.stories?.length) {
    const storyItems = input.frontPage.stories.map((story) => {
      const notes: EditorialNote[] = [
        note(
          `role_${story.role}`,
          story.role === "breaking"
            ? "Breaking News"
            : story.role === "interest"
            ? "Because it matches the reader’s interests"
            : story.role === "local"
            ? "Local relevance"
            : story.role === "feature"
            ? "Editorial feature for balance"
            : story.role === "national"
            ? "Editorial importance (national/world)"
            : `Front-page role: ${story.role}`,
          story.role === "breaking"
            ? "breaking"
            : story.role === "interest"
            ? "interest"
            : story.role === "local"
            ? "local"
            : story.role === "feature"
            ? "feature"
            : "editorial",
          4
        ),
        ...story.reasons
          .filter((r) => !r.code.startsWith("role_"))
          .slice(0, 4)
          .map((r) =>
            note(r.code, r.label, mapStoryReasonCode(r.code), r.weight)
          ),
      ];
      return {
        id: story.id,
        title: story.title,
        role: story.role,
        summary: (story.description ?? "").trim(),
        dek: story.dek ?? null,
        body: Array.isArray(story.body)
          ? story.body.filter((p) => typeof p === "string" && p.trim())
          : undefined,
        desk:
          story.desk && typeof story.desk === "object"
            ? story.desk
            : null,
        source: story.source,
        url: story.url ?? null,
        imageUrl: story.imageUrl ?? null,
        publishedAt: story.publishedAt ?? null,
        notes,
      };
    });

    const sectionNotes: EditorialNote[] = [
      note("curated_front_page", "Intentionally balanced front page", "editorial", 3),
    ];
    if (storyItems.some((s) => s.role === "breaking")) {
      sectionNotes.push(note("includes_breaking", "Breaking News", "breaking", 4));
    }
    if (storyItems.some((s) => s.role === "interest")) {
      sectionNotes.push(
        note("includes_interest", "Because the user follows their interests", "interest", 3)
      );
    }
    if (storyItems.some((s) => s.role === "local")) {
      sectionNotes.push(note("includes_local", "Local relevance", "local", 3));
    }

    const composition = input.frontPage.composition;
    if (composition) {
      for (const label of composition.editorNotes) {
        sectionNotes.push(
          note(
            "composition_note",
            label,
            "editorial",
            2
          )
        );
      }
      if (composition.uniqueSources >= 3) {
        sectionNotes.push(
          note("source_diversity", "Varied publishers across the slate", "editorial", 3)
        );
      }
      if (composition.hasLocal && composition.hasNationalOrWorld) {
        sectionNotes.push(
          note("geo_balance", "Local and national/world balance", "editorial", 3)
        );
      }
    }

    const decisions = input.frontPage.editorialDecisions as {
      editorNotes?: string[];
      policy?: { modeLabel?: string };
    } | null;
    if (decisions?.policy?.modeLabel) {
      sectionNotes.push(
        note("edition_mode", decisions.policy.modeLabel, "editorial", 3)
      );
    }
    for (const label of decisions?.editorNotes ?? []) {
      sectionNotes.push(note("editor_judgment", label, "editorial", 2));
    }

    sections.push({
      sectionType: "top_stories",
      notes: sectionNotes,
      items: storyItems,
    });
  }

  if (input.localEvents?.length) {
    sections.push({
      sectionType: "local_events",
      notes: [
        note("local_calendar", "Nearby things worth knowing about", "local", 3),
        ...(input.localEvents.some((e) =>
          /\b(sat|sun|saturday|sunday|weekend)\b/i.test(e.startDateTime)
        )
          ? [note("weekend_activity", "Weekend activity", "lifestyle", 2)]
          : []),
      ],
      items: input.localEvents.map((event) => ({
        title: event.name,
        notes: inferLocalEventNotes(event, interests),
      })),
    });
  }

  if (input.onThisDay) {
    sections.push({
      sectionType: "today_in_history",
      notes: [
        note("historical_anchor", "A true event from this calendar day", "history", 2),
        note(
          "year_mark",
          `From the year ${input.onThisDay.year}`,
          "history",
          1
        ),
      ],
    });
  }

  if (input.weather?.tomorrowHighC != null || input.weather?.tomorrowLowC != null) {
    sections.push({
      sectionType: "looking_ahead",
      notes: lookingAheadNotes(input),
    });
  }

  if (input.discovery?.picks?.length) {
    sections.push({
      sectionType: "discovery",
      notes: [
        note(
          "discovery_desk",
          "Editorial recommendations — magazine desk, not a feed",
          "lifestyle",
          3
        ),
        ...(input.discovery.surfaces.includes("bandits_picks")
          ? [note("bandits_picks", "What's Special Right Now assembled", "editorial", 3)]
          : []),
        ...(input.discovery.surfaces.includes("weekend_ideas")
          ? [note("weekend_ideas", "Weekend Ideas assembled", "lifestyle", 3)]
          : []),
        ...input.discovery.editorNotes
          .slice(0, 3)
          .map((label) => note("discovery_note", label, "editorial", 2)),
      ],
      items: input.discovery.picks.slice(0, 8).map((pick) => ({
        title: pick.title,
        role: pick.surface,
        notes: [
          note("discovery_category", pick.category, "lifestyle", 2),
          note("discovery_why", pick.why, "editorial", 2),
        ],
      })),
    });
  }

  if (input.knowledge && input.knowledge.facetCount > 0) {
    sections.push({
      sectionType: "knowledge",
      notes: [
        note(
          "knowledge_desk",
          "Context packets — teach the world, don’t only report events",
          "editorial",
          3
        ),
        note(
          "knowledge_coverage",
          `Enriched ${input.knowledge.storyCount} stories with ${input.knowledge.facetCount} facets`,
          "history",
          2
        ),
        ...input.knowledge.editorNotes
          .slice(0, 3)
          .map((label) => note("knowledge_note", label, "editorial", 2)),
      ],
      items: input.knowledge.highlights.slice(0, 8).map((h) => ({
        id: h.storyKey,
        title: h.headline,
        role: h.facetType,
        notes: [note("knowledge_why", h.why, "editorial", 2)],
      })),
    });
  }

  if (input.memory && input.memory.threadCount > 0) {
    sections.push({
      sectionType: "memory",
      notes: [
        note(
          "memory_desk",
          "Long-term reader relationship — continuity across mornings",
          "editorial",
          3
        ),
        note(
          "memory_integrity",
          "Memory informs continuity; it never overrides editorial selection",
          "editorial",
          3
        ),
        ...(input.memory.continuityDays >= 2
          ? [
              note(
                "reading_continuity",
                `Quiet morning continuity: ${input.memory.continuityDays} days`,
                "calendar",
                2
              ),
            ]
          : []),
        ...(input.memory.sinceYouLastRead
          ? [
              note(
                "since_you_last_read",
                input.memory.sinceYouLastRead.summary.slice(0, 160),
                "editorial",
                3
              ),
            ]
          : []),
        ...input.memory.editorNotes
          .slice(0, 3)
          .map((label) => note("memory_note", label, "editorial", 2)),
      ],
      items: input.memory.highlights.slice(0, 8).map((h) => ({
        id: h.threadId,
        title: h.title,
        role: h.type,
        notes: [note("memory_why", h.why, "editorial", 2)],
      })),
    });
  }

  if (input.morningEdition) {
    sections.push({
      sectionType: "morning_edition",
      notes: [
        note(
          "morning_edition_desk",
          "Morning Edition AI — calm editor introduction for every channel",
          "greeting",
          3
        ),
        note(
          "morning_engines",
          `Composed from: ${input.morningEdition.usedEngines.join(", ")}`,
          "editorial",
          2
        ),
        ...(input.morningEdition.polishedWithAi
          ? [
              note(
                "morning_polished",
                "Prose polished by the Morning Edition desk",
                "editorial",
                1
              ),
            ]
          : []),
        note(
          "morning_opening",
          input.morningEdition.openingPreview.slice(0, 160),
          "greeting",
          2
        ),
        ...input.morningEdition.editorNotes
          .slice(0, 3)
          .map((label) => note("morning_note", label, "editorial", 2)),
      ],
      items: [
        {
          title: "60-second briefing",
          role: "briefing_60s",
          notes: [
            note(
              "morning_briefing",
              input.morningEdition.briefingPreview.slice(0, 180),
              "editorial",
              2
            ),
          ],
        },
      ],
    });
  }

  const weatherChange = Boolean(
    input.weather?.todayHighC != null &&
      input.weather?.tomorrowHighC != null &&
      Math.abs(input.weather.tomorrowHighC - input.weather.todayHighC) >= 4
  );

  const ctx: EditionEditorialContext = {
    version: 1,
    editionDate: input.editionDate,
    generatedAt: now.toISOString(),
    location: {
      city: input.location.city,
      region: input.location.region ?? null,
      state: input.location.state ?? null,
    },
    profile: {
      interests,
      followedTopics,
    },
    personalization: {
      favoriteSources: favoriteSources.slice(0, 6),
      skippedTopics: skippedTopics.slice(0, 6),
      confidence: input.personalizationConfidence ?? 0,
    },
    sections,
    signals: {
      hasBreakingNews: Boolean(
        input.frontPage?.stories.some((s) => s.role === "breaking")
      ),
      hasLocalEvents: Boolean(input.localEvents?.length),
      weatherChange,
      holidayTomorrow,
      majorLocalEventTomorrow: Boolean(
        eventsOnTomorrow(input.localEvents ?? [], formatDateKey(tomorrow))
          .length
      ),
      primaryInterests: interests.slice(0, 3),
      sourceDiversity: Boolean(
        (input.frontPage?.composition?.uniqueSources ?? 0) >=
          Math.min(input.frontPage?.stories?.length ?? 0, 3)
      ),
      topicDiversity: Boolean(
        (input.frontPage?.composition?.uniqueCategories ?? 0) >=
          Math.min(input.frontPage?.stories?.length ?? 0, 3)
      ),
      geoBalance: Boolean(
        input.frontPage?.composition?.hasLocal &&
          input.frontPage?.composition?.hasNationalOrWorld
      ),
    },
    editorBrief: "",
  };

  ctx.editorBrief = buildEditorBrief(ctx);
  return ctx;
}
