-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ====== ROLES ======
CREATE TYPE public.app_role AS ENUM ('patient', 'doctor', 'pharmacy', 'admin');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  blood_type TEXT,                -- A+, O-, etc.
  is_blood_donor BOOLEAN DEFAULT false,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- security definer to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1 $$;

-- ====== TIMESTAMP FUNCTION ======
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ====== PROFILES TRIGGER ON SIGNUP ======
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role app_role;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone');

  _role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'patient');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- profile policies
CREATE POLICY "Profiles viewable by owner or admin" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_roles policies (read-only for self; only admins can write)
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ====== DOCTORS ======
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  specialty TEXT NOT NULL,
  qualification TEXT,
  experience_years INT DEFAULT 0,
  consultation_fee NUMERIC(10,2) DEFAULT 0,
  rating NUMERIC(2,1) DEFAULT 4.5,
  bio TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doctors public read" ON public.doctors FOR SELECT USING (true);
CREATE POLICY "Doctor manages own profile" ON public.doctors
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_doctors_updated BEFORE UPDATE ON public.doctors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== PHARMACIES ======
CREATE TABLE public.pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  phone TEXT,
  rating NUMERIC(2,1) DEFAULT 4.5,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  open_24h BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pharmacies public read" ON public.pharmacies FOR SELECT USING (true);
CREATE POLICY "Pharmacy manages own profile" ON public.pharmacies
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage pharmacies" ON public.pharmacies
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_pharmacies_updated BEFORE UPDATE ON public.pharmacies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== MEDS ======
CREATE TABLE public.meds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  generic_name TEXT,
  manufacturer TEXT,
  category TEXT,
  description TEXT,
  prescription_required BOOLEAN DEFAULT false,
  mrp NUMERIC(10,2) DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Meds public read" ON public.meds FOR SELECT USING (true);
CREATE POLICY "Admins manage meds" ON public.meds
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_meds_name_trgm ON public.meds USING GIN (name gin_trgm_ops);
CREATE INDEX idx_meds_generic_trgm ON public.meds USING GIN (generic_name gin_trgm_ops);

-- ====== PHARMACY_INVENTORY ======
CREATE TABLE public.pharmacy_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  med_id UUID NOT NULL REFERENCES public.meds(id) ON DELETE CASCADE,
  price NUMERIC(10,2) NOT NULL,
  stock_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pharmacy_id, med_id)
);
ALTER TABLE public.pharmacy_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Inventory public read" ON public.pharmacy_inventory FOR SELECT USING (true);
CREATE POLICY "Pharmacy manages own inventory" ON public.pharmacy_inventory
  FOR ALL USING (EXISTS (SELECT 1 FROM public.pharmacies p WHERE p.id = pharmacy_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pharmacies p WHERE p.id = pharmacy_id AND p.user_id = auth.uid()));
CREATE POLICY "Admins manage inventory" ON public.pharmacy_inventory
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_inv_updated BEFORE UPDATE ON public.pharmacy_inventory
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== PRESCRIPTIONS (encrypted text) ======
CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  qr_code TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  encrypted_text BYTEA,           -- encrypted via pgcrypto on insert by edge fn
  raw_text TEXT,                  -- fallback for demo (still RLS protected)
  parsed_drugs JSONB DEFAULT '[]'::jsonb,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patient sees own prescriptions" ON public.prescriptions
  FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "Patient creates own prescriptions" ON public.prescriptions
  FOR INSERT WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Doctor sees prescriptions they wrote" ON public.prescriptions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid()));
CREATE POLICY "Pharmacy can scan via QR (any auth)" ON public.prescriptions
  FOR SELECT USING (public.has_role(auth.uid(), 'pharmacy'));

-- ====== APPOINTMENTS ======
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|confirmed|completed|cancelled
  mode TEXT NOT NULL DEFAULT 'in_person', -- in_person|video
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patient sees own appointments" ON public.appointments
  FOR ALL USING (auth.uid() = patient_id) WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Doctor sees their appointments" ON public.appointments
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid()));
CREATE POLICY "Doctor updates their appointments" ON public.appointments
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid()));
CREATE TRIGGER trg_appt_updated BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== ORDERS ======
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL REFERENCES public.pharmacies(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|confirmed|packed|dispatched|delivered|cancelled
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'held',  -- held|released|refunded (mock escrow)
  delivery_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patient sees own orders" ON public.orders
  FOR ALL USING (auth.uid() = patient_id) WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Pharmacy sees its orders" ON public.orders
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.pharmacies p WHERE p.id = pharmacy_id AND p.user_id = auth.uid()));
CREATE POLICY "Pharmacy updates its orders" ON public.orders
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.pharmacies p WHERE p.id = pharmacy_id AND p.user_id = auth.uid()));
CREATE POLICY "Admins see all orders" ON public.orders
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  med_id UUID NOT NULL REFERENCES public.meds(id),
  med_name TEXT NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order items via order access" ON public.order_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id AND (
      o.patient_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.pharmacies p WHERE p.id = o.pharmacy_id AND p.user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    )
  ));
CREATE POLICY "Patient inserts items in own orders" ON public.order_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.patient_id = auth.uid()));

-- ====== BLOOD REQUESTS / DONORS ======
CREATE TABLE public.blood_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blood_type TEXT NOT NULL,
  units_needed INT DEFAULT 1,
  hospital TEXT,
  urgency TEXT DEFAULT 'high', -- high|medium|low
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'open', -- open|matched|fulfilled|closed
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed sees open blood requests" ON public.blood_requests
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users create own blood requests" ON public.blood_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Requester updates own request" ON public.blood_requests
  FOR UPDATE USING (auth.uid() = requester_id);

CREATE TABLE public.blood_request_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  donor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending|accepted|declined
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(request_id, donor_id)
);
ALTER TABLE public.blood_request_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Donor sees & manages own responses" ON public.blood_request_responses
  FOR ALL USING (auth.uid() = donor_id) WITH CHECK (auth.uid() = donor_id);
CREATE POLICY "Requester sees responses to their requests" ON public.blood_request_responses
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.blood_requests r WHERE r.id = request_id AND r.requester_id = auth.uid()));

-- ====== SEARCH LOGS ======
CREATE TABLE public.search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  results_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed inserts logs" ON public.search_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins read logs" ON public.search_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Pharmacy reads logs" ON public.search_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'pharmacy'));

-- ====== NOTIFICATIONS ======
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ====== HAVERSINE ======
CREATE OR REPLACE FUNCTION public.haversine_km(lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION, lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION)
RETURNS DOUBLE PRECISION LANGUAGE SQL IMMUTABLE AS $$
  SELECT 6371 * acos(
    least(1, greatest(-1,
      cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1)) +
      sin(radians(lat1)) * sin(radians(lat2))
    ))
  )
$$;

-- ====== SEED MEDS ======
INSERT INTO public.meds (name, generic_name, manufacturer, category, prescription_required, mrp) VALUES
('Atorvastatin 10mg', 'Atorvastatin', 'Sun Pharma', 'Cardiac', true, 120.00),
('Metformin 500mg', 'Metformin HCl', 'Cipla', 'Diabetes', true, 45.00),
('Amoxicillin 500mg', 'Amoxicillin', 'GSK', 'Antibiotic', true, 80.00),
('Paracetamol 650mg', 'Paracetamol', 'Micro Labs', 'Painkiller', false, 25.00),
('Aspirin 75mg', 'Aspirin', 'USV', 'Cardiac', false, 30.00),
('Omeprazole 20mg', 'Omeprazole', 'Dr. Reddy''s', 'Antacid', false, 60.00),
('Cetirizine 10mg', 'Cetirizine', 'Cipla', 'Antihistamine', false, 35.00),
('Azithromycin 500mg', 'Azithromycin', 'Pfizer', 'Antibiotic', true, 150.00),
('Ibuprofen 400mg', 'Ibuprofen', 'Abbott', 'Painkiller', false, 40.00),
('Losartan 50mg', 'Losartan Potassium', 'Lupin', 'Hypertension', true, 95.00),
('Vitamin D3 60K', 'Cholecalciferol', 'Mankind', 'Supplement', false, 55.00),
('Pantoprazole 40mg', 'Pantoprazole', 'Sun Pharma', 'Antacid', true, 75.00);