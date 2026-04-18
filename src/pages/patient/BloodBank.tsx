import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { haversineKm } from "@/lib/distance";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Droplet, Loader2, Send, MapPin } from "lucide-react";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// Compatibility: who can give to recipient
const COMPATIBLE_DONORS: Record<string, string[]> = {
  "O-": ["O-"],
  "O+": ["O-", "O+"],
  "A-": ["O-", "A-"],
  "A+": ["O-", "O+", "A-", "A+"],
  "B-": ["O-", "B-"],
  "B+": ["O-", "O+", "B-", "B+"],
  "AB-": ["O-", "A-", "B-", "AB-"],
  "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
};

const BloodBank = () => {
  const { user } = useAuth();
  const { coords } = useGeolocation();
  const [bloodType, setBloodType] = useState("O+");
  const [units, setUnits] = useState(2);
  const [hospital, setHospital] = useState("");
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [matchedDonors, setMatchedDonors] = useState<any[]>([]);

  // ✅ FIX: Auto-update map center when location arrives
  useEffect(() => {
    if (coords?.lat && coords?.lng) {
      setCenter([coords.lat, coords.lng]);
    }
  }, [coords]);

  const loadRequests = async () => {
    const { data } = await supabase
      .from("blood_requests")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(20);
    setRequests(data ?? []);
  };

  useEffect(() => {
    loadRequests();
    const ch = supabase
      .channel("blood-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "blood_requests" }, loadRequests)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const broadcast = async () => {
    if (!user) return;
    setBusy(true);
    const { data: req, error } = await supabase
      .from("blood_requests")
      .insert({
        requester_id: user.id,
        blood_type: bloodType,
        units_needed: units,
        hospital,
        lat: coords.lat,
        lng: coords.lng,
        urgency: "high",
      })
      .select("id")
      .single();
    if (error) { setBusy(false); return toast.error(error.message); }

    // find compatible donors within 5km
    const donorTypes = COMPATIBLE_DONORS[bloodType] ?? [bloodType];
    const { data: donors } = await supabase
      .from("profiles")
      .select("user_id, full_name, blood_type, lat, lng")
      .eq("is_blood_donor", true)
      .in("blood_type", donorTypes)
      .not("lat", "is", null);

    const nearby = (donors ?? [])
      .map((d) => ({ ...d, distance_km: haversineKm(coords.lat, coords.lng, d.lat, d.lng) }))
      .filter((d) => d.distance_km <= 5)
      .sort((a, b) => a.distance_km - b.distance_km);

    setMatchedDonors(nearby);

    // notify donors
    if (nearby.length > 0) {
      await supabase.from("notifications").insert(
        nearby.map((d) => ({
          user_id: d.user_id,
          title: `🩸 Urgent: ${bloodType} blood needed`,
          body: `${units} units at ${hospital || "nearby hospital"} · ${d.distance_km.toFixed(1)} km away`,
          link: "/app/blood",
        })),
      );
    }
    setBusy(false);
    toast.success(`Broadcast sent to ${nearby.length} matched donors within 5 km`);
    setHospital("");
    loadRequests();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-blood pulse-blood">
          <Droplet className="h-5 w-5 text-blood-foreground" fill="currentColor" />
        </div>
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Blood bank SOS</h1>
          <p className="text-sm text-muted-foreground">Broadcast to matched donors within 5 km. Real-time.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold">Request blood</h3>
          <div className="mt-4 grid gap-3">
            <div>
              <Label>Blood type needed</Label>
              <Select value={bloodType} onValueChange={setBloodType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BLOOD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Units</Label>
              <Input type="number" min={1} max={10} value={units} onChange={(e) => setUnits(Number(e.target.value))} />
            </div>
            <div>
              <Label>Hospital</Label>
              <Input value={hospital} onChange={(e) => setHospital(e.target.value)} placeholder="e.g. Apollo Hospital" maxLength={100} />
            </div>
            <Button onClick={broadcast} disabled={busy} className="w-full bg-gradient-blood">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Broadcast SOS
            </Button>
          </div>

          {matchedDonors.length > 0 && (
            <div className="mt-5 rounded-lg border bg-success/5 p-3">
              <div className="mb-2 text-sm font-semibold text-success">
                ✓ Notified {matchedDonors.length} donors
              </div>
              <div className="space-y-1 text-xs">
                {matchedDonors.slice(0, 5).map((d) => (
                  <div key={d.user_id} className="flex justify-between">
                    <span>{d.full_name ?? "Donor"} · {d.blood_type}</span>
                    <span className="text-muted-foreground">{d.distance_km.toFixed(1)} km</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* MAP */}
        <Card className="overflow-hidden p-0">
          <div className="border-b p-3">
            <h3 className="font-semibold">Nearby donors map</h3>
          </div>
          <div className="h-[320px]">
            <MapContainer center={[coords.lat, coords.lng]} zoom={12} className="h-full w-full">
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Circle center={[coords.lat, coords.lng]} radius={5000} pathOptions={{ color: "hsl(358, 75%, 52%)", fillOpacity: 0.05 }} />
              <Marker position={[coords.lat, coords.lng]}>
                <Popup>Your location</Popup>
              </Marker>
              {matchedDonors.map((d) => (
                <Marker key={d.user_id} position={[d.lat, d.lng]}>
                  <Popup>{d.full_name} · {d.blood_type}</Popup>
                </Marker>
              ))}

            </MapContainer>
          </div>
        </Card>

      </div>

      <div>
        <h3 className="mb-3 font-semibold">Active blood requests near you</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {requests.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">No open requests.</Card>}
          {requests.map((r) => {
            const dist = r.lat ? haversineKm(coords.lat, coords.lng, r.lat, r.lng) : null;
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-center justify-between">
                  <Badge className="bg-blood text-blood-foreground hover:bg-blood">{r.blood_type}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {dist != null && <><MapPin className="inline h-3 w-3" /> {dist.toFixed(1)} km</>}
                  </span>
                </div>
                <div className="mt-2 font-semibold">{r.units_needed} unit(s) · {r.hospital || "Hospital"}</div>
                <div className="text-xs text-muted-foreground">Posted {new Date(r.created_at).toLocaleString()}</div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BloodBank;