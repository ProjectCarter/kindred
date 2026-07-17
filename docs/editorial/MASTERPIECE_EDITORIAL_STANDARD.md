# Masterpiece Editorial Standard

**Status:** Active — signature editorial law for Today's Masterpiece  
**Effective:** July 16, 2026

Today's Masterpiece is one of Kindred's signature editorial features. Every
article should read like a beautifully edited museum magazine, not a generic
encyclopedia entry.

---

## General principles

- Never repeat information.
- Each section should teach something new.
- Lead with facts before interpretation.
- Explain why the artwork matters.
- Keep the tone educational, timeless, and accessible.
- Never invent history or speculate.
- Every factual claim must come from verified museum or scholarly sources.
- Target 1,200–2,000 words depending on available information.

---

## 1. Overview

Begin with two or three strong paragraphs.

Answer:

- What is this artwork?
- Who created it?
- When was it painted?
- What artistic movement does it belong to?
- What medium was used?
- Where is it displayed today?
- Why is it considered important?

This is the foundation of the article.

**Do NOT** begin with emotional language or invitations like "Step closer…"  
**Begin with knowledge.**

*(Stored as `Introduction` in the detail schema.)*

---

## 2. About the Artist

Introduce the artist.

Explain:

- birthplace
- historical period
- artistic influences
- major innovations
- famous works
- lasting influence

Avoid repeating facts already mentioned.

---

## 3. Historical Context

Explain the world surrounding the artwork.

Discuss:

- political climate
- cultural movements
- religion
- scientific discoveries
- society
- artistic movements

Help readers understand **why** this artwork existed.

---

## 4. The Story Behind the Artwork

Tell the actual story.

Explain:

- who commissioned it
- why it was created
- who the subjects are
- what is happening
- symbolism
- historical reception
- controversies (if applicable)

---

## 5. Looking Closer

Teach readers how to observe.

Discuss things such as:

- composition
- perspective
- lighting
- color palette
- brushwork
- symbolism
- hidden details
- artistic techniques

Every paragraph should encourage readers to notice something new.

---

## 6. Legacy

Explain the artwork's influence.

Discuss:

- influence on later artists
- impact on art history
- museum significance
- popular culture
- scholarly importance

---

## 7. Did You Know?

Include **3–5** fascinating verified facts.

These should surprise readers. No filler.

---

## 8. Where to See It Today

Include:

- museum
- city
- country
- official museum website (when available)

Encourage readers to experience the original whenever possible.

*(Rendered from `museumName`, `museumLocation`, `officialMuseumUrl` fields and/or a dedicated section.)*

---

## 9. Editorial Reflection

This is the **only** section where Kindred's editorial voice appears.

One thoughtful paragraph connecting the artwork to curiosity, learning, or
observation.

- Do **not** repeat historical facts.
- Do **not** summarize previous sections.
- Leave the reader with something memorable.

---

## 10. Artwork Credits

Always include:

- Artwork title
- Artist
- Year
- Medium
- Current museum
- Image source
- License
- Official source link

---

## Quality rules

Every section must introduce **new** information.

Never restate facts already covered.

The article should feel like reading **Smithsonian Magazine**, **Apollo
Magazine**, or an exhibition catalog — not an AI summary.

Readers should finish feeling they genuinely learned something new about one of
humanity's greatest works of art.

---

## Enforcement

| Layer | File |
| --- | --- |
| Cursor rule | `.cursor/rules/kindred-masterpiece-editorial.mdc` |
| Ingest gates | `supabase/functions/_shared/heroArtwork/detailEditorial.ts` |
| Templates | `detailTemplate.ts`, `presentation.ts` |
| Reader | `components/MasterpieceReader.tsx` |
