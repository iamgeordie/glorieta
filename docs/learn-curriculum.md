# The Learn curriculum

Thirteen modules, in the order a newcomer should take them: first what a road is and what its signs
mean, then the rules that depend on both, then risk, emergencies and paperwork. The sequence is ours.
The **topics** follow the official syllabus the DGT gives driving schools for the permiso B theory
course (*Fichas de seguimiento de la enseñanza de la conducción*, Subdirección General de Formación y
Educación Vial, April 2023, NIPO 128-23-005-9): specific regulations; signs; road safety; risk
factors; vulnerable users; collisions; driving and the environment. We use that document only as a
topic list. Facts are free to teach; the DGT's manuals and their wording are not copied
(see [`learn-authoring.md`](learn-authoring.md)).

Each lesson must `cover` the listed bank questions, so that a quiz question a learner misses links to
the lesson that teaches it. List a bank question id in a lesson's `covers` only if that lesson really
teaches its answer.

| # | Module id | Title (es / en) | Official topic |
|---|---|---|---|
| 1 | `road` | La vía y los carriles / Roads and lanes | Types and parts of the road; use of lanes and the hard shoulder |
| 2 | `signs` | Señales y marcas viales / Signs and road markings | Priority and format of signals; vertical, horizontal, temporary, agents, traffic lights |
| 3 | `speed` | Límites de velocidad / Speed limits | Speed limits; adapting speed |
| 4 | `priority` | Prioridad, intersecciones y semáforos / Right of way, junctions and traffic lights | Right of way and junctions |
| 5 | `roundabouts` | Glorietas / Roundabouts | (done: the pilot) |
| 6 | `overtaking` | Adelantamientos, giros y marcha atrás / Overtaking, turning and reversing | Lateral movements and overtaking; changing direction and way; reversing; signaling maneuvers |
| 7 | `situations` | Parada, estacionamiento, autopistas y túneles / Stopping, parking, motorways and tunnels | Stopping and parking; motorways; tunnels and level crossings |
| 8 | `safety` | Seguridad: cinturón, móvil, distancia y ayudas / Safety: seat belts, phones, distance and driver aids | Seat belts and child restraints; distractions; safety distance; active and passive safety; ADAS; defensive driving |
| 9 | `alcohol` | Alcohol, drogas, medicamentos y fatiga / Alcohol, drugs, medicines and fatigue | Alcohol; drugs; illness and medication; sleep and fatigue |
| 10 | `hazards` | Percepción del riesgo y usuarios vulnerables / Hazard perception and vulnerable users | Inexperience; decision making; emotions; weather; distractions; pedestrians, cyclists, motorcyclists, e-scooters |
| 11 | `emergencies` | Accidentes y primeros auxilios / Collisions and first aid | Protect, alert, help (PAS); first aid; breakdowns |
| 12 | `equipment` | El vehículo: documentos, luces y mantenimiento / The vehicle: documents, lights and upkeep | Vehicle features and equipment; documents; roadworthiness (ITV); lighting; load; maintenance; efficient driving |
| 13 | `docs` | Permisos, puntos y sanciones / Licenses, points and penalties | Driver's license classes, validity, points; the exam |

Category ids already exist in `src/data/categories.ts` (`road` and `emergencies` are new). `emergencies`
holds three older bank questions whose ids still start `situations-` (`situations-01..03`).

## Per-module briefs

Law sources are starting points. Search with `scripts/boe.mjs <id> grep <word>`; the article numbers
below are hints from the bank's existing citations, **not facts**: open each one.

### 1. `road`: La vía y los carriles
- **Bank questions:** none exist. Write the checks.
- **Read:** LSV Anexo I (basic definitions: vía, calzada, carril, arcén, mediana, autopista, autovía,
  vía para automóviles, carretera convencional, travesía, vía urbana, zona peatonal, etc.); RGC
  chapter on circulating on the right and using lanes and the hard shoulder (grep `arcén`, `carril`).
- **Lessons (3 to 4):** road types; parts of the road; which lane and when (right-hand traffic, lane
  discipline, special lanes: bus, reserved, reversible, with the rule on each); the hard shoulder (who may use it).
- **Figures:** a plan view of a divided road with lettered parts (calzada, arcén, mediana, carril),
  legend in the lesson. A multi-lane road showing correct lane use.
- **Watch:** definitions must match the Anexo I wording closely in meaning. Do not invent lane etiquette
  as law.

### 2. `signs`: Señales y marcas viales
- **Bank questions:** `signs-01..08`. **Signs:** there are 128 official signs in `signs.json`; every
  one should appear in a `signs` block somewhere in this module (the validator notes any that do not).
  Group them by meaning, not by catalogue order, and keep each strip to about 4 to 8 signs.
- **Read:** the RGC articles on the priority between signals, the families of signals, and the Anexo I
  catalogue; the Anexo's marking section for road markings (grep `marca vial`, `línea`).
- **Lessons (5 to 6):** the order of priority between signals (who obeys whom: agents, temporary signs,
  traffic lights, vertical signs, markings) and the families; warning signs (48: split into two
  lessons by theme); priority and prohibition/restriction signs; mandatory and end-of-restriction
  signs; road markings (continuous and dashed lines, edge lines, crossings, stop and yield lines).
- **Figures:** marking diagrams (a continuous line with a dashed line: what each side may do). Sign
  *images* come only from `signs`; do not redraw signs.
- **Watch:** use the sign's official name from `signs.json` and say what the driver must do, not just
  what it looks like. Shape and color families (triangle red border = warning, etc.) are in the catalogue.

### 3. `speed`: Límites de velocidad
- **Bank questions:** `speed-01..05`. **Signs:** the R-301 series and end-of-limit signs.
- **Read:** RGC arts. 45 to 52 and the speed articles for specific vehicles; urban limits changed by
  RD 970/2020 (art. 50: 20, 30, 50 km/h by road type).
- **Lessons (3 to 4):** limits in towns; limits outside towns by road type and vehicle; adapting speed
  to conditions (art. 46); how limits are signed and end.
- **Figures:** an animation of stopping distance (reaction then braking) is a good one: a car that
  keeps moving during reaction time and then stops, at two speeds. Keep the numbers to what a source
  gives; otherwise show proportion only and say so.
- **Watch:** exact km/h, and which road type each belongs to. Add mph in `us` blocks.

### 4. `priority`: Prioridad, intersecciones y semáforos
- **Bank questions:** `priority-01..11`. **Signs:** R-1, R-2, R-5, R-6, priority and intersection
  warning signs.
- **Read:** RGC arts. 56 to 65 (intersections, signed and unsigned, priority), the articles on traffic
  lights (grep `semáforo`), on agents' signals, on priority vehicles and on pedestrians at crossings.
- **Lessons (4 to 5):** who goes first with no signs (priority from the right and its exceptions);
  priority signs and stops; traffic lights (circular, arrow, flashing amber, pedestrian);
  agents and priority vehicles; pedestrians at crossings.
- **Figures:** animated junctions are valuable here: who goes first at an unsigned junction, a stop
  at a priority road, an emergency vehicle approaching.
- **Watch:** the order of authority (an agent's signal outranks a traffic light) must come from the
  articles. Do not repeat the roundabout rules; link by saying "see the Roundabouts module".

### 5. `roundabouts`: done
The pilot. Do not edit.

### 6. `overtaking`: Adelantamientos, giros y marcha atrás
- **Bank questions:** `overtaking-01..07`, `hazards-05`. **Signs:** the no-overtaking signs and
  their ends.
- **Read:** RGC arts. 74 to 89 (lane changes, turns, U-turns, overtaking, where it is forbidden,
  cyclists: art. 85.4 as amended by RD 518/2026, the 20 km/h rule from 2026-10-01), the article on
  reversing, arts. 108 to 110 (signaling), and the marking rules for continuous and dashed lines.
- **Lessons (4 to 5):** overtaking step by step; where overtaking is forbidden; overtaking cyclists
  and other vulnerable road users; turning and changing direction (and U-turns); reversing; signaling.
- **Figures:** the animated overtaking maneuver (look, signal, pass, return) with a continuous line
  variant; a turn at a junction.
- **Watch:** this is a high-risk area: quote exact distances and conditions from the articles.

### 7. `situations`: Parada, estacionamiento, autopistas y túneles
- **Bank questions:** `situations-04..07`. **Signs:** no-parking and no-stopping signs, motorway
  signs, tunnel signs.
- **Read:** RGC arts. 90 to 96 (stopping and parking, where forbidden, art. 94), the motorway and
  dual-carriageway articles (grep `autopista`), tunnels (grep `túnel`), level crossings (grep `paso a nivel`),
  and LSV art. 105 where the bank cites it.
- **Lessons (4):** stopping vs parking and where each is forbidden; parking correctly; motorways and
  dual carriageways (entering, exiting, lanes); tunnels and level crossings.
- **Figures:** a street plan showing forbidden stopping places; a motorway entry with the
  acceleration lane.

### 8. `safety`: Seguridad: cinturón, móvil, distancia y ayudas
- **Bank questions:** `safety-01..06`.
- **Read:** RGC arts. 117 to 119 (belts, child restraints, helmets), LSV art. 13 and RGC art. 18
  (attention, phone, headphones), the safety-distance articles (grep `distancia de seguridad`), the
  lights-in-tunnels articles the bank cites. For ADAS and active/passive safety use official DGT
  pages only if you fetch them in this session; otherwise teach only what the regulations say, in `tip`s.
- **Lessons (4):** belts and child restraints; phone and distractions at the wheel; safety distance
  (reaction and braking distance, a diagram); active and passive safety and driver aids.
- **Watch:** the two-second gap and similar are DGT guidance: `tip`, labeled as such. Child
  restraint rules depend on height: copy the thresholds from the article.

### 9. `alcohol`: Alcohol, drogas, medicamentos y fatiga
- **Bank questions:** `alcohol-01..08`.
- **Read:** the RGC articles on alcohol and drugs (grep `alcohol`, `tasa`), LSV arts. 14 and 77
  (offences), Código Penal arts. 379 to 385, and the articles on medicines.
- **Lessons (4):** alcohol limits (general vs novice and professional) and how they are tested; drugs;
  medicines and illness; fatigue and sleep.
- **Watch:** the limits are in mg per liter of exhaled air and g per liter of blood; get both, and
  who the lower limit applies to, from the text. Fatigue and rest advice is guidance, not law.
  The US comparison (BAC) is only useful if you can state it correctly and broadly.

### 10. `hazards`: Percepción del riesgo y usuarios vulnerables
- **Bank questions:** `hazards-01..04` (`hazards-05` belongs to `overtaking`).
- **Read:** RGC arts. 3 and 18 (attention), 45 and 46 (speed adapted to circumstances, vulnerable
  users), the articles on pedestrians, cyclists, and personal mobility vehicles (VMP) (grep `ciclo`,
  `peatón`, `movilidad personal`), and the articles on adverse conditions (grep `niebla`, `lluvia`).
- **Lessons (4 to 5):** how risk perception works (look, anticipate, decide) with examples; human
  factors (inexperience, emotion, distraction); weather and visibility; pedestrians and children;
  cyclists, motorcyclists and e-scooters. The theory exam has one video hazard question (see
  `facts.ts`): explain how to approach it.
- **Figures:** hazard scenes (a parked van before a crossing; a ball between cars).
- **Watch:** psychology is guidance. The legal parts are the duty of attention and moderating speed.

### 11. `emergencies`: Accidentes y primeros auxilios
- **Bank questions:** `situations-01`, `situations-02`, `situations-03`.
- **Read:** RGC art. 129 (duty to help) and the articles on warning signals and emergency lights
  (V16 beacon and triangles: art. 130.4 and its source norm, the bank cites RD 159/2021; read what
  is in force today), LSV art. 51 where it applies, and the DGT's PAS and 112 guidance if fetched.
- **Lessons (3):** protect, alert, help (PAS); what to say to 112; basic first aid and what not to do
  (the helmet question); breakdowns and warning devices.
- **Watch:** first aid is guidance, not an article: keep it short, cautious, and say "call 112 and follow
  their instructions". Never invent a medical procedure. If the DGT page cannot be fetched, teach PAS and
  112 only.

### 12. `equipment`: El vehículo: documentos, luces y mantenimiento
- **Bank questions:** `equipment-01..04`.
- **Read:** RGV (documents, ITV: also RD 920/2017 art. 6.1, find its BOE id by web search and check it with
  `boe.mjs <id> index`), RGC lighting articles (arts. 97 to 104), load articles, and Ley 7/2021 art. 14
  for low-emission zones (`BOE-A-2021-8447`).
- **Lessons (4):** documents the vehicle and driver must carry; roadworthiness (ITV) schedules; lights
  (when, which, signals of emergency); load, tires and upkeep, efficient driving.
- **Watch:** ITV intervals depend on vehicle type and age: copy them from the text. Eco-driving is guidance
  (`tip`s).

### 13. `docs`: Permisos, puntos y sanciones
- **Bank questions:** `docs-01..04`.
- **Read:** LSV points articles and Anexo II (the point loss table); RGCond (classes, validity, the
  theory exam validity art. 53.1, documents). Read `src/data/facts.ts` and **do not contradict it**;
  some items there are marked "verify" because they are unconfirmed. Only teach a fact about a US
  license, exchange or recognition if you verify it from an official source (grep the RGCond and dgt.es);
  otherwise leave it out and say so.
- **Lessons (3 to 4):** classes of license and what B allows; the points system (start, loss, recovery,
  novice rules); validity and renewal; the exam path (theory, practical, validity of the theory pass).
- **Watch:** points tables are exact; copy them. Do not teach fine amounts you did not read.
