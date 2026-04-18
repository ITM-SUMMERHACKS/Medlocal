import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const pwSchema = z.string().min(6, "Min 6 characters").max(72);

const Auth = () => {
  const nav = useNavigate();
  const { user, role, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  // form state
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [chosenRole, setChosenRole] = useState<"patient" | "doctor" | "pharmacy">("patient");

  useEffect(() => {
    if (!loading && user && role) {
      const home =
        role === "doctor" ? "/doctor" : role === "pharmacy" ? "/pharmacy" : role === "admin" ? "/admin" : "/app";
      nav(home, { replace: true });
    }
  }, [user, role, loading, nav]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      pwSchema.parse(pw);
    } catch (err: any) {
      toast.error(err.issues?.[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      pwSchema.parse(pw);
    } catch (err: any) {
      toast.error(err.issues?.[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password: pw,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: name, role: chosenRole },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created!");
  };

  const quickDemo = async (presetEmail: string, presetPw: string) => {
    setEmail(presetEmail);
    setPw(presetPw);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: presetEmail, password: presetPw });
    setBusy(false);
    if (error) toast.error(`Demo account not found yet. Sign up with ${presetEmail}.`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-soft p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Heart className="h-7 w-7 text-primary-foreground" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Welcome to MedLocal</h1>
            <p className="text-sm text-muted-foreground">Compare. Order. Save lives.</p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-elevated">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4">
              <form onSubmit={handleSignIn} className="space-y-3">
                <div>
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="si-pw">Password</Label>
                  <Input id="si-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-gradient-primary">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-4">
              <form onSubmit={handleSignUp} className="space-y-3">
                <div>
                  <Label htmlFor="su-name">Full name</Label>
                  <Input id="su-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
                </div>
                <div>
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="su-pw">Password</Label>
                  <Input id="su-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} />
                </div>
                <div>
                  <Label>I am a</Label>
                  <Select value={chosenRole} onValueChange={(v) => setChosenRole(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="patient">Patient</SelectItem>
                      <SelectItem value="doctor">Doctor</SelectItem>
                      <SelectItem value="pharmacy">Pharmacy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-gradient-primary">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 border-t pt-4">
            <p className="mb-2 text-center text-xs uppercase tracking-wider text-muted-foreground">Demo accounts</p>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={() => quickDemo("patient@demo.com", "demo1234")}>Patient</Button>
              <Button variant="outline" size="sm" onClick={() => quickDemo("pharmacy@demo.com", "demo1234")}>Pharmacy</Button>
              <Button variant="outline" size="sm" onClick={() => quickDemo("doctor@demo.com", "demo1234")}>Doctor</Button>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Click a role to auto-fill, or sign up first with that email
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
