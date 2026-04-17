import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { haversineKm } from "@/lib/distance";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Loader2, ShoppingCart, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";

interface MedHit {
  med_id: string;
  med_name: string;
  generic_name: string | null;
  category: string | null;
  prescription_required: boolean;
  mrp: number;
  offers: {
    pharmacy_id: string;
    pharmacy_name: string;
    pharmacy_lat: number;
    pharmacy_lng: number;
    price: number;
    stock_count: number;
    distance_km: number;
  }[];
}

const CACHE = new Map<string, { ts: number; data: MedHit[] }>();
const TTL = 15 * 60 * 1000;

const SearchPage = () => {
  const { user } = useAuth();
  const { coords } = useGeolocation();
  const { add } = useCart();
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MedHit[]>([]);

  const runSearch = async (query: string) => {
    if (!query.trim()) return;
    const key = query.toLowerCase().trim();
    const cached = CACHE.get(key);
    if (cached && Date.now() - cached.ts < TTL) {
      setResults(decorate(cached.data));
      return;
    }
    setLoading(true);
    // pg_trgm fuzzy: similarity threshold via .or with ilike fallback + filter
    const { data: meds, error } = await supabase
      .from("meds")
      .select("id, name, generic_name, category, prescription_required, mrp")
      .or(`name.ilike.%${key}%,generic_name.ilike.%${key}%`)
      .limit(10);

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    if (!meds || meds.length === 0) {
      setResults([]);
      setLoading(false);
      // log search
      if (user) await supabase.from("search_logs").insert({ user_id: user.id, query: key, results_count: 0 });
      return;
    }

    const medIds = meds.map((m) => m.id);
    const { data: invs } = await supabase
      .from("pharmacy_inventory")
      .select("med_id, price, stock_count, pharmacy:pharmacies(id, name, lat, lng)")
      .in("med_id", medIds)
      .gt("stock_count", 0);

    const hits: MedHit[] = meds.map((m) => ({
      med_id: m.id,
      med_name: m.name,
      generic_name: m.generic_name,
      category: m.category,
      prescription_required: m.prescription_required ?? false,
      mrp: Number(m.mrp ?? 0),
      offers: (invs ?? [])
        .filter((i: any) => i.med_id === m.id && i.pharmacy)
        .map((i: any) => ({
          pharmacy_id: i.pharmacy.id,
          pharmacy_name: i.pharmacy.name,
          pharmacy_lat: i.pharmacy.lat,
          pharmacy_lng: i.pharmacy.lng,
          price: Number(i.price),
          stock_count: i.stock_count,
          distance_km: 0,
        })),
    }));
    CACHE.set(key, { ts: Date.now(), data: hits });
    setResults(decorate(hits));
    setLoading(false);

    if (user) {
      await supabase.from("search_logs").insert({
        user_id: user.id,
        query: key,
        results_count: hits.length,
      });
    }
  };

  const decorate = (hits: MedHit[]): MedHit[] =>
    hits.map((h) => ({
      ...h,
      offers: h.offers
        .map((o) => ({
          ...o,
          distance_km: haversineKm(coords.lat, coords.lng, o.pharmacy_lat, o.pharmacy_lng),
        }))
        .sort((a, b) => a.price - b.price || a.distance_km - b.distance_km)
        .slice(0, 5),
    }));

  // recompute distances when coords change
  useEffect(() => {
    if (results.length) setResults((r) => decorate(r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords.lat, coords.lng]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(q);
    runSearch(q);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Find your medicine</h1>
        <p className="text-sm text-muted-foreground">
          Compare real-time prices across nearby pharmacies. Try "Atorvastain" — fuzzy search will find it.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by brand or generic name…"
            className="h-12 pl-10 text-base"
            maxLength={100}
          />
        </div>
        <Button type="submit" size="lg" disabled={loading} className="bg-gradient-primary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {submitted && !loading && results.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          No matches for "{submitted}". Try a different name.
        </Card>
      )}

      {results.map((m) => {
        const best = m.offers[0];
        const savings = best ? Math.max(0, m.mrp - best.price) : 0;
        const pct = m.mrp ? Math.round((savings / m.mrp) * 100) : 0;
        return (
          <Card key={m.med_id} className="overflow-hidden p-0">
            <div className="border-b bg-muted/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold">{m.med_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {m.generic_name} · {m.category}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {m.prescription_required && (
                    <Badge variant="secondary" className="text-[10px]">Rx required</Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground line-through">MRP ₹{m.mrp.toFixed(0)}</span>
                </div>
              </div>
              {savings > 0 && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                  <TrendingDown className="h-3 w-3" />
                  Save ₹{savings.toFixed(0)} ({pct}%) on best offer
                </div>
              )}
            </div>
            <div className="divide-y">
              {m.offers.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">Out of stock at all nearby pharmacies.</div>
              )}
              {m.offers.map((o, i) => (
                <div key={o.pharmacy_id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{o.pharmacy_name}</span>
                      {i === 0 && (
                        <Badge className="bg-primary text-primary-foreground hover:bg-primary text-[10px]">
                          BEST PRICE
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {o.distance_km.toFixed(1)} km
                      </span>
                      <span>{o.stock_count} in stock</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">₹{o.price.toFixed(0)}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 h-7 text-xs"
                      onClick={() => {
                        add({
                          med_id: m.med_id,
                          med_name: m.med_name,
                          pharmacy_id: o.pharmacy_id,
                          pharmacy_name: o.pharmacy_name,
                          unit_price: o.price,
                          qty: 1,
                        });
                        toast.success(`Added ${m.med_name} to cart`);
                      }}
                    >
                      <ShoppingCart className="mr-1 h-3 w-3" /> Add
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default SearchPage;
