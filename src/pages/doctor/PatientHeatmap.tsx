import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const PatientHeatmap = () => {
  const { user } = useAuth();
  const [points, setPoints] = useState<{ lat: number; lng: number; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: d } = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
      if (!d) return;
      const { data: appts } = await supabase
        .from("appointments")
        .select("patient_id")
        .eq("doctor_id", d.id);
      const ids = Array.from(new Set((appts ?? []).map((a: any) => a.patient_id)));
      if (ids.length === 0) {
        // demo: scatter around Bangalore
        setPoints(Array.from({ length: 25 }).map(() => ({
          lat: 12.97 + (Math.random() - 0.5) * 0.12,
          lng: 77.59 + (Math.random() - 0.5) * 0.14,
          count: 1 + Math.floor(Math.random() * 6),
        })));
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("lat, lng")
        .in("user_id", ids)
        .not("lat", "is", null);
      const grid: Record<string, { lat: number; lng: number; count: number }> = {};
      (profs ?? []).forEach((p: any) => {
        const key = `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`;
        if (!grid[key]) grid[key] = { lat: p.lat, lng: p.lng, count: 0 };
        grid[key].count++;
      });
      setPoints(Object.values(grid));
    })();
  }, [user?.id]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Patient density heatmap</h1>
        <p className="text-sm text-muted-foreground">Larger circles = more patients in that area.</p>
      </div>
      <Card className="overflow-hidden p-0">
        <div className="h-[60vh]">
          <MapContainer center={[12.97, 77.59]} zoom={11} className="h-full w-full">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
            {points.map((p, i) => (
              <CircleMarker
                key={i}
                center={[p.lat, p.lng]}
                radius={6 + p.count * 4}
                pathOptions={{ color: "hsl(175 70% 38%)", fillColor: "hsl(175 70% 38%)", fillOpacity: 0.4 }}
              />
            ))}
          </MapContainer>
        </div>
      </Card>
    </div>
  );
};

export default PatientHeatmap;
