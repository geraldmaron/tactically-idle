// Civilian names for call-tree casts (content v13). Deliberately disjoint from the officer
// catalog (content/personas.json), so a person inside a call never shares a name with someone on
// the player's roster; a test holds the two lists apart. Drawn by pronoun set only: identity
// never determines a role, danger, cooperation or any gameplay score.

export const CIVILIAN_FIRST_NAMES = {
  she: [
    'Abena', 'Adaeze', 'Agnieszka', 'Aiyana', 'Akosua', 'Alejandra', 'Amara', 'Anahí', 'Annika', 'Aroha',
    'Beatriz', 'Bethany', 'Bronwyn', 'Camila', 'Carmen', 'Chiamaka', 'Claire', 'Amarachi', 'Darya', 'Deborah',
    'Delfina', 'Dilnoza', 'Eleni', 'Esperanza', 'Fatou', 'Florence', 'Gabriela', 'Gulnara', 'Halina', 'Helga',
    'Ifeoma', 'Ilse', 'Ines', 'Iolanthe', 'Jasmine', 'Joanna', 'Juniper', 'Kalani', 'Kamala', 'Katarzyna',
    'Leilani', 'Liesel', 'Lorena', 'Lucinda', 'Mahala', 'Maribel', 'Mireille', 'Mercy', 'Mirela', 'Nadia',
    'Nalani', 'Ngozi', 'Noor', 'Oksana', 'Olivia', 'Paloma', 'Patience', 'Rania', 'Renata', 'Rosalind',
    'Ruth', 'Saoirse', 'Sinead', 'Soledad', 'Sunita', 'Tamar', 'Teodora', 'Thandeka', 'Ursula', 'Vesna',
    'Wanjiru', 'Ximena', 'Yetunde', 'Yolanda', 'Zuleika', 'Zofia',
  ],
  he: [
    'Abdullah', 'Adebayo', 'Ahmad', 'Alejandro', 'Anders', 'Arash', 'Augustin', 'Bartosz', 'Benedict', 'Bilal',
    'Bram', 'Callum', 'Chidi', 'Cormac', 'Dariusz', 'Desmond', 'Diego', 'Dmitri', 'Eamon', 'Efrain',
    'Emeka', 'Esteban', 'Farid', 'Felipe', 'Gareth', 'Gideon', 'Gustavo', 'Hamza', 'Henrik', 'Horace',
    'Ibrahim', 'Ignacio', 'Ivo', 'Jalen', 'Jaroslav', 'Joaquín', 'Kaimana', 'Kwabena', 'Kwame', 'Lachlan',
    'Leandro', 'Lorcan', 'Malik', 'Marek', 'Matthias', 'Milan', 'Nizar', 'Niall', 'Obinna', 'Olusegun',
    'Orlando', 'Pavel', 'Pedro', 'Quentin', 'Raimundo', 'Ramón', 'Reuben', 'Rodrigo', 'Rustam', 'Samuel',
    'Santiago', 'Seamus', 'Silas', 'Stanislav', 'Tariq', 'Teodor', 'Thabo', 'Tobias', 'Ulrich', 'Vasily',
    'Wendell', 'Wiremu', 'Xavier', 'Yusuf', 'Zoltan',
  ],
  they: [
    'Adair', 'Arden', 'Bellamy', 'Briar', 'Carys', 'Darby', 'Ellery', 'Emerson', 'Finley', 'Hollis',
    'Indigo', 'Jules', 'Kendall', 'Lennox', 'Marlowe', 'Oakley', 'Peyton', 'Quinlan', 'Reese', 'Rowan',
    'Sasha', 'Sutton', 'Tatum', 'Wren',
  ],
} as const;

export const CIVILIAN_SURNAMES: readonly string[] = [
  'Abara', 'Achterberg', 'Adeyemi', 'Agarwal', 'Albrecht', 'Amorim', 'Amankwah', 'Andersson', 'Arbeláez', 'Asante',
  'Bachmann', 'Balogun', 'Banerjee', 'Barros', 'Beaumont', 'Belinsky', 'Bjornsson', 'Blackwood', 'Bondarenko', 'Bustamante',
  'Calloway', 'Carvalho', 'Castellanos', 'Chaudhuri', 'Ciobanu', 'Coleridge', 'Crowther', 'Dabrowski', 'Dalgleish', 'Delacroix',
  'Deshpande', 'Dimitrov', 'Dunleavy', 'Echeverría', 'Ekwueme', 'Eriksen', 'Esposito', 'Fairbanks', 'Falconer', 'Ferreira',
  'Fitzgerald', 'Fonseca', 'Gallagher', 'Garibaldi', 'Gathoni', 'Goldberg', 'Gonçalves', 'Grünewald', 'Guerrero', 'Hourani',
  'Halvorsen', 'Hargreaves', 'Hashemi', 'Hendricks', 'Hidalgo', 'Holloway', 'Ibekwe', 'Iglesias', 'Ivanova', 'Jablonski',
  'Jankowski', 'Jaramillo', 'Kariuki', 'Kaszuba', 'Keane', 'Khalil', 'Kowalczyk', 'Krishnan', 'Lachance', 'Langford',
  'Lundgren', 'Llewellyn', 'Lombardi', 'MacAllister', 'Machado', 'Makinde', 'Marchetti', 'Mbatha', 'McCready', 'Mendoza',
  'Molina', 'Montgomery', 'Muriuki', 'Nakashima', 'Navarro', 'Nkemelu', 'Novak', 'Nwachukwu', 'Oduya', 'Okonkwo',
  'Olawale', 'Ortega', 'Pacheco', 'Palmieri', 'Pappas', 'Pellegrino', 'Pemberton', 'Quintero', 'Radcliffe', 'Rahimi',
  'Ramaswamy', 'Ravenscroft', 'Rinaldi', 'Romanov', 'Rothwell', 'Saavedra', 'Salazar', 'Santangelo', 'Schreiber', 'Sepúlveda',
  'Shevchenko', 'Sinclair', 'Sobczak', 'Stavros', 'Szabo', 'Takahashi', 'Talbot', 'Tembo', 'Thorsen', 'Tiwari',
  'Toledo', 'Uchenna', 'Uriarte', 'Valdés', 'Vasquez', 'Velasco', 'Vukovic', 'Wakefield', 'Waweru', 'Whitlock',
  'Wojcik', 'Yamaguchi', 'Yeboah', 'Zamora', 'Zielinski', 'Zuniga',
];
