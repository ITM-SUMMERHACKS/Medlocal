import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScanLine, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ParsedDrug {
  drug: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
}

const ScanPrescription = () => {
  const { user } = useAuth();
  const nav = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<ParsedDrug[] | null>(null);
  const [rawText, setRawText] = useState<string>("");

  const onFile = (f: File) => {
    setFile(f);
    setParsed(null);
    setRawText("");

    const r = new FileReader();
    r.onload = () => setPreview(r.result as string);
    r.readAsDataURL(f);
  };

  // ✅ FAKE AI SCAN (WORKING)
  const scan = async () => {
    if (!preview) return;

    setBusy(true);

    await new Promise((res) => setTimeout(res, 1500));

    const fakeData = [
      {
        drug: "Paracetamol",
        dosage: "500mg",
        frequency: "Twice daily",
        duration: "5 days",
      },
      {
        drug: "Amoxicillin",
        dosage: "250mg",
        frequency: "Three times daily",
        duration: "7 days",
      },
    ];

    setParsed(fakeData);
    setRawText("Sample extracted prescription text");

    toast.success(`Extracted ${fakeData.length} medicines`);
    setBusy(false);
  };

  const save = async () => {
    if (!user || !parsed) return;

    setBusy(true);

    const { error } = await supabase.from("prescriptions").insert({
      patient_id: user.id,
      raw_text: rawText,
      parsed_drugs: parsed as any,
    });

    setBusy(false);

    if (error) return toast.error(error.message);

    toast.success("Prescription saved");
    nav("/app");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">
          Scan prescription
        </h1>
        <p className="text-sm text-muted-foreground">
          AI vision extracts medicines and shows best prices nearby.
        </p>
      </div>

      {/* Upload Card */}
      <Card className="p-6">
        <Label
          htmlFor="rxfile"
          className="mb-3 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer hover:bg-muted/30"
        >
          {preview ? (
            <img
              src={preview}
              alt="prescription"
              className="max-h-64 rounded-lg shadow-sm"
            />
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground" />
              <span className="font-medium">
                Click to upload prescription image
              </span>
              <span className="text-xs text-muted-foreground">
                JPG, PNG up to 5 MB
              </span>
            </>
          )}
        </Label>

        <Input
          id="rxfile"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) =>
            e.target.files?.[0] && onFile(e.target.files[0])
          }
        />

        <Button
          onClick={scan}
          disabled={!preview || busy}
          className="mt-4 w-full bg-gradient-primary"
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ScanLine className="mr-2 h-4 w-4" />
          )}
          Extract medicines with AI
        </Button>
      </Card>

      {/* Results */}
      {parsed && (
        <Card className="p-6">
          <h3 className="font-semibold">Detected medicines</h3>

          {parsed.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              No medicines detected. Try a clearer image.
            </p>
          )}

          <div className="mt-3 space-y-4">
            {parsed.map((d, i) => (
              <div
                key={i}
                className="rounded-lg border p-4 space-y-2"
              >
                <div className="font-medium text-lg">
                  {d.drug}
                </div>

                <div className="text-xs text-muted-foreground">
                  {[d.dosage, d.frequency, d.duration]
                    .filter(Boolean)
                    .join(" · ")}
                </div>

                {/* Pharmacy comparison */}
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>MedPlus</span>
                    <span className="font-medium">₹20</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Apollo Pharmacy</span>
                    <span className="font-medium">₹35</span>
                  </div>
                </div>

                <Button className="mt-2 w-full">
                  Buy Now
                </Button>
              </div>
            ))}
          </div>

          {parsed.length > 0 && (
            <Button
              onClick={save}
              disabled={busy}
              className="mt-4 w-full"
            >
              Save prescription
            </Button>
          )}
        </Card>
      )}
    </div>
  );
};

export default ScanPrescription;