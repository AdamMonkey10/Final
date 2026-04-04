import type { Location, LocationId } from '../types/game';

export const LOCATIONS: Record<LocationId, Location> = {
  graveyard: {
    id: 'graveyard',
    emoji: '🪦',
    name: 'Giggling Graveyard',
    description:
      'Ancient tombstones stretch as far as the eye can see, each one engraved with a terrible pun. One reads: "HERE LIES DAN. He tripped over a rake. The rake is fine." Fireflies drift lazily between the graves. It smells like old leaves and mild mischief.',
    danger: 'Watch out for tumbling tombstones!',
    connections: ['bakery', 'mansion', 'swamp'],
    npcId: 'gerald',
    enemyIds: ['giggling_zombie'],
    encounterChance: 0.3,
  },
  bakery: {
    id: 'bakery',
    emoji: '🦴',
    name: 'Bonehead Bakery',
    description:
      'A rickety little shop that smells permanently of charcoal. A hand-painted sign reads: "BENNY\'S BAKERY — All Items Artisanally Burnt." Smoke pours cheerfully from the chimney. A skeleton in a tiny apron waves from the window.',
    danger: 'Beware of exploding muffins!',
    connections: ['graveyard', 'mansion'],
    npcId: 'benny',
    enemyIds: ['muffin_monster'],
    encounterChance: 0.3,
  },
  mansion: {
    id: 'mansion',
    emoji: '🏚️',
    name: 'Haunted Mansion',
    description:
      'A grand Victorian mansion with seventeen chimneys, all of them crooked. The iron gates creak ominously. Inside, chandeliers drip with candle wax, portraits have eyes that follow you, and a carpet of red leads somewhere deeply suspicious. Beatrice lives here, obviously.',
    danger: 'Watch for falling chandeliers and surprise trap doors!',
    connections: ['graveyard', 'bakery', 'castle'],
    npcId: 'beatrice',
    enemyIds: ['chandelier_spider'],
    encounterChance: 0.25,
  },
  swamp: {
    id: 'swamp',
    emoji: '🌿',
    name: 'Swamp of Soggy Socks',
    description:
      'A vast, bubbling swamp that smells exactly as advertised — like a gym bag left in the rain for six months. Twisted trees drip with green moss. Somewhere in the murk, a frog is taking very serious scientific notes about footwear.',
    danger: 'Sock-throwing bog monsters lurk in the reeds!',
    connections: ['graveyard', 'library'],
    npcId: 'professor_squelch',
    enemyIds: ['sock_goblin'],
    encounterChance: 0.35,
  },
  library: {
    id: 'library',
    emoji: '📚',
    name: 'The Screaming Library',
    description:
      'Towering shelves reach into darkness above, filled with books that rustle and whisper. A sign at the entrance reads: "QUIET PLEASE" in seventeen languages. Then, smaller text beneath: "or else." Whispering Wendy presides over everything with a deeply disapproving expression.',
    danger: 'Speak too loudly and encyclopaedias will fly at your head!',
    connections: ['swamp', 'castle'],
    npcId: 'wendy',
    enemyIds: ['angry_encyclopedia'],
    encounterChance: 0.3,
  },
  castle: {
    id: 'castle',
    emoji: '🏰',
    name: 'Castle Dooooom',
    description:
      'A frankly excessive castle with spires, lightning rods, a working moat, and a sign above the drawbridge that reads: "DOOOOOM AWAITS" in letters that seem to be slightly on fire. Inside, it\'s surprisingly cosy. There are throw pillows. Lord Von Dooooom takes decorating seriously.',
    danger: 'Everything is dangerous here. EVERYTHING.',
    connections: ['mansion', 'library'],
    npcId: 'von_dooooom',
    enemyIds: ['von_dooooom_boss'],
    encounterChance: 0.1,
    requiredLevel: 4,
  },
};

export const LOCATION_CONNECTION_LABELS: Record<string, string> = {
  'graveyard-bakery': '🦴 Bakery',
  'graveyard-mansion': '🏚️ Mansion',
  'graveyard-swamp': '🌿 Swamp',
  'bakery-graveyard': '🪦 Graveyard',
  'bakery-mansion': '🏚️ Mansion',
  'mansion-graveyard': '🪦 Graveyard',
  'mansion-bakery': '🦴 Bakery',
  'mansion-castle': '🏰 Castle',
  'swamp-graveyard': '🪦 Graveyard',
  'swamp-library': '📚 Library',
  'library-swamp': '🌿 Swamp',
  'library-castle': '🏰 Castle',
  'castle-mansion': '🏚️ Mansion',
  'castle-library': '📚 Library',
};
