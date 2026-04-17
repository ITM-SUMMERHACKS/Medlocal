import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { Package, Loader2 } from "lucide-react";

const NEXT: Record<string, string> = {
  pending: "confirmed",
  confirmed: "packed",
  packed: "dispatched",
  dispatched: "delivered",
};
const COLOR: Record<string, string> = {
  pending: "bg-muted text-foreground",
  confirmed: "bg-accent/10 text-accent",
  packed: "bg-warning/10 text-warning",
  dispatched: "bg-primary/10 text-primary",
  delivered: "bg-success/10 text-success",
};

const PharmacyOrders = () => {
  const { user } = useAuth();
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (pid: string) => {
    const { data } = await supabase
      .from("orders")
      .select("*, profiles:patient_id(full_name, phone), order_items(*)")
      .eq("pharmacy_id", pid)
      .order("created_at", { ascending: false });
    setOrders(data ?? []);
  };

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: ph } = await supabase
        .from("pharmacies")
        .select("id, name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!ph) {
        // Auto-create pharmacy profile so demo works
        const { data: created } = await supabase
          .from("pharmacies")
          .insert({ user_id: user.id, name: "My Pharmacy", city: "Bangalore", lat: 12.97, lng: 77.59 })
          .select("id")
          .single();
        setPharmacyId(created?.id ?? null);
        if (created) await load(created.id);
      } else {
        setPharmacyId(ph.id);
        await load(ph.id);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!pharmacyId) return;
    const ch = supabase
      .channel("ph-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `pharmacy_id=eq.${pharmacyId}` }, () => load(pharmacyId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pharmacyId]);

  const advance = async (o: any) => {
    const next = NEXT[o.status];
    if (!next) return;
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", o.id);
    if (error) toast.error(error.message);
    else toast.success(`Marked ${next}`);
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Incoming orders</h1>
        <p className="text-sm text-muted-foreground">Real-time. Updates appear automatically.</p>
      </div>

      {orders.length === 0 && (
        <Card className="p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">No orders yet. Patients can order from the search page.</p>
        </Card>
      )}

      {orders.map((o) => (
        <Card key={o.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-semibold">#{o.id.slice(0, 8)} · {o.profiles?.full_name ?? "Patient"}</div>
              <div className="text-xs text-muted-foreground">{format(new Date(o.created_at), "PPp")}</div>
              <div className="text-xs text-muted-foreground">{o.delivery_address}</div>
            </div>
            <Badge className={COLOR[o.status]}>{o.status}</Badge>
          </div>
          <div className="mt-3 space-y-1 text-sm">
            {o.order_items.map((it: any) => (
              <div key={it.id} className="flex justify-between">
                <span>{it.med_name} × {it.qty}</span>
                <span>₹{(it.qty * it.unit_price).toFixed(0)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <span className="font-semibold">₹{Number(o.total).toFixed(0)}</span>
            {NEXT[o.status] && <Button size="sm" onClick={() => advance(o)}>Mark {NEXT[o.status]}</Button>}
          </div>
        </Card>
      ))}
    </div>
  );
};

export default PharmacyOrders;
