import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScanLine, Upload, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ParsedDrug { drug: string; dosage?: string; frequency?: string; duration?: string; }

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

  const scan = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ocr-prescription", {
        body: { image: preview },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setParsed(data.drugs ?? []);
      setRawText(data.raw_text ?? "");
      toast.success(`Extracted ${data.drugs?.length ?? 0} medicines`);
    } catch (e: any) {
      toast.error(e.message ?? "OCR failed");
    } finally {
      setBusy(false);
    }
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
        <h1 className="text-2xl font-bold md:text-3xl">Scan prescription</h1>
        <p className="text-sm text-muted-foreground">
          AI vision extracts medicines and dosages automatically.
        </p>
      </div>

      <Card className="p-6">
        <Label htmlFor="rxfile" className="mb-3 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer hover:bg-muted/30">
          {preview ? (
            <img src={preview} alt="prescription" className="max-h-64 rounded-lg shadow-sm" />
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground" />
              <span className="font-medium">Click to upload prescription image</span>
              <span className="text-xs text-muted-foreground">JPG, PNG up to 5 MB</span>
            </>
          )}
        </Label>
        <Input
          id="rxfile"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <Button onClick={scan} disabled={!preview || busy} className="mt-4 w-full bg-gradient-primary">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
          Extract medicines with AI
        </Button>
      </Card>

      {parsed && (
        <Card className="p-6">
          <h3 className="font-semibold">Detected medicines</h3>
          {parsed.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No medicines detected. Try a clearer image.</p>}
          <div className="mt-3 space-y-2">
            {parsed.map((d, i) => (
              <div key={i} className="flex items-start justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium">{d.drug}</div>
                  <div className="text-xs text-muted-foreground">
                    {[d.dosage, d.frequency, d.duration].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <Badge variant="secondary"><Check className="mr-1 h-3 w-3" />OK</Badge>
              </div>
            ))}
          </div>
          {parsed.length > 0 && (
            <Button onClick={save} disabled={busy} className="mt-4 w-full">Save prescription</Button>
          )}
        </Card>
      )}
    </div>
  );
};

export default ScanPrescription;
