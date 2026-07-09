import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/AuthContext';
import { getErrorMessage } from '@/lib/errorUtils';

const CONFIRM_PHRASE = 'DELETE MY ACCOUNT';

export default function DeleteAccount() {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { confirm: confirmText },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Account deleted', description: 'All your data has been permanently removed.' });
      await signOut();
    } catch (error: unknown) {
      toast({
        title: 'Could not delete account',
        description: getErrorMessage(error, 'Please try again, or contact support if this keeps happening.'),
        variant: 'destructive',
      });
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
      <p className="font-medium text-sm text-destructive">Delete account</p>
      <p className="text-sm text-muted-foreground">
        Permanently delete your account and all associated data - medical records, uploaded files,
        and ML predictions. This cannot be undone.
      </p>

      <AlertDialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setConfirmText(''); }}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete my account and all data
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your account, medical records, uploaded files, and ML data.
              There is no way to recover this. Type <span className="font-mono font-semibold">{CONFIRM_PHRASE}</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="delete-confirm" className="sr-only">
              Confirmation phrase
            </Label>
            <Input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText !== CONFIRM_PHRASE || deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Permanently delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
