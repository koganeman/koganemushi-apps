import type { SubjectDef } from "@/types/shikin-guri";

export const SUBJECTS: SubjectDef[] = [
  { id: "uriageNyukin", label: "売上入金", section: "keijou", kind: "income", order: 1 },
  { id: "sonotaKeijouShunyuu", label: "その他経常収入", section: "keijou", kind: "income", order: 2 },
  { id: "shiireShiharai", label: "仕入支払い", section: "keijou", kind: "expense", order: 10 },
  { id: "gaichuuhi", label: "外注費", section: "keijou", kind: "expense", order: 11 },
  { id: "kyuuyoShouyo", label: "給与・賞与", section: "keijou", kind: "expense", order: 12 },
  { id: "shakaiHokenGensenJuumin", label: "社会保険料・源泉所得税・住民税", section: "keijou", kind: "expense", order: 13 },
  { id: "koukokuHanbai", label: "広告宣伝費・販売費", section: "keijou", kind: "expense", order: 14 },
  { id: "kousaiFukuri", label: "交際費・福利厚生費", section: "keijou", kind: "expense", order: 15 },
  { id: "ryohiKoutsuuShayou", label: "旅費交通費・車両関連費", section: "keijou", kind: "expense", order: 16 },
  { id: "chidaiYachinKounetsu", label: "地代家賃・水道光熱費", section: "keijou", kind: "expense", order: 17 },
  { id: "hokenryou", label: "保険料", section: "keijou", kind: "expense", order: 18 },
  { id: "kaihiKomonTesuuryouSystem", label: "会費・顧問料・手数料・システム利用料", section: "keijou", kind: "expense", order: 19 },
  { id: "kenshuuKenkyuu", label: "研修費・研究開発費", section: "keijou", kind: "expense", order: 20 },
  { id: "leaseKappu", label: "リース料・割賦支払い", section: "keijou", kind: "expense", order: 21 },
  { id: "shuuzenSetsubiShoumouhin", label: "修繕費・設備管理費・消耗品費", section: "keijou", kind: "expense", order: 22 },
  { id: "zappiGinkouTesuuryou", label: "雑費・銀行手数料", section: "keijou", kind: "expense", order: 23 },
  { id: "sonotaHankanhi", label: "その他販管費", section: "keijou", kind: "expense", order: 24 },
  { id: "sonotaKeijouShishutsu", label: "その他経常支出", section: "keijou", kind: "expense", order: 25 },
  { id: "genkinHikidashiQR", label: "現金引出し・QR決済", section: "keijou", kind: "expense", order: 26 },
  { id: "creditCardShiharai", label: "クレジットカード支払い", section: "keijou", kind: "expense", order: 27 },
  { id: "shouhizeiSozeiKouka", label: "消費税・租税公課", section: "keijou", kind: "expense", order: 28 },
  { id: "jigyoushuKashi", label: "事業主貸（個人事業）", section: "keijou", kind: "expense", order: 29 },
  { id: "teikiYokinKaiyaku", label: "定期預金解約", section: "keijouGai", kind: "income", order: 40 },
  { id: "koteiShisanBaikyaku", label: "固定資産売却", section: "keijouGai", kind: "income", order: 41 },
  { id: "hojokinJoseikin", label: "補助金・助成金等", section: "keijouGai", kind: "income", order: 42 },
  { id: "sonotaKeijouGaiShunyuu", label: "その他経常外収入", section: "keijouGai", kind: "income", order: 43 },
  { id: "teikiYokinToushi", label: "定期預金・投資等", section: "keijouGai", kind: "expense", order: 50 },
  { id: "koteiShisanShutoku", label: "固定資産の取得", section: "keijouGai", kind: "expense", order: 51 },
  { id: "houjinzeiTou", label: "法人税等", section: "keijouGai", kind: "expense", order: 52 },
  { id: "sonotaKeijouGaiShishutsu", label: "その他経常外支出", section: "keijouGai", kind: "expense", order: 53 },
  { id: "tankiKariire", label: "短期借入金", section: "zaimu", kind: "income", order: 60 },
  { id: "choukiKariire", label: "長期借入金", section: "zaimu", kind: "income", order: 61 },
  { id: "yakuinKankeiKaishaKara", label: "役員・関係会社から入金", section: "zaimu", kind: "income", order: 62 },
  { id: "uketoriRisokuHaitou", label: "受取利息・配当", section: "zaimu", kind: "income", order: 63 },
  { id: "sonotaZaimuShunyuu", label: "その他財務収入", section: "zaimu", kind: "income", order: 64 },
  { id: "tankiKariireHensai", label: "短期借入金返済", section: "zaimu", kind: "expense", order: 70 },
  { id: "choukiKariireHensai", label: "長期借入金返済", section: "zaimu", kind: "expense", order: 71 },
  { id: "yakuinKankeiKaishaHe", label: "役員・関係会社へ支出", section: "zaimu", kind: "expense", order: 72 },
  { id: "shiharaiRisokuHoshou", label: "支払利息・保証料", section: "zaimu", kind: "expense", order: 73 },
  { id: "sonotaZaimuShishutsu", label: "その他財務支出", section: "zaimu", kind: "expense", order: 74 },
];

export const SUBJECT_BY_ID: Record<string, SubjectDef> = Object.fromEntries(
  SUBJECTS.map((s) => [s.id, s])
);

export const SUBJECT_BY_LABEL: Record<string, SubjectDef> = Object.fromEntries(
  SUBJECTS.map((s) => [s.label, s])
);

export const SECTION_LABELS: Record<"keijou" | "keijouGai" | "zaimu", string> = {
  keijou: "経常収支",
  keijouGai: "経常外収支",
  zaimu: "財務収支",
};

export const OPENING_BALANCE_LABEL = "期首・期末現預金残高";
