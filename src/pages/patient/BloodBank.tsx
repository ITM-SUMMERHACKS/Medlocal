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

// Fix leaflet icons
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

type LatLngTuple = [number, number];
const DEFAULT_CENTER: LatLngTuple = [19.0456, 73.0696];

const BloodBank = () => {
  const { user } = useAuth();
  const { coords, loading } = useGeolocation();

  const [center, setCenter] = useState<LatLngTuple>(DEFAULT_CENTER);

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blood_requests" },
        loadRequests
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const broadcast = async () => {
    if (!user || !coords?.lat || !coords?.lng) {
      toast.error("Location not ready yet");
      return;
    }

    setBusy(true);

    const { error } = await supabase.from("blood_requests").insert({
      requester_id: user.id,
      blood_type: bloodType,
      units_needed: units,
      hospital,
      lat: coords.lat,
      lng: coords.lng,
      urgency: "high",
    });

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
      .not("lat", "is", null)
      .not("lng", "is", null);

    const nearby = (donors ?? [])
      .map((d) => ({
        ...d,
        distance_km: haversineKm(coords.lat, coords.lng, d.lat, d.lng),
      }))
      .filter((d) => d.distance_km <= 5)
      .sort((a, b) => a.distance_km - b.distance_km);

    setMatchedDonors(nearby);

    if (nearby.length > 0) {
      await supabase.from("notifications").insert(
        nearby.map((d) => ({
          user_id: d.user_id,
          title: `🩸 Urgent: ${bloodType} blood needed`,
          body: `${units} units at ${hospital || "nearby hospital"} · ${d.distance_km.toFixed(
            1
          )} km away`,
          link: "/app/blood",
        }))
      );
    }

    setBusy(false);
    toast.success(`Broadcast sent to ${nearby.length} donors`);
    setHospital("");
    loadRequests();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      <div className="flex items-center gap-3">
        <Droplet className="h-6 w-6 text-red-500" />
        <div>
          <h1 className="text-2xl font-bold">Blood SOS System</h1>
          <p className="text-sm text-muted-foreground">
            Live donor matching within 5km
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* FORM */}
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">Request Blood</h3>

          <div>
            <Label>Blood Type</Label>
            <Select value={bloodType} onValueChange={setBloodType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOOD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Units</Label>
            <Input
              type="number"
              value={units}
              onChange={(e) => setUnits(Number(e.target.value))}
            />
          </div>

          <div>
            <Label>Hospital</Label>
            <Input
              value={hospital}
              onChange={(e) => setHospital(e.target.value)}
            />
          </div>

          <Button onClick={broadcast} disabled={busy || loading} className="w-full">
            {busy ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2" />}
            Broadcast SOS
          </Button>

          {loading && (
            <p className="text-xs text-muted-foreground">
              Getting location...
            </p>
          )}
        </Card>

        {/* MAP */}
        <Card className="overflow-hidden p-0">
          <div className="h-[350px] relative">

            {loading && (
              <div className="absolute z-50 top-2 left-2 bg-white px-3 py-1 text-xs rounded shadow">
                Fetching GPS...
              </div>
            )}

            <MapContainer center={center} zoom={13} className="h-full w-full">

              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              {/* user radius */}
              {coords?.lat && coords?.lng && (
                <Circle
                  center={[coords.lat, coords.lng]}
                  radius={5000}
                  pathOptions={{ color: "red", fillOpacity: 0.05 }}
                />
              )}

              <Marker position={center}>
                <Popup>You are here</Popup>
              </Marker>

              {matchedDonors.map((d) => (
                <Marker key={d.user_id} position={[d.lat, d.lng]}>
                  <Popup>
                    {d.full_name} ({d.blood_type}) <br />
                    {d.distance_km.toFixed(1)} km away
                  </Popup>
                </Marker>
              ))}

            </MapContainer>
          </div>
        </Card>

      </div>

      {/* REQUEST LIST */}
      <div className="grid md:grid-cols-2 gap-3">
        {requests.map((r) => {
          const dist = coords
            ? haversineKm(coords.lat, coords.lng, r.lat, r.lng)
            : null;

          return (
            <Card key={r.id} className="p-4">
              <div className="flex justify-between">
                <Badge>{r.blood_type}</Badge>
                {dist && (
                  <span className="text-xs text-muted-foreground">
                    <MapPin className="inline h-3 w-3" /> {dist.toFixed(1)} km
                  </span>
                )}
              </div>
              <p className="mt-2 font-semibold">{r.units_needed} units</p>
              <p className="text-xs text-muted-foreground">{r.hospital}</p>
            </Card>
          );
        })}
      </div>

    </div>
  );
};

export default BloodBank;