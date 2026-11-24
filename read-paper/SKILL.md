---
name: read-paper
description: >-
  Walk Charlie through a research paper using William Griswold's eight questions ("How to Read an
  Engineering Research Paper"): motivation, proposed solution, evaluation, analysis, contributions,
  future directions, open questions, take-away. Answers ONE question at a time and waits for Charlie
  to say "ok" before moving to the next. Use when Charlie invokes /read-paper or asks for help reading,
  understanding or digesting a paper. Takes a PDF path, an arXiv/URL link, or pasted text.
---

# Read a paper, one question at a time

Based on William G. Griswold, "How to Read an Engineering Research Paper"
(https://cseweb.ucsd.edu/~wgg/CSE210/howtoread.html).

## Step 0: get the paper

- If no paper came with the invocation, ask for one (PDF path, URL, arXiv id, or pasted text) and stop.
- Read the **whole** paper before answering anything. For a PDF, read every page (in chunks if long).
  For arXiv, prefer the PDF or HTML full text, not just the abstract page.
- Then send one short line: the paper's title and authors, and "Ready. Say ok to start with Question 1."
  Do not answer any question yet.

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

Offer, in one line, any of: a ~250-word personal abstract in plain English (not a copy of the
paper's abstract), how this paper relates to others Charlie has read, or a second pass on any question.
