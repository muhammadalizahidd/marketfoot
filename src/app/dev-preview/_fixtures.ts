import type { SquadMemberView } from "@/features/squad/lineup-manager";

/** Shared fixtures that mirror the sample data drawn in the Figma frames. */
const m = (id: string, name: string, position: string, clubName: string, value: number, acquired: number, isStarter: boolean, owners: number, isCaptain = false): SquadMemberView =>
  ({ id, name, position, clubName, value, acquiredValue: acquired, isStarter, owners, isCaptain });

export const members: SquadMemberView[] = [
  m("1", "Hidalgo", "FW", "Toulouse", 4_450_000, 4_280_000, true, 41, true),
  m("2", "Balogun", "FW", "AS Monaco", 11_430_000, 12_400_000, true, 712),
  m("3", "Pardo", "FW", "Lille", 9_840_000, 8_790_000, true, 56),
  m("4", "Doué", "MF", "Paris Saint-Germain", 14_520_000, 12_300_000, true, 300),
  m("5", "Haidara", "MF", "Lens", 8_650_000, 10_050_000, true, 88),
  m("6", "Neves", "MF", "Paris Saint-Germain", 14_220_000, 7_550_000, true, 120),
  m("7", "Udol", "DF", "Lens", 11_420_000, 5_340_000, true, 64),
  m("8", "Nicolaisen", "DF", "Toulouse", 4_850_000, 4_660_000, true, 23),
  m("9", "Cornelius", "DF", "Auxerre", 3_510_000, 3_650_000, true, 17),
  m("10", "Sidibé", "DF", "Toulouse", 6_520_000, 5_980_000, true, 35),
  m("11", "Hradecki", "GK", "AS Monaco", 8_660_000, 6_980_000, true, 12),
  m("12", "Kvaratskhelia", "FW", "Paris Saint-Germain", 18_600_000, 15_000_000, false, 902),
  m("13", "Gouiri", "FW", "Rennes", 12_140_000, 6_530_000, false, 210),
  m("14", "Bulatovic", "MF", "Lens", 6_440_000, 5_240_000, false, 40),
  m("15", "Minamino", "MF", "AS Monaco", 8_430_000, 7_590_000, false, 66),
  m("16", "Ganiou", "DF", "Lens", 6_440_000, 6_190_000, false, 19),
  m("17", "Marquinhos", "DF", "Paris Saint-Germain", 8_430_000, 10_800_000, false, 97),
  m("18", "Ozer", "GK", "Lille", 6_540_000, 5_590_000, false, 8),
  m("19", "Restes", "GK", "Toulouse", 8_740_000, 7_100_000, false, 5),
];


export const sidebarFixture = {
  username: "APE931301987",
  budget: 2_100_000,
  lockedAccount: 0,
  wealth: 110_630_000,
  leaderboard: [
    { rank: 1, username: "Petarmouillé", wealth: 123_580_000, isMe: false },
    { rank: 1, username: "Trutlejdkks9…", wealth: 122_880_000, isMe: false },
    { rank: 1, username: "Jilou89", wealth: 122_460_000, isMe: false },
    { rank: 4, username: "APE931301987", wealth: 123_170_000, isMe: true },
    { rank: 5, username: "Oscarrrito", wealth: 120_870_000, isMe: false },
    { rank: 6, username: "Francas67", wealth: 120_120_000, isMe: false },
  ],
  topBuys: [
    { id: "b1", name: "K. Kvaratskhelia", clubName: "Paris Saint-Germain", delta: 180_000, count: 18 },
    { id: "b2", name: "M. Abline", clubName: "AS Monaco", delta: 120_000, count: 12 },
    { id: "b3", name: "L. Ajorque", clubName: "RC Lens", delta: 100_000, count: 10 },
  ],
  topSells: [
    { id: "s1", name: "K. Kvaratskhelia", clubName: "Paris Saint-Germain", delta: -340_000, count: 34 },
    { id: "s2", name: "M. Al Tamari", clubName: "Toulouse FC", delta: -40_000, count: 4 },
    { id: "s3", name: "J. Allevinah", clubName: "Lille", delta: -20_000, count: 2 },
  ],
};
