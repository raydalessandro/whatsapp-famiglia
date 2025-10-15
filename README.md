# 📱 WhatsApp Famiglia - Real-time Messaging App

Applicazione di messaggistica istantanea con Supabase e React.

## 🚀 Quick Start

### 1️⃣ Setup Supabase

1. Vai su https://supabase.com e crea un account
2. Crea un nuovo progetto:
   - Nome: `whatsapp-famiglia`
   - Password: scegli una password sicura
   - Region: `Europe West`
3. Aspetta 2 minuti che il progetto si crei

### 2️⃣ Esegui SQL Schema

1. Nel dashboard Supabase, vai in **SQL Editor**
2. Crea una nuova query
3. Copia e incolla il contenuto del file `supabase-schema.sql`
4. Clicca **Run** per creare le tabelle

### 3️⃣ Configura Storage

1. Vai in **Storage**
2. Crea un nuovo bucket chiamato `media`
3. Imposta come **Public**

### 4️⃣ Ottieni le Credenziali

1. Vai in **Settings** → **API**
2. Copia:
   - **Project URL**: `https://xxx.supabase.co`
   - **anon public key**: stringa lunga che inizia con `eyJ...`

### 5️⃣ Setup Locale

```bash
# Clona il repository
git clone <your-repo>
cd whatsapp-famiglia

# Installa dipendenze
npm install

# Crea file .env.local
cp .env.local.example .env.local

# Modifica .env.local con i tuoi valori Supabase
# VITE_SUPABASE_URL=https://xxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJ...

# Avvia in locale
npm run dev
```

Apri http://localhost:3000

### 6️⃣ Deploy su Vercel

1. Push su GitHub:
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. Vai su https://vercel.com
3. Clicca **New Project**
4. Importa il repository GitHub
5. Aggiungi le **Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Clicca **Deploy**

✅ App live in 2 minuti!

## ✨ Features

- ✅ Autenticazione con email/password
- ✅ Messaggistica real-time
- ✅ Invio foto/video/documenti
- ✅ Online/offline status
- ✅ Read receipts (✓✓)
- ✅ Emoji picker
- ✅ Mobile responsive
- ✅ Storage cloud sicuro

## 🔐 Sicurezza

- Crittografia durante il trasporto (HTTPS)
- Row Level Security (RLS) su Supabase
- Solo gli utenti autorizzati possono leggere i loro messaggi
- Storage pubblico solo per media (non dati sensibili)

## 📱 Test in Famiglia

1. Condividi il link Vercel con la famiglia
2. Ogni persona si registra con la propria email
3. Iniziate a chattare in real-time!

## 🛠️ Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Real-time + Storage)
- **Deploy**: Vercel
- **Auth**: Supabase Auth

## 📊 Limiti FREE

- ✅ 500MB database
- ✅ 1GB storage file
- ✅ 2GB bandwidth/mese
- ✅ Illimitati utenti attivi (50k/mese)

Perfetto per 5-10 persone in famiglia!

## 🐛 Troubleshooting

**Errore "Invalid API key"**
- Verifica di aver copiato correttamente `VITE_SUPABASE_ANON_KEY`
- Assicurati che inizi con `eyJ`

**Messaggi non arrivano in real-time**
- Verifica che Realtime sia abilitato su Supabase
- Controlla che le tabelle abbiano RLS configurato

**Upload file non funziona**
- Verifica che il bucket `media` sia **Public**
- Controlla che esista su Supabase Storage

## 📞 Support

Per problemi o domande, apri una issue su GitHub.

---

Made with ❤️ for family communication
