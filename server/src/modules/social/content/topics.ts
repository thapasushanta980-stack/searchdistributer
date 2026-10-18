/**
 * Nurvexa Labs TikTok carousel bank: 3 slides per topic.
 * Product facts come only from nurvexalabs.com / buddhimanai.com / the team's own posts:
 * guided quizzes (subject, system, difficulty) with rationales, timed mock tests, performance analytics,
 * AI-assisted explanations, daily mock tests, PCL Nursing / BSc Nursing / NCLEX prep.
 * Never promise or imply a guaranteed pass.
 */
export interface Slide {
  kicker: string;
  title: string;
  lines: string[];
  /** Optional uploaded screenshot shown in a phone frame. */
  assetId?: string;
}
export interface Topic {
  id: string;
  slides: [Slide, Slide, Slide];
  caption: string;
  /** Disabled topics are skipped by the daily worker. Defaults to enabled. */
  enabled?: boolean;
}

const LINK = "nurvexalabs.com";
const TAGS = "#nurvexalabs #nursingstudent #nursinglicense #nclex #nursingexam #nepal";

export const defaultTopics: Topic[] = [
  {
    id: "pass-the-loop",
    slides: [
      { kicker: "1 / 3", title: "Reading alone won't get you through", lines: ["Notes feel productive.", "Exam questions test whether you can APPLY them.", "Switch from re-reading to practising questions."] },
      { kicker: "2 / 3", title: "The Nurvexa study loop", lines: ["1. Take a guided quiz by subject or system", "2. Read the rationale on every option", "3. Check analytics for your weak areas", "4. Repeat daily"] },
      { kicker: "3 / 3", title: "Start practising today", lines: ["Daily mock tests & quizzes", "Built for PCL Nursing, BSc Nursing & NCLEX", LINK] },
    ],
    caption: `Stop just re-reading notes. Practise questions, learn from the rationales, fix your weak areas. Start at ${LINK}\n${TAGS}`,
  },
  {
    id: "mock-tests",
    slides: [
      { kicker: "1 / 3", title: "Knowing it isn't the same as finishing it", lines: ["Many students run out of time, not knowledge.", "Pacing is a skill you have to train."] },
      { kicker: "2 / 3", title: "Practise like it's the real thing", lines: ["Nurvexa mock tests mirror real exam length and pacing.", "Track your time per question.", "Spot where you slow down."] },
      { kicker: "3 / 3", title: "Make mocks a weekly habit", lines: ["One timed mock a week", "Review every wrong answer after", LINK] },
    ],
    caption: `Practise under real timing so exam day feels familiar. Timed mock tests at ${LINK}\n${TAGS}`,
  },
  {
    id: "learn-from-mistakes",
    slides: [
      { kicker: "1 / 3", title: "A wrong answer is useful data", lines: ["Don't just check the right option.", "Ask: why was MY choice wrong?"] },
      { kicker: "2 / 3", title: "Understand the why", lines: ["Nurvexa gives a rationale on every option.", "AI-assisted explanations answer your follow-up questions."] },
      { kicker: "3 / 3", title: "Turn mistakes into marks", lines: ["Keep a short error log", "Re-test those topics in 2 days", LINK] },
    ],
    caption: `Every mistake teaches you something if you know why. Rationales + AI explanations at ${LINK}\n${TAGS}`,
  },
  {
    id: "weak-areas",
    slides: [
      { kicker: "1 / 3", title: "You can't fix what you can't see", lines: ["Feeling ready is not the same as being ready."] },
      { kicker: "2 / 3", title: "Let your numbers guide you", lines: ["Performance analytics show:", "Weak subjects and systems", "Accuracy trends over time", "Average time per question"] },
      { kicker: "3 / 3", title: "Study where it counts", lines: ["Spend extra time on your lowest area this week", LINK] },
    ],
    caption: `Use your analytics to decide what to study next. See yours at ${LINK}\n${TAGS}`,
  },
  {
    id: "daily-30",
    slides: [
      { kicker: "1 / 3", title: "Small and daily beats big and rare", lines: ["30 focused minutes every day", "builds more than a weekend cram."] },
      { kicker: "2 / 3", title: "Your 30 minutes", lines: ["10 min: a guided quiz", "15 min: read the rationales", "5 min: note your weakest topic"] },
      { kicker: "3 / 3", title: "Make it a streak", lines: ["Daily mock tests & quizzes are waiting", LINK] },
    ],
    caption: `30 minutes a day. Quiz, review, repeat. Start your streak at ${LINK}\n${TAGS}`,
  },
  {
    id: "one-platform",
    slides: [
      { kicker: "1 / 3", title: "Different exam, same need", lines: ["Practice questions", "Clear explanations", "Honest feedback on your progress"] },
      { kicker: "2 / 3", title: "Nurvexa Labs covers", lines: ["PCL Nursing", "BSc Nursing", "NCLEX", "with guidance from teachers"] },
      { kicker: "3 / 3", title: "Join other nursing students", lines: ["AI-powered nursing education for Nepal & beyond", LINK] },
    ],
    caption: `One study partner for PCL Nursing, BSc Nursing & NCLEX prep. ${LINK}\n${TAGS}`,
  },
  {
    id: "what-is-nurvexa",
    slides: [
      { kicker: "1 / 3", title: "What is Nurvexa Labs?", lines: ["An AI-powered study partner", "for nursing license exam prep", "Learn smarter. Practice better. Care confidently."] },
      { kicker: "2 / 3", title: "What you get", lines: ["Guided quizzes with rationales", "Timed mock tests", "Performance analytics", "AI-assisted explanations"] },
      { kicker: "3 / 3", title: "How to start", lines: ["Create your account", "Take your first quiz today", LINK] },
    ],
    caption: `New to Nurvexa Labs? Here's what it is and how to start. ${LINK}\n${TAGS}`,
  },
];
