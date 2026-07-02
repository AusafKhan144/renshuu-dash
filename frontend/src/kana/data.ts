/** Static kana layout tables (the standard 46-base gojuon + dakuten/handakuten
 *  + yoon set that Renshuu's own Hiragana/Katakana schedules cover — 104
 *  characters each). Positions are fixed; mastery scores come from the live
 *  API (`GET /api/kana`) and are matched onto these cells by `char`. */

export interface KanaCell {
  romaji: string;
  hiragana: string;
  katakana: string;
}

export interface KanaGroup {
  title: string;
  /** Each row is a fixed-width column set; "" marks a gap (no such kana). */
  rows: KanaCell[][];
}

function row(romaji: string[], hira: string[], kata: string[]): KanaCell[] {
  return romaji.map((r, i) => ({ romaji: r, hiragana: hira[i] ?? "", katakana: kata[i] ?? "" }));
}

export const SEION: KanaGroup = {
  title: "Seion",
  rows: [
    row(["a", "i", "u", "e", "o"], ["あ", "い", "う", "え", "お"], ["ア", "イ", "ウ", "エ", "オ"]),
    row(["ka", "ki", "ku", "ke", "ko"], ["か", "き", "く", "け", "こ"], ["カ", "キ", "ク", "ケ", "コ"]),
    row(["sa", "shi", "su", "se", "so"], ["さ", "し", "す", "せ", "そ"], ["サ", "シ", "ス", "セ", "ソ"]),
    row(["ta", "chi", "tsu", "te", "to"], ["た", "ち", "つ", "て", "と"], ["タ", "チ", "ツ", "テ", "ト"]),
    row(["na", "ni", "nu", "ne", "no"], ["な", "に", "ぬ", "ね", "の"], ["ナ", "ニ", "ヌ", "ネ", "ノ"]),
    row(["ha", "hi", "fu", "he", "ho"], ["は", "ひ", "ふ", "へ", "ほ"], ["ハ", "ヒ", "フ", "ヘ", "ホ"]),
    row(["ma", "mi", "mu", "me", "mo"], ["ま", "み", "む", "め", "も"], ["マ", "ミ", "ム", "メ", "モ"]),
    row(["ya", "", "yu", "", "yo"], ["や", "", "ゆ", "", "よ"], ["ヤ", "", "ユ", "", "ヨ"]),
    row(["ra", "ri", "ru", "re", "ro"], ["ら", "り", "る", "れ", "ろ"], ["ラ", "リ", "ル", "レ", "ロ"]),
    row(["wa", "", "", "", "wo"], ["わ", "", "", "", "を"], ["ワ", "", "", "", "ヲ"]),
    row(["n", "", "", "", ""], ["ん", "", "", "", ""], ["ン", "", "", "", ""]),
  ],
};

export const DAKUON: KanaGroup = {
  title: "Dakuten / Handakuten",
  rows: [
    row(["ga", "gi", "gu", "ge", "go"], ["が", "ぎ", "ぐ", "げ", "ご"], ["ガ", "ギ", "グ", "ゲ", "ゴ"]),
    row(["za", "ji", "zu", "ze", "zo"], ["ざ", "じ", "ず", "ぜ", "ぞ"], ["ザ", "ジ", "ズ", "ゼ", "ゾ"]),
    row(["da", "ji", "zu", "de", "do"], ["だ", "ぢ", "づ", "で", "ど"], ["ダ", "ヂ", "ヅ", "デ", "ド"]),
    row(["ba", "bi", "bu", "be", "bo"], ["ば", "び", "ぶ", "べ", "ぼ"], ["バ", "ビ", "ブ", "ベ", "ボ"]),
    row(["pa", "pi", "pu", "pe", "po"], ["ぱ", "ぴ", "ぷ", "ぺ", "ぽ"], ["パ", "ピ", "プ", "ペ", "ポ"]),
  ],
};

export const YOON: KanaGroup = {
  title: "Yōon",
  rows: [
    row(["kya", "kyu", "kyo"], ["きゃ", "きゅ", "きょ"], ["キャ", "キュ", "キョ"]),
    row(["gya", "gyu", "gyo"], ["ぎゃ", "ぎゅ", "ぎょ"], ["ギャ", "ギュ", "ギョ"]),
    row(["sha", "shu", "sho"], ["しゃ", "しゅ", "しょ"], ["シャ", "シュ", "ショ"]),
    row(["ja", "ju", "jo"], ["じゃ", "じゅ", "じょ"], ["ジャ", "ジュ", "ジョ"]),
    row(["cha", "chu", "cho"], ["ちゃ", "ちゅ", "ちょ"], ["チャ", "チュ", "チョ"]),
    row(["nya", "nyu", "nyo"], ["にゃ", "にゅ", "にょ"], ["ニャ", "ニュ", "ニョ"]),
    row(["hya", "hyu", "hyo"], ["ひゃ", "ひゅ", "ひょ"], ["ヒャ", "ヒュ", "ヒョ"]),
    row(["bya", "byu", "byo"], ["びゃ", "びゅ", "びょ"], ["ビャ", "ビュ", "ビョ"]),
    row(["pya", "pyu", "pyo"], ["ぴゃ", "ぴゅ", "ぴょ"], ["ピャ", "ピュ", "ピョ"]),
    row(["mya", "myu", "myo"], ["みゃ", "みゅ", "みょ"], ["ミャ", "ミュ", "ミョ"]),
    row(["rya", "ryu", "ryo"], ["りゃ", "りゅ", "りょ"], ["リャ", "リュ", "リョ"]),
  ],
};

export const KANA_GROUPS: KanaGroup[] = [SEION, DAKUON, YOON];
