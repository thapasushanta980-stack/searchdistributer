# Nurvexa Labs TikTok content plan

Account: `@sushant34022` (growwithsushant), connected through Zernio.
Goal: grow awareness and sign-ups for Nurvexa Labs (nurvexalabs.com), an AI-powered study platform for nursing license exam prep in Nepal and beyond.

## What Nurvexa Labs is (sources: nurvexalabs.com via buddhimanai.com, @nurvexalabs Instagram)

- Guided quizzes by subject, system and difficulty, with a rationale on every option.
- Timed mock tests that mirror real exam length and pacing.
- Performance analytics: weak areas, accuracy trends, time per question.
- AI-assisted explanations that answer follow-up questions.
- Daily mock tests and quizzes; guidance from teachers; PCL Nursing, BSc Nursing and NCLEX prep.
- Tagline: "Learn smarter. Practice better. Care confidently."

## Content rules

- Only claim features listed above. Never promise or imply a guaranteed pass, a pass rate or a price. Confirm pricing/free-trial wording with the Nurvexa team before adding it.
- Format: 3-slide photo carousel (1080x1920 PNG), slide 1 hook, slide 2 the how, slide 3 call to action with nurvexalabs.com.
- Caption: one useful sentence, the link, and the hashtag set `#nurvexalabs #nursingstudent #nursinglicense #nclex #nursingexam #nepal`.
- Language: English for now. Nepali or mixed-language versions are a likely next step, since the team's own Instagram posts mix both.

## Topic rotation (7 carousels, repeat after the last)

| # | Id | Angle |
|---|----|-------|
| 1 | pass-the-loop | How to prepare: practise questions, read rationales, check analytics, repeat |
| 2 | mock-tests | Why timed mocks matter |
| 3 | learn-from-mistakes | Use rationales and AI explanations on wrong answers |
| 4 | weak-areas | Use analytics to decide what to study |
| 5 | daily-30 | A 30-minute daily routine |
| 6 | one-platform | PCL, BSc Nursing and NCLEX in one place |
| 7 | what-is-nurvexa | Explainer: what it is and how to start |

Slide copy lives in `server/src/modules/social/content/topics.ts`; edit it there.

## Automation

1. Slides are rendered with `sharp` from SVG (`content/render.ts`).
2. Uploaded to Zernio with the presigned-URL flow, then posted as a TikTok photo carousel with `createPost`.
3. A worker (`content/worker.ts`) posts at most one carousel per day, after `NURVEXA_POST_HOUR` Nepal time (default 18:00). Every attempt writes an `audit_logs` row (`social.nurvexa_post`), which drives topic rotation and the once-a-day gap. A failed attempt is not retried in a loop.
4. `NURVEXA_POST_MODE` in `server/.env`:
   - `off` (default): nothing runs.
   - `draft`: each carousel goes to the TikTok Creator Inbox; the creator finishes it in the app (add music, adjust, tap Post). Safest while reviewing quality.
   - `publish`: goes live automatically.

Commands (from `server/`):

```bash
npm run content:preview -- <topicId> <outDir>   # render PNGs to look at them
npm run content:post -- draft <topicId>         # send one draft now
npm run content:post -- publish <topicId>       # post one live now
```

## Limits to respect

- TikTok allows 5 pending drafts per account per 24 hours; draft mode once a day is safe, but manual tests count.
- TikTok business-app connections can post 15 photo posts per rolling 24 hours.
- Media URLs from Zernio uploads are valid for 7 days, which is plenty because posting happens immediately.
- The server needs a font for SVG text. On Windows this uses Segoe UI. In Docker or Linux, install a font package (for example `fonts-dejavu`) or text will not render.

## Suggested rollout

1. Week 1: `draft` mode. Review each draft in the TikTok app, add trending audio, post manually. Note which topics get views.
2. Week 2+: switch to `publish` if quality is consistent, and rewrite the weakest topics.
3. Later: add Nepali versions, real screenshots of the Nurvexa quiz and analytics screens (with permission), and student testimonials.
