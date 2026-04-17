import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Search, ShoppingBag, Droplet, TrendingUp } from "lucide-react";

const AdminDashboard = () => {
  const [m, setM] = useState({ searches: 0, orders: 0, gmv: 0, donors: 0 });

  useEffect(() => {
    (async () => {
      const [s, o, d] = await Promise.all([
        supabase.from("search_logs").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("total"),
        supabase.from("blood_request_responses").select("id", { count: "exact", head: true }),
      ]);
      const orders = (o.data ?? []) as any[];
      setM({
        searches: s.count ?? 0,
        orders: orders.length,
        gmv: orders.reduce((sum, x) => sum + Number(x.total), 0),
        donors: d.count ?? 0,
      });
    })();
  }, []);

  const tiles = [
    { label: "Total searches", value: m.searches, icon: Search, color: "text-primary bg-primary/10" },
    { label: "Active orders", value: m.orders, icon: ShoppingBag, color: "text-accent bg-accent/10" },
    { label: "GMV", value: `₹${m.gmv.toFixed(0)}`, icon: TrendingUp, color: "text-success bg-success/10" },
    { label: "Donors contacted", value: m.donors, icon: Droplet, color: "text-blood bg-blood/10" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-2xl font-bold md:text-3xl">Admin dashboard</h1>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${t.color}`}>
              <t.icon className="h-5 w-5" />
            </div>
            <div className="mt-3 text-2xl font-bold">{t.value}</div>
            <div className="text-xs text-muted-foreground">{t.label}</div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
