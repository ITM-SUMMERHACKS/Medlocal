import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { haversineKm } from "@/lib/distance";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Loader2, Store, Phone, Navigation } from "lucide-react";

interface Medicine {
  name: string;
  price: number;
}

interface Pharmacy {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  lat: number;
  lng: number;
  is_open: boolean;
  medicines: Medicine[];
  distance_km?: number;
  matchedPrice?: number;
}

const SearchPage = () => {
  const { user } = useAuth();

  // fixed location (demo safe)
  const coords = { lat: 19.047, lng: 73.069 };

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);

  const fetchPharmacies = useCallback(async (query: string = "") => {
    setLoading(true);

    await new Promise((res) => setTimeout(res, 600));

    const dummyData: Pharmacy[] = [
      {
        id: "1",
        name: "Apollo Pharmacy",
        address: "Sector 7, Kharghar",
        phone: "9876543210",
        lat: 19.046,
        lng: 73.070,
        is_open: true,
        medicines: [
          { name: "Paracetamol", price: 25 },
          { name: "Crocin", price: 30 }
        ]
      },
      {
        id: "2",
        name: "MedPlus",
        address: "Sector 12, Kharghar",
        phone: "9123456780",
        lat: 19.049,
        lng: 73.065,
        is_open: true,
        medicines: [
          { name: "Paracetamol", price: 22 },
          { name: "Crocin", price: 28 }
        ]
      },
      {
        id: "3",
        name: "Wellness Forever",
        address: "Sector 20, Kharghar",
        phone: "9988776655",
        lat: 19.052,
        lng: 73.072,
        is_open: false,
        medicines: [
          { name: "Paracetamol", price: 30 }
        ]
      },
      {
        id: "4",
        name: "Guardian Pharmacy",
        address: "Sector 10, Kharghar",
        phone: "9765432109",
        lat: 19.045,
        lng: 73.068,
        is_open: true,
        medicines: [
          { name: "Paracetamol", price: 24 }
        ]
      }
    ];

    let filtered: Pharmacy[] = [];

    if (query.trim()) {
      filtered = dummyData
        .map((p) => {
          const match = p.medicines.find((m) =>
            m.name.toLowerCase().includes(query.toLowerCase())
          );

          if (!match) return null;

          return {
            ...p,
            matchedPrice: match.price
          };
        })
        .filter(Boolean) as Pharmacy[];
    } else {
      filtered = dummyData;
    }

    const decorated = filtered
      .map((p) => ({
        ...p,
        distance_km: haversineKm(coords.lat, coords.lng, p.lat, p.lng),
      }))
      .sort((a, b) => {
        // sort by price if searching, else by distance
        if (query.trim()) {
          return (a.matchedPrice || 999) - (b.matchedPrice || 999);
        }
        return (a.distance_km || 0) - (b.distance_km || 0);
      });

    setPharmacies(decorated);
    setLoading(false);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPharmacies(q);
  };

  useEffect(() => {
    fetchPharmacies();
  }, [fetchPharmacies]);

  // find cheapest for highlight
  const cheapestPrice = Math.min(
    ...pharmacies.map((p) => p.matchedPrice || Infinity)
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Find Medicines Nearby</h1>
        <p className="text-sm text-muted-foreground">
          Search medicines and compare prices across pharmacies.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search medicine (e.g. Paracetamol)"
            className="h-12 pl-10 text-base"
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        {pharmacies.length === 0 && !loading && (
          <div className="col-span-full text-center text-muted-foreground py-10">
            No results found.
          </div>
        )}

        {pharmacies.map((p) => (
          <Card key={p.id} className="p-5 space-y-3 hover:shadow-md transition">

            {/* HEADER */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Store className="text-primary" />
                <span className="font-semibold">{p.name}</span>
              </div>

              <Badge className={p.is_open ? "bg-green-500 text-white" : "bg-red-500 text-white"}>
                {p.is_open ? "Open Now" : "Closed"}
              </Badge>
            </div>

            {/* PRICE DISPLAY */}
            {p.matchedPrice && (
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold text-green-600">
                  ₹{p.matchedPrice}
                </div>

                {p.matchedPrice === cheapestPrice && (
                  <Badge className="bg-yellow-400 text-black">
                    Best Price
                  </Badge>
                )}
              </div>
            )}

            {/* DETAILS */}
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                {p.address}
              </div>

              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-primary" />
                {p.distance_km?.toFixed(1)} km away
              </div>

              {p.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  {p.phone}
                </div>
              )}
            </div>

            {/* ACTIONS */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`
                  )
                }
              >
                Directions
              </Button>

              <Button className="flex-1 bg-gradient-primary">
                Buy Now
              </Button>
            </div>

          </Card>
        ))}
      </div>
    </div>
  );
};

export default SearchPage;