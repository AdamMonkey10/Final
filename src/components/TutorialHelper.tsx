import { useState, useEffect } from 'react';

interface TutorialHelperProps {
  playerName: string;
  onFinish: () => void;
}

interface Step {
  title: string;
  body: string;
  emoji: string;
  highlight?: string; // description of what to look at
  tip?: string;
}

const STEPS: Step[] = [
  {
    emoji: '👻',
    title: 'Oh! A NEW FRIEND!',
    body: `Hello there, {name}! I'm Gerald! I'm a ghost! I've been haunting this graveyard for 300 years and I still haven't found my moan, but that's FINE. I'm completely fine.

Anyway — welcome to SPOOKY QUEST! I'll give you a quick tour. Don't worry, I'll probably remember most of it.`,
    tip: 'Tap NEXT to continue (or SKIP to dive straight in!)',
  },
  {
    emoji: '🪦',
    title: 'Your Adventure Starts Here',
    body: `You're standing in the Giggling Graveyard. Every area has a big description card telling you where you are and what dangers lurk nearby.

Tap the big location card to read about your surroundings. Tombstones here tell terrible jokes. I wrote some of them. I'm very proud.`,
    highlight: 'The big card in the middle of the screen',
    tip: '📍 Look at the location card below the game log',
  },
  {
    emoji: '🗺️',
    title: 'Getting Around',
    body: `You can travel in three ways:

🗺️ TAP THE MAP BUTTON in the top bar to see the whole world and fast-travel anywhere.

➡️ TAP EXIT CARDS below the location to walk to a neighbouring area.

👆 SWIPE LEFT or RIGHT on the screen to move between connected areas.`,
    highlight: 'The 🗺️ button in the top bar',
    tip: '⚠️ Watch out — monsters sometimes ambush you when you travel!',
  },
  {
    emoji: '💬',
    title: 'Talk to NPCs',
    body: `Each area has a resident character. Tap their card to have a chat!

They'll give you QUESTS, sell you items in their SHOP, and offer TRADES. Some have very strong opinions about baked goods.

Conversations have multiple choices — tap a response to keep talking, or choose "Goodbye" to leave.`,
    highlight: 'The green character card inside the location',
    tip: '💡 Characters remember if you\'ve visited before and say different things!',
  },
  {
    emoji: '🔍',
    title: 'Explore Areas',
    body: `Each area hides secret items! Tap the yellow 🔍 EXPLORE button to search the area.

You might find quest items, healing potions, weapons, or mysterious curiosities. Some quest items ONLY appear when you explore, so check every location!`,
    highlight: 'The yellow Explore button next to the NPC',
    tip: '🎒 You have 10 inventory slots — use or trade items to make room!',
  },
  {
    emoji: '📜',
    title: 'Quests & Goals',
    body: `Tap the 📜 QUESTS button to see your quest log. You have 5 quests to complete!

Quests tell you what to find, who to talk to, and what to bring. Complete them all to reach the FINAL BOSS… who is reportedly very easy to defeat because he's secretly terrified of children.`,
    highlight: 'The 📜 button in the HUD bar',
    tip: '🌟 Completing quests gives XP to level up and gold to spend in shops!',
  },
  {
    emoji: '⚔️',
    title: 'Combat',
    body: `Sometimes monsters jump out when you travel! Don't panic — combat is turn-based, so you have all the time you need to think.

⚔️ ATTACK — Deal damage to the enemy
🧪 USE ITEM — Use a healing potion from the strip above
🏃 RUN — Try to escape (60% chance of success)

If you lose, you wake up safely back in the Graveyard.`,
    highlight: 'The three big coloured buttons at the bottom in combat',
    tip: '💡 Keep some health potions handy — enemies hit hard in later areas!',
  },
  {
    emoji: '❤️',
    title: 'Your Stats',
    body: `The bar at the top of the screen shows your vital info:

❤️ HP — your health. If it hits 0, you faint!
⭐ Level — get XP from fights and quests to level up
💰 Gold — spend it in shops

As you level up, you get stronger and unlock new areas. Castle Dooooom unlocks at Level 4!`,
    highlight: 'The HUD bar at the very top of the screen',
    tip: '⚙️ The gear button opens settings where you can save manually or restart.',
  },
  {
    emoji: '👻',
    title: "Right! You're Ready!",
    body: `That's everything! Well, probably. I forgot some things but I'm a ghost, that's normal.

Your first quest is already active — find my missing moan! It's in a jar. Somewhere. I'm sure you'll figure it out.

Good luck, {name}! The graveyard is counting on you! (I counted them. There are 47 tombstones. I forget what the number means now.)`,
    tip: '💾 The game saves automatically after every action.',
  },
];

const TOTAL = STEPS.length;
const STORAGE_KEY = 'spooky_tutorial_done';

export function shouldShowTutorial(): boolean {
  return !localStorage.getItem(STORAGE_KEY);
}

export function markTutorialDone(): void {
  localStorage.setItem(STORAGE_KEY, '1');
}

export default function TutorialHelper({ playerName, onFinish }: TutorialHelperProps) {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  const current = STEPS[step];
  const isLast = step === TOTAL - 1;

  const handleNext = () => {
    if (isLast) {
      handleFinish();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleFinish = () => {
    setExiting(true);
    markTutorialDone();
    setTimeout(onFinish, 400);
  };

  const fill = (text: string) => text.replace(/{name}/g, playerName);

  return (
    <div
      className={`
        fixed inset-0 z-[60] flex flex-col items-center justify-end
        transition-opacity duration-300 ${exiting ? 'opacity-0' : 'opacity-100'}
      `}
      style={{ background: 'rgba(6,4,16,0.82)', backdropFilter: 'blur(3px)' }}
    >
      {/* Ghost floating above the card */}
      <div className="mb-2 flex flex-col items-center select-none pointer-events-none">
        <span
          className="float-anim"
          style={{ fontSize: 'clamp(52px, 14vw, 80px)', filter: 'drop-shadow(0 0 16px #a855f7)' }}
        >
          {current.emoji}
        </span>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-lg bg-spooky-darker border-t-4 border-spooky-purple rounded-t-3xl p-5 pb-safe flex flex-col gap-4"
        style={{ maxHeight: '72vh', overflowY: 'auto' }}
      >
        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`rounded-full transition-all ${
                i === step
                  ? 'w-6 h-2.5 bg-spooky-orange'
                  : i < step
                    ? 'w-2.5 h-2.5 bg-purple-600'
                    : 'w-2.5 h-2.5 bg-gray-700'
              }`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Title */}
        <h2 className="font-pixel text-spooky-orange text-sm md:text-base leading-snug text-center">
          {fill(current.title)}
        </h2>

        {/* Body */}
        <div className="font-game text-spooky-text text-base md:text-lg leading-relaxed whitespace-pre-line">
          {fill(current.body)}
        </div>

        {/* Highlight callout */}
        {current.highlight && (
          <div className="flex items-start gap-3 bg-purple-950 border border-purple-700 rounded-xl px-4 py-3">
            <span className="text-xl shrink-0 mt-0.5">👆</span>
            <p className="font-game text-purple-300 text-sm leading-snug">
              {current.highlight}
            </p>
          </div>
        )}

        {/* Tip */}
        {current.tip && (
          <div className="flex items-start gap-3 bg-yellow-950 border border-yellow-700 rounded-xl px-4 py-3">
            <span className="text-xl shrink-0 mt-0.5">💡</span>
            <p className="font-game text-yellow-200 text-sm leading-snug">
              {current.tip}
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={handleFinish}
            className="flex-1 py-4 rounded-xl border-2 border-gray-700 bg-spooky-card font-game text-base text-gray-400 active:scale-95 transition-transform min-h-[56px]"
          >
            Skip Tour
          </button>
          <button
            onClick={handleNext}
            className="flex-[2] py-4 rounded-xl bg-spooky-orange font-game font-bold text-black text-lg active:scale-95 transition-transform min-h-[56px]"
          >
            {isLast ? "🎃 Let's Go!" : `Next  ${step + 1}/${TOTAL}`}
          </button>
        </div>
      </div>
    </div>
  );
}
