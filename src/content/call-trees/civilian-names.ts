// Civilian names for call-tree casts (content v13). Common names, on purpose: the first names are the
// ones most often given to people in the United States across the communities a city has, and the
// surnames are the most common in the census, so a cast reads like people you would meet and not like
// a list of rare names (owner, 2026-10-23). Deliberately disjoint from the officer
// catalog (content/personas.json) and the Command Staff managers (sim/command-staff.ts MANAGERS),
// so a person inside a call never shares a name with someone on the player's roster or HQ screen;
// a test holds the lists apart. Drawn by pronoun set only: identity
// never determines a role, danger, cooperation or any gameplay score.

export const CIVILIAN_FIRST_NAMES = {
  she: [
    'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen',
    'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle',
    'Carol', 'Amanda', 'Melissa', 'Deborah', 'Stephanie', 'Rebecca', 'Laura', 'Sharon', 'Cynthia', 'Kathleen',
    'Amy', 'Angela', 'Shirley', 'Anna', 'Brenda', 'Pamela', 'Nicole', 'Katherine', 'Christine', 'Janet',
    'Catherine', 'Maria', 'Heather', 'Diane', 'Olivia', 'Julie', 'Joyce', 'Victoria', 'Kelly', 'Christina',
    'Lauren', 'Megan', 'Andrea', 'Cheryl', 'Hannah', 'Jacqueline', 'Martha', 'Gloria', 'Teresa', 'Sara',
    'Janice', 'Marie', 'Julia', 'Grace', 'Judy', 'Rose', 'Beverly', 'Denise', 'Marilyn', 'Amber',
    'Danielle', 'Brittany', 'Diana', 'Abigail', 'Jane', 'Lori', 'Alexis', 'Tiffany', 'Kayla', 'Latoya',
    'Keisha', 'Tamika', 'Monique', 'Yvonne', 'Carmen', 'Rosa', 'Guadalupe', 'Alicia', 'Emma', 'Ava',
    'Mia', 'Chloe', 'Zoe', 'Isabella', 'Valeria', 'Aaliyah', 'Imani', 'Jasmine', 'Destiny', 'Fatima',
    'Aisha', 'Layla', 'Gabriela', 'Esperanza', 'Veronica', 'Natalie', 'Samantha', 'Rachel', 'Courtney', 'Erin',
    'Monica', 'Wendy', 'Tracy',
  ],
  he: [
    'James', 'Robert', 'John', 'Michael', 'David', 'William', 'Richard', 'Joseph', 'Charles', 'Christopher',
    'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin',
    'Brian', 'George', 'Timothy', 'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary',
    'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin', 'Samuel',
    'Gregory', 'Frank', 'Alexander', 'Raymond', 'Patrick', 'Jack', 'Dennis', 'Jerry', 'Tyler', 'Aaron',
    'Jose', 'Adam', 'Nathan', 'Henry', 'Zachary', 'Douglas', 'Peter', 'Kyle', 'Ethan', 'Walter',
    'Jeremy', 'Harold', 'Keith', 'Christian', 'Roger', 'Terry', 'Austin', 'Sean', 'Gerald', 'Carl',
    'Dylan', 'Arthur', 'Lawrence', 'Bryan', 'Joe', 'Billy', 'Bruce', 'Albert', 'Willie', 'Gabriel',
    'Alan', 'Juan', 'Wayne', 'Ralph', 'Roy', 'Eugene', 'Randy', 'Vincent', 'Russell', 'Louis',
    'Philip', 'Bobby', 'Johnny', 'Bradley', 'Carlos', 'Luis', 'Jorge', 'Miguel', 'Antonio', 'Javier',
    'Pedro', 'Manuel', 'Ricardo', 'Sergio', 'Oscar', 'Victor', 'Hector', 'Ruben', 'Mario', 'Francisco',
    'Alejandro', 'Jamal', 'Terrell', 'Darnell', 'Malik', 'Hassan', 'Ahmed', 'Ali', 'Mohammed', 'Kenji',
    'Dwayne', 'Tyrone', 'Marvin', 'Curtis', 'Clarence', 'Leon', 'Calvin',
  ],
  they: [
    'Alex', 'Taylor', 'Casey', 'Riley', 'Avery', 'Cameron', 'Dakota', 'Jamie', 'Skyler', 'Quinn',
    'Parker', 'Reese', 'Charlie', 'Drew', 'Kris', 'Lee', 'Pat', 'Sydney', 'Devon', 'Harper',
    'Blake', 'Hayden', 'Peyton', 'Emerson', 'Finley', 'Kendall', 'Sasha', 'Jules', 'Rowan', 'Logan',
    'Jesse', 'Ari', 'Remy', 'Sage', 'Tatum',
  ],
} as const;

export const CIVILIAN_SURNAMES: readonly string[] = [
    'Smith', 'Johnson', 'Brown', 'Jones', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez',
    'Gonzalez', 'Anderson', 'Moore', 'Jackson', 'Martin', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez',
    'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Torres',
    'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
    'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Cruz', 'Edwards', 'Collins',
    'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Cooper', 'Peterson', 'Bailey',
    'Reed', 'Howard', 'Ramos', 'Cox', 'Ward', 'Richardson', 'Watson', 'Chavez', 'Wood', 'Bennett',
    'Gray', 'Mendoza', 'Ruiz', 'Hughes', 'Price', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long',
    'Ross', 'Foster', 'Jimenez', 'Powell', 'Jenkins', 'Perry', 'Sullivan', 'Coleman', 'Butler', 'Henderson',
    'Barnes', 'Fisher', 'Vasquez', 'Simmons', 'Romero', 'Patterson', 'Hamilton', 'Graham', 'Reynolds', 'Griffin',
    'Wallace', 'Moreno', 'West', 'Cole', 'Hayes', 'Bryant', 'Herrera', 'Gibson', 'Tran', 'Medina',
    'Aguilar', 'Stevens', 'Murray', 'Ford', 'Castro', 'Marshall', 'Owens', 'Harrison', 'Fernandez', 'McDonald',
    'Woods', 'Washington', 'Kennedy', 'Wells', 'Freeman', 'Webb', 'Tucker', 'Guzman', 'Burns', 'Crawford',
    'Olson', 'Simpson', 'Porter', 'Hunter', 'Gordon', 'Mendez', 'Silva', 'Shaw', 'Snyder', 'Mason',
    'Dixon', 'Munoz', 'Hunt', 'Hicks', 'Holmes', 'Palmer', 'Wagner', 'Black', 'Robertson', 'Boyd',
    'Stone', 'Salazar', 'Fox', 'Warren', 'Mills', 'Meyer', 'Rice', 'Schmidt', 'Garza', 'Daniels',
    'Ferguson', 'Nichols', 'Stephens', 'Soto', 'Weaver', 'Gardner', 'Payne', 'Grant', 'Dunn', 'Spencer',
    'Hawkins', 'Arnold', 'Pierce', 'Vazquez', 'Hansen', 'Peters', 'Santos', 'Hart', 'Knight', 'Elliott',
    'Cunningham', 'Duncan', 'Armstrong', 'Hudson', 'Carroll', 'Lane', 'Andrews', 'Alvarado', 'Ray', 'Delgado',
    'Berry', 'Perkins', 'Hoffman', 'Johnston', 'Matthews', 'Pena', 'Richards', 'Contreras', 'Willis', 'Carpenter',
    'Sandoval', 'Guerrero', 'Chapman', 'Rios', 'Estrada', 'Ortega', 'Watkins', 'Greene', 'Nunez', 'Wheeler',
    'Valdez', 'Burke', 'Larson', 'Maldonado', 'Morrison', 'Franklin', 'Carlson', 'Dominguez', 'Carr', 'Lawson',
    'Jacobs', 'O\'Brien', 'Lynch', 'Vega', 'Bishop', 'Montgomery', 'Oliver', 'Jensen', 'Harvey', 'Williamson',
    'Gilbert', 'Dean', 'Sims', 'Espinoza', 'Howell', 'Li', 'Wong', 'Reid', 'Hanson', 'Le',
    'McCoy', 'Garrett', 'Burton', 'Fuller', 'Wang', 'Weber', 'Welch', 'Lucas', 'Marquez', 'Fields',
    'Yang', 'Little', 'Banks', 'Padilla', 'Day', 'Walsh', 'Bowman', 'Schultz', 'Luna', 'Fowler',
    'Mejia', 'Davidson', 'Acosta', 'Brewer', 'Holland', 'Juarez', 'Newman', 'Pearson', 'Cortez', 'Huang',
    'Lin', 'Shah', 'Khan', 'Hussain', 'Cohen', 'Katz', 'Friedman', 'Kowalski', 'Nowak', 'Rossi',
    'Russo', 'Ferrari', 'Bianchi',
];
