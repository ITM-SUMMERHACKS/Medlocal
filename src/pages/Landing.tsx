import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart, Search, Droplet, ScanLine, MapPin, Stethoscope } from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-soft">
      <header className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Heart className="h-5 w-5 text-primary-foreground" fill="currentColor" />
          </div>
          <span className="text-lg font-bold">MedLocal</span>
        </div>
        <Link to="/auth">
          <Button variant="ghost" size="sm">Sign in</Button>
        </Link>
      </header>

      <section className="container px-4 pt-12 pb-20 text-center md:pt-24">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Healthcare marketplace for India
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Save up to <span className="text-primary">40%</span> on medicines.
            <br />
            Find blood donors in <span className="text-blood">minutes</span>.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            Compare real-time prices across nearby pharmacies, scan prescriptions with AI,
            and connect emergency blood requests with verified donors.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-primary shadow-glow">
                Get started — it's free
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline">
                I'm a pharmacy / doctor
              </Button>
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-4 md:grid-cols-3">
          {[
            { icon: Search, t: "Compare instantly", d: "Fuzzy search across thousands of meds, sorted by price + distance." },
            { icon: ScanLine, t: "AI prescription OCR", d: "Snap a doctor's note. AI extracts drugs, dosages, frequency." },
            { icon: Droplet, t: "Blood donor SOS", d: "Broadcast emergency requests to matched donors within 5 km." },
            { icon: MapPin, t: "Live pharmacy map", d: "See real stock at pharmacies near you, in real time." },
            { icon: Stethoscope, t: "Doctor consults", d: "Book in-person or video appointments with specialists." },
            { icon: Heart, t: "Trusted & secure", d: "Encrypted prescriptions, role-based access, RLS-protected data." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border bg-card p-6 text-left shadow-sm transition-base hover:shadow-elevated">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t bg-card/50 py-6 text-center text-xs text-muted-foreground">
        © MedLocal — built for the healthcare hackathon
      </footer>
    </div>
  );
};

export default Landing;
