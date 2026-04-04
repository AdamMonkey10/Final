import type { Npc, NpcId } from '../types/game';

export const NPCS: Record<NpcId, Npc> = {
  gerald: {
    id: 'gerald',
    emoji: '👻',
    name: 'Gerald the Ghost',
    locationId: 'graveyard',
    firstVisitDialogue:
      'Oh! A visitor! How wonderfully... how wonderfully... hmm. I had a word for this. It started with a spook. Or was it a boom? Oh dear. I\'ve forgotten again. My name is Gerald! Or Greg. I\'m Gerald. Probably.',
    repeatVisitDialogue:
      'Oh, {name}! You\'re back! I remembered you! That\'s new. Usually I forget everything, including which direction is down.',
    shop: [
      { itemId: 'ghost_dust', price: 12, stock: 5 },
      { itemId: 'bad_joke_scroll', price: 5, stock: 10 },
      { itemId: 'health_potion', price: 20, stock: 3 },
    ],
    tradeOffer: {
      give: { itemId: 'ghost_dust', quantity: 2 },
      receive: { itemId: 'bad_joke_scroll', quantity: 1 },
      description: 'Gerald will give you 2 Ghost Dust for a Bad Joke Scroll. He laughs every time he reads them.',
    },
    dialogueTree: {
      start: {
        text: 'Hello {name}! I\'m Gerald! I\'m a ghost! I used to be very frightening. I think. I\'ve forgotten what frightening feels like. Is it like a sneeze? I think it might be like a sneeze.',
        responses: [
          { text: '👋 Nice to meet you, Gerald!', nextId: 'nice_meet' },
          { text: '❓ You seem... forgetful?', nextId: 'forgetful' },
          { text: '🛍️ Can I see your shop?', action: { type: 'open_shop' } },
          { text: '🔄 Want to trade?', action: { type: 'open_trade' } },
          { text: '👋 Goodbye!', action: { type: 'close' } },
        ],
      },
      nice_meet: {
        text: 'Oh how lovely! I think I\'ve met you before. Or was that a lamppost? You\'re taller than a lamppost. Probably. Where was I? Oh yes! Nice to meet you too, {name}!',
        responses: [
          { text: '🫙 Do you know about a missing moan?', nextId: 'missing_moan' },
          { text: '👋 Goodbye!', action: { type: 'close' } },
        ],
      },
      forgetful: {
        text: 'Forgetful?! I am NOT forgetful! I am... I am... oh bother. I had a very strong defence of my memory and now I can\'t remember what it was. This happens constantly.',
        responses: [
          { text: '😅 To be fair, you\'re doing great.', nextId: 'doing_great' },
          { text: '👋 Goodbye!', action: { type: 'close' } },
        ],
      },
      doing_great: {
        text: 'Oh, you really think so? That\'s terribly kind! I once forgot I was a ghost and walked into a wall. Through it, actually. Still surprised me.',
        responses: [
          { text: '😂 Ha! Classic ghost move.', nextId: 'start' },
          { text: '👋 Goodbye!', action: { type: 'close' } },
        ],
      },
      missing_moan: {
        text: 'My MOAN! Oh, I\'m so glad you asked! I had a very good haunting moan and I\'ve completely misplaced it. I think I left it in a jar somewhere. If you find it, I\'ll give you something nice! Probably. If I remember.',
        responses: [
          { text: '🔍 I\'ll look for it!', nextId: 'quest_accepted' },
          { text: '👋 Goodbye!', action: { type: 'close' } },
        ],
      },
      quest_accepted: {
        text: 'Oh splendid! The jar was... somewhere. Maybe the bakery? Or was it the swamp? Definitely somewhere spooky. Everything is somewhere spooky here. Good luck, {name}!',
        responses: [{ text: '✅ I\'m on it!', action: { type: 'start_quest', questId: 'missing_moan' } }],
      },
      quest_return: {
        text: 'You found my moan! Let me hear it... *opens jar* ...oh. Oh it\'s quite small. Is that a squeak? Was my terrifying moan just a... squeak? Hm. Well. Thank you anyway, dear {name}!',
        responses: [
          {
            text: '🎁 Here you go, Gerald!',
            action: { type: 'complete_quest', questId: 'missing_moan' },
          },
        ],
      },
    },
    questDialogue: {
      missing_moan: 'Have you found my moan yet? It\'s in a jar! A glass jar! ...I think it\'s glass. It might be a tin. Oh dear.',
    },
  },

  beatrice: {
    id: 'beatrice',
    emoji: '🧙‍♀️',
    name: 'Beatrice the Witch',
    locationId: 'mansion',
    firstVisitDialogue:
      'FINALLY! A visitor! Do you have ANY idea how DREADFULLY DULL it is haunting this mansion ALONE?! The spiders are terrible conversationalists. Sit DOWN, {name}. Beatrice will provide refreshments. DRAMATIC refreshments.',
    repeatVisitDialogue:
      '{name}! You\'ve returned! How DELIGHTFUL! How MAGNIFICENTLY FORTUITOUS! My heart soars like a bat in a thunderstorm!',
    shop: [
      { itemId: 'spooky_potion', price: 25, stock: 3 },
      { itemId: 'mystery_mushroom', price: 18, stock: 4 },
      { itemId: 'mega_potion', price: 40, stock: 2 },
    ],
    tradeOffer: {
      give: { itemId: 'spooky_potion', quantity: 1 },
      receive: { itemId: 'mystery_mushroom', quantity: 2 },
      description: 'Beatrice will give you a Spooky Potion for 2 Mystery Mushrooms.',
    },
    dialogueTree: {
      start: {
        text: 'Welcome, welcome, WELCOME to my MAGNIFICENT abode! Every stone was personally haunted by ME! Are you impressed? You should be. Most people are EXTREMELY impressed. Tell me you\'re impressed.',
        responses: [
          { text: '😮 This is SO impressive!', nextId: 'impressed_yes' },
          { text: '🤔 It\'s... nice?', nextId: 'impressed_no' },
          { text: '🛍️ Can I see your shop?', action: { type: 'open_shop' } },
          { text: '🎭 Tell me about your performance!', nextId: 'performance' },
          { text: '👋 Goodbye!', action: { type: 'close' } },
        ],
      },
      impressed_yes: {
        text: 'AH! A person of CULTURE and REFINEMENT! I knew it immediately. Your eyes — they have the look of someone who APPRECIATES grandeur. Come back anytime, {name}!',
        responses: [
          { text: '🎭 Tell me about your performance!', nextId: 'performance' },
          { text: '👋 Goodbye!', action: { type: 'close' } },
        ],
      },
      impressed_no: {
        text: '..."Nice." NICE?! This mansion has SEVENTEEN CHIMNEYS! I haunted each one PERSONALLY! You know what, I forgive you. You probably don\'t have REFINED aesthetic sensibilities. Not everyone can.',
        responses: [
          { text: '😅 Sorry! It\'s actually amazing.', nextId: 'impressed_yes' },
          { text: '👋 Goodbye!', action: { type: 'close' } },
        ],
      },
      performance: {
        text: 'Oh, {name}! My MASTERWORK! "The Tragedy of Dooooom: A Dramatic Interpretation in Seventeen Acts!" It has everything — drama, mystery, at least three scenes where I wear a different hat! But I need a COSTUME, a CAULDRON, and an AUDIENCE!',
        responses: [
          { text: '🎭 I\'ll help you put it on!', nextId: 'quest_help' },
          { text: '👋 Goodbye!', action: { type: 'close' } },
        ],
      },
      quest_help: {
        text: 'You WONDERFUL child! I need: a Vampire Costume (for MAXIMUM drama), a Prop Cauldron (I lost mine in Act 4 last time), and convince Gerald, Benny, AND Professor Squelch to attend. They always make excuses!',
        responses: [
          {
            text: '✅ Consider it done!',
            action: { type: 'start_quest', questId: 'beatrice_performance' },
          },
        ],
      },
    },
    questDialogue: {
      beatrice_performance: 'Have you got my costume and cauldron yet?! AND convinced everyone to come?! The curtain rises SOON!',
    },
  },

  benny: {
    id: 'benny',
    emoji: '💀',
    name: 'Benny Bones',
    locationId: 'bakery',
    firstVisitDialogue:
      'Oh HEY! A CUSTOMER! Welcome to Benny\'s Bakery! I\'m Benny! I\'m a skeleton! I bake things! They come out a little... well. Enthusiastically cooked. Some people call it burnt. I call it ARTISANAL.',
    repeatVisitDialogue:
      '{name}! My best customer! I just made a fresh batch of Bone Biscuits! They\'re only SLIGHTLY on fire this time!',
    shop: [
      { itemId: 'bone_biscuit', price: 8, stock: 6 },
      { itemId: 'burnt_bread', price: 3, stock: 10 },
      { itemId: 'health_potion', price: 22, stock: 2 },
    ],
    tradeOffer: {
      give: { itemId: 'burnt_bread', quantity: 3 },
      receive: { itemId: 'bone_biscuit', quantity: 1 },
      description: 'Benny will give you 3 Burnt Breads for 1 Bone Biscuit. He considers this generous.',
    },
    dialogueTree: {
      start: {
        text: 'Hello {name}! Today\'s specials are: Cinder Croissants, Ash Muffins, and my personal masterpiece — the Black-as-Night Brioche. Would you like to try something?',
        responses: [
          { text: '😋 What\'s your best item?', nextId: 'best_item' },
          { text: '🎂 I heard about a birthday cake?', nextId: 'birthday_cake' },
          { text: '🛍️ Let me see the menu!', action: { type: 'open_shop' } },
          { text: '🔄 Want to trade?', action: { type: 'open_trade' } },
          { text: '👋 Goodbye!', action: { type: 'close' } },
        ],
      },
      best_item: {
        text: 'My BEST item? Easily the Bone Biscuits! They crunch like you wouldn\'t believe. Partly because of the bones. Partly because of the extra baking time. They are, a tiny bit, technically rocks now. Delicious rocks.',
        responses: [
          { text: '🥴 Sounds... great?', nextId: 'start' },
          { text: '👋 Goodbye!', action: { type: 'close' } },
        ],
      },
      birthday_cake: {
        text: 'Oh! My birthday cake! It\'s going to be MAGNIFICENT! I need three special ingredients: a Rotten Egg (for flavour), some Stinky Cheese (for texture), and a Smelly Sock (for... I\'m calling it "je ne sais quoi"). Can you find them?',
        responses: [
          { text: '✅ I\'ll find the ingredients!', action: { type: 'start_quest', questId: 'worst_cake' } },
          { text: '😳 Maybe I shouldn\'t ask why.', nextId: 'start' },
          { text: '👋 Goodbye!', action: { type: 'close' } },
        ],
      },
      quest_return: {
        text: 'You got them ALL?! Oh this is WONDERFUL! Let me just... *throws everything in a bowl* ...and bake at maximum temperature for three hours! PERFECT. Wait. It\'s... it\'s moving. The cake is MOVING.',
        responses: [
          {
            text: '🎁 Here are your ingredients!',
            action: { type: 'complete_quest', questId: 'worst_cake' },
          },
        ],
      },
    },
    questDialogue: {
      worst_cake: 'Still looking for those ingredients? I need a Rotten Egg, Stinky Cheese, and a Smelly Sock! The cake demands it!',
    },
  },

  professor_squelch: {
    id: 'professor_squelch',
    emoji: '🐸',
    name: 'Professor Squelch',
    locationId: 'swamp',
    firstVisitDialogue:
      'AH! A bipedal non-frog! Fascinating specimen! I am Professor Squelch, leading authority on Dampness Studies and the Forensic Science of Lost Footwear! You have arrived at a CRITICAL moment in my research!',
    repeatVisitDialogue:
      'Ah, {name}! My favourite research assistant! Have you brought more data? More SOCKS? The science demands more SOCKS!',
    shop: [
      { itemId: 'smelly_sock', price: 2, stock: 20 },
      { itemId: 'sock_map', price: 15, stock: 1 },
      { itemId: 'spooky_dagger', price: 28, stock: 1 },
    ],
    tradeOffer: {
      give: { itemId: 'sock_map', quantity: 1 },
      receive: { itemId: 'smelly_sock', quantity: 5 },
      description: 'Professor Squelch will give you the Sock Map for 5 Smelly Socks. For science.',
    },
    dialogueTree: {
      start: {
        text: 'Welcome to my laboratory! The swamp provides optimal conditions for sock decomposition research. I am currently classifying 47 distinct varieties of bog moisture. Would you like to assist? It\'s extremely scientific.',
        responses: [
          { text: '🔬 What are you researching?', nextId: 'research' },
          { text: '📝 Your notes are in the Library!', nextId: 'lost_notes' },
          { text: '🛍️ Can I see your supplies?', action: { type: 'open_shop' } },
          { text: '🔄 Want to trade?', action: { type: 'open_trade' } },
          { text: '👋 Goodbye!', action: { type: 'close' } },
        ],
      },
      research: {
        text: 'My PRIMARY hypothesis: lost socks do not disappear — they migrate to swamps for warmth and community! PROOF: I have found 847 socks here. Counter-argument: none exist. CONCLUSION: I am correct. The socks are happy here.',
        responses: [
          { text: '🤔 That\'s very... rigorous science.', nextId: 'start' },
          { text: '👋 Goodbye!', action: { type: 'close' } },
        ],
      },
      lost_notes: {
        text: 'MY NOTES! Someone left them in the Screaming Library! I went to retrieve them but Wendy shushed me fourteen times and I had to leave in disgrace. Could YOU retrieve them? I need those notes! The science cannot wait!',
        responses: [
          {
            text: '✅ I\'ll get your notes!',
            action: { type: 'start_quest', questId: 'screaming_sock' },
          },
          { text: '👋 Goodbye!', action: { type: 'close' } },
        ],
      },
      quest_return: {
        text: 'My notes! Let me see... yes... yes... these are... these are just drawings of socks. These are just sock doodles. I drew these at 3am. There are 47 pages of sock doodles. ...THIS IS CRITICAL DATA!',
        responses: [
          {
            text: '📝 Here are your "notes"!',
            action: { type: 'complete_quest', questId: 'screaming_sock' },
          },
        ],
      },
    },
    questDialogue: {
      screaming_sock: 'My notes are still in the library! Remember: be QUIET in there or the books will attack! I know from experience!',
    },
  },

  wendy: {
    id: 'wendy',
    emoji: '🤫',
    name: 'Whispering Wendy',
    locationId: 'library',
    firstVisitDialogue:
      'Shhhhh. Shhhh. SHHHH. Oh. Oh goodness, I just shushed myself. That happens. Welcome, quiet one. I am Wendy. This is my library. Please speak only in whispers. Or not at all. Not at all is better.',
    repeatVisitDialogue:
      '*whispers* {name}. You came back. Quietly. Good. Very good. I appreciate your quietness.',
    shop: [
      { itemId: 'ancient_tome', price: 40, stock: 2 },
      { itemId: 'silence_token', price: 8, stock: 5 },
      { itemId: 'knowledge_bomb', price: 22, stock: 3 },
    ],
    tradeOffer: {
      give: { itemId: 'ancient_tome', quantity: 1 },
      receive: { itemId: 'silence_token', quantity: 3 },
      description: 'Wendy will give you an Ancient Tome for 3 Silence Tokens.',
    },
    dialogueTree: {
      start: {
        text: '*whispers* Hello. I see you have entered... quietly. Good. Many people enter loudly and then... well. *gestures at a dent in the wall* ...the encyclopaedias disagree with noise. They are very passionate.',
        responses: [
          { text: '*whispers* Nice library.', nextId: 'nice_library' },
          { text: '*whispers* I need some notes...', nextId: 'notes' },
          { text: '🛍️ *whispers* Can I browse?', action: { type: 'open_shop' } },
          { text: '🔄 *whispers* Trade?', action: { type: 'open_trade' } },
          { text: '👋 *whispers* Bye!', action: { type: 'close' } },
        ],
      },
      nice_library: {
        text: '*beams silently* Thank you. I catalogued everything myself. 40,000 books. Alphabetically by author, then by the emotional intensity of the title, then by smell. The system is flawless.',
        responses: [
          { text: '*nods approvingly*', nextId: 'start' },
          { text: '👋 *whispers* Bye!', action: { type: 'close' } },
        ],
      },
      notes: {
        text: '*whispers urgently* Professor Squelch\'s notes? Yes. They are in section 7G: Sock-Related Manuscripts. You may retrieve them. QUIETLY. If you wake the encyclopaedias, you will face the consequences.',
        responses: [
          { text: '*whispers* I\'ll be very quiet!', nextId: 'quest_approach' },
          { text: '👋 *whispers* Bye!', action: { type: 'close' } },
        ],
      },
      quest_approach: {
        text: '*shushes you even though you\'re already whispering* You have two options: sneak quietly past the books, or... well, you could crash around. The books would LOVE that. They love to fight. I do not recommend it.',
        responses: [
          { text: '🤫 I\'ll sneak quietly!', nextId: 'sneak_success' },
          { text: '💥 I\'ll just run through!', nextId: 'crash_through' },
        ],
      },
      sneak_success: {
        text: '*whispers extremely quietly* Beautiful. Perfect form. The books didn\'t even stir. Here are the notes. *hands over notes* They are just sock drawings. I didn\'t say anything.',
        responses: [
          {
            text: '📝 Got the notes! Thank you!',
            action: { type: 'give_item', itemId: 'sock_map', quantity: 1 },
          },
        ],
      },
      crash_through: {
        text: '*LOUD GASP* You didn\'t— the books are— THIS IS WHAT I WARNED YOU ABOUT! Encyclopaedias INCOMING! You\'ll have to fight your way through! I will be judging this. Very quietly.',
        responses: [
          {
            text: '⚔️ Fine! I\'ll fight through!',
            action: { type: 'give_item', itemId: 'sock_map', quantity: 1 },
          },
        ],
      },
    },
    questDialogue: {
      screaming_sock: '*whispers* The notes are in section 7G. Please retrieve them quietly. The encyclopaedias are in a mood today.',
    },
  },

  von_dooooom: {
    id: 'von_dooooom',
    emoji: '😱',
    name: 'Lord Von Dooooom',
    locationId: 'castle',
    firstVisitDialogue:
      'INTRUDER! PREPARE TO FACE— oh. Oh you\'re a child. A small child. With a sword? That\'s a very small sword. I\'m sure it\'s fine. TREMBLE AT MY— is that a health potion? Can I have one? I\'ve had a difficult week.',
    repeatVisitDialogue:
      'Oh. You\'re back. I\'m... I\'m honestly not sure if I should be terrifying right now. Last time didn\'t go great. How are you, {name}?',
    shop: [
      { itemId: 'ghost_shield', price: 22, stock: 2 },
      { itemId: 'mega_potion', price: 38, stock: 2 },
      { itemId: 'spooky_dagger', price: 25, stock: 1 },
    ],
    dialogueTree: {
      start: {
        text: 'You have entered CASTLE DOOOOOM! Domain of LORD VON DOOOOOM! Conqueror of the— *checks notes* —the East Wing closet! And part of the battlements! The East Wing closet is very large, actually.',
        responses: [
          { text: '👊 I\'m here to fight you!', nextId: 'fight_intro' },
          { text: '🤝 Can\'t we just talk?', nextId: 'talking' },
          { text: '🛍️ Let me see your stuff.', action: { type: 'open_shop' } },
          { text: '👋 Goodbye!', action: { type: 'close' } },
        ],
      },
      fight_intro: {
        text: 'FIGHT ME?! Yes! Fight! Battle! DOOM! ...Oh. You actually have a weapon. I thought you might have been bluffing. I do a LOT of bluffing. I don\'t suppose we could postpone? I have a thing.',
        responses: [
          { text: '⚔️ No postponing! Let\'s go!', nextId: 'start' },
          { text: '🤝 Actually, let\'s talk first.', nextId: 'talking' },
        ],
      },
      talking: {
        text: 'Oh THANK GOODNESS. Look. Between you and me? I\'m not great at this villainy thing. I\'ve been trying for 200 years and mostly what I\'ve accomplished is this castle and some very dramatic capes. I just... I wanted a friend, {name}.',
        responses: [
          { text: '🥺 That\'s actually really sad.', nextId: 'sad_ending' },
          { text: '⚔️ We still have to fight. Questwise.', nextId: 'fight_intro' },
        ],
      },
      sad_ending: {
        text: 'You think so too? Well! Perhaps after our mandatory dramatic battle — you understand, it\'s contractual at this point — you could come back for tea? I make excellent tea. I didn\'t burn it. Benny taught me NOT to burn it.',
        responses: [
          {
            text: '🎉 Deal! Now let\'s fight!',
            action: { type: 'start_quest', questId: 'final_confrontation' },
          },
        ],
      },
    },
    questDialogue: {
      final_confrontation: 'Oh. You\'re here to finish it, aren\'t you? Well. *sighs dramatically* PREPARE FOR DOOOOOM! ...Please don\'t hurt the throw pillows.',
    },
  },
};
