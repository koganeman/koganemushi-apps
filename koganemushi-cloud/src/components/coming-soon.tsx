export function ComingSoonPage({ toolName }: { toolName: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">{toolName}</h1>
        <p className="text-muted-foreground">準備中です</p>
      </div>
    </div>
  );
}
