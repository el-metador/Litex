import { useStore } from '@nanostores/react';
import { useState } from 'react';
import { authStore } from '~/lib/stores/auth';
import { getSupabaseClient } from '~/lib/supabase/client';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';

export function AuthControls() {
  const auth = useStore(authStore);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (auth.status === 'loading') {
    return <div className="text-xs text-bolt-elements-textTertiary">Auth…</div>;
  }

  if (auth.status === 'authenticated') {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden md:inline text-xs text-bolt-elements-textSecondary truncate max-w-[180px]">{auth.email}</span>
        <button
          className="rounded-md border border-bolt-elements-borderColor px-2.5 py-1.5 text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2"
          onClick={() => {
            const supabase = getSupabaseClient();

            if (!supabase) {
              return;
            }

            void supabase.auth.signOut();
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        className="rounded-md border border-bolt-elements-borderColor px-2.5 py-1.5 text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2"
        onClick={() => {
          setStatus(null);
          setOpen(true);
        }}
      >
        Sign in
      </button>
      <DialogRoot open={open} onOpenChange={setOpen}>
        <Dialog onBackdrop={() => setOpen(false)} onClose={() => setOpen(false)}>
          <DialogTitle>Sign in via magic link</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3">
              <p>Enter your email and we will send a one-time sign-in link.</p>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none"
              />
              {status ? <p className="text-xs text-bolt-elements-textSecondary">{status}</p> : null}
            </div>
          </DialogDescription>
          <div className="px-5 pb-4 bg-bolt-elements-background-depth-2 flex gap-2 justify-end">
            <DialogButton type="secondary" onClick={() => setOpen(false)}>
              Cancel
            </DialogButton>
            <DialogButton
              type="primary"
              onClick={() => {
                if (pending) {
                  return;
                }

                const supabase = getSupabaseClient();

                if (!supabase) {
                  setStatus('Supabase config is missing.');
                  return;
                }

                const normalizedEmail = email.trim().toLowerCase();

                if (!normalizedEmail) {
                  setStatus('Enter a valid email.');
                  return;
                }

                setPending(true);
                setStatus(null);

                void supabase.auth
                  .signInWithOtp({
                    email: normalizedEmail,
                    options: {
                      emailRedirectTo: window.location.origin,
                    },
                  })
                  .then(({ error }) => {
                    if (error) {
                      setStatus(error.message);
                      return;
                    }

                    setStatus('Magic link sent. Check your email.');
                  })
                  .finally(() => {
                    setPending(false);
                  });
              }}
            >
              {pending ? 'Sending…' : 'Send magic link'}
            </DialogButton>
          </div>
        </Dialog>
      </DialogRoot>
    </>
  );
}
