(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.data = root.Hablemos.data || {}; root.Hablemos.data.why = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    'agree-gender': 'Spanish nouns are masculine or feminine, and articles and adjectives change to match: el libro nuevo, la casa nueva.',
    'agree-number': 'When a noun is plural, its article and adjectives become plural too: los libros nuevos.',
    'order-noun-adj': 'Most Spanish adjectives go after the noun: un coche rojo, not "un rojo coche".',
    'pre-adj': 'A few common adjectives such as bueno, malo, mucho and poco usually go before the noun.',
    'apocope': 'Bueno and malo shorten to buen and mal before a masculine singular noun, and grande shortens to gran before any singular noun.',
    'drop-subject': 'The verb ending already shows who is acting, so Spanish usually leaves out yo, tú, nosotros and similar subject pronouns.',
    'keep-subject': 'Él, ella, ellos and ellas are kept when the verb ending alone would leave the person unclear.',
    'ser': 'Ser describes identity, origin, profession, time, and lasting qualities: Soy estudiante. Es grande.',
    'estar': 'Estar describes location, ongoing actions and states that can change: Estoy en casa. Está cansado.',
    'ser-estar-unsure': 'English "to be" has two Spanish verbs. ser or estar depends on meaning here, so check which fits.',
    'tener-state': 'Spanish uses tener (to have) for many bodily states where English uses "to be": tengo hambre, tengo frío.',
    'a-personal': 'Spanish puts "a" before a direct object that is a specific person: Veo a María.',
    'contraction': 'The words a + el become al, and de + el become del.',
    'article-el': 'A feminine noun that starts with a stressed a- takes el in the singular for easier pronunciation: el agua, but las aguas.',
    'plural-rule': 'Plurals add -s after a vowel and -es after a consonant. Words ending in -z change to -ces, and an accent can be dropped or added: canción, canciones.',
    'gustar': 'Spanish says "gustar" the other way around: the thing liked is the subject. "I like coffee" is "Me gusta el café", literally "coffee pleases me".',
    'neg': 'To make a sentence negative, put no before the verb.',
    'double-neg': 'Spanish keeps no before the verb even when another negative word follows: No veo nada.',
    'question-inversion': 'In a question with a noun subject, the verb often comes before the subject: ¿Dónde vive María?',
    'question-marks': 'Spanish writes an opening mark ¿ as well as the closing ?, and the same for exclamations with ¡ !.',
    'future-ir-a': 'To say what you are going to do, use ir a plus an infinitive: Voy a comer.',
    'progressive': 'To say what is happening now, use estar plus the -ando or -iendo form: Estoy comiendo.',
    'imperative': 'A bare verb at the start of a sentence is a command. Spanish uses the tú form (or the usted form) of the command.',
    'variant': 'This word differs between Spain and Latin America. The variant setting chose the form.',
    'number-word': 'Numbers are written as words in Spanish text. Uno becomes un or una before a noun.',
    'time-phrase': 'Time uses a fixed pattern: Son las tres, but Es la una for one o\'clock.',
    'por-para': 'English "for" can be por or para in Spanish. Para often shows purpose or a recipient; por often shows cause or exchange. Check which fits.',
    'name': 'A capitalized word that is not in the dictionary is treated as a name and left unchanged.',
    'unknown': 'This word is not in the dictionary, so it is left in [brackets] instead of being guessed.',
    'unsupported': 'Past and "will" tenses are not supported yet, so this part is left in [brackets].'
  };
});
