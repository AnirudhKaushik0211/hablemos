# Hablemos: case study

A short write-up of what Hablemos is, why it was built the way it is, and what was learned. Real usage numbers are placeholders until the project has been published and used.

## Problem

English speakers who want to practise Spanish often have to create an account and accept tracking. Offline tools tend to be opaque about their grammar and their accuracy.

## Approach

- A static, dependency-free web app that runs from `file://` and GitHub Pages, with all progress in `localStorage`.
- Online-only free-text translation behind an explicit consent prompt; offline or on failure only exact matches from the hand-written library are shown.
- Authored content only (about 1,000 words and 300 phrases), checked by data-integrity tests and a separate Spanish accuracy review.
- A strict Content Security Policy. The only network use is an optional, consent-gated online translation.

## Decisions and trade-offs

| Decision | Reason | Cost |
|---|---|---|
| Classic scripts with a UMD wrapper | works from `file://` and in Node tests | no `import`, more ceremony |
| Online mode kept, off by default, consent first | helps with longer text and cross-checking | third-party privacy trade-off; limited daily quota |
| Local daily counter for the provider limit | avoids wasted or failed requests | an estimate, not the provider's accounting |

## Results

| Measure | Value |
|---|---|
| Unit tests | see the release notes |
| Active learners | [placeholder: fill in after publishing] |
| Weekly sessions per learner | [placeholder] |
| Cards reviewed per week | [placeholder] |
| Share of learners turning on online mode | [placeholder] |

The app has no analytics, so usage numbers can only come from voluntary feedback or hosting statistics. Do not invent them.

## What would come next

More scenarios and a review of the audio on more devices.
