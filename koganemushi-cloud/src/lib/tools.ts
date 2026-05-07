export interface ToolInfo {
  id: string;
  name: string;
  description: string;
  href: string;
  status: "active" | "dev" | "coming-soon";
}

export const TOOLS: ToolInfo[] = [
  {
    id: "yakuin-hoshu",
    name: "役員報酬シミュレーション",
    description: "役員報酬の最適化と税金シミュレーション",
    href: "/yakuin-hoshu",
    status: "active",
  },
  {
    id: "hojinnari",
    name: "法人成りシミュレーション",
    description: "個人事業主から法人化のシミュレーション",
    href: "/hojinnari",
    status: "active",
  },
  {
    id: "furusato-nouzei",
    name: "ふるさと納税",
    description: "ふるさと納税の控除額シミュレーション",
    href: "/furusato-nouzei",
    status: "coming-soon",
  },
  {
    id: "shotokuzei-tedori",
    name: "所得税計算 手取り計算",
    description: "所得税と手取り額のシミュレーション",
    href: "/shotokuzei-tedori",
    status: "coming-soon",
  },
  {
    id: "houjinzei-keisan",
    name: "法人税計算",
    description: "法人税額のシミュレーション",
    href: "/houjinzei-keisan",
    status: "coming-soon",
  },
  {
    id: "souzokuzei",
    name: "相続税計算",
    description: "相続税額のシミュレーション",
    href: "/souzokuzei",
    status: "coming-soon",
  },
  {
    id: "zouyozei",
    name: "贈与税計算",
    description: "贈与税額のシミュレーション",
    href: "/zouyozei",
    status: "coming-soon",
  },
  {
    id: "taishokukin",
    name: "退職金計算",
    description: "退職金の税金シミュレーション",
    href: "/taishokukin",
    status: "coming-soon",
  },
  {
    id: "kinri",
    name: "金利計算",
    description: "金利・利息のシミュレーション",
    href: "/kinri",
    status: "coming-soon",
  },
  {
    id: "gensen-shotokuzei",
    name: "源泉所得税",
    description: "源泉所得税の計算",
    href: "/gensen-shotokuzei",
    status: "coming-soon",
  },
  {
    id: "kaneguru-freee",
    name: "かねぐる簡易版 for freee",
    description: "freee連携のかねぐる簡易版",
    href: "/kaneguru-freee",
    status: "coming-soon",
  },
  {
    id: "ai-kanjou",
    name: "AI勘定科目作成",
    description: "AIによる勘定科目の自動作成",
    href: "/ai-kanjou",
    status: "coming-soon",
  },
  {
    id: "block-puzzle",
    name: "お金のブロックパズル",
    description: "お金の流れを視覚的に理解するツール",
    href: "/block-puzzle",
    status: "dev",
  },
  {
    id: "entaizei",
    name: "延滞税計算",
    description: "延滞税額のシミュレーション",
    href: "/entaizei",
    status: "coming-soon",
  },
  {
    id: "shikin-guri",
    name: "資金繰り表 for freee & MF",
    description: "freee・MF連携の資金繰り表作成",
    href: "/shikin-guri",
    status: "coming-soon",
  },
  {
    id: "shouhizei-hantei",
    name: "消費税簡易課税本則計算有利不利判定",
    description: "消費税の簡易課税・本則課税の有利不利判定",
    href: "/shouhizei-hantei",
    status: "coming-soon",
  },
];
