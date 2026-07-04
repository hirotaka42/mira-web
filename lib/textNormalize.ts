/**
 * チャンネル名の表示正規化 + 検索の曖昧マッチ用テキスト正規化。
 *
 * 放送(ARIB)由来のチャンネル名は全角で届く。Mirakurun は全角のまま、
 * EPGStation も Mirakurun に揃えて全角で提供する。フロントエンドでは英数字・
 * 記号・空白を半角にして表示する(カタカナ・漢字は保持)。
 *
 * 検索照合はさらに緩く畳み込む(全角/半角・英字大小・カタカナ/ひらがなを同一視し、
 * ローマ字入力も補助的にかなへ変換して照合する)。
 */

/* ------------------------------------------------------------------ */
/*  表示用: 全角 → 半角(英数記号・空白のみ。カタカナ・漢字は保持)          */
/* ------------------------------------------------------------------ */

/**
 * 全角の ASCII 英数記号(Ｕ+ＦＦ０１〜Ｕ+ＦＦ５Ｅ)と全角空白(Ｕ+３０００)を半角へ。
 * カタカナ・漢字・「・」等はそのまま(表示で意図しない置換を避けるため、
 * 汎用の NFKC ではなく対象を絞った変換にしている)。
 */
export function toHalfWidth(s: string): string {
  let out = "";
  for (const chr of s) {
    const c = chr.codePointAt(0)!;
    if (c >= 0xff01 && c <= 0xff5e) {
      // 全角 ASCII → 半角 ASCII(差分 0xFEE0)
      out += String.fromCodePoint(c - 0xfee0);
    } else if (c === 0x3000) {
      // 全角スペース → 半角スペース
      out += " ";
    } else {
      out += chr;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  検索用: 畳み込みキー                                                */
/* ------------------------------------------------------------------ */

/** カタカナ(ァ:0x30A1〜ヶ:0x30F6)をひらがな(ぁ:0x3041〜)へ。差分 0x60。 */
function katakanaToHiragana(s: string): string {
  let out = "";
  for (const chr of s) {
    const c = chr.codePointAt(0)!;
    if (c >= 0x30a1 && c <= 0x30f6) out += String.fromCodePoint(c - 0x60);
    else out += chr;
  }
  return out;
}

/**
 * 検索照合用の正規化キー。
 * NFKC(全角→半角・半角カナ→全角カナ)→ 小文字化 → カタカナをひらがなへ。
 * これで「ＮＨＫ」「nhk」「NHK」、「アニ」「あに」が同じキーになる。
 */
export function foldForSearch(s: string): string {
  return katakanaToHiragana(s.normalize("NFKC").toLowerCase());
}

/* ------------------------------------------------------------------ */
/*  検索用: ローマ字 → ひらがな(best-effort)                           */
/* ------------------------------------------------------------------ */

// ローマ字トークン → ひらがな。長いキーから貪欲に一致させる。
// 放送のカタカナ語(アニ・ニュース・ドラマ・チャンネル 等)を主眼に、
// ヘボン式+訓令式の主要な綴りと外来音(ファ/ティ/ディ 等)を収録。
const ROMAJI: Record<string, string> = {
  // 拗音(3〜)
  kya: "きゃ", kyu: "きゅ", kyo: "きょ",
  gya: "ぎゃ", gyu: "ぎゅ", gyo: "ぎょ",
  sha: "しゃ", shu: "しゅ", sho: "しょ",
  sya: "しゃ", syu: "しゅ", syo: "しょ",
  cha: "ちゃ", chu: "ちゅ", cho: "ちょ",
  tya: "ちゃ", tyu: "ちゅ", tyo: "ちょ",
  jya: "じゃ", jyu: "じゅ", jyo: "じょ",
  nya: "にゃ", nyu: "にゅ", nyo: "にょ",
  hya: "ひゃ", hyu: "ひゅ", hyo: "ひょ",
  bya: "びゃ", byu: "びゅ", byo: "びょ",
  pya: "ぴゃ", pyu: "ぴゅ", pyo: "ぴょ",
  mya: "みゃ", myu: "みゅ", myo: "みょ",
  rya: "りゃ", ryu: "りゅ", ryo: "りょ",
  // 特殊・外来音(2〜3)
  shi: "し", chi: "ち", tsu: "つ",
  fa: "ふぁ", fi: "ふぃ", fe: "ふぇ", fo: "ふぉ",
  che: "ちぇ", she: "しぇ", je: "じぇ",
  ti: "てぃ", di: "でぃ", du: "どぅ", tu: "とぅ",
  wi: "うぃ", we: "うぇ",
  va: "ゔぁ", vi: "ゔぃ", vu: "ゔ", ve: "ゔぇ", vo: "ゔぉ",
  ja: "じゃ", ju: "じゅ", jo: "じょ", ji: "じ",
  // 五十音(2)
  ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ",
  ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "ご",
  sa: "さ", si: "し", su: "す", se: "せ", so: "そ",
  za: "ざ", zi: "じ", zu: "ず", ze: "ぜ", zo: "ぞ",
  ta: "た", te: "て", to: "と",
  da: "だ", de: "で", do: "ど",
  na: "な", ni: "に", nu: "ぬ", ne: "ね", no: "の",
  ha: "は", hi: "ひ", hu: "ふ", fu: "ふ", he: "へ", ho: "ほ",
  ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ",
  pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ",
  ma: "ま", mi: "み", mu: "む", me: "め", mo: "も",
  ya: "や", yu: "ゆ", yo: "よ",
  ra: "ら", ri: "り", ru: "る", re: "れ", ro: "ろ",
  wa: "わ", wo: "を",
  // 母音(1)
  a: "あ", i: "い", u: "う", e: "え", o: "お",
};

const isVowel = (c: string) => c === "a" || c === "i" || c === "u" || c === "e" || c === "o";
const isConsonant = (c: string) => c >= "a" && c <= "z" && !isVowel(c);

/**
 * ローマ字(小文字前提)をひらがなへ best-effort 変換する。
 * 変換できない文字はそのまま通す(照合側で無害)。末尾の未確定子音は
 * 「n」→「ん」、その他は落とす(逐次入力中でも当たりやすくする)。
 */
export function romajiToHiragana(input: string): string {
  const s = input;
  let out = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    // 促音: 同じ子音の連続(n を除く)→ っ。例 "kk"→っ
    if (isConsonant(c) && c !== "n" && s[i + 1] === c) {
      out += "っ";
      i += 1;
      continue;
    }
    // "tch" → っ + ち…(t の後に ch)
    if (c === "t" && s[i + 1] === "c" && s[i + 2] === "h") {
      out += "っ";
      i += 1;
      continue;
    }
    // 3→2→1 文字の貪欲一致
    let matched = false;
    for (let len = 3; len >= 1; len--) {
      const tok = s.slice(i, i + len);
      if (ROMAJI[tok]) {
        out += ROMAJI[tok];
        i += len;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    // 撥音: 母音/y を伴わない単独 n → ん(na/nya 等は表で消費済み)
    if (c === "n") {
      out += "ん";
      i += 1;
      if (s[i] === "'") i += 1; // "n'" のアポストロフィを飲む
      continue;
    }
    // 変換できない文字。末尾の単独子音は落とし、それ以外はそのまま通す。
    if (isConsonant(c) && i === s.length - 1) {
      i += 1;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  検索用: マッチ判定                                                  */
/* ------------------------------------------------------------------ */

/**
 * チャンネル名が検索クエリに曖昧一致するか。
 * 1) 畳み込みキー同士の部分一致(全角/半角・英字大小・カナ種別を吸収)
 * 2) それで外れたら、クエリをローマ字→かな変換して再照合
 */
export function channelMatchesSearch(name: string, query: string): boolean {
  const q = foldForSearch(query.trim());
  if (!q) return true;
  const n = foldForSearch(name);
  if (n.includes(q)) return true;
  const r = romajiToHiragana(q);
  if (r && r !== q && n.includes(r)) return true;
  return false;
}
