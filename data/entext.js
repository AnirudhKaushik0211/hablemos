(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.data = root.Hablemos.data || {}; root.Hablemos.data.entext = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    // subject pronouns: [person, number, gender]
    pronSubj: { i: [1, 'sg', 'm'], you: [2, 'sg', 'm'], he: [3, 'sg', 'm'], she: [3, 'sg', 'f'], it: [3, 'sg', 'm'], we: [1, 'pl', 'm'], they: [3, 'pl', 'm'], 'y\'all': [2, 'pl', 'm'] },
    // object pronouns: clitic (direct object), stressed (after a preposition)
    pronObj: {
      me: { cl: 'me', st: 'mí', p: 1, n: 'sg' }, you: { cl: 'te', st: 'ti', p: 2, n: 'sg' }, him: { cl: 'lo', st: 'él', p: 3, n: 'sg' },
      her: { cl: 'la', st: 'ella', p: 3, n: 'sg' }, it: { cl: 'lo', st: 'ello', p: 3, n: 'sg' }, us: { cl: 'nos', st: 'nosotros', p: 1, n: 'pl' }, them: { cl: 'los', st: 'ellos', p: 3, n: 'pl' }
    },
    indirect: { i: 'me', you: 'te', he: 'le', she: 'le', it: 'le', we: 'nos', they: 'les' },
    determiners: { the: 'def', a: 'indef', an: 'indef', some: 'some', this: 'este', that: 'ese', these: 'este', those: 'ese', every: 'cada', each: 'cada', no: 'ningún' },
    possessives: { my: 'mi', your: 'tu', his: 'su', her: 'su', its: 'su', our: 'nuestro', their: 'su' },
    prepositions: {
      in: 'en', on: 'en', at: 'en', to: 'a', from: 'de', of: 'de', with: 'con', for: 'para', by: 'por', about: 'sobre', near: 'cerca de',
      under: 'debajo de', behind: 'detrás de', between: 'entre', without: 'sin', until: 'hasta', during: 'durante', before: 'antes de', after: 'después de',
      into: 'en', through: 'por', toward: 'hacia', over: 'sobre', across: 'enfrente de'
    },
    adverbPrep: { near: 'cerca', behind: 'detrás', under: 'debajo' },
    conjunctions: { and: 'y', or: 'o', but: 'pero', because: 'porque', if: 'si', that: 'que', while: 'mientras' },
    whWords: { what: 'qué', where: 'dónde', when: 'cuándo', why: 'por qué', how: 'cómo', who: 'quién', which: 'cuál' },
    // contraction expansion (applied to lowercase text)
    contractions: {
      "i'm": 'i am', "you're": 'you are', "he's": 'he is', "she's": 'she is', "it's": 'it is', "that's": 'that is', "what's": 'what is', "where's": 'where is',
      "who's": 'who is', "how's": 'how is', "there's": 'there is', "we're": 'we are', "they're": 'they are', "isn't": 'is not', "aren't": 'are not',
      "don't": 'do not', "doesn't": 'does not', "can't": 'can not', "won't": 'will not', cannot: 'can not', "i've": 'i have', "you've": 'you have', "we've": 'we have',
      "they've": 'they have', "i'd": 'i would', "you'd": 'you would', "i'll": 'i will', "you'll": 'you will', "let's": 'let us', "wasn't": 'was not',
      "weren't": 'were not', "didn't": 'did not', "haven't": 'have not', "hasn't": 'has not', "couldn't": 'could not', "wouldn't": 'would not',
      "shouldn't": 'should not', "o'clock": "o'clock"
    },
    // irregular plural nouns -> singular
    irregularPlurals: { children: 'child', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth', mice: 'mouse', wives: 'wife', knives: 'knife', lives: 'life', people: 'person', fish: 'fish', sheep: 'sheep', glasses: 'glasses', pants: 'pants', clothes: 'clothes', vacations: 'vacation' },
    // irregular verb forms -> [lemma, form]
    irregularVerbs: {
      is: ['be', '3sg'], am: ['be', 'base'], are: ['be', 'base'], has: ['have', '3sg'], does: ['do', '3sg'], goes: ['go', '3sg'], says: ['say', '3sg'], doing: ['do', 'ing'], being: ['be', 'ing'], having: ['have', 'ing'],
      was: ['be', 'past'], were: ['be', 'past'], had: ['have', 'past'], did: ['do', 'past'], went: ['go', 'past'], saw: ['see', 'past'], ate: ['eat', 'past'],
      drank: ['drink', 'past'], came: ['come', 'past'], gave: ['give', 'past'], made: ['make', 'past'], said: ['say', 'past'], took: ['take', 'past'], got: ['get', 'past'],
      knew: ['know', 'past'], wrote: ['write', 'past'], read: ['read', 'past?'], bought: ['buy', 'past'], sold: ['sell', 'past'], spoke: ['speak', 'past'], slept: ['sleep', 'past'],
      left: ['leave', 'past'], found: ['find', 'past'], thought: ['think', 'past'], told: ['tell', 'past'], paid: ['pay', 'past'], ran: ['run', 'past'], sat: ['sit', 'past'],
      lost: ['lose', 'past'], met: ['meet', 'past'], began: ['begin', 'past'], brought: ['bring', 'past'], heard: ['hear', 'past'], put: ['put', 'past?'], wanted: ['want', 'past'],
      liked: ['like', 'past'], loved: ['love', 'past'], worked: ['work', 'past'], played: ['play', 'past'], lived: ['live', 'past'], studied: ['study', 'past'], visited: ['visit', 'past'],
      watched: ['watch', 'past'], arrived: ['arrive', 'past'], called: ['call', 'past'], helped: ['help', 'past'], needed: ['need', 'past'], opened: ['open', 'past'], closed: ['close', 'past']
    },
    numberWords: {
      zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
      sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
    },
    scaleWords: { hundred: 100, thousand: 1000 },
    days: { monday: 'lunes', tuesday: 'martes', wednesday: 'miércoles', thursday: 'jueves', friday: 'viernes', saturday: 'sábado', sunday: 'domingo' },
    months: { january: 'enero', february: 'febrero', march: 'marzo', april: 'abril', may: 'mayo', june: 'junio', july: 'julio', august: 'agosto', september: 'septiembre', october: 'octubre', november: 'noviembre', december: 'diciembre' },
    // adjectives of state expressed with tener when the subject is animate (en -> Spanish noun)
    // fixed fragments, safe anywhere in a sentence. type: 'adv' | 'quant' | 'special'
    frags: [
      { en: 'thank you', es: 'gracias', pos: 'interj' },
      { en: 'at noon', es: 'al mediodía', pos: 'adv' },
      { en: 'a lot of', es: 'mucho', pos: 'quant' },
      { en: 'lots of', es: 'mucho', pos: 'quant' },
      { en: 'a little', es: 'un poco', pos: 'adv' },
      { en: 'a bit', es: 'un poco', pos: 'adv' },
      { en: 'every day', es: 'todos los días', pos: 'adv' },
      { en: 'every morning', es: 'todas las mañanas', pos: 'adv' },
      { en: 'every night', es: 'todas las noches', pos: 'adv' },
      { en: 'right now', es: 'ahora mismo', pos: 'adv' },
      { en: 'next to', es: 'al lado de', pos: 'prep' },
      { en: 'in front of', es: 'delante de', pos: 'prep' },
      { en: 'far from', es: 'lejos de', pos: 'prep' },
      { en: 'on top of', es: 'encima de', pos: 'prep' },
      { en: 'across from', es: 'enfrente de', pos: 'prep' },
      { en: 'in the morning', es: 'por la mañana', pos: 'adv' },
      { en: 'in the afternoon', es: 'por la tarde', pos: 'adv' },
      { en: 'at night', es: 'por la noche', pos: 'adv' },
      { en: 'at home', es: 'en casa', pos: 'adv' },
      { en: 'at work', es: 'en el trabajo', pos: 'adv' },
      { en: 'at school', es: 'en la escuela', pos: 'adv' },
      { en: 'of course', es: 'claro', pos: 'interj' },
      { en: 'years old', es: 'años', pos: 'special' }
    ]
  };
});
