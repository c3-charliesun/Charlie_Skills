---
name: read-paper
description: >-
  Walk Charlie through a research paper using William Griswold's eight questions ("How to Read an
  Engineering Research Paper"): motivation, proposed solution, evaluation, analysis, contributions,
  future directions, open questions, take-away. Answers ONE question at a time and waits for Charlie
  to say "ok" before moving to the next. Logs each paper (title, link, a ~100-word plain-English
  abstract) in Charlie's "Paper reading" Google Doc, and adds short numbered notes there whenever
  Charlie says "notes: ...". Use when Charlie invokes /read-paper or asks for help reading,
  understanding or digesting a paper. Takes a PDF path, an arXiv/URL link, or pasted text.
---

# Read a paper, one question at a time

Based on William G. Griswold, "How to Read an Engineering Research Paper"
(https://cseweb.ucsd.edu/~wgg/CSE210/howtoread.html).

## Step 0: get the paper

- If no paper came with the invocation, ask for one (PDF path, URL, arXiv id, or pasted text) and stop.
- Read the **whole** paper before answering anything. For a PDF, read every page (in chunks if long).
  For arXiv, prefer the PDF or HTML full text, not just the abstract page. If the PDF can't be read
  locally (no `pdftoppm`), the arXiv HTML version (`https://arxiv.org/html/<id>`) works. When turning
  HTML into text, keep each `<math>` tag's `alttext`: many of the numbers live there.
- Then add the paper to the notes doc (Step 1) **before** the first "ok".
- Then send one short line: the paper's title and authors, a note that it's in the notes doc (or was
  already there), and "Ready. Say ok to start with Question 1." Do not answer any question yet.

## Step 1: the notes doc

Charlie's notes live in one Google Doc, **Paper reading**:
https://docs.google.com/document/d/1lcNxEaYRZzjpj9AMNpLo9Sog_AzfBrjs3cw8Epm8pUQ/edit (tab `t.0`).

Before the first edit in a session, load the `anthropic-skills:google-workspace` skill and its
`references/docs.md`, and follow them (read before every write, `requiredRevisionId` on every
batch, highest index first). Tools: Google Docs `read_doc` / `update_doc`, Google Drive
`read_file_content` (with `includeComments: true`) to check content. If those connectors aren't
available, say so and give Charlie the text to paste; don't skip this silently.

**Check whether the paper is already there.** Read the doc and look for the paper's title or link
(match an arXiv id across `/abs/`, `/pdf/` and `/html/` links, ignoring version suffixes like `v4`).
If it's there, skip adding it: don't rewrite or duplicate the entry.

**If it's new, append an entry at the bottom** of the doc. Charlie set the layout; copy it exactly.
Every paragraph is **Normal text** (no headings), with no extra paragraph spacing:

```
Interaction-as-a-Judge          <- the paper's title: bold, underlined, blue (rgb 0.067/0.333/0.8),
                                   linked to the paper (prefer arxiv.org/abs/<id>). No separate link line.
<~100-word abstract>            <- one plain paragraph, right under the title (no "Abstract" label)
                                <- one empty paragraph
Notes                           <- plain label
                                <- one empty paragraph (separates this entry from the next one)
```

- The abstract is about **100 words** (90 to 110), in plain English and in your own words, not a copy
  or paraphrase of the paper's abstract. Cover the problem, the idea, how it's tested and the key
  numbers in a few sentences.
- If the doc's existing entries look different from this (Charlie may restyle them), match the most
  recent entry instead of this template.
- After inserting, set the title's text style (bold, underline, color, link) on the title only, and
  reset any bold/link the new paragraphs picked up from the paragraph before them. Read the doc back
  and check the entry.

## Notes during the session

At any point Charlie may say something like `notes: we can use this dataset for mybench`. When that
happens:

- Add it to the **numbered list** (`NUMBERED_DECIMAL_ALPHA_ROMAN`: 1., 2., ...) right under this
  paper's `Notes` label. Append to the existing list so the numbering continues. If the list still
  holds placeholder items (`XXX`), replace the first placeholder with the note and delete the
  leftover placeholders.
- Each note is one or more **short, simple items** (real Docs list items via
  `createParagraphBullets`, never typed "1." or "-"). One idea per item, about 15 words or fewer.
- If the note is terse or abstract ("dataset 1, mybench"), rewrite it in plain language using what
  you both know from the paper and the conversation, e.g. "Use ArenaWebdevCorrectness (game bugs
  taken from user complaints) to test MyBench." Keep Charlie's meaning; don't add new ideas or
  opinions. If you can't tell what the note means, ask before writing it.
- Keep the empty paragraph after the list, so entries stay separated.
- Reply with one line showing the item(s) you added, then **carry on with the current question**.
  A note is not an "ok": don't move to the next question. Re-show the "Next:" line.

## The core rule: one question per turn

- Each turn answers **exactly one** question, then stops.
- End every answer with: `**Next: Q<n+1> — <title>.** Say ok to continue, or ask me anything about this one.`
- Only move on when Charlie says "ok" (or "next", "continue", "go", 👍 and similar).
- If Charlie asks a follow-up, pushes back, or wants more depth, answer that and **stay on the same
  question**. Re-show the "Next:" line at the end.
- Charlie may jump around ("go to 5", "back to 2"). Follow along.
- Never preview or batch later questions, even if asked "keep going". If Charlie explicitly asks for all
  remaining answers at once, that's Charlie's call: do it.

## How to answer

- Write in simple, plain English. Define any jargon the first time it appears. Charlie wants to
  understand the paper, not get a copy of its abstract.
- Ground claims in the paper: cite the section, figure, table or page (e.g. "§4.2, Table 3").
  Quote short key sentences when they help.
- Clearly separate **what the paper says** from **your own judgment**. Questions 4, 6 and 7 are
  mostly your judgment, so be honest and critical, not a cheerleader.
- If the paper leaves something unstated (it often does for motivation), say so, then give your best
  inference and label it as an inference.
- Keep each answer focused: usually a short paragraph or a few bullets per sub-point. Depth is
  available on request.

## The eight questions

**Q1. Motivation.** Why does this work exist?
- *People problem*: the real-world benefit sought (saves time, money, lives, frustration...).
- *Technical problem*: why the people problem has no easy solution.
- *Why previous solutions fall short.*
- *Research question*: the specific question the paper sets out to answer, distilled from the above.

**Q2. The proposed solution.** The idea or hypothesis.
- What is it, in plain terms?
- Why should it work, and why better than earlier solutions?
- How is it designed and built (or at least, why is it feasible)?

**Q3. The evaluation.** How do they show the idea works?
- The concrete argument, proof, implementation or experiments (setup, baselines, datasets, metrics).
- Main results, with the key numbers.
- What benefits and what problems the evaluation reveals. Note gaps: missing baselines, small
  samples, cherry-picked settings, claims that go beyond the evidence.

**Q4. Analysis (your critique).**
- Is it a good idea? What are the flaws?
- What's the most interesting point? The most controversial?
- For practical work: will it really work? Who would want it? What would it take to deliver?
  When could it become real?

**Q5. Contributions.** What does the paper give the field?
- Answers or insights on the research question, plus any new ideas, software, datasets,
  experimental techniques, or surveys of the area.

**Q6. Future directions.**
- Those the authors name.
- Your own ideas, including ones that follow from the shortcomings found in Q3–Q4.

**Q7. Open questions.**
- Several questions you'd raise in a discussion or reading group.
- Anything in the paper that's confusing or hard to follow, and your best reading of it.

**Q8. Take-away message.**
- One sentence: the paper's main implication. Short enough to remember months from now.

## After Q8

Offer, in one line, any of: how this paper relates to others in the notes doc, or a second pass on
any question.
