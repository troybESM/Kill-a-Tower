# Requirements Document

## Introduction

This feature is a browser-based roguelike deckbuilder game — a personal-use clone of Slay the Spire 2 — that the player runs for enjoyment and to experiment with mechanic and content tweaks. The game runs entirely client-side with no server component and deploys as static files to an Amazon S3 static website bucket. It is built with vanilla HTML, CSS, and JavaScript with no framework and no build step. All game content (cards, enemies, relics, and map layout) is defined in data files so that gameplay values can be adjusted by editing data rather than code.

This first version delivers a vertical slice: one playable character, a starter set of 15 to 20 cards, a small set of enemies, a single act with a short branching map ending in a boss, and a basic set of relics. The slice forms a complete, replayable run loop that can be expanded later.

## Glossary

- **Game**: The complete browser-based roguelike deckbuilder application, including all client-side systems.
- **Run**: A single playthrough that begins with a fresh starting deck and ends when the player is defeated or completes the act.
- **Run_State**: The persistent state carried across encounters within a single run, including current hit points, the player's deck, and owned relics.
- **Combat_System**: The subsystem that manages turn-based card combat, including drawing, playing, and discarding cards, energy, block, and enemy actions.
- **Map_System**: The subsystem that generates and manages the branching sequence of encounter nodes for an act, ending in a boss node.
- **Deck**: The collection of cards the player owns during a run; cards are added through rewards.
- **Card**: A playable game piece with an energy cost and one or more effects (for example, dealing damage or gaining block).
- **Draw_Pile**: The face-down stack from which cards are drawn into the hand during combat.
- **Discard_Pile**: The stack where played and discarded cards are placed during combat.
- **Hand**: The set of cards currently available for the player to play during a combat turn.
- **Energy**: The per-turn resource consumed to play cards.
- **Block**: A temporary defensive value that absorbs incoming damage before hit points are reduced.
- **Enemy**: A combat opponent with hit points and behavior driven by intents.
- **Intent**: A displayed indication of the action an enemy will take on its next turn.
- **Relic**: A persistent item owned during a run that provides an ongoing passive effect.
- **Encounter_Node**: A single selectable location on the map, such as a combat, an elite combat, or the boss.
- **Card_Reward**: A post-combat selection in which the player chooses a card to add to the deck or skips the reward.
- **Content_Data**: The data files (JavaScript or JSON) that define cards, enemies, relics, and map layout.
- **Card pool**: The set of distinct cards available to be offered as rewards during a run, drawn from the cards defined in Content_Data.
- **Player**: The person playing the Game.

## Requirements

### Requirement 1: Client-side static deployment

**User Story:** As the player, I want the game to run entirely in my browser from static hosting, so that I can play it from an S3 website without running a server.

#### Acceptance Criteria

1. THE Game SHALL execute all gameplay logic within the browser using client-side HTML, CSS, and JavaScript.
2. THE Game SHALL operate without any server-side component and SHALL NOT issue any network request to a backend during gameplay.
3. IF the Game attempts a network request during gameplay after initial load, THEN THE Game SHALL continue gameplay without functional degradation and SHALL preserve current game state.
4. THE Game SHALL consist only of static files (HTML, CSS, JavaScript, and static asset files such as images and audio) that can be served from an Amazon S3 static website bucket without requiring any server-side execution.
5. WHEN the Game is loaded from a static file host, THE Game SHALL present the initial screen within 5 seconds on a standard broadband connection (10 Mbps or faster) without requiring any build, compilation, or transpilation step at load time.
6. IF a required static asset fails to load during startup, THEN THE Game SHALL display an on-screen error message indicating the load failure and SHALL NOT present a partially initialized game state.

### Requirement 2: No framework, no build step

**User Story:** As the developer-player, I want the game written in vanilla web technologies without a build step, so that I can edit and run it directly.

#### Acceptance Criteria

1. THE Game SHALL be implemented using vanilla HTML, CSS, and JavaScript without any frontend framework or UI library (for example React, Vue, Angular, Svelte, jQuery).
2. THE Game SHALL open and play directly in a browser via file:// or a plain static file server without any bundling, transpilation, or compilation step.
3. IF a referenced JavaScript module fails to load, THEN THE Game SHALL display an on-screen error message rather than a blank screen.
4. THE Game SHALL NOT require any source-to-source transpilation (for example TypeScript, JSX, or SASS) to run.
5. WHEN a source file is edited and the browser is reloaded, THE Game SHALL reflect the change without any intermediate build command.

### Requirement 3: Data-driven content

**User Story:** As the developer-player, I want cards, enemies, relics, and the map defined in data files, so that I can tweak gameplay values by editing data rather than code.

#### Acceptance Criteria

1. THE Game SHALL define all cards, enemies, relics, and map layout in Content_Data files that contain no executable game logic code.
2. WHEN a value in a Content_Data file is changed and the Game is restarted, THE Game SHALL reflect the changed value in gameplay without any recompilation.
3. THE Game SHALL load all Content_Data at startup within 10 seconds to construct the available cards, enemies, relics, and map.
4. IF a Content_Data entry is missing a required field, THEN THE Game SHALL report a loading error identifying the affected file and entry, and SHALL NOT enter gameplay.
5. IF a Content_Data entry contains a value of an invalid type or outside its allowed range, THEN THE Game SHALL report a loading error identifying the affected file and entry, and SHALL NOT enter gameplay.
6. IF a Content_Data file is missing or cannot be read, THEN THE Game SHALL report a loading error identifying the affected file, and SHALL NOT enter gameplay.

### Requirement 4: Vertical slice content scope

**User Story:** As the player, I want a focused starter set of content, so that I have a complete playable run without waiting for full content.

#### Acceptance Criteria

1. THE Game SHALL provide exactly one playable character that has a starting deck of between 8 and 12 cards and a starting hit point value between 50 and 100.
2. THE Content_Data SHALL define between 15 and 20 distinct cards available in the Game, where each card has a unique identifier.
3. IF the count of cards defined in Content_Data is less than 15 or greater than 20, THEN THE Game SHALL fail to start and present an error indicating the card count is outside the required range.
4. THE Content_Data SHALL define at least 3 and at most 10 distinct enemies, where each enemy has a unique identifier.
5. THE Content_Data SHALL define at least 1 and at most 3 boss enemies, where each boss enemy is distinct from the non-boss enemies defined in criterion 4.
6. THE Content_Data SHALL define at least 3 and at most 10 distinct relics, where each relic has a unique identifier.
7. WHEN the Game loads Content_Data at startup, THE Game SHALL complete loading of all defined characters, cards, enemies, boss enemies, and relics within 5 seconds.
8. IF any required content category (character, cards, enemies, boss enemy, relics) defines fewer than its minimum required count, THEN THE Game SHALL fail to start and present an error indicating which content category is incomplete.

### Requirement 5: Turn-based card combat

**User Story:** As the player, I want turn-based card combat with energy, block, and enemy intents, so that I can make tactical decisions each turn.

#### Acceptance Criteria

1. WHEN a combat begins, THE Combat_System SHALL set the Player Energy to the per-turn Energy amount (default 3) and draw the starting Hand of 5 Cards from the Draw_Pile.
2. WHEN the Player plays a Card whose Energy cost is less than or equal to the available Energy, THE Combat_System SHALL deduct the Card Energy cost from the available Energy and apply the Card effects.
3. IF the Player attempts to play a Card whose Energy cost exceeds the available Energy, THEN THE Combat_System SHALL reject the play, leave the Card in the Hand, leave the available Energy unchanged, and present an indication that insufficient Energy is available.
4. WHEN a Card whose effects have been applied is resolved, THE Combat_System SHALL move the Card to the Discard_Pile.
5. WHEN a draw is required and the Draw_Pile is empty, THE Combat_System SHALL shuffle all Cards in the Discard_Pile into the Draw_Pile and then draw the required Cards.
6. IF a draw is required and both the Draw_Pile and the Discard_Pile contain zero Cards, THEN THE Combat_System SHALL draw no Cards and leave the Hand unchanged.
7. WHEN damage is dealt to a target that has a Block value greater than zero, THE Combat_System SHALL reduce the Block by the incoming damage first and reduce hit points only by the amount of damage that exceeds the current Block, to a minimum hit point value of zero.
8. WHILE it is an Enemy turn, THE Combat_System SHALL execute each Enemy action according to the Intent displayed for that Enemy at the start of the turn.
9. WHEN the Player turn begins, THE Combat_System SHALL display the Intent for each living Enemy upcoming turn before the Player can end the current turn.
10. WHEN the Player ends the turn, THE Combat_System SHALL discard all remaining Cards in the Hand and set the Player Block to zero.
11. WHEN every Enemy hit point value reaches zero, THE Combat_System SHALL end the combat as a Player victory.
12. WHEN the Player hit point value reaches zero, THE Combat_System SHALL end the Run as a defeat.

### Requirement 6: Deck building during a run

**User Story:** As the player, I want to build my deck by earning cards after fights, so that my run grows stronger over time.

#### Acceptance Criteria

1. WHEN a combat ends in a Player victory, THE Combat_System SHALL present a Card_Reward offering a selection of 3 distinct Cards drawn from the run's available Card pool.
2. IF fewer than 3 distinct Cards are available in the run's Card pool when a Card_Reward is generated, THEN THE Combat_System SHALL present all remaining available distinct Cards, with a minimum of 1 Card.
3. WHEN the Player selects a Card from the Card_Reward, THE Game SHALL add exactly the selected Card to the Deck and close the Card_Reward.
4. WHEN the Player selects a Card from the Card_Reward, THE Game SHALL restrict the Player to selecting at most 1 Card per Card_Reward.
5. WHERE the Player chooses to skip the Card_Reward, THE Game SHALL leave the Deck unchanged and close the Card_Reward.
6. WHEN a combat ends in a Player victory, THE Combat_System SHALL block progression to the next room until the Player either selects 1 Card from the Card_Reward or skips the Card_Reward.
7. THE Game SHALL use the current Deck, including all Cards added during the run, as the source of Cards for the next combat.

### Requirement 7: Branching map with boss

**User Story:** As the player, I want a short branching map of encounters ending in a boss, so that I can choose a path through the act.

#### Acceptance Criteria

1. WHEN a Run begins, THE Map_System SHALL generate a branching sequence of Encounter_Nodes for the act containing between 10 and 20 Encounter_Nodes arranged in 6 to 10 sequential rows, where the final row contains exactly one boss Encounter_Node.
2. IF the generated map does not terminate in exactly one boss Encounter_Node reachable from every path, THEN THE Map_System SHALL regenerate the map before displaying it to the Player, retrying up to 5 times, and if still unsuccessful SHALL display an error indication that map generation failed.
3. WHILE the Player is on the map, THE Map_System SHALL enable selection only of Encounter_Nodes directly connected by an edge to the Player current Encounter_Node position, and SHALL render all other Encounter_Nodes as non-selectable.
4. IF the Player attempts to select an Encounter_Node that is not directly connected to the Player current position, THEN THE Map_System SHALL reject the selection, leave the Player current position unchanged, and provide a visual indication that the node is unreachable.
5. WHEN the Player selects a reachable Encounter_Node, THE Map_System SHALL update the Player current position to that Encounter_Node and start the encounter associated with that Encounter_Node within 1 second.
6. WHEN the Player defeats the boss Encounter_Node, THE Game SHALL end the Run as a completed act and record the act as completed.

### Requirement 8: Basic relics

**User Story:** As the player, I want to collect relics that grant passive effects, so that my run has persistent upgrades.

#### Acceptance Criteria

1. WHEN the Player acquires a Relic that is not already present in the Run_State, THE Game SHALL add the Relic to the Run_State relic collection and display a visible confirmation of the acquisition to the Player.
2. IF the Player acquires a Relic that is already present in the Run_State, THEN THE Game SHALL reject the duplicate acquisition, leave the existing Run_State relic collection unchanged, and display an indication that the Relic is already owned.
3. WHILE a Relic is owned in the Run_State, THE Game SHALL apply the Relic passive effect continuously for the remainder of the Run until the Run ends.
4. WHEN two or more owned Relics define passive effects that modify the same game value, THE Game SHALL apply all such effects, resolving them in the order the Relics were acquired.
5. WHEN a Run ends, THE Game SHALL remove all Relics from the Run_State and stop applying their passive effects.
6. THE Game SHALL support a Run_State relic collection of up to 999 owned Relics.

### Requirement 9: Persistent run state across fights

**User Story:** As the player, I want my hit points, deck, and relics to carry between fights, so that a run is a continuous journey.

#### Acceptance Criteria

1. THE Run_State SHALL retain the Player current hit points, Deck (all owned cards including cards added or removed during the Run), and owned Relics across all Encounter_Nodes within a single Run without loss or modification between Encounter_Nodes.
2. WHEN a combat ends, THE Combat_System SHALL set the Run_State Player current hit points to the Player hit point value recorded at the moment combat resolved, clamped to the range 0 to the Player maximum hit points.
3. WHEN a new combat begins, THE Combat_System SHALL initialize the Player current hit points from the Run_State value and initialize the available draw pile to contain exactly the cards present in the Run_State Deck.
4. IF the Run_State cannot be read or is missing a required field (Player hit points, Deck, or Relics) when a new combat begins, THEN THE Combat_System SHALL halt combat initialization and present an error indication to the Player without starting the combat.
5. WHEN a Run ends in Player defeat or completion of an act, THE Game SHALL reset the Run_State so that Player current hit points, Deck, and owned Relics contain no values carried over from the ended Run before a new Run begins.
