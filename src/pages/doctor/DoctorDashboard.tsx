import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";

const DoctorDashboard = () => {
  const { user } = useAuth();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [appts, setAppts] = useState<any[]>([]);

  const load = async (did: string) => {
    const { data } = await supabase
      .from("appointments")
      .select("*, profiles:patient_id(full_name)")
      .eq("doctor_id", did)
      .order("scheduled_at", { ascending: true });
    setAppts(data ?? []);
  };

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: d } = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
      if (!d) {
        const { data: created } = await supabase
          .from("doctors")
          .insert({ user_id: user.id, specialty: "General Medicine", qualification: "MBBS", experience_years: 5, consultation_fee: 500, city: "Bangalore", lat: 12.97, lng: 77.59 })
          .select("id").single();
        if (created) { setDoctorId(created.id); await load(created.id); }
      } else {
        setDoctorId(d.id);
        await load(d.id);
      }
    })();
  }, [user?.id]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else toast.success(`Marked ${status}`);
    if (doctorId) load(doctorId);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold md:text-3xl">Appointments</h1>
      {appts.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No appointments yet.</Card>}
      {appts.map((a) => (
        <Card key={a.id} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{a.profiles?.full_name ?? "Patient"}</div>
              <div className="text-xs text-muted-foreground">{format(new Date(a.scheduled_at), "PPp")} · {a.mode}</div>
            </div>
            <Badge>{a.status}</Badge>
          </div>
          {a.status === "pending" && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => setStatus(a.id, "confirmed")}>Confirm</Button>
              <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "cancelled")}>Cancel</Button>
            </div>
          )}
          {a.status === "confirmed" && (
            <Button size="sm" className="mt-3" onClick={() => setStatus(a.id, "completed")}>Mark completed</Button>
          )}
        </Card>
      ))}
    </div>
  );
};

export default DoctorDashboard;
