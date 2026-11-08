# Google OAuth setup

The application code uses Supabase Auth with the PKCE callback route:

```text
https://YOUR_APP_DOMAIN/auth/callback?next=/mon-equipe
```

Do not put the Google client secret in this repository, `.env.local`, or any `NEXT_PUBLIC_` variable. Store it only in Supabase Auth.

## 1. Set the application URL

In the deployment environment add:

```env
APP_URL=https://YOUR_APP_DOMAIN
```

For local development use:

```env
APP_URL=http://localhost:3000
```

`APP_URL` is used to build trusted callback URLs. It must exactly match the public origin without a trailing slash.

## 2. Configure Supabase redirect URLs

In **Supabase Dashboard → Authentication → URL Configuration**:

- Set **Site URL** to `https://YOUR_APP_DOMAIN`.
- Add `https://YOUR_APP_DOMAIN/auth/callback` to **Redirect URLs**.
- For local development add `http://localhost:3000/auth/callback`.

## 3. Create Google credentials

In **Google Cloud Console → Google Auth Platform → Clients** create an **OAuth client ID** of type **Web application**.

Add these values:

- **Authorized JavaScript origins:** `https://YOUR_APP_DOMAIN` and, for local work, `http://localhost:3000`.
- **Authorized redirect URI:** copy the callback URL shown in **Supabase Dashboard → Authentication → Providers → Google**. It normally has this form:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

This is the Supabase callback, not the MARKETFOOT `/auth/callback` route.

## 4. Enable Google in Supabase

In **Supabase Dashboard → Authentication → Providers → Google**:

1. Enable Google.
2. Paste the Google **Client ID**.
3. Paste the Google **Client Secret**.
4. Save.

## 5. Verify

Open `/connexion`, select **Continuer avec Google**, complete consent, and confirm you return to MARKETFOOT. First-time Google users are shown the required pseudo step before team creation.

Useful official references: [Supabase Google sign-in guide](https://supabase.com/docs/guides/auth/social-login/auth-google) and [Supabase redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls).
