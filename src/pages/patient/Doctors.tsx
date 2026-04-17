import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Star, MapPin, Video, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const Doctors = () => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("doctors").select("*").limit(20).then(({ data }) => setDocs(data ?? []));
  }, []);

  const book = async (d: any, mode: "in_person" | "video") => {
    if (!user) return;
    const dt = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    const { error } = await supabase.from("appointments").insert({
      patient_id: user.id,
      doctor_id: d.id,
      scheduled_at: dt.toISOString(),
      mode,
      status: "pending",
    });
    if (error) toast.error(error.message);
    else toast.success(`Booked ${mode.replace("_", " ")} consult with ${d.specialty}`);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold md:text-3xl">Doctors</h1>
      {docs.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No doctors registered yet. Doctors can sign up from the auth page.
        </Card>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {docs.map((d) => (
          <Card key={d.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Dr. {d.specialty}</span>
                  <Badge variant="secondary"><Star className="mr-1 h-3 w-3 fill-warning text-warning" />{d.rating}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {d.qualification} · {d.experience_years}+ yrs
                </div>
                {d.city && <div className="mt-1 text-xs flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{d.city}</div>}
                <div className="mt-2 text-sm">Fee: ₹{d.consultation_fee}</div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => book(d, "in_person")}><Stethoscope className="mr-1 h-3 w-3" />In-person</Button>
                  <Button size="sm" onClick={() => book(d, "video")}><Video className="mr-1 h-3 w-3" />Video</Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Doctors;
