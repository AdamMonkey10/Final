import { useState, useCallback } from 'react';

type Difficulty = 'easy' | 'medium' | 'hard' | 'all';
type CategoryType = 'math' | 'flags' | 'animals' | 'music' | 'tv' | 'all';
type Screen = 'home' | 'quiz' | 'results';

interface Question {
  id: string;
  category: CategoryType;
  difficulty: Difficulty;
  question: string;
  visual: string;
  answers: string[];
  correct: string;
}

const ALL_QUESTIONS: Question[] = [
  // MATH - Easy
  { id: 'm1', category: 'math', difficulty: 'easy', question: 'What is 5 + 3?', visual: '5️⃣ ➕ 3️⃣', answers: ['8', '6', '9', '7'], correct: '8' },
  { id: 'm2', category: 'math', difficulty: 'easy', question: 'What is 10 - 4?', visual: '🔟 ➖ 4️⃣', answers: ['4', '7', '6', '8'], correct: '6' },
  { id: 'm3', category: 'math', difficulty: 'easy', question: 'How many sides does a triangle have?', visual: '🔺', answers: ['3', '4', '5', '2'], correct: '3' },
  { id: 'm4', category: 'math', difficulty: 'easy', question: 'What is 2 × 5?', visual: '2️⃣ ✖️ 5️⃣', answers: ['10', '8', '12', '15'], correct: '10' },
  { id: 'm5', category: 'math', difficulty: 'easy', question: 'What is 20 ÷ 4?', visual: '2️⃣0️⃣ ➗ 4️⃣', answers: ['5', '4', '6', '8'], correct: '5' },
  // MATH - Medium
  { id: 'm6', category: 'math', difficulty: 'medium', question: 'What is 7 × 8?', visual: '7️⃣ ✖️ 8️⃣', answers: ['54', '56', '58', '64'], correct: '56' },
  { id: 'm7', category: 'math', difficulty: 'medium', question: 'What is the square root of 64?', visual: '√64 = ❓', answers: ['6', '7', '8', '9'], correct: '8' },
  { id: 'm8', category: 'math', difficulty: 'medium', question: 'What is 15 × 3?', visual: '1️⃣5️⃣ ✖️ 3️⃣', answers: ['45', '40', '48', '42'], correct: '45' },
  { id: 'm9', category: 'math', difficulty: 'medium', question: 'What is 100 - 37?', visual: '💯 ➖ 3️⃣7️⃣', answers: ['63', '67', '73', '57'], correct: '63' },
  { id: 'm10', category: 'math', difficulty: 'medium', question: 'A rectangle has length 8 and width 3. What is its area?', visual: '📐', answers: ['24', '22', '11', '26'], correct: '24' },
  // MATH - Hard
  { id: 'm11', category: 'math', difficulty: 'hard', question: 'What is 12²?', visual: '1️⃣2️⃣²', answers: ['144', '124', '148', '134'], correct: '144' },
  { id: 'm12', category: 'math', difficulty: 'hard', question: 'What is 15% of 200?', visual: '📊 15%', answers: ['30', '25', '35', '40'], correct: '30' },
  { id: 'm13', category: 'math', difficulty: 'hard', question: 'What is the next prime number after 13?', visual: '🔢', answers: ['15', '16', '17', '19'], correct: '17' },
  // FLAGS - Easy
  { id: 'f1', category: 'flags', difficulty: 'easy', question: 'Which country has this flag?', visual: '🇫🇷', answers: ['France', 'Germany', 'Italy', 'Spain'], correct: 'France' },
  { id: 'f2', category: 'flags', difficulty: 'easy', question: 'Which country has this flag?', visual: '🇬🇧', answers: ['UK', 'Australia', 'USA', 'Canada'], correct: 'UK' },
  { id: 'f3', category: 'flags', difficulty: 'easy', question: 'Which country has this flag?', visual: '🇺🇸', answers: ['USA', 'Canada', 'Australia', 'New Zealand'], correct: 'USA' },
  { id: 'f4', category: 'flags', difficulty: 'easy', question: 'Which country has this flag?', visual: '🇯🇵', answers: ['Japan', 'China', 'South Korea', 'Vietnam'], correct: 'Japan' },
  { id: 'f5', category: 'flags', difficulty: 'easy', question: 'Which country has this flag?', visual: '🇩🇪', answers: ['Germany', 'Austria', 'Belgium', 'Switzerland'], correct: 'Germany' },
  // FLAGS - Medium
  { id: 'f6', category: 'flags', difficulty: 'medium', question: 'Which country has this flag?', visual: '🇧🇷', answers: ['Brazil', 'Argentina', 'Colombia', 'Venezuela'], correct: 'Brazil' },
  { id: 'f7', category: 'flags', difficulty: 'medium', question: 'Which country has this flag?', visual: '🇮🇹', answers: ['Italy', 'Ireland', 'Hungary', 'Bulgaria'], correct: 'Italy' },
  { id: 'f8', category: 'flags', difficulty: 'medium', question: 'Which country has this flag?', visual: '🇦🇺', answers: ['Australia', 'New Zealand', 'Fiji', 'Papua New Guinea'], correct: 'Australia' },
  { id: 'f9', category: 'flags', difficulty: 'medium', question: 'Which country has this flag?', visual: '🇨🇦', answers: ['Canada', 'Switzerland', 'Denmark', 'Georgia'], correct: 'Canada' },
  { id: 'f10', category: 'flags', difficulty: 'medium', question: 'Which country has this flag?', visual: '🇲🇽', answers: ['Mexico', 'Italy', 'Nigeria', 'Ethiopia'], correct: 'Mexico' },
  // FLAGS - Hard
  { id: 'f11', category: 'flags', difficulty: 'hard', question: 'Which country has this flag?', visual: '🇳🇴', answers: ['Norway', 'Sweden', 'Denmark', 'Finland'], correct: 'Norway' },
  { id: 'f12', category: 'flags', difficulty: 'hard', question: 'Which country has this flag?', visual: '🇿🇦', answers: ['South Africa', 'Zimbabwe', 'Kenya', 'Nigeria'], correct: 'South Africa' },
  { id: 'f13', category: 'flags', difficulty: 'hard', question: 'Which country has this flag?', visual: '🇵🇹', answers: ['Portugal', 'Brazil', 'Spain', 'Ghana'], correct: 'Portugal' },
  // ANIMALS - Easy
  { id: 'a1', category: 'animals', difficulty: 'easy', question: 'What sound does a cow make?', visual: '🐄', answers: ['Moo', 'Oink', 'Baa', 'Woof'], correct: 'Moo' },
  { id: 'a2', category: 'animals', difficulty: 'easy', question: 'How many legs does a spider have?', visual: '🕷️', answers: ['8', '6', '10', '4'], correct: '8' },
  { id: 'a3', category: 'animals', difficulty: 'easy', question: 'What is a baby cat called?', visual: '🐱', answers: ['Kitten', 'Puppy', 'Cub', 'Foal'], correct: 'Kitten' },
  { id: 'a4', category: 'animals', difficulty: 'easy', question: 'Which animal is the largest in the world?', visual: '🐋', answers: ['Blue Whale', 'Elephant', 'Giraffe', 'Hippo'], correct: 'Blue Whale' },
  { id: 'a5', category: 'animals', difficulty: 'easy', question: 'What do bees make?', visual: '🐝', answers: ['Honey', 'Milk', 'Silk', 'Wax'], correct: 'Honey' },
  // ANIMALS - Medium
  { id: 'a6', category: 'animals', difficulty: 'medium', question: 'What is the fastest land animal?', visual: '🐆', answers: ['Cheetah', 'Lion', 'Horse', 'Greyhound'], correct: 'Cheetah' },
  { id: 'a7', category: 'animals', difficulty: 'medium', question: 'What is a group of lions called?', visual: '🦁', answers: ['Pride', 'Pack', 'Herd', 'Flock'], correct: 'Pride' },
  { id: 'a8', category: 'animals', difficulty: 'medium', question: 'Which animal can change its colour?', visual: '🦎', answers: ['Chameleon', 'Gecko', 'Iguana', 'Komodo Dragon'], correct: 'Chameleon' },
  { id: 'a9', category: 'animals', difficulty: 'medium', question: 'What is the largest land animal?', visual: '🐘', answers: ['Elephant', 'Hippo', 'Rhino', 'Giraffe'], correct: 'Elephant' },
  { id: 'a10', category: 'animals', difficulty: 'medium', question: 'How many weeks does a dog carry puppies before birth?', visual: '🐶', answers: ['9', '5', '12', '3'], correct: '9' },
  // ANIMALS - Hard
  { id: 'a11', category: 'animals', difficulty: 'hard', question: 'What is a group of flamingos called?', visual: '🦩', answers: ['Flamboyance', 'Flock', 'Colony', 'Gaggle'], correct: 'Flamboyance' },
  { id: 'a12', category: 'animals', difficulty: 'hard', question: 'Which bird can fly backwards?', visual: '🐦', answers: ['Hummingbird', 'Swallow', 'Swift', 'Eagle'], correct: 'Hummingbird' },
  { id: 'a13', category: 'animals', difficulty: 'hard', question: 'What is the only mammal capable of true flight?', visual: '🦇', answers: ['Bat', 'Flying Squirrel', 'Sugar Glider', 'Colugo'], correct: 'Bat' },
  // MUSIC - Easy
  { id: 'mu1', category: 'music', difficulty: 'easy', question: 'Who sang "Shake It Off"?', visual: '🎤', answers: ['Taylor Swift', 'Katy Perry', 'Ariana Grande', 'Dua Lipa'], correct: 'Taylor Swift' },
  { id: 'mu2', category: 'music', difficulty: 'easy', question: 'Who is known as the "King of Pop"?', visual: '🕺', answers: ['Michael Jackson', 'Elvis Presley', 'Prince', 'Bruno Mars'], correct: 'Michael Jackson' },
  { id: 'mu3', category: 'music', difficulty: 'easy', question: '"Happy" is a song by which artist?', visual: '😊🎶', answers: ['Pharrell Williams', 'Justin Timberlake', 'Bruno Mars', 'Ed Sheeran'], correct: 'Pharrell Williams' },
  { id: 'mu4', category: 'music', difficulty: 'easy', question: 'Which band sang "Bohemian Rhapsody"?', visual: '🎸', answers: ['Queen', 'The Beatles', 'Rolling Stones', 'Led Zeppelin'], correct: 'Queen' },
  { id: 'mu5', category: 'music', difficulty: 'easy', question: 'Who sang "Hello"?', visual: '📞🎵', answers: ['Adele', 'Beyoncé', 'Rihanna', 'Amy Winehouse'], correct: 'Adele' },
  // MUSIC - Medium
  { id: 'mu6', category: 'music', difficulty: 'medium', question: '"Shape of You" is by which artist?', visual: '🎶', answers: ['Ed Sheeran', 'Harry Styles', 'Sam Smith', 'James Arthur'], correct: 'Ed Sheeran' },
  { id: 'mu7', category: 'music', difficulty: 'medium', question: 'Which artist released "Blinding Lights"?', visual: '💡🎵', answers: ['The Weeknd', 'Drake', 'Post Malone', 'Travis Scott'], correct: 'The Weeknd' },
  { id: 'mu8', category: 'music', difficulty: 'medium', question: 'Who sang "Old Town Road"?', visual: '🤠🎵', answers: ['Lil Nas X', 'Doja Cat', 'Cardi B', 'Nicki Minaj'], correct: 'Lil Nas X' },
  { id: 'mu9', category: 'music', difficulty: 'medium', question: '"Someone Like You" is by which singer?', visual: '💔🎵', answers: ['Adele', 'Amy Winehouse', 'Paloma Faith', 'Duffy'], correct: 'Adele' },
  { id: 'mu10', category: 'music', difficulty: 'medium', question: 'Which group had a hit with "Wannabe"?', visual: '👯', answers: ['Spice Girls', "Destiny's Child", 'Little Mix', 'TLC'], correct: 'Spice Girls' },
  // MUSIC - Hard
  { id: 'mu11', category: 'music', difficulty: 'hard', question: 'In what year did The Beatles split up?', visual: '🎸🕰️', answers: ['1970', '1968', '1972', '1975'], correct: '1970' },
  { id: 'mu12', category: 'music', difficulty: 'hard', question: 'Who was the lead singer of Nirvana?', visual: '🎸🤘', answers: ['Kurt Cobain', 'Dave Grohl', 'Krist Novoselic', 'Eddie Vedder'], correct: 'Kurt Cobain' },
  { id: 'mu13', category: 'music', difficulty: 'hard', question: 'Which artist has won the most Grammy Awards of all time?', visual: '🏆🎵', answers: ['Beyoncé', 'Taylor Swift', 'Georg Solti', 'Michael Jackson'], correct: 'Beyoncé' },
  // TV - Easy
  { id: 'tv1', category: 'tv', difficulty: 'easy', question: 'Who lives in a pineapple under the sea?', visual: '🍍🌊', answers: ['SpongeBob SquarePants', 'Patrick Star', 'Sandy Cheeks', 'Squidward'], correct: 'SpongeBob SquarePants' },
  { id: 'tv2', category: 'tv', difficulty: 'easy', question: 'What colour is Peppa Pig?', visual: '🐷', answers: ['Pink', 'Purple', 'Red', 'Orange'], correct: 'Pink' },
  { id: 'tv3', category: 'tv', difficulty: 'easy', question: "Who is Bluey's little sister?", visual: '🐾', answers: ['Bingo', 'Chloe', 'Judo', 'Mackenzie'], correct: 'Bingo' },
  { id: 'tv4', category: 'tv', difficulty: 'easy', question: 'What is the name of the toy cowboy in Toy Story?', visual: '🤠🎬', answers: ['Woody', 'Buzz', 'Rex', 'Hamm'], correct: 'Woody' },
  { id: 'tv5', category: 'tv', difficulty: 'easy', question: "In The Simpsons, what is Homer's favourite drink?", visual: '🍺', answers: ['Duff Beer', 'Bud Light', 'Corona', 'Heineken'], correct: 'Duff Beer' },
  // TV - Medium
  { id: 'tv6', category: 'tv', difficulty: 'medium', question: "In Friends, what is the name of Ross's pet monkey?", visual: '🐒', answers: ['Marcel', 'Maurice', 'Mario', 'Max'], correct: 'Marcel' },
  { id: 'tv7', category: 'tv', difficulty: 'medium', question: 'What is the alternate dimension in Stranger Things called?', visual: '🌀', answers: ['The Upside Down', 'The Shadow Realm', 'The Dark World', 'The Mirror Dimension'], correct: 'The Upside Down' },
  { id: 'tv8', category: 'tv', difficulty: 'medium', question: 'In Game of Thrones, what is the motto of House Stark?', visual: '❄️🐺', answers: ['Winter is Coming', 'Fire and Blood', 'We Do Not Sow', 'Hear Me Roar'], correct: 'Winter is Coming' },
  { id: 'tv9', category: 'tv', difficulty: 'medium', question: 'Who plays Iron Man in the MCU?', visual: '🦾', answers: ['Robert Downey Jr.', 'Chris Evans', 'Chris Hemsworth', 'Mark Ruffalo'], correct: 'Robert Downey Jr.' },
  { id: 'tv10', category: 'tv', difficulty: 'medium', question: 'What show features the Great British Bake Off tent?', visual: '🎂', answers: ['Great British Bake Off', 'MasterChef', "Hell's Kitchen", 'Top Chef'], correct: 'Great British Bake Off' },
  // TV - Hard
  { id: 'tv11', category: 'tv', difficulty: 'hard', question: "In Breaking Bad, what is Walter White's alias?", visual: '🧪', answers: ['Heisenberg', 'Scarface', 'El Chapo', 'The Cook'], correct: 'Heisenberg' },
  { id: 'tv12', category: 'tv', difficulty: 'hard', question: 'Which TV show features the Dunder Mifflin paper company?', visual: '📄', answers: ['The Office', 'Parks and Recreation', 'Workaholics', 'Silicon Valley'], correct: 'The Office' },
  { id: 'tv13', category: 'tv', difficulty: 'hard', question: 'In Sherlock, who plays Sherlock Holmes?', visual: '🔍', answers: ['Benedict Cumberbatch', 'Martin Freeman', 'Andrew Scott', 'Mark Gatiss'], correct: 'Benedict Cumberbatch' },
];

const CATEGORIES = [
  { id: 'math' as CategoryType, label: 'Maths', emoji: '🔢', desc: 'Numbers & puzzles', bg: 'bg-blue-500', light: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-700' },
  { id: 'flags' as CategoryType, label: 'Flags', emoji: '🚩', desc: 'Countries of the world', bg: 'bg-red-500', light: 'bg-red-100', border: 'border-red-400', text: 'text-red-700' },
  { id: 'animals' as CategoryType, label: 'Animals', emoji: '🐾', desc: 'Wild & wonderful', bg: 'bg-green-500', light: 'bg-green-100', border: 'border-green-400', text: 'text-green-700' },
  { id: 'music' as CategoryType, label: 'Pop Music', emoji: '🎵', desc: 'Hits & artists', bg: 'bg-purple-500', light: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-700' },
  { id: 'tv' as CategoryType, label: 'TV & Film', emoji: '📺', desc: 'Shows & movies', bg: 'bg-orange-500', light: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-700' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getCategoryInfo(cat: CategoryType) {
  return CATEGORIES.find(c => c.id === cat) ?? CATEGORIES[0];
}

export default function Quiz() {
  const [screen, setScreen] = useState<Screen>('home');
  const [difficulty, setDifficulty] = useState<Difficulty>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const startQuiz = useCallback((cat: CategoryType, diff: Difficulty) => {
    setSelectedCategory(cat);
    setDifficulty(diff);
    let pool = ALL_QUESTIONS;
    if (cat !== 'all') pool = pool.filter(q => q.category === cat);
    if (diff !== 'all') pool = pool.filter(q => q.difficulty === diff);
    const qs = shuffle(pool).slice(0, 15);
    setQuestions(qs);
    setCurrent(0);
    setScore(0);
    setSelected(null);
    setScreen('quiz');
  }, []);

  const handleAnswer = useCallback((ans: string) => {
    if (selected !== null) return;
    setSelected(ans);
    if (ans === questions[current].correct) {
      setScore(s => s + 1);
    }
  }, [selected, questions, current]);

  const handleNext = useCallback(() => {
    if (current + 1 >= questions.length) {
      setScreen('results');
    } else {
      setCurrent(c => c + 1);
      setSelected(null);
    }
  }, [current, questions.length]);

  const q = questions[current];
  const progress = questions.length > 0 ? ((current + (selected ? 1 : 0)) / questions.length) * 100 : 0;
  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  const grade = pct >= 90 ? { msg: 'Amazing! 🌟', sub: 'You are a quiz superstar!', col: 'text-yellow-600' }
    : pct >= 70 ? { msg: 'Great Job! 🎉', sub: 'Really impressive!', col: 'text-green-600' }
    : pct >= 50 ? { msg: 'Good Try! 👍', sub: 'Keep it up!', col: 'text-blue-600' }
    : { msg: 'Keep Practising! 💪', sub: "You'll do better next time!", col: 'text-purple-600' };

  // HOME SCREEN
  if (screen === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center py-8">
            <div className="text-7xl mb-3">🧠</div>
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-2">
              Family Quiz!
            </h1>
            <p className="text-xl text-gray-600 font-medium">Fun for all ages — how much do you know?</p>
          </div>

          {/* Difficulty */}
          <div className="bg-white rounded-2xl shadow-lg p-5 mb-5">
            <h2 className="text-lg font-bold text-gray-700 mb-3 text-center">Choose Difficulty</h2>
            <div className="grid grid-cols-4 gap-2">
              {(['easy', 'medium', 'hard', 'all'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`py-2 rounded-xl font-bold capitalize transition-all text-sm ${
                    difficulty === d
                      ? 'bg-purple-600 text-white shadow-md scale-105'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {d === 'easy' ? '😊 Easy' : d === 'medium' ? '🤔 Medium' : d === 'hard' ? '🔥 Hard' : '🎲 All'}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="grid grid-cols-1 gap-3 mb-5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => startQuiz(cat.id, difficulty)}
                className={`flex items-center gap-4 p-4 rounded-2xl shadow-md text-white font-bold transition-all hover:scale-105 active:scale-95 ${cat.bg}`}
              >
                <span className="text-4xl">{cat.emoji}</span>
                <div className="text-left">
                  <div className="text-xl font-black">{cat.label}</div>
                  <div className="text-sm opacity-90">{cat.desc}</div>
                </div>
                <span className="ml-auto text-2xl">▶</span>
              </button>
            ))}
          </div>

          {/* Play All */}
          <button
            onClick={() => startQuiz('all', difficulty)}
            className="w-full py-5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all"
          >
            🎲 Play All Categories!
          </button>
        </div>
      </div>
    );
  }

  // RESULTS SCREEN
  if (screen === 'results') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-100 via-orange-50 to-pink-100 p-4 flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className="text-8xl mb-4">🎉</div>
          <h1 className="text-4xl font-black text-gray-800 mb-2">Quiz Complete!</h1>

          <div className="bg-white rounded-3xl shadow-xl p-8 mb-6">
            <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-1">
              {score}/{questions.length}
            </div>
            <div className="text-4xl font-bold text-gray-600 mb-4">{pct}%</div>
            <div className={`text-3xl font-black ${grade.col} mb-1`}>{grade.msg}</div>
            <div className="text-gray-500 text-lg">{grade.sub}</div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => startQuiz(selectedCategory, difficulty)}
              className="py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              🔄 Play Again
            </button>
            <button
              onClick={() => setScreen('home')}
              className="py-4 rounded-2xl bg-white text-gray-700 text-xl font-bold shadow-md border-2 border-gray-200 hover:scale-105 active:scale-95 transition-all"
            >
              🏠 Choose Category
            </button>
          </div>
        </div>
      </div>
    );
  }

  // QUIZ SCREEN
  if (!q) return null;
  const catInfo = getCategoryInfo(q.category);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setScreen('home')}
            className="text-gray-500 hover:text-gray-700 font-bold text-sm"
          >
            ← Back
          </button>
          <span className={`px-3 py-1 rounded-full text-sm font-bold text-white ${catInfo.bg}`}>
            {catInfo.emoji} {catInfo.label}
          </span>
          <span className="text-gray-500 font-bold text-sm">
            {current + 1}/{questions.length}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Score badge */}
        <div className="text-right mb-2">
          <span className="text-sm font-bold text-gray-500">Score: <span className="text-purple-600">{score}</span></span>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-3xl shadow-xl p-6 mb-5">
          {/* Visual */}
          <div className="text-center mb-4">
            <span className="text-8xl leading-none">{q.visual}</span>
          </div>
          {/* Question */}
          <h2 className="text-xl font-black text-gray-800 text-center leading-snug">{q.question}</h2>
        </div>

        {/* Answers */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {q.answers.map((ans) => {
            let style = 'bg-white border-2 border-gray-200 text-gray-800 hover:border-purple-400 hover:bg-purple-50';
            if (selected !== null) {
              if (ans === q.correct) {
                style = 'bg-green-500 border-2 border-green-600 text-white';
              } else if (ans === selected && ans !== q.correct) {
                style = 'bg-red-500 border-2 border-red-600 text-white';
              } else {
                style = 'bg-gray-100 border-2 border-gray-200 text-gray-400';
              }
            }
            return (
              <button
                key={ans}
                onClick={() => handleAnswer(ans)}
                disabled={selected !== null}
                className={`p-4 rounded-2xl font-bold text-sm transition-all shadow-md hover:scale-105 active:scale-95 disabled:cursor-default disabled:hover:scale-100 ${style}`}
              >
                {ans}
              </button>
            );
          })}
        </div>

        {/* Feedback & Next */}
        {selected !== null && (
          <div className="text-center">
            <div className={`text-2xl font-black mb-3 ${selected === q.correct ? 'text-green-600' : 'text-red-600'}`}>
              {selected === q.correct ? '✅ Correct!' : `❌ The answer was: ${q.correct}`}
            </div>
            <button
              onClick={handleNext}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              {current + 1 >= questions.length ? '🏆 See Results!' : 'Next Question →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
