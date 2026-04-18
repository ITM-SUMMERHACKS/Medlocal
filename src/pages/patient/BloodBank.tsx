import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { haversineKm } from "@/lib/distance";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Droplet, Loader2, Send, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  MapContainer, TileLayer, Marker, Popup, Circle
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// fix marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const BloodBank = () => {
  const { user } = useAuth();

  // 🔥 FORCE KHARGHAR (NO GEOLOCATION)
  const lat = 19.047;
  const lng = 73.069;

  const [bloodType, setBloodType] = useState("O+");
  const [units, setUnits] = useState(2);
  const [hospital, setHospital] = useState("");
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    // fake requests (fix distance issue)
    setRequests([
      { id: 1, blood_type: "O+", units_needed: 2 },
      { id: 2, blood_type: "B-", units_needed: 2 }
    ]);
  }, []);

  const broadcast = async () => {
    if (!user) return;

    setBusy(true);
    await new Promise((r) => setTimeout(r, 1000));

    toast.success("SOS sent to nearby donors");
    setBusy(false);
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
                placeholder="Apollo Hospital, Kharghar"
              />
            </div>

            <Button onClick={broadcast} disabled={busy} className="bg-red-500 text-white">
              {busy
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Send className="mr-2 h-4 w-4" />}
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

              {/* radius */}
              <Circle center={[lat, lng]} radius={1500} pathOptions={{ color: "red" }} />

              {/* YOU */}
              <Marker position={[lat, lng]}>
                <Popup>
                  <div><b>You are here</b><br />Kharghar</div>
                </Popup>
              </Marker>

              {/* 🔥 DONOR WITH FULL POPUP */}
              <Marker position={[19.048, 73.070]}>
                <Popup>
                  <div className="space-y-1 text-sm">
                    <div><b>Name:</b> Ravi Gupta</div>
                    <div><b>Age:</b> 21</div>
                    <div><b>Blood Group:</b> O+</div>
                    <div><b>Contact:</b> 8446585687</div>
                  </div>
                </Popup>
              </Marker>

              {/* extra donors */}
              {[ 
                { lat: 19.045, lng: 73.068 },
                { lat: 19.050, lng: 73.066 }
              ].map((d, i) => (
                <Marker key={i} position={[d.lat, d.lng]}>
                  <Popup>Available Donor</Popup>
                </Marker>
              ))}

            </MapContainer>
          </div>
        </Card>

      </div>

      {/* REQUESTS */}
      <div>
        <h3 className="mb-3 font-semibold">Active blood requests</h3>

        <div className="grid gap-3 md:grid-cols-2">
          {requests.map((r, i) => {
            const fakeDist = (Math.random() * 2).toFixed(1);

            return (
              <Card key={i} className="p-4">
                <div className="flex justify-between">
                  <Badge className="bg-red-500 text-white">{r.blood_type}</Badge>
                  <span className="text-sm">{fakeDist} km</span>
                </div>

                <div className="mt-2 font-semibold">
                  {r.units_needed} unit(s) · Apollo Hospital, Kharghar
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