import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

const Analytics = () => {
  const [data, setData] = useState<{ query: string; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase
        .from("search_logs")
        .select("query")
        .order("created_at", { ascending: false })
        .limit(500);
      const counts: Record<string, number> = {};
      (rows ?? []).forEach((r: any) => { counts[r.query] = (counts[r.query] ?? 0) + 1; });
      const arr = Object.entries(counts)
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setData(arr);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-2xl font-bold md:text-3xl">Top searched medicines</h1>
      <Card className="p-5">
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No search data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
              <YAxis dataKey="query" type="category" width={110} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
};

export default Analytics;
