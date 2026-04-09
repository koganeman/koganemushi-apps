import Link from "next/link";
import { TOOLS, type ToolInfo } from "@/lib/tools";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

function StatusBadge({ status }: { status: ToolInfo["status"] }) {
  const styles = {
    active: "bg-green-100 text-green-800",
    dev: "bg-yellow-100 text-yellow-800",
    "coming-soon": "bg-gray-100 text-gray-500",
  };
  const labels = {
    active: "稼働中",
    dev: "開発中",
    "coming-soon": "準備中",
  };
  return (
    <span
      className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export default function TopPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-[1200px] mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">ツール一覧</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {TOOLS.map((tool) => (
            <Link key={tool.id} href={tool.href}>
              <Card className="h-full hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">{tool.name}</CardTitle>
                    <StatusBadge status={tool.status} />
                  </div>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
