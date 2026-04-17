import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import { Package } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-muted text-foreground",
  confirmed: "bg-accent/10 text-accent",
  packed: "bg-warning/10 text-warning",
  dispatched: "bg-primary/10 text-primary",
  delivered: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

const STAGES = ["pending", "confirmed", "packed", "dispatched", "delivered"];

const MyOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("orders")
      .select("*, pharmacies(name), order_items(*)")
      .eq("patient_id", user.id)
      .order("created_at", { ascending: false });
    setOrders(data ?? []);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel("patient-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `patient_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const markReceived = async (id: string) => {
    const { error } = await supabase.from("orders").update({ status: "delivered", payment_status: "released" }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Marked as received. Funds released to pharmacy.");
  };

  if (orders.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Package className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">No orders yet</h2>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold">My orders</h1>
      {orders.map((o) => {
        const stageIdx = STAGES.indexOf(o.status);
        return (
          <Card key={o.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{o.pharmacies?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(o.created_at), "PPp")} · #{o.id.slice(0, 8)}
                </div>
              </div>
              <Badge className={STATUS_COLOR[o.status]}>{o.status}</Badge>
            </div>
            {/* progress */}
            <div className="mt-4 flex items-center gap-1">
              {STAGES.map((s, i) => (
                <div key={s} className="flex-1">
                  <div className={`h-1.5 rounded-full ${i <= stageIdx ? "bg-primary" : "bg-muted"}`} />
                  <div className={`mt-1 text-[10px] capitalize ${i <= stageIdx ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    {s}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1 text-sm">
              {o.order_items.map((it: any) => (
                <div key={it.id} className="flex justify-between">
                  <span>{it.med_name} × {it.qty}</span>
                  <span>₹{(it.qty * it.unit_price).toFixed(0)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="font-semibold">Total ₹{Number(o.total).toFixed(0)}</span>
              {o.status === "dispatched" && (
                <Button size="sm" onClick={() => markReceived(o.id)}>Mark received</Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default MyOrders;
