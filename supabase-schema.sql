-- ============================================================================
-- WHATSAPP FAMIGLIA - SUPABASE DATABASE SCHEMA
-- ============================================================================
-- Esegui questo script nel SQL Editor di Supabase
-- ============================================================================

-- 1. Crea tabella PROFILES (estende auth.users)
-- ============================================================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Gli utenti possono vedere tutti i profili
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Policy: Gli utenti possono aggiornare solo il proprio profilo
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger: Crea automaticamente un profilo quando un utente si registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. Crea tabella MESSAGES
-- ============================================================================
CREATE TABLE public.messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'document', 'audio')),
  media_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indici per performance
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_receiver ON public.messages(receiver_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_messages_conversation ON public.messages(sender_id, receiver_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policy: Gli utenti possono vedere solo i messaggi inviati o ricevuti da loro
CREATE POLICY "Users can view own messages"
  ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Policy: Gli utenti possono inserire messaggi come sender
CREATE POLICY "Users can insert own messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Policy: Gli utenti possono aggiornare (es. marcare come letto) solo i messaggi ricevuti
CREATE POLICY "Users can update received messages"
  ON public.messages FOR UPDATE
  USING (auth.uid() = receiver_id);

-- ============================================================================
-- 3. Enable Realtime per la tabella messages
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============================================================================
-- 4. Crea funzione per ottenere conversazioni recenti
-- ============================================================================
CREATE OR REPLACE FUNCTION get_recent_conversations(user_id UUID)
RETURNS TABLE (
  other_user_id UUID,
  other_user_name TEXT,
  other_user_avatar TEXT,
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  unread_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH latest_messages AS (
    SELECT DISTINCT ON (
      CASE 
        WHEN sender_id = user_id THEN receiver_id 
        ELSE sender_id 
      END
    )
      CASE 
        WHEN sender_id = user_id THEN receiver_id 
        ELSE sender_id 
      END as contact_id,
      content as last_msg,
      created_at as last_time
    FROM public.messages
    WHERE sender_id = user_id OR receiver_id = user_id
    ORDER BY 
      CASE 
        WHEN sender_id = user_id THEN receiver_id 
        ELSE sender_id 
      END,
      created_at DESC
  )
  SELECT 
    p.id,
    p.display_name,
    p.avatar_url,
    lm.last_msg,
    lm.last_time,
    COUNT(m.id) FILTER (WHERE m.receiver_id = user_id AND m.read_at IS NULL) as unread_count
  FROM latest_messages lm
  JOIN public.profiles p ON p.id = lm.contact_id
  LEFT JOIN public.messages m ON (
    (m.sender_id = lm.contact_id AND m.receiver_id = user_id) OR
    (m.sender_id = user_id AND m.receiver_id = lm.contact_id)
  )
  GROUP BY p.id, p.display_name, p.avatar_url, lm.last_msg, lm.last_time
  ORDER BY lm.last_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Crea Storage Bucket per media files
-- ============================================================================
-- NOTA: Questo deve essere fatto manualmente nell'interfaccia Supabase
-- Vai su Storage → Create a new bucket → Nome: "media" → Public: true

-- ============================================================================
-- 6. Insert dati di test (opzionale)
-- ============================================================================
-- Questi dati saranno creati automaticamente quando gli utenti si registrano
-- Ma puoi decommentare per creare utenti di test:

/*
-- Crea utente di test 1
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'authenticated',
  'authenticated',
  'test1@famiglia.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '{"display_name": "Mario Rossi"}'::jsonb,
  NOW(),
  NOW()
);

-- Crea utente di test 2
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'authenticated',
  'authenticated',
  'test2@famiglia.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '{"display_name": "Laura Bianchi"}'::jsonb,
  NOW(),
  NOW()
);
*/

-- ============================================================================
-- SETUP COMPLETATO!
-- ============================================================================
-- Ora puoi:
-- 1. Configurare il bucket "media" come Public in Storage
-- 2. Copiare URL e ANON_KEY nel file .env.local
-- 3. Avviare l'app con npm run dev
-- ============================================================================
