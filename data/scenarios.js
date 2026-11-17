(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else { root.Hablemos = root.Hablemos || {}; root.Hablemos.data = root.Hablemos.data || {}; root.Hablemos.data.scenarios = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
    {
      id: 's-food', title: 'Ordering at a café', level: 'A1', setting: 'You sit down at a small café.', start: 'a1',
      steps: [
        { id: 'a1', npc: { es: 'Buenas tardes. ¿Qué desea?', en: 'Good afternoon. What would you like?' }, prompt: 'Order a coffee.',
          choices: [
            { es: 'Un café, por favor.', en: 'A coffee, please.', ok: true, fb: 'Polite and clear.', next: 'a2' },
            { es: 'Yo querer café.', en: 'I want coffee.', ok: false, fb: 'Use "quisiera" or "un café, por favor". "Querer" needs to be conjugated.', next: 'a2' },
            { es: 'Adiós.', en: 'Goodbye.', ok: false, fb: 'That is a goodbye, not an order.', next: 'a2' }
          ], accept: ['un cafe por favor', 'quisiera un cafe'] },
        { id: 'a2', npc: { es: '¿Lo quiere con leche o solo?', en: 'Do you want it with milk or black?' }, prompt: 'Say you want milk.',
          choices: [
            { es: 'Con leche, por favor.', en: 'With milk, please.', ok: true, fb: 'Good: "con" means "with".', next: 'a3' },
            { es: 'Sin leche, por favor.', en: 'Without milk, please.', ok: false, fb: '"Sin" means "without", the opposite of what you wanted.', next: 'a2b' },
            { es: 'Tengo leche.', en: 'I have milk.', ok: false, fb: 'That says you have milk. Use "con leche".', next: 'a2b' }
          ], accept: ['con leche por favor', 'con leche'] },
        { id: 'a2b', npc: { es: 'Perdone, ¿con leche o sin leche?', en: 'Sorry, with milk or without milk?' }, prompt: 'Answer again: with milk.',
          choices: [
            { es: 'Con leche, gracias.', en: 'With milk, thank you.', ok: true, fb: 'Good recovery.', next: 'a3' },
            { es: 'No sé.', en: 'I do not know.', ok: false, fb: 'Try to give a clear answer: "con leche".', next: 'a3' }
          ] },
        { id: 'a3', npc: { es: '¿Algo para comer?', en: 'Anything to eat?' }, prompt: 'Ask for a sandwich.',
          choices: [
            { es: 'Sí, un bocadillo, por favor.', en: 'Yes, a sandwich, please.', ok: true, fb: 'Latin America often says "un sándwich".', next: 'a4' },
            { es: 'Sí, una mesa, por favor.', en: 'Yes, a table, please.', ok: false, fb: '"Mesa" is a table. A sandwich is "un bocadillo" or "un sándwich".', next: 'a4' },
            { es: 'No, gracias.', en: 'No, thank you.', ok: true, fb: 'A polite way to decline.', next: 'a4' }
          ] },
        { id: 'a4', npc: { es: 'Son cuatro euros con cincuenta.', en: 'That is four euros fifty.' }, prompt: 'Ask if you can pay by card.',
          choices: [
            { es: '¿Puedo pagar con tarjeta?', en: 'Can I pay by card?', ok: true, fb: 'Perfect.', next: 'a5' },
            { es: '¿Puedo pagar con sopa?', en: 'Can I pay with soup?', ok: false, fb: '"Sopa" is soup. Card is "tarjeta".', next: 'a5' }
          ], accept: ['puedo pagar con tarjeta'] },
        { id: 'a5', npc: { es: 'Sí, claro. Aquí tiene.', en: 'Yes, of course. Here you are.' }, prompt: 'Say thank you.',
          choices: [
            { es: 'Muchas gracias. Buen día.', en: 'Thank you very much. Have a good day.', ok: true, fb: 'A friendly goodbye.', next: 'end' },
            { es: 'De nada.', en: 'You are welcome.', ok: false, fb: 'That is a reply to thanks; here you should thank them.', next: 'end' }
          ] }
      ]
    },
    {
      id: 's-directions', title: 'Asking for directions', level: 'A1', setting: 'You are lost in a small town and stop a passer-by.', start: 'b1',
      steps: [
        { id: 'b1', npc: { es: 'Hola. ¿Necesita ayuda?', en: 'Hello. Do you need help?' }, prompt: 'Ask where the train station is.',
          choices: [
            { es: 'Sí, ¿dónde está la estación de tren?', en: 'Yes, where is the train station?', ok: true, fb: '"Dónde está" is the way to ask where something is.', next: 'b2' },
            { es: 'Sí, ¿cuándo está la estación?', en: 'Yes, when is the station?', ok: false, fb: '"Cuándo" means "when". To ask "where" use "dónde".', next: 'b1b' },
            { es: 'No, gracias.', en: 'No, thank you.', ok: false, fb: 'You are lost, so asking would help.', next: 'b1b' }
          ], accept: ['donde esta la estacion de tren', 'donde esta la estacion'] },
        { id: 'b1b', npc: { es: '¿Busca algo?', en: 'Are you looking for something?' }, prompt: 'Say you are looking for the station.',
          choices: [
            { es: 'Busco la estación de tren.', en: 'I am looking for the train station.', ok: true, fb: 'Good: "busco" is "I look for".', next: 'b2' },
            { es: 'Busca la estación.', en: 'He or she is looking for the station.', ok: false, fb: 'For "I", use "busco".', next: 'b2' }
          ] },
        { id: 'b2', npc: { es: 'Siga recto dos calles y gire a la derecha.', en: 'Go straight two blocks and turn right.' }, prompt: 'Check the direction: which way do you turn?',
          choices: [
            { es: 'Gire a la derecha.', en: 'Turn right.', ok: true, fb: '"Derecha" is right.', next: 'b3' },
            { es: 'Gire a la izquierda.', en: 'Turn left.', ok: false, fb: '"Izquierda" is left. The person said "derecha" (right).', next: 'b3' }
          ] },
        { id: 'b3', npc: { es: 'Está al lado del banco.', en: 'It is next to the bank.' }, prompt: 'Ask if it is far.',
          choices: [
            { es: '¿Está lejos?', en: 'Is it far?', ok: true, fb: 'Short and clear.', next: 'b4' },
            { es: '¿Está cerca?', en: 'Is it close?', ok: true, fb: 'Also a good question.', next: 'b4' },
            { es: '¿Estás lejos?', en: 'Are you far?', ok: false, fb: '"Estás" is "you are". For the station use "está".', next: 'b4' }
          ] },
        { id: 'b4', npc: { es: 'No, está a cinco minutos.', en: 'No, it is five minutes away.' }, prompt: 'Thank them.',
          choices: [
            { es: 'Muchas gracias. Adiós.', en: 'Thank you very much. Goodbye.', ok: true, fb: 'Polite.', next: 'end' },
            { es: 'Lo siento.', en: 'I am sorry.', ok: false, fb: 'That apologizes. To thank, say "gracias".', next: 'end' }
          ] }
      ]
    },
    {
      id: 's-hotel', title: 'Checking into a hotel', level: 'A2', setting: 'You arrive at the hotel reception desk.', start: 'c1',
      steps: [
        { id: 'c1', npc: { es: 'Buenas noches. Bienvenido al hotel.', en: 'Good evening. Welcome to the hotel.' }, prompt: 'Say you have a reservation.',
          choices: [
            { es: 'Buenas noches. Tengo una reserva.', en: 'Good evening. I have a reservation.', ok: true, fb: 'Perfect.', next: 'c2' },
            { es: 'Buenas noches. Quiero reservar una habitación.', en: 'Good evening. I want to reserve a room.', ok: false, fb: 'You already have a reservation, so say "tengo una reserva".', next: 'c1b' },
            { es: 'Buenos días.', en: 'Good morning.', ok: false, fb: 'It is evening, so "buenas noches".', next: 'c2' }
          ], accept: ['tengo una reserva', 'buenas noches tengo una reserva'] },
        { id: 'c1b', npc: { es: 'Muy bien, ¿a qué nombre?', en: 'Very well, under what name?' }, prompt: 'Give your name.',
          choices: [
            { es: 'A nombre de Ana López.', en: 'Under the name Ana López.', ok: true, fb: '"A nombre de" is the usual phrase.', next: 'c3' },
            { es: 'Me llamo Ana López.', en: 'My name is Ana López.', ok: true, fb: 'Also fine.', next: 'c3' }
          ] },
        { id: 'c2', npc: { es: '¿A qué nombre, por favor?', en: 'Under what name, please?' }, prompt: 'Give your name.',
          choices: [
            { es: 'A nombre de Ana López.', en: 'Under the name Ana López.', ok: true, fb: 'Good.', next: 'c3' },
            { es: 'Mi nombre es hotel.', en: 'My name is hotel.', ok: false, fb: 'Say your own name.', next: 'c3' }
          ] },
        { id: 'c3', npc: { es: 'Aquí está su habitación: la 204. ¿Cuántas noches se queda?', en: 'Here is your room: 204. How many nights are you staying?' }, prompt: 'Say you stay three nights.',
          choices: [
            { es: 'Me quedo tres noches.', en: 'I am staying three nights.', ok: true, fb: 'Correct.', next: 'c4' },
            { es: 'Me quedo tres días.', en: 'I am staying three days.', ok: true, fb: 'Also understood; hotels count "noches".', next: 'c4' },
            { es: 'Tengo tres noches.', en: 'I have three nights.', ok: false, fb: 'Use "me quedo" to say how long you are staying.', next: 'c4' }
          ] },
        { id: 'c4', npc: { es: '¿Necesita algo más?', en: 'Do you need anything else?' }, prompt: 'Ask what time breakfast is.',
          choices: [
            { es: '¿A qué hora es el desayuno?', en: 'What time is breakfast?', ok: true, fb: 'Good question.', next: 'c5' },
            { es: '¿Qué hora es el desayuno?', en: 'What hour is breakfast?', ok: false, fb: 'Say "¿A qué hora es...?" for "at what time".', next: 'c5' }
          ], accept: ['a que hora es el desayuno'] },
        { id: 'c5', npc: { es: 'El desayuno es de siete a diez.', en: 'Breakfast is from seven to ten.' }, prompt: 'Say thank you and good night.',
          choices: [
            { es: 'Gracias. Buenas noches.', en: 'Thank you. Good night.', ok: true, fb: 'Nicely done.', next: 'end' },
            { es: 'Hasta mañana, gracias.', en: 'See you tomorrow, thanks.', ok: true, fb: 'Also fine.', next: 'end' }
          ] }
      ]
    },
    {
      id: 's-pharmacy', title: 'At the pharmacy', level: 'A2', setting: 'You feel unwell and walk into a pharmacy.', start: 'd1',
      steps: [
        { id: 'd1', npc: { es: 'Buenos días. ¿En qué puedo ayudarle?', en: 'Good morning. How can I help you?' }, prompt: 'Say that your head hurts.',
          choices: [
            { es: 'Me duele la cabeza.', en: 'My head hurts.', ok: true, fb: 'Spanish says "the head hurts me".', next: 'd2' },
            { es: 'Tengo dolor de cabeza.', en: 'I have a headache.', ok: true, fb: 'Also correct.', next: 'd2' },
            { es: 'Mi cabeza es mala.', en: 'My head is bad.', ok: false, fb: 'Say "me duele la cabeza".', next: 'd1b' }
          ], accept: ['me duele la cabeza', 'tengo dolor de cabeza'] },
        { id: 'd1b', npc: { es: '¿Le duele algo? ¿Qué le pasa?', en: 'Does something hurt? What is the matter?' }, prompt: 'Explain again.',
          choices: [
            { es: 'Me duele la cabeza.', en: 'My head hurts.', ok: true, fb: 'Yes.', next: 'd2' },
            { es: 'Estoy enfermo.', en: 'I am sick.', ok: true, fb: 'General but understood.', next: 'd2' }
          ] },
        { id: 'd2', npc: { es: '¿Tiene fiebre?', en: 'Do you have a fever?' }, prompt: 'Say you do not have a fever.',
          choices: [
            { es: 'No, no tengo fiebre.', en: 'No, I do not have a fever.', ok: true, fb: 'Good.', next: 'd3' },
            { es: 'Sí, tengo fiebre.', en: 'Yes, I have a fever.', ok: false, fb: 'The task was to say you do not have one.', next: 'd3' }
          ] },
        { id: 'd3', npc: { es: 'Tome una pastilla cada ocho horas.', en: 'Take a pill every eight hours.' }, prompt: 'Ask if you need a prescription.',
          choices: [
            { es: '¿Necesito una receta?', en: 'Do I need a prescription?', ok: true, fb: '"Receta" is a prescription (and a recipe).', next: 'd4' },
            { es: '¿Necesito una cita?', en: 'Do I need an appointment?', ok: false, fb: '"Cita" is an appointment.', next: 'd4' }
          ], accept: ['necesito una receta'] },
        { id: 'd4', npc: { es: 'No, no hace falta. Son seis euros.', en: 'No, it is not necessary. That is six euros.' }, prompt: 'Pay and say thanks.',
          choices: [
            { es: 'Aquí tiene. Gracias.', en: 'Here you are. Thank you.', ok: true, fb: 'Good.', next: 'd5' },
            { es: 'No tengo dinero.', en: 'I do not have money.', ok: false, fb: 'You need to pay: say "aquí tiene".', next: 'd5' }
          ] },
        { id: 'd5', npc: { es: 'Que se mejore.', en: 'Get well soon.' }, prompt: 'Reply politely.',
          choices: [
            { es: 'Gracias. Adiós.', en: 'Thanks. Goodbye.', ok: true, fb: 'Polite.', next: 'end' },
            { es: 'Igualmente.', en: 'Likewise.', ok: false, fb: '"Igualmente" wishes the same back; here you should just thank them.', next: 'end' }
          ] }
      ]
    }
  ];
});
