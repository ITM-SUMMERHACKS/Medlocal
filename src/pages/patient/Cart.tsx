import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, ShoppingBag, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

const Cart = () => {
  const { items, remove, clear, total } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  // group by pharmacy → 1 order per pharmacy
  const grouped = items.reduce<Record<string, typeof items>>((acc, it) => {
    (acc[it.pharmacy_id] ??= []).push(it);
    return acc;
  }, {});

  const checkout = async () => {
    if (!user) return toast.error("Please sign in");
    if (!address.trim()) return toast.error("Enter a delivery address");
    setBusy(true);
    try {
      for (const [pharmacy_id, list] of Object.entries(grouped)) {
        const orderTotal = list.reduce((s, i) => s + i.unit_price * i.qty, 0);
        const { data: order, error: oErr } = await supabase
          .from("orders")
          .insert({
            patient_id: user.id,
            pharmacy_id,
            total: orderTotal,
            delivery_address: address,
            status: "confirmed",
            payment_status: "held",
          })
          .select("id")
          .single();
        if (oErr) throw oErr;
        const { error: iErr } = await supabase.from("order_items").insert(
          list.map((i) => ({
            order_id: order.id,
            med_id: i.med_id,
            med_name: i.med_name,
            qty: i.qty,
            unit_price: i.unit_price,
          })),
        );
        if (iErr) throw iErr;

        // Notify pharmacy
        const { data: ph } = await supabase.from("pharmacies").select("user_id").eq("id", pharmacy_id).maybeSingle();
        if (ph?.user_id) {
          await supabase.from("notifications").insert({
            user_id: ph.user_id,
            title: "New order received",
            body: `Order of ₹${orderTotal.toFixed(0)} — ${list.length} items`,
            link: "/pharmacy",
          });
        }
      }
      clear();
      toast.success("Payment held in escrow. Orders sent to pharmacies!");
      nav("/app/orders");
    } catch (e: any) {
      toast.error(e.message ?? "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <Card className="p-12 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">Your cart is empty</h2>
        <p className="text-sm text-muted-foreground">Search for medicines to add them.</p>
      </Card>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {Object.entries(grouped).map(([pid, list]) => (
          <Card key={pid} className="overflow-hidden">
            <div className="border-b bg-muted/30 px-4 py-2 text-sm font-medium">{list[0].pharmacy_name}</div>
            <div className="divide-y">
              {list.map((i) => (
                <div key={`${i.med_id}-${i.pharmacy_id}`} className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium">{i.med_name}</div>
                    <div className="text-xs text-muted-foreground">Qty {i.qty} · ₹{i.unit_price.toFixed(0)} each</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">₹{(i.qty * i.unit_price).toFixed(0)}</span>
                    <Button size="icon" variant="ghost" onClick={() => remove(i.med_id, i.pharmacy_id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <Card className="h-fit p-5">
        <h3 className="font-semibold">Checkout</h3>
        <div className="mt-3 space-y-2">
          <Label htmlFor="addr">Delivery address</Label>
          <Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House, street, area" maxLength={200} />
        </div>
        <div className="mt-4 flex items-center justify-between border-t pt-4 text-lg font-bold">
          <span>Total</span>
          <span className="text-primary">₹{total.toFixed(0)}</span>
        </div>
        <Button onClick={checkout} disabled={busy} className="mt-4 w-full bg-gradient-primary">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
          Pay (Mock Stripe — held in escrow)
        </Button>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Test mode. Funds release on delivery or 48h timeout.
        </p>
      </Card>
    </div>
  );
};

export default Cart;
