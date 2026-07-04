/**
 * 生のエラーメッセージを平易な日本語に変換する。
 * 部分一致・先勝ちで判定し、該当なしは汎用メッセージを返す。
 */

interface Rule {
  test: (msg: string) => boolean;
  description: string;
}

const rules: Rule[] = [
  {
    test: (m) => /Failed to fetch|CORS/i.test(m),
    description:
      "サーバに接続できませんでした（CORS / ネットワーク設定を確認してください）",
  },
  {
    test: (m) => /タイムアウト/i.test(m),
    description: "ストリームの起動がタイムアウトしました",
  },
  {
    test: (m) => /iOS\s*\/\s*iPadOS/i.test(m),
    description:
      "iPhone / iPad のブラウザでは TS 直接再生に対応していません。下の「アプリで開く」から Infuse / VLC で再生するか、EPGStation の HLS ソースをご利用ください",
  },
  {
    test: (m) => /WebGPU|WebCodecs|SharedArrayBuffer/i.test(m),
    description:
      "このブラウザ/端末では TS 直接再生に対応していません",
  },
  {
    test: (m) => /mixed|https/i.test(m),
    description:
      "HTTPS ページから HTTP のストリームは再生できません",
  },
];

export function describePlayerError(msg: string): string {
  for (const rule of rules) {
    if (rule.test(msg)) return rule.description;
  }
  return "再生を開始できませんでした";
}
