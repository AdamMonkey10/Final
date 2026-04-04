import type { Quest, QuestId } from '../types/game';

export const QUESTS: Record<QuestId, Quest> = {
  missing_moan: {
    id: 'missing_moan',
    title: 'The Missing Moan',
    emoji: '👻',
    description: 'Find Gerald\'s lost haunting moan — apparently it\'s in a jar somewhere.',
    fullDescription:
      'Gerald the Ghost has lost his haunting moan. Without it, he can\'t scare anyone, and frankly he\'s quite upset about it (though he keeps forgetting why). He thinks he left it in a jar somewhere around the graveyard. Find the Moan Jar and return it to Gerald!',
    requiredLevel: 1,
    objectives: [
      {
        description: 'Find the Moan Jar',
        completed: false,
        itemRequired: { itemId: 'moan_jar', quantity: 1 },
      },
      {
        description: 'Return the Moan Jar to Gerald',
        completed: false,
        npcRequired: 'gerald',
      },
    ],
    rewards: {
      xp: 20,
      gold: 10,
      items: [{ itemId: 'ghost_dust', quantity: 3 }],
    },
    completionMessage:
      'Quest Complete: The Missing Moan! Gerald is overjoyed — then immediately forgets you helped him. Typical.',
    payoff:
      'Gerald opens the jar with great ceremony. The moan that emerges is... a tiny little squeak. Like a sleepy mouse. Gerald stares at it for a long moment. "...I\'ve been missing THAT this whole time?" He tries it out. "Squeeeak." The graveyard is very quiet. "...Maybe I\'ll just leave it in the jar," Gerald says.',
  },

  worst_cake: {
    id: 'worst_cake',
    title: 'The Worst Cake Ever',
    emoji: '🎂',
    description: 'Collect 3 terrible ingredients for Benny\'s birthday cake.',
    fullDescription:
      'Benny Bones is baking a birthday cake for himself (no one else offered) and he needs three very special, very wrong ingredients. You need to find a Rotten Egg, some Stinky Cheese, and a Smelly Sock from the swamp. Don\'t ask why.',
    requiredLevel: 1,
    objectives: [
      {
        description: 'Find a Rotten Egg',
        completed: false,
        itemRequired: { itemId: 'rotten_egg', quantity: 1 },
      },
      {
        description: 'Find some Stinky Cheese',
        completed: false,
        itemRequired: { itemId: 'stinky_cheese', quantity: 1 },
      },
      {
        description: 'Find a Smelly Sock from the Swamp',
        completed: false,
        itemRequired: { itemId: 'smelly_sock', quantity: 1 },
      },
      {
        description: 'Bring everything to Benny',
        completed: false,
        npcRequired: 'benny',
      },
    ],
    rewards: {
      xp: 40,
      gold: 25,
    },
    completionMessage:
      'Quest Complete: The Worst Cake Ever! You delivered the ingredients. The cake ran away. Everyone agrees this was the expected outcome.',
    payoff:
      'Benny combines the ingredients with great enthusiasm, bakes for exactly three hours at "THE HIGHEST SETTING," and removes from the oven what can only be described as a dense, smoking entity. "PERFECT," Benny announces. Then the cake gets up. The cake looks around. The cake runs out the door at a remarkable speed. Benny watches it go. "...I\'ll make another one," he says. "I\'ll perfect the recipe eventually."',
  },

  screaming_sock: {
    id: 'screaming_sock',
    title: 'The Screaming Sock Situation',
    emoji: '🧦',
    description: 'Retrieve Professor Squelch\'s important research notes from the Screaming Library.',
    fullDescription:
      'Professor Squelch left his critically important research notes in the Screaming Library, but Whispering Wendy keeps shushing him out before he can get them. Navigate the library carefully — speak too loudly and the books will attack!',
    requiredLevel: 2,
    objectives: [
      {
        description: 'Visit the Screaming Library',
        completed: false,
        locationRequired: 'library',
      },
      {
        description: 'Retrieve the Sock Map from Wendy',
        completed: false,
        itemRequired: { itemId: 'sock_map', quantity: 1 },
      },
      {
        description: 'Deliver the notes to Professor Squelch',
        completed: false,
        npcRequired: 'professor_squelch',
      },
    ],
    rewards: {
      xp: 80,
      gold: 50,
      items: [{ itemId: 'knowledge_bomb', quantity: 2 }],
    },
    completionMessage:
      'Quest Complete: The Screaming Sock Situation! The notes were just sock drawings. This was completely unsurprising.',
    payoff:
      'Professor Squelch receives the notes and examines them carefully. Page 1: sock with hat. Page 2: sock playing guitar. Page 3: two socks getting married (?). Page 7: sock going to university. Page 47: sock becoming president of "Sockland." Professor Squelch closes the notes reverently. "CRITICAL DATA," he confirms. He locks them in a safe.',
  },

  beatrice_performance: {
    id: 'beatrice_performance',
    title: "Beatrice's Big Performance",
    emoji: '🎭',
    description:
      "Help Beatrice stage her seventeen-act dramatic masterpiece by gathering props and convincing everyone to attend.",
    fullDescription:
      "Beatrice the Witch has written what she calls 'the most dramatically significant theatrical event since the invention of drama.' She needs a Vampire Costume, a Prop Cauldron, and an audience. Specifically, she wants Gerald, Benny, and Professor Squelch to attend. They will all need convincing.",
    requiredLevel: 3,
    objectives: [
      {
        description: 'Find the Vampire Costume',
        completed: false,
        itemRequired: { itemId: 'vampire_costume', quantity: 1 },
      },
      {
        description: 'Find the Prop Cauldron',
        completed: false,
        itemRequired: { itemId: 'prop_cauldron', quantity: 1 },
      },
      {
        description: 'Convince Gerald to attend',
        completed: false,
        npcRequired: 'gerald',
      },
      {
        description: 'Convince Benny to attend',
        completed: false,
        npcRequired: 'benny',
      },
      {
        description: 'Convince Professor Squelch to attend',
        completed: false,
        npcRequired: 'professor_squelch',
      },
      {
        description: 'Return to Beatrice with everything ready',
        completed: false,
        npcRequired: 'beatrice',
      },
    ],
    rewards: {
      xp: 150,
      gold: 100,
      items: [{ itemId: 'spooky_potion', quantity: 2 }],
      unlocks: ['castle'],
    },
    completionMessage:
      "Quest Complete: Beatrice's Big Performance! The play was terrible. Everyone absolutely loved it. Castle Dooooom is now unlocked!",
    payoff:
      "The play lasts four hours. Act 3 involves Beatrice changing hats seven times. Act 9 has a fifteen-minute scene where Beatrice argues with a cauldron. The cauldron is played by the prop cauldron. Gerald forgets he's in the audience and starts haunting Act 12. Benny falls asleep in Act 8 but applauds politely when nudged. Professor Squelch takes detailed scientific notes on the costumes. At the curtain call, everyone gives a standing ovation. Beatrice cries. Happy tears. Very dramatic happy tears. 'IT IS EXACTLY AS I IMAGINED,' she announces. 'ENCORE!'",
  },

  final_confrontation: {
    id: 'final_confrontation',
    title: 'The Final Confrontation (Sort Of)',
    emoji: '😱',
    description:
      'Defeat Lord Von Dooooom in a dramatic battle — though he keeps trying to surrender.',
    fullDescription:
      'Lord Von Dooooom, the legendary villain of Castle Dooooom, must be faced! He has terrorised this land for 200 years! Well. Technically he has mostly just lived in his castle, but still. Face him in battle! He will fight back! Probably! He seems very nervous about the whole thing.',
    requiredLevel: 4,
    objectives: [
      {
        description: 'Defeat Lord Von Dooooom in battle',
        completed: false,
        npcRequired: 'von_dooooom',
      },
    ],
    rewards: {
      xp: 300,
      gold: 200,
      items: [{ itemId: 'ghost_shield', quantity: 1 }],
    },
    completionMessage:
      'Quest Complete: The Final Confrontation! You saved the land! Von Dooooom is very relieved. You are now best friends, apparently.',
    payoff:
      "Lord Von Dooooom, defeated, collapses dramatically onto his throne. His extremely tall hat falls off. He catches it. He looks up at you with watery eyes. 'I... I yield,' he whispers. Then, quieter: 'Thank goodness.' He straightens up. Blows his nose. 'You know,' he says, in a much more normal voice, 'I\'ve been doing this villain thing for two hundred years and I\'m EXHAUSTED. Do you want some tea? I have excellent tea. Biscuits too. Proper ones, not Benny\'s.' He rings a bell. Somehow a butler appears. 'YOU WIN THE QUEST,' he announces. Then, to himself: 'Finally. FINALLY I have a friend.'",
  },
};
