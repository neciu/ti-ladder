// tslint:disable-next-line:no-var-requires
const trueskill = require('trueskill');

type PlayerName = string;
type RawGameResult = PlayerName[];
interface IPlayerTrueSkill {
  playerName: PlayerName;
  trueSkill: number;
}
interface IPlayer {
  name: PlayerName;
  skill: [number, number];
  rank: number;
}
interface IPlayers {
  [name: string]: IPlayer;
}

function onOpen(): void {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Ladder')
    .addItem('Recalculate True Skill', 'onRecalculateTrueSkill')
    .addToUi();
}

function onRecalculateTrueSkill(): void {
  const rawGameResults = readRawGameResults();
  const trueSkillResults = calculateTrueSkill(rawGameResults);
  writeTrueSkillResults(trueSkillResults);
}

function readRawGameResults(): RawGameResult[] {
  const rawValues = SpreadsheetApp.getActiveSheet()
    .getRange('B2:G')
    .getValues() as string[][];

  return rawValues.reduce((acc: RawGameResult[], row: RawGameResult) => {
    const playersInRow: RawGameResult = row.filter(value => value !== '');
    return playersInRow.length === 0 ? acc : [...acc, playersInRow];
  }, []);
}

function calculateTrueSkill(gameResults: RawGameResult[]): IPlayerTrueSkill[] {
  let players: IPlayers = {};

  gameResults.forEach(gameResult => {
    gameResult.forEach((playerName, index) => {
      if (playerExists(playerName, players)) {
        players = setPlayerRank(playerName, index + 1, players);
      } else {
        players = createPlayer(playerName, index + 1, players);
      }
    });

    players = updateSkill(gameResult, players);
  });

  return mapPlayersToFinalSkills(players);
}

function playerExists(name: string, players: IPlayers): boolean {
  return name in players;
}

function setPlayerRank(
  name: string,
  rank: number,
  players: IPlayers,
): IPlayers {
  return {
    ...players,
    [name]: {
      ...players[name],
      rank,
    },
  };
}

function createPlayer(name: string, rank: number, players: IPlayers): IPlayers {
  const initMu = 25.0;
  const initSigma = 25.0 / 3.0;
  return {
    ...players,
    [name]: {
      name,
      rank,
      skill: [initMu, initSigma],
    },
  };
}

function writeTrueSkillResults(trueSkillResults: IPlayerTrueSkill[]) {
  SpreadsheetApp.getActiveSheet()
    .getRange('I2:J')
    .clearContent();
  const values = trueSkillResults
    .sort((a, b) => b.trueSkill - a.trueSkill)
    .reduce(
      (acc, result) => [...acc, [result.playerName, result.trueSkill]],
      [],
    );
  SpreadsheetApp.getActiveSheet()
    .getRange(`I2:J${1 + values.length}`)
    .setValues(values);
}

function updateSkill(game: RawGameResult, players: IPlayers): IPlayers {
  const temporaryPlayers: IPlayer[] = game.map(name =>
    clonePlayer(players[name]),
  );

  trueskill.AdjustPlayers(temporaryPlayers);

  return temporaryPlayers.reduce(
    (acc, player) => ({
      ...acc,
      [player.name]: player,
    }),
    players,
  );

  function clonePlayer(player: IPlayer): IPlayer {
    return {
      name: player.name,
      rank: player.rank,
      skill: [player.skill[0], player.skill[1]],
    };
  }
}

function mapPlayersToFinalSkills(players: IPlayers): IPlayerTrueSkill[] {
  return Object.keys(players)
    .map(name => players[name])
    .sort((a, b) => b.skill[0] - a.skill[0])
    .map(player => ({
      playerName: player.name,
      trueSkill: player.skill[0],
    }));
}

// @ts-ignore
global.onOpen = onOpen;

// @ts-ignore
global.onRecalculateTrueSkill = onRecalculateTrueSkill;
