/**
 * 総勘定元帳CSVの文字コード判定デコード。
 * 会計ソフトのエクスポートは Shift-JIS(cp932) が多いが、UTF-8 の場合もあるため自動判定する。
 */
export function decodeLedgerBytes(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  // UTF-8 BOM
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  // 厳密UTF-8デコードを試し、不正バイト列なら Shift-JIS とみなす
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("shift_jis").decode(bytes);
  }
}
