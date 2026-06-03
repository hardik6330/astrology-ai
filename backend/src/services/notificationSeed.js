// One-time seed of the curated engagement-notification pool (English). Only
// seeds when the table is empty, so admin curation (edits/deletes) is never
// clobbered on reboot. Mirrors the settingsSeed pattern.

import { NotificationTemplate } from '../models/index.js';
import { logger } from '../config/logger.js';

// Astroyogi-style hooks: an emotional line + a hint that an answer/remedy
// exists, to spark a tap. English only, short, ≤1 emoji. `screen` deep-links
// the tap (reading | chat | daily).
export const TEMPLATE_SEED = [
  { category: 'dasha',  screen: 'reading', title: "Life isn't angry with you…", body: "It's just a rough planetary phase — and the remedy is closer than you think. ✨" },
  { category: 'money',  screen: 'reading', title: 'Money comes but never stays?', body: 'Venus has something to say about that. Tap to see the fix.' },
  { category: 'night',  screen: 'daily',   title: 'Restless tonight for no reason?', body: 'The Moon knows why. 🔮 Tap to read what it means for you.' },
  { category: 'dasha',  screen: 'reading', title: "Saturn is testing you right now.", body: "Here's exactly how to turn this phase in your favour." },
  { category: 'career', screen: 'reading', title: 'That decision you keep delaying…', body: 'The stars say this week matters. Tap to find out why.' },
  { category: 'love',   screen: 'chat',    title: 'Wondering where love is headed?', body: 'Your chart already knows. Ask, and get a straight answer.' },
  { category: 'hope',   screen: 'daily',   title: 'A better phase is closer than it feels.', body: 'See what shifts for you this week. 🌙' },
  { category: 'career', screen: 'reading', title: 'Feeling stuck at work lately?', body: 'It may be timing, not effort. Tap to see your window.' },
  { category: 'health', screen: 'daily',   title: 'Low energy without a reason?', body: "Today's transit explains it — and what helps. Tap to read." },
  { category: 'money',  screen: 'reading', title: 'A money opportunity is forming.', body: 'Your chart hints at the right moment. Tap before you miss it.' },
  { category: 'love',   screen: 'chat',    title: 'Is this the right person for you?', body: 'Let your kundali weigh in. Ask now — first answer is on us.' },
  { category: 'regret', screen: 'reading', title: 'Still thinking about what could have been?', body: 'The planets say your turn is coming. Tap to see when.' },
  { category: 'hope',   screen: 'daily',   title: 'Today carries a quiet blessing.', body: 'Find out where your luck leans before the day ends. ✨' },
  { category: 'career', screen: 'reading', title: 'Big change on your mind?', body: "Your dasha has an opinion. Tap to hear it before you decide." },
  { category: 'night',  screen: 'chat',    title: 'Some questions only the stars can answer.', body: 'Ask the one that keeps you up at night. 🔮' },
  { category: 'money',  screen: 'reading', title: 'Spending more than you planned?', body: "There's a reason in your chart — and a way to steady it. Tap to see." },
  { category: 'love',   screen: 'daily',   title: 'Tension at home this week?', body: 'The Moon explains the mood. Tap for what eases it.' },
  { category: 'dasha',  screen: 'reading', title: 'A turning point is near.', body: "Your running period is shifting. See what it opens up for you." },
  { category: 'hope',   screen: 'chat',    title: 'You asked the universe for a sign.', body: 'Here it is — ask your question and get clarity today.' },
  { category: 'career', screen: 'daily',   title: 'Good day for a bold move?', body: "Check today's alignment before you act. Tap to read. ✨" },
];

export async function seedNotificationTemplates() {
  const count = await NotificationTemplate.count();
  if (count > 0) {
    logger.info(`Notification templates present (${count}) — seed skipped`);
    return;
  }
  await NotificationTemplate.bulkCreate(
    TEMPLATE_SEED.map((t) => ({ ...t, source: 'curated', enabled: true })),
  );
  logger.info(`Notification templates seeded (${TEMPLATE_SEED.length})`);
}
