import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stethoscope, Star, MapPin, Video, User, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const Doctors = () => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);

  // booking modal state
  const [open, setOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [mode, setMode] = useState<"in_person" | "video">("in_person");

  const [form, setForm] = useState({
    name: "",
    age: "",
    address: "",
    time: "",
  });

  useEffect(() => {
    // ❗ Keep if you have data, else you can dummy it later
    supabase.from("doctors").select("*").limit(20).then(({ data }) => {
      setDocs(data ?? []);
    });
  }, []);

  const openBooking = (d: any, m: "in_person" | "video") => {
    setSelectedDoctor(d);
    setMode(m);
    setOpen(true);
  };

  const confirmBooking = async () => {
    if (!user) return;

    if (!form.name || !form.age || !form.address || !form.time) {
      toast.error("Fill all details");
      return;
    }

    // fake payment simulation
    toast.loading("Processing payment...");

    await new Promise((res) => setTimeout(res, 1500));

    toast.dismiss();
    toast.success(`Appointment booked with Dr. ${selectedDoctor.specialty}`);

    setOpen(false);

    // optional: still insert in DB if you want
    await supabase.from("appointments").insert({
      patient_id: user.id,
      doctor_id: selectedDoctor.id,
      scheduled_at: new Date().toISOString(),
      mode,
      status: "confirmed",
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold md:text-3xl">Doctors</h1>

      {docs.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No doctors available (using demo flow).
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
                  <span className="font-semibold">
                    Dr. {d.specialty}
                  </span>
                  <Badge variant="secondary">
                    <Star className="mr-1 h-3 w-3 fill-yellow-500 text-yellow-500" />
                    {d.rating}
                  </Badge>
                </div>

                <div className="text-xs text-muted-foreground">
                  {d.qualification} · {d.experience_years}+ yrs
                </div>

                {d.city && (
                  <div className="mt-1 text-xs flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {d.city}
                  </div>
                )}

                <div className="mt-2 text-sm">
                  Fee: ₹{d.consultation_fee}
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openBooking(d, "in_person")}
                  >
                    <Stethoscope className="mr-1 h-3 w-3" />
                    In-person
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => openBooking(d, "video")}
                  >
                    <Video className="mr-1 h-3 w-3" />
                    Video
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 🔥 BOOKING MODAL */}
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 w-full max-w-md space-y-4 relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3"
            >
              <X />
            </button>

            <h2 className="text-lg font-semibold">
              Book Appointment
            </h2>

            <div>
              <Label>Patient Name</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Age</Label>
              <Input
                value={form.age}
                onChange={(e) =>
                  setForm({ ...form, age: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) =>
                  setForm({ ...form, address: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Preferred Time</Label>
              <Input
                type="time"
                value={form.time}
                onChange={(e) =>
                  setForm({ ...form, time: e.target.value })
                }
              />
            </div>

            <div className="text-sm">
              Booking Fee: ₹150 (Refundable if Doctors Not Avaliable)
            </div>

            <Button onClick={confirmBooking} className="w-full">
              Confirm & Pay ₹150
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Doctors;