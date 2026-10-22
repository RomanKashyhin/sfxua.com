// Ukrainian for the whole site, keyed by the English text exactly as the page and the scripts write it
// (see js/i18n.js). Company, game, brand and tool names stay as they are: NAVI, Valve, Epic Games,
// Riot Games, WePlay Studios, RJ Games, Vogster Entertainment, HEY CLAY, Ultimate Pirates, Moonmana,
// Steam, Unity, Unreal, FMOD, Wwise. The decorative SOUNDFX word and the big faint "SoundFX" stay too.
// Round K (16.10.2026): the site sells the audio system; round L (20.10.2026): Unity and Unreal, the client cards;
// round M (22.10.2026): mobile games, the team of three, one map with the four stages always in view.
const few = (n, one, two, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? two : many;
};

export const UK = {
  /* page */

  /* header and footer */
  'Skip to content': 'Перейти до змісту',
  'SoundFX, back to top': 'SoundFX, на початок сторінки',
  'Main': 'Головне меню',
  'Footer': 'Меню внизу сторінки',
  'Language': 'Мова',
  'Process': 'Процес',
  'Pricing': 'Вартість',
  'Work': 'Роботи',
  'Contact': 'Контакти',
  'Sound': 'Звук',
  'on': 'увімк',
  'off': 'вимк',
  'Get a plan': 'Отримати план',
  'Menu': 'Меню',
  'Close': 'Закрити',

  /* hero */
  'Your game’s audio system.': 'Аудіосистема для вашої гри.',
  'Get your audio plan': 'Отримати план озвучення',

  /* how we work */
  'How we work.': 'Як ми працюємо.',
  'Sound effects': 'Звукові ефекти',
  'Music': 'Музика',
  'A month of support after handover': 'Місяць підтримки після передачі',
  'We fix bugs and make small adjustments within the agreed integration package. New tasks are agreed separately.':
    'Виправляємо помилки й вносимо невеликі правки в межах погодженого пакета інтеграції. Нові завдання узгоджуємо окремо.',

  /* round L: the offer, one route over one scene, the client cards */
  'An audio system for your game. Unity and Unreal.': 'Аудіосистема для вашої гри. Unity та Unreal.',
  'Unity and Unreal. Integrated in 24 hours.': 'Unity та Unreal. Підключаємо за 24 години.',
  'We assemble and tailor an audio engine to your game, shaping its unique sound and behavior with AAA production quality as our benchmark. Your team gets a complete, integrated audio solution.':
    'Збираємо й адаптуємо аудіорушій під вашу гру: створюємо унікальне звучання та налаштовуємо його поведінку з орієнтиром на якість AAA-проєктів. Ваша команда отримує готове інтегроване аудіорішення.',
  'See how we work': 'Як ми працюємо',
  'The 24 hours start once the scope is agreed and we have the materials and access we need.': '24 години рахуємо після погодження обсягу й отримання потрібних матеріалів і доступів.',
  'Analysis and agreement': 'Аналіз і погодження',
  'Integration and testing': 'Інтеграція й перевірка',
  'Delivery and support': 'Передача й підтримка',
  'Environment': 'Оточення',
  'Movement': 'Рух',
  'Surfaces': 'Поверхні',
  'Combat': 'Бій',
  'Interface': 'Інтерфейс',
  'Ready to plug a working audio solution into your game?': 'Готові підключити робоче аудіорішення до своєї гри?',
  'Effects': 'Ефекти',
  'Game developer that created the mobile puzzle RPG Puzzle Breakers: Champions War, as well as strategy and casual games.':
    'Розробник ігор, який створив мобільну рольову гру-головоломку Puzzle Breakers: Champions War, а також стратегічні й казуальні ігри.',
  'Game company behind Carnivores: Dinosaur Hunter HD for PlayStation 3.': 'Ігрова компанія, що створила Carnivores: Dinosaur Hunter HD для PlayStation 3.',
  'Children’s brand combining air-dry modelling clay sets with an app of step-by-step animated sculpting guides.':
    'Дитячий бренд, що поєднує набори самозастигаючої маси для ліплення із застосунком з покроковими анімованими інструкціями.',
  'Free pirate-themed city-building and strategy MMO on Steam, developed and published by Moonmana.':
    'Безкоштовна піратська MMO-стратегія з розбудовою міста у Steam; розробник і видавець — Moonmana.',
  'Esports club with teams in Counter-Strike 2, Dota 2, VALORANT, League of Legends and other games.':
    'Кіберспортивний клуб, що має команди в Counter-Strike 2, Dota 2, VALORANT, League of Legends та інших іграх.',
  'Game developer behind Half-Life, Counter-Strike 2 and Dota 2, and maker of the Steam platform and Steam Deck.':
    'Розробник ігор Half-Life, Counter-Strike 2 і Dota 2, а також творець платформи Steam і пристрою Steam Deck.',
  'Interactive entertainment company behind Fortnite and Unreal Engine, which also runs the Epic Games Store.':
    'Компанія інтерактивних розваг, що стоїть за Fortnite та Unreal Engine і керує магазином Epic Games Store.',
  'Game developer and publisher of League of Legends, VALORANT, Teamfight Tactics and other titles.':
    'Розробник і видавець ігор League of Legends, VALORANT, Teamfight Tactics та інших.',
  'Content production company that produces esports tournaments, gaming shows and other events; part of WePlay Holding.':
    'Компанія з виробництва контенту, що продюсує кіберспортивні турніри, ігрові шоу та інші події; входить до WePlay Holding.',
  // round Q: the showcase
  'Studios and games our team has worked on': 'Студії та ігри, з якими працювала наша команда',
  'Now playing': 'Зараз грає',
  // round R: the player and the track list
  'Pause': 'Пауза',
  'Position': 'Позиція',
  'A random client': 'Випадковий клієнт',
  'Track list': 'Список треків',
  'Events': 'Івенти',
  'Gameplay': 'Геймплей',
  'Our part': 'Наша частина',
  'Your game could be the next record on this shelf.': 'Ваша гра може стати наступною платівкою на цій полиці.',
  'Projects our team has worked on. They don’t claim that these games use our audio system.':
    'Проєкти, над якими працювала наша команда. Це не означає, що ці ігри використовують нашу аудіосистему.',
  'Planned together with your team, step by step.': 'Плануємо разом із вашою командою, крок за кроком.',
  'For example:': 'Наприклад:',
  'Engine and version': 'Рушій і версія',
  'Tell us about your game, and we’ll come back with an audio plan: the sound, the integration and the timing.':
    'Розкажіть про свою гру, і ми повернемося з планом озвучення: звук, інтеграція й терміни.',
  'For example, Unity 6 or Unreal Engine 5': 'Наприклад, Unity 6 або Unreal Engine 5',

  /* round M: mobile games, the team, one map */
  'SoundFX: an audio system for your mobile game, Unity and Unreal': 'SoundFX: аудіосистема для вашої мобільної гри, Unity та Unreal',
  'SoundFX tailors an audio system to your Unity or Unreal mobile game and integrates it in 24 hours: a unique sound and behavior, with AAA production quality as the benchmark.':
    'SoundFX адаптує аудіосистему під вашу мобільну гру на Unity чи Unreal та інтегрує її за 24 години: унікальне звучання й поведінка з орієнтиром на якість AAA-проєктів.',
  'Steps · grass': 'Кроки · трава',
  'Campfire': 'Багаття',
  'Tree · wind and a bird': 'Дерево · вітер і пташка',
  'Working sound for your mobile game, without building an audio department.': 'Робочий звук для вашої мобільної гри без власного аудіовідділу.',
  'Four steps on one map. Your team shares the game; we tailor the sound, connect it and check it in gameplay, with one manager running our side.':
    'Чотири етапи на одній карті. Ваша команда передає гру, а ми адаптуємо звук, підключаємо його й перевіряємо в геймплеї; нашу частину веде один менеджер.',
  'Creation and adaptation': 'Створення й адаптація',
  'We get to know your game and agree on the character of the sound, the scope and the access.': 'Знайомимося з грою й погоджуємо характер звучання, обсяг і доступи.',
  'Scope agreed': 'Обсяг погоджено',
  'A mobile game on the phone: a forest clearing with a hut, a campfire and a stream': 'Мобільна гра на телефоні: лісова галявина з хатинкою, багаттям і струмком',
  'We adapt the sound effects and the music to your game.': 'Адаптуємо звукові ефекти й музику під вашу гру.',
  'Sound tailored': 'Звук адаптовано',
  'Illustration: recording sound with a boom microphone': 'Ілюстрація: запис звуку бум-мікрофоном',
  'Sound effects: a boot over dirt, sand, grass and snow. Press a surface to hear the boot step on it.':
    'Звукові ефекти: черевик над землею, піском, травою і снігом. Натисніть на поверхню, щоб почути крок по ній.',
  'Open the sound effects larger': 'Відкрити звукові ефекти більшими',
  'Illustration: creating and tuning music on a MIDI keyboard': 'Ілюстрація: створення й налаштування музики на MIDI-клавіатурі',
  'Open the keyboard larger': 'Відкрити клавіатуру більшою',
  'We connect the solution to the game and check its behaviour and balance in gameplay.': 'Підключаємо рішення до гри й перевіряємо його поведінку та баланс у геймплеї.',
  'Checked in the game': 'Перевірено в грі',
  'Illustration: testing the game on a phone': 'Ілюстрація: перевірка гри на телефоні',
  'Open the Game Boy larger': 'Відкрити Game Boy більшим',
  'Sweep across the strings to play. The rhythm game is only a demo of the interaction, not a tool for testing your game.':
    'Проведіть по струнах, щоб зіграти. Ритм-гра — лише демонстрація взаємодії, а не інструмент для тестування вашої гри.',
  'We hand over the ready solution.': 'Передаємо готове рішення.',
  'Handed over': 'Передано',
  'Back to the map': 'Назад до карти',

  /* round O: the turning microphone, the speakers in the game, the shelf of records */
  'Drag to rotate': 'Потягніть, щоб обертати',
  'Boom microphone': 'Бум-мікрофон',
  'Drag the microphone to turn it around its own axis, or use the left and right arrow keys.':
    'Потягніть мікрофон, щоб обертати його навколо власної осі, або скористайтеся клавішами зі стрілками ліворуч і праворуч.',
  'Play: the wind in the tree and a bird': 'Відтворити: вітер у дереві й пташка',
  'Play: footsteps on the grass': 'Відтворити: кроки по траві',
  'Play: the campfire': 'Відтворити: багаття',

  /* round P: the team carousel, the circle of records */
  'Our team: drag sideways or use the arrows to swap': 'Наша команда: потягніть убік або скористайтеся стрілками, щоб поміняти місцями',
  'Illustration: a team member testing a mobile game on a phone': 'Ілюстрація: учасник команди перевіряє мобільну гру на телефоні',
  'Illustration: a team member recording sound with a boom microphone': 'Ілюстрація: учасниця команди записує звук бум-мікрофоном',
  'Illustration: a team member playing a MIDI keyboard': 'Ілюстрація: учасник команди грає на MIDI-клавіатурі',
  'Previous team member': 'Попередній учасник команди',
  'Next team member': 'Наступний учасник команди',
  'Recording and sound effects': 'Запис звуку й звукові ефекти',
  'Music and sound tuning': 'Музика й налаштування звучання',
  'Integration and testing in the game': 'Інтеграція й перевірка в грі',
  'Official page': 'Офіційна сторінка',
  'Previous project': 'Попередній проєкт',
  'Next project': 'Наступний проєкт',
  'Project collection': 'Колекція проєктів',
  'Use the left and right arrow keys to browse projects.': 'Гортайте проєкти клавішами зі стрілками ліворуч і праворуч.',

  /* the gift and the bonus */
  'Give it a shake, then open your gift': 'Струси й відкрий подарунок',
  'Open the gift': 'Відкрити подарунок',
  'On your first project — with any package': 'На перший проєкт — для будь-якого пакета',
  'A bonus for you: 10% off your first project, with any package. Opening it takes you to the contact form.':
    'Бонус для вас: −10% на перший проєкт для будь-якого пакета. Після відкриття ви перейдете до форми.',
  'Your gift: 10% off your first project': 'Ваш подарунок: −10% на перший проєкт',
  '10% off your first project with any package. Taking you to the contact form.': '−10% на перший проєкт для будь-якого пакета. Переходимо до форми.',
  '10% off your first project with any package': '−10% на перший проєкт при виборі будь-якого пакета',
  'Your gift: 10% off your first project, with any package. It goes with your request.': 'Ваш подарунок: −10% на перший проєкт для будь-якого пакета. Він буде у вашій заявці.',
  'Gift from the site': 'Подарунок із сайту',
  '10% off the first project, with any package': '−10% на перший проєкт для будь-якого пакета',

  /* the Studio objects: boot, piano, console */
  'Pick a surface': 'Оберіть поверхню',
  'Step on dirt': 'Крок по землі',
  'Step on sand': 'Крок по піску',
  'Step on grass': 'Крок по траві',
  'Step on snow': 'Крок по снігу',
  'A small keyboard you can play': 'Маленька клавіатура, на якій можна грати',
  'Play me': 'Пограйте на мені',
  'Click or tap the keys. With the keyboard, use A to L for white keys and W, E, T, Y, U, O, P for black keys.':
    'Натискайте клавіші мишею або пальцем. На клавіатурі: від A до L — білі клавіші, W, E, T, Y, U, O, P — чорні.',
  'A handheld console with a small rhythm game: four strings on its screen, notes slide down to their targets.':
    'Портативна консоль із маленькою ритм-грою: чотири струни на екрані, ноти спускаються до своїх цілей.',
  'Sweep across the strings': 'Проведіть по струнах',
  'The four strings play the notes C, E, G and A. Press Play, then pluck each string as its note reaches the target: pass the cursor across the string (no click needed), swipe across it on a touch screen, or use the keys D, F, J and K. Out of a game the strings can be plucked freely.':
    'Чотири струни звучать нотами C, E, G і A. Натисніть «Грати» і зачіпайте струну, коли її нота досягає цілі: проведіть курсором поперек струни (клацати не потрібно), проведіть пальцем на сенсорному екрані або натискайте клавіші D, F, J і K. Поза грою на струнах можна грати вільно.',
  'Play': 'Грати',
  'Resume': 'Продовжити',
  'Stop the game': 'Зупинити гру',
  'Game started. Pluck each string as its note reaches the target.': 'Гру розпочато. Зачіпайте кожну струну, коли її нота досягає цілі.',
  'Game stopped': 'Гру зупинено',
  'Paused': 'Пауза',
  'Click once to hear the strings': 'Клацніть раз, щоб почути струни',

  /* work */
  '(opens in a new tab)': '(відкривається в новій вкладці)',
  'Open project': 'Відкрити проєкт',
  'SoundFX’s own record, kept apart from client work.': 'Власна платівка SoundFX, окремо від клієнтських робіт.',
  'Ultimate Pirates on Steam': 'Ultimate Pirates у Steam',
  'Studios we’ve worked with': 'Студії, з якими ми працювали',
  'Close project': 'Закрити проєкт',
  'The task': 'Завдання',
  'What we did': 'Що ми зробили',

  /* pricing */
  'Find your sound.': 'Знайдіть свій звук.',
  'Pricing depends on your game’s complexity, selected modules, and the content within each module.': 'Вартість залежить від складності гри, обраних модулів та їхнього наповнення.',
  'SOUNDFX / AUDIO SYSTEM': 'SOUNDFX / АУДІОСИСТЕМА',
  'Opening Act': 'Розігрів',
  'Headliner': 'Хедлайнер',
  'All Access': 'Повний доступ',
  'ALL ACCESS': 'ПОВНИЙ ДОСТУП',
  'Compact game': 'Компактна гра',
  'Bigger game': 'Складніша гра',
  'An individual plan': 'Індивідуальний план',
  'Individual quote': 'Індивідуальний розрахунок',
  'For a game with a limited, agreed set of activities.': 'Для гри з обмеженим погодженим набором активностей.',
  'The modules your activities need, with a fitting sound base': 'Потрібні модулі з відповідною звуковою основою',
  'Sound tailored to the style of your project': 'Звучання, адаптоване під стиль проєкту',
  'Connected and checked for the agreed scope': 'Підключення й перевірка погодженого обсягу',
  'a casual game with one location: interface, core actions, one environment and music.': 'казуальна гра з однією локацією: інтерфейс, основні дії, одне оточення й музика.',
  'Discuss this package': 'Обговорити цей пакет',
  'For a game with more systems that work together.': 'Для гри з більшою кількістю систем, що працюють разом.',
  'More modules and systems that interact': 'Більше модулів і систем, що взаємодіють',
  'More surfaces, actions, states and scenes': 'Більше поверхонь, дій, станів і сцен',
  'Extended themed content': 'Розширене тематичне наповнення',
  'Deeper tuning of behaviour and integration': 'Глибше налаштування поведінки й інтеграції',
  'an adventure with several locations, combat, interactive objects and music that follows the game state.':
    'пригодницька гра з кількома локаціями, боєм, інтерактивними об’єктами й музикою, що йде за станом гри.',
  'For large-scale projects': 'Для масштабних проєктів',
  'A configuration built around your company and your project.': 'Конфігурація, побудована довкола вашої компанії та проєкту.',
  'An agreed scope of modules, content, adapters and checks': 'Погоджений обсяг модулів, наповнення, адаптерів і перевірок',
  'Timeline and price planned individually': 'Терміни й вартість плануємо індивідуально',
  'Dedicated work with your team': 'Виділена робота з вашою командою',
  'A system that grows with the project': 'Система, що росте разом із проєктом',
  'Discuss your project': 'Обговорити проєкт',
  'The clock starts once the scope is agreed and we have the materials and access we need. New recordings, custom systems and non‑standard integrations are planned separately. Rights and the exact schedule are agreed in the contract before the start.':
    'Відлік починається після погодження обсягу й отримання потрібних матеріалів і доступів. Нові записи, спеціальні системи й нестандартні інтеграції плануємо окремо. Права й точний графік узгоджуємо в договорі до старту.',

  /* contact */
  'Let’s talk.': 'Поспілкуємось?',
  'Copied': 'Скопійовано',
  'Your game': 'Ваша гра',
  'A link to the game or its page, or a few words': 'Посилання на гру, сторінку або кілька слів',
  'Where to reply': 'Куди відповісти',
  'Email or Telegram': 'Email або Telegram',
  'Write to us': 'Написати нам',
  'Your email opens with the letter ready.': 'Відкриється ваша пошта з готовим листом.',
  'off your first project, already in your request': 'на перший проєкт — вже в заявці',
  'Or just write:': 'Або просто напишіть:',
  'Package': 'Пакет',
  'Email isn’t connected yet, so this form is turned off for now.': 'Пошту ще не підключено, тому форма поки що вимкнена.',
  'Add a link or a few words about the game.': 'Додайте посилання або кілька слів про гру.',
  /* the email the form composes */
  'Game': 'Гра',
  'our game': 'нашої гри',
};

// texts with a variable part
export const UK_PATTERNS = [
  [/^Our team has worked with (.+) on (.+)\.$/, 'Наша команда працювала з $1 над $2.'],
  [/^Our team has worked with (.+)\. Project details coming soon\.$/, 'Наша команда працювала з $1. Подробиці проєкту згодом.'],
  [/^(.+), client$/, '$1, клієнт'],
  [/^(.+), studio record$/, '$1, платівка студії'],
  [/^Step (\d):$/, 'Етап $1:'],
  [/^String (\d), note ([A-G]) \(key ([A-Z])\)$/, 'Струна $1, нота $2 (клавіша $3)'],
  [/^(\d+)\/(\d+) · Play again$/, '$1/$2 · Ще раз'],
  [/^Finished: (\d+) of (\d+) notes$/, 'Готово: $1 із $2 нот'],
  [/^Audio plan for (.+)$/, 'План озвучення для $1'],
  [/^Email opened\. If it didn’t, write to (.+)\.$/, 'Відкрито лист. Якщо пошта не відкрилася, напишіть на $1.'],
  [/^Turned (\d+)°$/, 'Повернуто на $1°'],
  [/^Our team worked on (.+)\.$/, 'Наша команда працювала над $1.'],
  [/^Our team has worked on (.+)\.$/, 'Наша команда працювала над $1.'],
  [/^Our team has worked with (.+)\.$/, 'Наша команда працювала з $1.'],
  [/^(\d+) modules? · (\d+) activit(?:y|ies)$/, (_, m, a) => `${m} ${few(+m, 'модуль', 'модулі', 'модулів')} · ${a} ${few(+a, 'активність', 'активності', 'активностей')}`],
];
