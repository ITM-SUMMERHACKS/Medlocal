import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Inventory = () => {
  const { user } = useAuth();
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: ph } = await supabase.from("pharmacies").select("id").eq("user_id", user.id).maybeSingle();
      if (!ph) return;
      setPharmacyId(ph.id);
      const { data } = await supabase
        .from("pharmacy_inventory")
        .select("id, price, stock_count, meds(name, generic_name, mrp)")
        .eq("pharmacy_id", ph.id);
      setItems(data ?? []);
    })();
  }, [user?.id]);

  const update = async (id: string, field: "price" | "stock_count", value: number) => {
    const payload = field === "price" ? { price: value } : { stock_count: value };
    const { error } = await supabase.from("pharmacy_inventory").update(payload).eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 text-2xl font-bold md:text-3xl">My inventory</h1>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Medicine</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((it: any) => (
              <tr key={it.id}>
                <td className="p-3">
                  <div className="font-medium">{it.meds?.name}</div>
                  <div className="text-xs text-muted-foreground">{it.meds?.generic_name}</div>
                </td>
                <td className="p-3">
                  <Input
                    type="number"
                    defaultValue={Number(it.price)}
                    className="h-8 w-24"
                    onBlur={(e) => update(it.id, "price", Number(e.target.value))}
                  />
                </td>
                <td className="p-3">
                  <Input
                    type="number"
                    defaultValue={it.stock_count}
                    className="h-8 w-20"
                    onBlur={(e) => update(it.id, "stock_count", Number(e.target.value))}
                  />
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No inventory yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

export default Inventory;
