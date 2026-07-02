-- Create medical_records table
CREATE TABLE public.medical_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('blood_test', 'prescription', 'imaging', 'bill', 'discharge_summary')),
  title TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  doctor TEXT NOT NULL DEFAULT 'Unknown',
  hospital TEXT NOT NULL DEFAULT 'Unknown',
  status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'attention', 'critical')),
  extracted_data JSONB,
  file_name TEXT NOT NULL,
  file_path TEXT,
  amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to medical_records" ON public.medical_records FOR ALL USING (true) WITH CHECK (true);

-- Create ML training datasets table
CREATE TABLE public.ml_training_datasets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL,
  features JSONB NOT NULL DEFAULT '{}',
  labels JSONB NOT NULL DEFAULT '{}',
  model_type TEXT NOT NULL DEFAULT 'health_risk',
  confidence_score NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ml_training_datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to ml_training_datasets" ON public.ml_training_datasets FOR ALL USING (true) WITH CHECK (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_medical_records_updated_at
  BEFORE UPDATE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for uploaded reports
INSERT INTO storage.buckets (id, name, public) VALUES ('medical-reports', 'medical-reports', true);

CREATE POLICY "Anyone can upload medical reports" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'medical-reports');
CREATE POLICY "Anyone can view medical reports" ON storage.objects FOR SELECT USING (bucket_id = 'medical-reports');
CREATE POLICY "Anyone can delete medical reports" ON storage.objects FOR DELETE USING (bucket_id = 'medical-reports');