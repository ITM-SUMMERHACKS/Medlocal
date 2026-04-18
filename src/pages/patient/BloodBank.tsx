import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation } from "@/hooks/useGeolocation";
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

// Fix leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

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

  // fallback to Kharghar
  const lat = coords?.lat || 19.047;
  const lng = coords?.lng || 73.069;

  const [bloodType, setBloodType] = useState("O+");
  const [units, setUnits] = useState(2);
  const [hospital, setHospital] = useState("");
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [matchedDonors, setMatchedDonors] = useState<any[]>([]);

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
        lat,
        lng,
        urgency: "high",
      })
      .select("id")
      .single();

    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }

    const donorTypes = COMPATIBLE_DONORS[bloodType] ?? [bloodType];

    const { data: donors } = await supabase
      .from("profiles")
      .select("user_id, full_name, blood_type, lat, lng")
      .eq("is_blood_donor", true)
      .in("blood_type", donorTypes)
      .not("lat", "is", null);

    const nearby = (donors ?? [])
      .map((d) => ({
        ...d,
        distance_km: haversineKm(lat, lng, d.lat, d.lng),
      }))
      .filter((d) => d.distance_km <= 5)
      .sort((a, b) => a.distance_km - b.distance_km);

    setMatchedDonors(nearby);

    setBusy(false);
    toast.success(`Broadcast sent to ${nearby.length} donors`);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 text-white">
          <Droplet className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Blood bank SOS</h1>
          <p className="text-sm text-muted-foreground">
            Broadcast to nearby donors instantly
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* FORM */}
        <Card className="p-5">
          <h3 className="font-semibold">Request blood</h3>

          <div className="mt-4 grid gap-3">
            <div>
              <Label>Blood type</Label>
              <Select value={bloodType} onValueChange={setBloodType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BLOOD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Units</Label>
              <Input type="number" value={units} onChange={(e) => setUnits(Number(e.target.value))} />
            </div>

            <div>
              <Label>Hospital</Label>
              <Input value={hospital} onChange={(e) => setHospital(e.target.value)} placeholder="Apollo Hospital, Kharghar" />
            </div>

            <Button onClick={broadcast} disabled={busy} className="bg-red-500 text-white">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Broadcast SOS
            </Button>
          </div>
        </Card>

        {/* MAP */}
        <Card className="overflow-hidden p-0">
          <div className="p-3 border-b">
            <h3 className="font-semibold">Nearby donors map</h3>
          </div>

          <div className="h-[320px]">
            <MapContainer center={[lat, lng]} zoom={14} className="h-full w-full">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              <Circle center={[lat, lng]} radius={1500} pathOptions={{ color: "red" }} />

              {/* USER */}
              <Marker position={[lat, lng]}>
                <Popup>
                  <div><b>You are here</b><br />Kharghar</div>
                </Popup>
              </Marker>

              {/* REAL DONORS */}
              {matchedDonors.map((d) => (
                <Marker key={d.user_id} position={[d.lat, d.lng]}>
                  <Popup>
                    <div>
                      <b>{d.full_name || "Donor"}</b><br />
                      {d.blood_type}<br />
                      {d.distance_km.toFixed(1)} km
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* FALLBACK */}
              {matchedDonors.length === 0 &&
                [
                  { lat: 19.048, lng: 73.070 },
                  { lat: 19.045, lng: 73.068 },
                  { lat: 19.050, lng: 73.066 }
                ].map((d, i) => (
                  <Marker key={i} position={[d.lat, d.lng]}>
                    <Popup>Available Donor</Popup>
                  </Marker>
                ))
              }
            </MapContainer>
          </div>
        </Card>

      </div>

      {/* REQUESTS */}
      <div>
        <h3 className="mb-3 font-semibold">Active blood requests</h3>

        <div className="grid gap-3 md:grid-cols-2">
          {requests.map((r) => {
            const dist = r.lat
              ? haversineKm(lat, lng, r.lat, r.lng)
              : null;

            return (
              <Card key={r.id} className="p-4">
                <div className="flex justify-between">
                  <Badge className="bg-red-500 text-white">{r.blood_type}</Badge>
                  {dist && <span>{dist.toFixed(1)} km</span>}
                </div>

                <div className="mt-2 font-semibold">
                  {r.units_needed} unit(s) · {r.hospital || "Hospital"}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BloodBank;